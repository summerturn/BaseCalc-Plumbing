import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { DEFAULT_THEME_MODE, ThemeMode } from '../theme/appTheme';
import { isRevenueCatConfigured } from '../lib/config';
import { canCreateClientForPlan, canCreateInvoiceForPlan } from '../lib/accessControl';
import { InvoiceService } from '../services/InvoiceService';
import { SubscriptionService } from '../services/SubscriptionService';

// ─── Types ───────────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  fromCalculation?: boolean;
  calculationType?: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentTerms: string;
  notes: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  pdfPath?: string;
}

export interface CalculationRecord {
  id: string;
  clientId?: string;
  type:
    | 'pipeVelocity'
    | 'flowRate'
    | 'pipeSizing'
    | 'pressureDrop'
    | 'drainageSizing'
    | 'ventSizing'
    | 'waterHeater'
    | 'gasPipeSizing'
    | 'pumpHead'
    | 'pipeVolume'
    | 'waterPressure'
    | 'pipeExpansion'
    | 'fixtureUnits'
    | 'waterMeterSizing'
    | 'irrigationFlow'
    | 'septicTank'
    | 'greaseInterceptor'
    | 'backflowPressure';
  inputs: object;
  result: object;
  createdAt: string;
  synced: boolean;
}

export interface CompanySettings {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  logo?: string;
  taxRate: number;
  paymentTerms: string;
}

export interface PendingDeletes {
  clients: string[];
  invoices: string[];
  calculations: string[];
}

export interface AppState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  // Clients
  clients: Client[];
  canAddClient: () => boolean;
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'synced'>) => boolean;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClientById: (id: string) => Client | undefined;
  getClientJobs: (clientId: string) => (Invoice | CalculationRecord)[];

  // Invoices
  invoices: Invoice[];
  canAddInvoice: () => boolean;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'synced'>) => boolean;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  getInvoiceById: (id: string) => Invoice | undefined;
  getInvoicesByClient: (clientId: string) => Invoice[];
  generateInvoiceNumber: () => string;

  // Calculations
  calculations: CalculationRecord[];
  addCalculation: (calc: Omit<CalculationRecord, 'id' | 'createdAt' | 'synced'>) => void;
  deleteCalculation: (id: string) => void;

  // Company
  company: CompanySettings;
  updateCompany: (updates: Partial<CompanySettings>) => void;

  // Offline/Sync
  isOnline: boolean;
  pendingDeletes: PendingDeletes;
  setOnline: (online: boolean) => void;
  sync: () => Promise<void>;
  pendingSyncCount: () => number;
  deleteAllLocalData: () => Promise<boolean>;

  // RevenueCat
  isPro: boolean;
  proLastVerifiedAt: number | null;
  setPro: (pro: boolean) => void;
  refreshProStatus: () => Promise<void>;
}

const PRO_OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migratePersistedState(persistedState: unknown): unknown {
  if (!persistedState || typeof persistedState !== 'object') {
    return persistedState;
  }

  const state = persistedState as Record<string, unknown>;
  const verifiedAt = typeof state.proLastVerifiedAt === 'number' && Number.isFinite(state.proLastVerifiedAt)
    ? state.proLastVerifiedAt
    : null;
  const verificationAge = verifiedAt === null ? Number.POSITIVE_INFINITY : Date.now() - verifiedAt;
  const migrated: Record<string, unknown> = {
    ...state,
    clients: Array.isArray(state.clients) ? state.clients.filter(isRecord) : [],
    invoices: Array.isArray(state.invoices)
      ? state.invoices.filter((invoice) => isRecord(invoice) && Array.isArray(invoice.lineItems))
      : [],
    calculations: Array.isArray(state.calculations) ? state.calculations.filter(isRecord) : [],
    themeMode: state.themeMode === 'light' || state.themeMode === 'dark' ? state.themeMode : DEFAULT_THEME_MODE,
    isPro: state.isPro === true && verificationAge >= 0 && verificationAge <= PRO_OFFLINE_GRACE_MS,
    proLastVerifiedAt: verifiedAt,
  };
  if (!isRecord(state.company)) delete migrated.company;
  return migrated;
}

