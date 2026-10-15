import type { AppState, CalculationRecord, Client, CompanySettings, Invoice, JobTemplate } from '../store/useAppStore';

export type LocalRecords = Pick<AppState, 'clients' | 'invoices' | 'calculations' | 'company' | 'jobTemplates'>;
const FORMAT = 'basecalc-plumbing-local-backup';
const VERSION = 1;
export const MAX_BACKUP_BYTES = 10_000_000;

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const point = value.codePointAt(index);
    if (point === undefined) break;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (point > 0xffff) index += 1;
    if (bytes > MAX_BACKUP_BYTES) return bytes;
  }
  return bytes;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function string(value: unknown): value is string { return typeof value === 'string'; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function textFields(value: Record<string, unknown>, keys: string[]): boolean { return keys.every((key) => string(value[key])); }
function uniqueIds(items: { id: string }[]): boolean { return new Set(items.map((item) => item.id)).size === items.length; }
function client(value: unknown): value is Client {
  return record(value) && textFields(value, ['id', 'name', 'email', 'phone', 'address', 'company', 'notes', 'createdAt', 'updatedAt']) && typeof value.synced === 'boolean';
}
function lineItem(value: unknown): boolean {
  return record(value) && textFields(value, ['id', 'description']) && finite(value.quantity) && value.quantity >= 0 && finite(value.unitPrice) && finite(value.total) && (value.fromCalculation === undefined || typeof value.fromCalculation === 'boolean') && (value.calculationType === undefined || string(value.calculationType));
}
function invoice(value: unknown): value is Invoice {
  return record(value) && textFields(value, ['id', 'clientId', 'invoiceNumber', 'date', 'dueDate', 'paymentTerms', 'notes', 'createdAt', 'updatedAt']) && Array.isArray(value.lineItems) && value.lineItems.every(lineItem) && (value.calculationIds === undefined || (Array.isArray(value.calculationIds) && value.calculationIds.every(string))) && ['draft', 'sent', 'paid', 'overdue'].includes(String(value.status)) && ['subtotal', 'taxRate', 'taxAmount', 'total'].every((key) => finite(value[key])) && typeof value.synced === 'boolean';
}
function calculation(value: unknown): value is CalculationRecord {
  return record(value) && textFields(value, ['id', 'type', 'createdAt']) && (value.clientId === undefined || string(value.clientId)) && record(value.inputs) && record(value.result) && typeof value.synced === 'boolean';
}
function template(value: unknown): value is JobTemplate {
  return record(value) && textFields(value, ['id', 'name', 'notes', 'createdAt']) && Array.isArray(value.lineItems) && value.lineItems.every((item: unknown) => record(item) && string(item.description) && finite(item.quantity) && item.quantity >= 0);
}
function company(value: unknown): value is CompanySettings {
  return record(value) && textFields(value, ['name', 'address', 'city', 'state', 'zip', 'phone', 'email', 'paymentTerms']) && finite(value.taxRate) && (value.logo === undefined || string(value.logo));
}

export function createLocalBackup(state: LocalRecords): string {
  const records: LocalRecords = {
    clients: state.clients,
    invoices: state.invoices.map(({ pdfPath: _pdfPath, reportPdfPath: _reportPdfPath, ...item }) => item),
    calculations: state.calculations,
    company: state.company,
    jobTemplates: state.jobTemplates,
  };
  const json = JSON.stringify({ format: FORMAT, schemaVersion: VERSION, exportedAt: new Date().toISOString(), records });
  if (utf8Bytes(json) > MAX_BACKUP_BYTES) throw new Error('Backup is too large to transfer through this app.');
  return json;
}

export function parseLocalBackup(json: string): LocalRecords {
  if (utf8Bytes(json) > MAX_BACKUP_BYTES) throw new Error('Backup is too large for this app.');
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('This file is not valid JSON.'); }
  if (!record(parsed) || parsed.format !== FORMAT || parsed.schemaVersion !== VERSION || !record(parsed.records)) {
    throw new Error('This is not a supported BaseCalc Plumbing backup.');
  }
  const data = parsed.records;
  if (!Array.isArray(data.clients) || !data.clients.every(client) || !uniqueIds(data.clients) ||
      !Array.isArray(data.invoices) || !data.invoices.every(invoice) || !uniqueIds(data.invoices) ||
      !Array.isArray(data.calculations) || !data.calculations.every(calculation) || !uniqueIds(data.calculations) ||
      !Array.isArray(data.jobTemplates) || !data.jobTemplates.every(template) || !uniqueIds(data.jobTemplates) ||
      !company(data.company)) {
    throw new Error('Backup records are incomplete or damaged. Nothing was restored.');
  }
  const clientIds = new Set(data.clients.map((item) => item.id));
  const calculationsById = new Map(data.calculations.map((item) => [item.id, item]));
  const brokenReferences = data.calculations.some((item) => item.clientId !== undefined && !clientIds.has(item.clientId)) ||
    data.invoices.some((item) => {
      if (!clientIds.has(item.clientId)) return true;
      const ids = item.calculationIds ?? [];
      return new Set(ids).size !== ids.length || ids.some((id) => calculationsById.get(id)?.clientId !== item.clientId);
    });
  if (brokenReferences) throw new Error('Backup contains broken job contact or calculation links. Nothing was restored.');
  return {
    clients: data.clients.map((item) => ({ ...item, synced: false })),
    invoices: data.invoices.map(({ pdfPath: _pdfPath, reportPdfPath: _reportPdfPath, ...item }) => ({ ...item, synced: false })),
    calculations: data.calculations.map((item) => ({ ...item, synced: false })),
    jobTemplates: data.jobTemplates,
    company: data.company,
  };
}
