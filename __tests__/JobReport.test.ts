import { generateInvoiceHTML } from '../src/services/InvoiceService';
import type { CalculationRecord, CompanySettings, Invoice } from '../src/store/useAppStore';

const company: CompanySettings = { name: 'Sample Co', address: '', city: '', state: '', zip: '', phone: '', email: '', taxRate: 0, paymentTerms: '' };
const invoice: Invoice = { id: 'w1', clientId: 'c1', invoiceNumber: 'JOB-1', date: '2026-01-01', dueDate: '2026-01-02', lineItems: [{ id: 'i1', description: 'Install <valve>', quantity: 2, unitPrice: 0, total: 0 }], subtotal: 0, taxRate: 0, taxAmount: 0, total: 0, paymentTerms: '', notes: 'Site & safety', status: 'draft', createdAt: '2026-01-01', updatedAt: '2026-01-01', synced: false };
const calc: CalculationRecord = { id: 'calc1', clientId: 'c1', type: 'drainFall', inputs: { length: 40, slope: '1/4' }, result: { message: 'Required fall ≈ 10 in', fields: [{ label: 'Fall', value: '10', unit: 'in' }], details: ['Run × slope'] }, createdAt: '2026-01-01', synced: false };

test('complete report includes selected calculation inputs and result with escaped field notes', () => {
  const html = generateInvoiceHTML(invoice, company, 'Sample Contact', [calc], true);
  expect(html).toContain('JOB REPORT');
  expect(html).toContain('Install &lt;valve&gt;');
  expect(html).toContain('Site &amp; safety');
  expect(html).toContain('length: 40');
  expect(html).toContain('Required fall ≈ 10 in');
  expect(html).toContain('Quantity: 2');
});

test('free worksheet does not include saved calculations', () => {
  const html = generateInvoiceHTML(invoice, company, 'Sample Contact');
  expect(html).toContain('JOB WORKSHEET');
  expect(html).not.toContain('Saved calculations');
});