// ─── SQLite Setup (for offline persistence) ──────────────────────────

const APP_STORAGE_NAME = 'basecalc-plumbing-storage';
const LEGACY_STORAGE_NAMES = ['nexduit-storage', 'tradecalc-storage', 'watthawk-storage', 'sparkcalc-storage'] as const;
const DATABASE_NAME = 'tradecalc.db';

export const DEFAULT_COMPANY_SETTINGS: Readonly<CompanySettings> = {
  name: 'My Plumbing Company',
  address: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
  email: '',
  taxRate: 0,
  paymentTerms: 'Create the final invoice in SpeakSheet.',
};

function defaultCompanySettings(): CompanySettings {
  return { ...DEFAULT_COMPANY_SETTINGS };
}

const appStorage = {
  getItem: async (name: string) => {
    const value = await AsyncStorage.getItem(name);
    if (value !== null || name !== APP_STORAGE_NAME) return value;

    for (const legacyStorageName of LEGACY_STORAGE_NAMES) {
      const legacyValue = await AsyncStorage.getItem(legacyStorageName);
      if (legacyValue === null) continue;
      await AsyncStorage.setItem(APP_STORAGE_NAME, legacyValue);
      for (const staleStorageName of LEGACY_STORAGE_NAMES) {
        await AsyncStorage.removeItem(staleStorageName);
      }
      return legacyValue;
    }
    return null;
  },
  setItem: (name: string, value: string) => AsyncStorage.setItem(name, value),
  removeItem: async (name: string) => {
    await AsyncStorage.removeItem(name);
    if (name === APP_STORAGE_NAME) {
      for (const legacyStorageName of LEGACY_STORAGE_NAMES) {
        await AsyncStorage.removeItem(legacyStorageName);
      }
    }
  },
};

let db: SQLite.SQLiteDatabase | null = null;
let proStatusGeneration = 0;

