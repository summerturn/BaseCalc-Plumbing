jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(), deleteDatabaseAsync: jest.fn() }));
jest.mock('../src/services/SubscriptionService', () => ({ SubscriptionService: { checkStatus: jest.fn() } }));
jest.mock('../src/services/InvoiceService', () => ({ InvoiceService: { deletePDF: jest.fn(async () => true) } }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../src/store/useAppStore';
import type { Client } from '../src/store/useAppStore';

const storage = jest.mocked(AsyncStorage);
const contact = (id: string): Client => ({ id, name: id, email: '', phone: '', address: '', company: '', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01', synced: false });

beforeAll(async () => { await useAppStore.persist.rehydrate(); });

test('restore waits for an older delayed Zustand save before writing restored records', async () => {
  storage.setItem.mockClear();
  let releaseOldWrite: (() => void) | undefined;
  storage.setItem.mockImplementationOnce(() => new Promise<void>((resolve) => { releaseOldWrite = resolve; }));
  storage.setItem.mockImplementation(() => Promise.resolve());

  useAppStore.setState({ clients: [contact('old')] });
  await Promise.resolve();
  expect(storage.setItem).toHaveBeenCalledTimes(1);

  const restored = { clients: [contact('new')], invoices: [], calculations: [], jobTemplates: [], company: useAppStore.getState().company };
  const restoring = useAppStore.getState().restoreLocalRecords(restored);
  await Promise.resolve();
  expect(storage.setItem).toHaveBeenCalledTimes(1);

  releaseOldWrite?.();
  await restoring;
  await useAppStore.persist.rehydrate();
  const payloads = storage.setItem.mock.calls.map(([, value]) => JSON.parse(value) as { state: { clients: Client[] } });
  expect(payloads[0].state.clients[0].id).toBe('old');
  expect(payloads.slice(1).every((payload) => payload.state.clients[0].id === 'new')).toBe(true);
  expect(useAppStore.getState().clients[0].id).toBe('new');
});

test('failed restore write leaves current records unchanged', async () => {
  storage.setItem.mockClear();
  storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
  const before = useAppStore.getState().clients;
  const restored = { clients: [contact('replacement')], invoices: [], calculations: [], jobTemplates: [], company: useAppStore.getState().company };
  await expect(useAppStore.getState().restoreLocalRecords(restored)).rejects.toThrow('storage unavailable');
  expect(useAppStore.getState().clients).toBe(before);
});
