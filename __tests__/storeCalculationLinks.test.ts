jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(), deleteDatabaseAsync: jest.fn() }));
jest.mock('../src/services/SubscriptionService', () => ({ SubscriptionService: { checkStatus: jest.fn() } }));
jest.mock('../src/services/InvoiceService', () => ({ InvoiceService: { deletePDF: jest.fn(async () => true) } }));

import { useAppStore } from '../src/store/useAppStore';
import { createLocalBackup, parseLocalBackup } from '../src/lib/localBackup';
import type { CalculationRecord, Client, Invoice } from '../src/store/useAppStore';

const contact = (id: string): Client => ({ id, name: id, email: '', phone: '', address: '', company: '', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01', synced: false });
const calculation: CalculationRecord = { id: 'calc1', clientId: 'c1', type: 'drainFall', inputs: { length: 40 }, result: { message: '10 in' }, createdAt: '2026-01-01', synced: false };
const worksheet: Invoice = { id: 'w1', clientId: 'c1', invoiceNumber: 'JOB-1', date: '2026-01-01', dueDate: '2026-01-02', lineItems: [], subtotal: 0, taxRate: 0, taxAmount: 0, total: 0, paymentTerms: '', notes: '', status: 'draft', createdAt: '2026-01-01', updatedAt: '2026-01-01', synced: false, calculationIds: ['calc1'] };

beforeEach(() => useAppStore.setState({ clients: [contact('c1'), contact('c2')], invoices: [{ ...worksheet }], calculations: [{ ...calculation }] }));

test('deleting saved history removes worksheet calculation references', () => {
  useAppStore.getState().deleteCalculation('calc1');
  expect(useAppStore.getState().invoices[0].calculationIds).toEqual([]);
  expect(() => parseLocalBackup(createLocalBackup(useAppStore.getState()))).not.toThrow();
});

test('reassigning history removes references from its former contact worksheet', () => {
  useAppStore.getState().assignCalculationToClient('calc1', 'c2');
  expect(useAppStore.getState().calculations[0].clientId).toBe('c2');
  expect(useAppStore.getState().invoices[0].calculationIds).toEqual([]);
  expect(() => parseLocalBackup(createLocalBackup(useAppStore.getState()))).not.toThrow();
});

test('rejects assignment to a missing contact', () => {
  useAppStore.getState().assignCalculationToClient('calc1', 'missing');
  expect(useAppStore.getState().calculations[0].clientId).toBe('c1');
  expect(useAppStore.getState().invoices[0].calculationIds).toEqual(['calc1']);
});