async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  // Keep the existing on-device database filename so existing installs retain their data.
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      company TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      clientId TEXT,
      invoiceNumber TEXT,
      date TEXT,
      dueDate TEXT,
      lineItems TEXT,
      subtotal REAL,
      taxRate REAL,
      taxAmount REAL,
      total REAL,
      paymentTerms TEXT,
      notes TEXT,
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      synced INTEGER DEFAULT 0,
      pdfPath TEXT
    );

    CREATE TABLE IF NOT EXISTS calculations (
      id TEXT PRIMARY KEY,
      clientId TEXT,
      type TEXT,
      inputs TEXT,
      result TEXT,
      createdAt TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      phone TEXT,
      email TEXT,
      logo TEXT,
      taxRate REAL DEFAULT 8.25,
      paymentTerms TEXT DEFAULT 'Create the final invoice in SpeakSheet.'
    );
  `);

  // Insert default company settings if not exists
  await db.runAsync(
    `INSERT OR IGNORE INTO company_settings (id, name, taxRate, paymentTerms) VALUES (1, 'My Plumbing Company', 0, 'Create the final invoice in SpeakSheet.')`
  );

  return db;
}

// ─── Zustand Store ───────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ─── Initial State ───
      clients: [],
      invoices: [],
      calculations: [],
      company: defaultCompanySettings(),
      themeMode: DEFAULT_THEME_MODE,
      isOnline: true,
      pendingDeletes: emptyPendingDeletes(),
      isPro: false,
      proLastVerifiedAt: null,

      setThemeMode: (mode) => set({ themeMode: mode }),

      // ─── Client Actions ───
      canAddClient: () => canCreateClientForPlan(get().isPro, get().clients.length),

      addClient: (clientData) => {
        if (!get().canAddClient()) return false;
        const client: Client = {
          ...clientData,
          id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: false,
        };
        set((state) => ({ clients: [...state.clients, client] }));
        void get().sync();
        return true;
      },

      updateClient: (id, updates) => {
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id
              ? { ...c, ...updates, updatedAt: new Date().toISOString(), synced: false }
              : c
          ),
        }));
        void get().sync();
      },

      deleteClient: (id) => {
        const state = get();
        const invoiceIds = state.invoices.filter((i) => i.clientId === id).map((i) => i.id);
        const calculationIds = state.calculations.filter((c) => c.clientId === id).map((c) => c.id);
        const pdfPaths = state.invoices
          .filter((invoice) => invoice.clientId === id)
          .map((invoice) => invoice.pdfPath)
          .filter((path): path is string => Boolean(path));

        set((state) => ({
          clients: state.clients.filter((c) => c.id !== id),
          invoices: state.invoices.filter((i) => i.clientId !== id),
          calculations: state.calculations.filter((c) => c.clientId !== id),
          pendingDeletes: mergePendingDeletes(state.pendingDeletes, {
            clients: [id],
            invoices: invoiceIds,
            calculations: calculationIds,
          }),
        }));
        pdfPaths.forEach((path) => void InvoiceService.deletePDF(path));
        void get().sync();
      },

      getClientById: (id) => {
        return get().clients.find((c) => c.id === id);
      },

      getClientJobs: (clientId) => {
        const invoices = get().invoices.filter((i) => i.clientId === clientId);
        const calcs = get().calculations.filter((c) => c.clientId === clientId);
        return [...invoices, ...calcs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },

      // ─── Invoice Actions ───
      canAddInvoice: () => {
        const activeInvoiceCount = get().invoices.filter((invoice) => invoice.status !== 'paid').length;
        return canCreateInvoiceForPlan(get().isPro, activeInvoiceCount);
      },

      addInvoice: (invoiceData) => {
        if (!get().canAddInvoice()) return false;
        const invoice: Invoice = {
          ...invoiceData,
          id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: false,
        };
        set((state) => ({ invoices: [...state.invoices, invoice] }));
        void get().sync();
        return true;
      },

      updateInvoice: (id, updates) => {
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === id
              ? { ...i, ...updates, updatedAt: new Date().toISOString(), synced: false }
              : i
          ),
        }));
        void get().sync();
      },

      deleteInvoice: (id) => {
        const pdfPath = get().invoices.find((invoice) => invoice.id === id)?.pdfPath;
        set((state) => ({
          invoices: state.invoices.filter((i) => i.id !== id),
          pendingDeletes: mergePendingDeletes(state.pendingDeletes, { invoices: [id] }),
        }));
        if (pdfPath) void InvoiceService.deletePDF(pdfPath);
        void get().sync();
      },

      getInvoiceById: (id) => {
        return get().invoices.find((i) => i.id === id);
      },

      getInvoicesByClient: (clientId) => {
        return get().invoices
          .filter((i) => i.clientId === clientId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      generateInvoiceNumber: () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const period = `${year}${month}`;
        const usedNumbers = new Set(get().invoices.map((invoice) => invoice.invoiceNumber));
        let nextSequence = get().invoices.reduce((max, invoice) => {
          const match = invoice.invoiceNumber.match(new RegExp(`^(?:JOB|INV)-${period}-(\\d+)$`));
          if (!match) return max;
          const sequence = Number(match[1]);
          return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
        }, 0) + 1;
        let candidate = `JOB-${period}-${String(nextSequence).padStart(4, '0')}`;
        while (usedNumbers.has(candidate)) {
          nextSequence += 1;
          candidate = `JOB-${period}-${String(nextSequence).padStart(4, '0')}`;
        }
        return candidate;
      },

      // ─── Calculation Actions ───
      addCalculation: (calcData) => {
        const calc: CalculationRecord = {
          ...calcData,
          id: `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          synced: false,
        };
        set((state) => ({ calculations: [...state.calculations, calc] }));
        void get().sync();
      },

      deleteCalculation: (id) => {
        set((state) => ({
          calculations: state.calculations.filter((c) => c.id !== id),
          pendingDeletes: mergePendingDeletes(state.pendingDeletes, { calculations: [id] }),
        }));
        void get().sync();
      },

      // ─── Company Actions ───
      updateCompany: (updates) => {
        set((state) => ({
          company: { ...state.company, ...updates },
        }));
        void get().sync();
      },

      // ─── Offline/Sync Actions ───
      setOnline: (online) => {
        set({ isOnline: online });
        if (online) {
          void get().sync();
        }
      },

      sync: async () => {
        // BaseCalc Plumbing is intentionally device-local. Keep this no-op so existing write
        // paths can remain simple while cloud sync is removed from the build.
      },

      pendingSyncCount: () => {
        return 0;
      },

      deleteAllLocalData: async () => {
        const pdfPaths = get().invoices
          .map((invoice) => invoice.pdfPath)
          .filter((path): path is string => Boolean(path));
        let complete = true;

        const pdfResults = await Promise.all(pdfPaths.map((path) => InvoiceService.deletePDF(path)));
        if (pdfResults.some((deleted) => !deleted)) complete = false;

        try {
          if (db) {
            await db.closeAsync();
            db = null;
          }
          await SQLite.deleteDatabaseAsync(DATABASE_NAME);
        } catch (error) {
          complete = false;
          console.error('[Privacy] Legacy database cleanup failed:', error);
        }

        try {
          await appStorage.removeItem(APP_STORAGE_NAME);
        } catch (error) {
          complete = false;
          console.error('[Privacy] Local storage cleanup failed:', error);
        }

        set({
          clients: [],
          invoices: [],
          calculations: [],
          company: defaultCompanySettings(),
          pendingDeletes: emptyPendingDeletes(),
        });
        return complete;
      },

      // ─── RevenueCat ───
      setPro: (pro) => {
        proStatusGeneration += 1;
        set({ isPro: pro, proLastVerifiedAt: Date.now() });
      },

      refreshProStatus: async () => {
        const generation = ++proStatusGeneration;
        if (!isRevenueCatConfigured()) {
          if (generation === proStatusGeneration) set({ isPro: false, proLastVerifiedAt: Date.now() });
          return;
        }

        try {
          const isPro = await SubscriptionService.checkStatus({ forceRefresh: true });
          if (generation === proStatusGeneration) set({ isPro, proLastVerifiedAt: Date.now() });
        } catch (error) {
          const state = get();
          const age = state.proLastVerifiedAt === null
            ? Number.POSITIVE_INFINITY
            : Date.now() - state.proLastVerifiedAt;
          if (generation === proStatusGeneration && !(state.isPro && age >= 0 && age <= PRO_OFFLINE_GRACE_MS)) {
            set({ isPro: false });
          }
          console.error('[RevenueCat] entitlement refresh failed:', error);
        }
      },
    }),
    {
      name: APP_STORAGE_NAME,
      version: 3,
      storage: createJSONStorage(() => appStorage),
      migrate: migratePersistedState,
      partialize: (state) => ({
        clients: state.clients,
        invoices: state.invoices,
        calculations: state.calculations,
        themeMode: state.themeMode,
        company: state.company,
        isPro: state.isPro,
        proLastVerifiedAt: state.proLastVerifiedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) void state.refreshProStatus();
      },
    }
  )
);

// ─── Sync merge helpers ──────────────────────────────────────────────

function emptyPendingDeletes(): PendingDeletes {
  return { clients: [], invoices: [], calculations: [] };
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function mergePendingDeletes(current: PendingDeletes, next: Partial<PendingDeletes>): PendingDeletes {
  const existing = current ?? emptyPendingDeletes();
  return {
    clients: uniqueIds([...existing.clients, ...(next.clients ?? [])]),
    invoices: uniqueIds([...existing.invoices, ...(next.invoices ?? [])]),
    calculations: uniqueIds([...existing.calculations, ...(next.calculations ?? [])]),
  };
}
