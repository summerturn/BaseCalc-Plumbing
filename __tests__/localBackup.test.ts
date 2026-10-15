import { createLocalBackup, parseLocalBackup, type LocalRecords } from '../src/lib/localBackup';

const records: LocalRecords = {
  clients: [{ id: 'c1', name: 'Sample Contact', email: '', phone: '', address: '', company: '', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01', synced: true }],
  invoices: [{ id: 'w1', clientId: 'c1', invoiceNumber: 'JOB-1', date: '2026-01-01', dueDate: '2026-01-02', lineItems: [], subtotal: 0, taxRate: 0, taxAmount: 0, total: 0, paymentTerms: '', notes: '', status: 'draft', createdAt: '2026-01-01', updatedAt: '2026-01-01', synced: true, pdfPath: 'file:///old-device.pdf', reportPdfPath: 'file:///old-report.pdf', calculationIds: ['calc1'] }],
  calculations: [{ id: 'calc1', clientId: 'c1', type: 'drainFall', inputs: { length: 40 }, result: { message: '10 in' }, createdAt: '2026-01-01', synced: true }],
  company: { name: 'Sample Co', address: '', city: '', state: '', zip: '', phone: '', email: '', taxRate: 0, paymentTerms: '' },
  jobTemplates: [{ id: 't1', name: 'Sample', lineItems: [{ description: 'Inspect', quantity: 1 }], notes: '', createdAt: '2026-01-01' }],
};

test('exports portable records without entitlement or device PDF path', () => {
  const json = createLocalBackup(records);
  expect(json).not.toContain('pdfPath');
  expect(json).not.toContain('reportPdfPath');
  expect(json).not.toContain('isPro');
  const restored = parseLocalBackup(json);
  expect(restored.invoices[0].pdfPath).toBeUndefined();
  expect(restored.invoices[0].calculationIds).toEqual(['calc1']);
  expect(restored.clients[0].synced).toBe(false);
});

test('rejects a damaged backup before replacing data', () => {
  expect(() => parseLocalBackup('{')).toThrow('valid JSON');
  expect(() => parseLocalBackup(JSON.stringify({ format: 'other', schemaVersion: 1, records }))).toThrow('supported');
  const damaged = JSON.parse(createLocalBackup(records));
  damaged.records.invoices[0].lineItems = 'wrong';
  expect(() => parseLocalBackup(JSON.stringify(damaged))).toThrow('damaged');
});

test('rejects missing worksheet contacts and calculation links', () => {
  const missingContact = JSON.parse(createLocalBackup(records));
  missingContact.records.invoices[0].clientId = 'missing';
  expect(() => parseLocalBackup(JSON.stringify(missingContact))).toThrow('broken job contact');

  const missingCalculation = JSON.parse(createLocalBackup(records));
  missingCalculation.records.invoices[0].calculationIds = ['missing'];
  expect(() => parseLocalBackup(JSON.stringify(missingCalculation))).toThrow('broken job contact');

  const duplicateCalculation = JSON.parse(createLocalBackup(records));
  duplicateCalculation.records.invoices[0].calculationIds = ['calc1', 'calc1'];
  expect(() => parseLocalBackup(JSON.stringify(duplicateCalculation))).toThrow('broken job contact');
});

test('rejects calculations assigned to a missing or different contact', () => {
  const missingContact = JSON.parse(createLocalBackup(records));
  missingContact.records.calculations[0].clientId = 'missing';
  expect(() => parseLocalBackup(JSON.stringify(missingContact))).toThrow('broken job contact');

  const wrongContact = JSON.parse(createLocalBackup(records));
  wrongContact.records.clients.push({ ...records.clients[0], id: 'c2' });
  wrongContact.records.calculations[0].clientId = 'c2';
  expect(() => parseLocalBackup(JSON.stringify(wrongContact))).toThrow('broken job contact');
});

test('export rejects a multibyte backup larger than restore can accept', () => {
  const oversized: LocalRecords = { ...records, company: { ...records.company, name: 'é'.repeat(5_000_000) } };
  expect(() => createLocalBackup(oversized)).toThrow('too large');
});
