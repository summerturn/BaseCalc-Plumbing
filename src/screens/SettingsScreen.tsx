import { type ComponentProps, useState } from 'react';
import { Alert, Pressable, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { createLocalBackup, parseLocalBackup, MAX_BACKUP_BYTES } from '../lib/localBackup';
import { useAppTheme, useColors } from '../theme/useAppTheme';
import type { ThemeMode } from '../theme/appTheme';
import { Body, Label, Mono, Small } from '../components/Type';
import {
  CONTROL_GAP,
  Field,
  ListScreenHeader,
  ListScreenScrollView,
  Panel,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SECTION_GAP,
  useBottomClearance,
  withAlpha,
} from '../components/ui';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const THEME_CHOICES: { value: ThemeMode; label: string; icon: IconName }[] = [
  { value: 'system', label: 'Auto', icon: 'brightness-auto' },
  { value: 'light', label: 'Light', icon: 'light-mode' },
  { value: 'dark', label: 'Dark', icon: 'dark-mode' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: SECTION_GAP }}>
      <Label style={{ marginBottom: 10 }}>{title}</Label>
      {children}
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { company, updateCompany, isPro, deleteAllLocalData } = useAppStore();
  const { themeMode, setThemeMode } = useAppTheme();
  const c = useColors();
  const { width } = useWindowDimensions();
  const bottomClearance = useBottomClearance();
  const [form, setForm] = useState({ ...company });
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const stackLocationFields = width < 360;

  const handleSave = () => {
    updateCompany(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const confirmDeleteAllData = () => {
    Alert.alert(
      'Delete all local data?',
      'This permanently removes clients, job worksheets, calculation history, company details, and generated PDFs from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all data',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            void deleteAllLocalData()
              .then((complete) => {
                setForm({ ...useAppStore.getState().company });
                Alert.alert(
                  complete ? 'Local data deleted' : 'Data cleared with a cleanup warning',
                  complete
                    ? 'BaseCalc Plumbing local records and generated files were removed from this device.'
                    : 'App records were cleared, but one or more generated files or legacy storage items could not be removed. Check device storage before transferring the device.'
                );
              })
              .finally(() => setDeleting(false));
          },
        },
      ]
    );
  };

  const exportBackup = async () => {
    if (transferring) return;
    setTransferring(true);
    try {
      const state = useAppStore.getState();
      const json = createLocalBackup(state);
      const file = new File(Paths.cache, `basecalc-plumbing-backup-${new Date().toISOString().slice(0, 10)}.json`);
      file.create({ overwrite: true });
      file.write(json);
      if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save BaseCalc Plumbing backup' });
    } catch (error) {
      Alert.alert('Backup failed', error instanceof Error ? error.message : 'Could not export the backup.');
    } finally { setTransferring(false); }
  };

  const restoreBackup = async () => {
    if (transferring) return;
    setTransferring(true);
    let confirmationShown = false;
    let decisionMade = false;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      if (asset.size && asset.size > MAX_BACKUP_BYTES) throw new Error('Backup is too large for this app.');
      const records = parseLocalBackup(await new File(asset.uri).text());
      Alert.alert(
        'Replace local records?',
        `This will replace this device's ${useAppStore.getState().clients.length} contacts, worksheets, calculations, templates, and company details with ${records.clients.length} contacts, ${records.invoices.length} worksheets, and ${records.calculations.length} calculations from the backup. Your Pro access stays tied to the app store.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { decisionMade = true; setTransferring(false); } },
          { text: 'Replace records', style: 'destructive', onPress: async () => {
            decisionMade = true;
            try {
              await useAppStore.getState().restoreLocalRecords(records);
              setForm({ ...records.company });
              Alert.alert('Restore complete', 'Local records were restored. Refresh Pro access from the store if needed.');
            } catch {
              Alert.alert('Restore failed', 'Local records could not be replaced. Please try again.');
            } finally {
              setTransferring(false);
            }
          } },
        ],
        { cancelable: true, onDismiss: () => { if (!decisionMade) setTransferring(false); } }
      );
      confirmationShown = true;
    } catch (error) {
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Could not read the backup. Nothing was restored.');
    } finally { if (!confirmationShown) setTransferring(false); }
  };

  return (
    <Screen>
      <ListScreenScrollView bottomPadding={bottomClearance}>
        <ListScreenHeader title="Settings" />

        <Section title="Plan">
          <Panel>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 14 }}>
                <Body tone="primary">{isPro ? 'Pro plan' : 'Free plan'}</Body>
                <Small tone="muted" style={{ marginTop: 4 }}>
                  {isPro ? 'All calculators and local workflow limits are unlocked on this device.' : 'Upgrade to unlock every calculator and remove local workflow limits.'}
                </Small>
              </View>
              <MaterialIcons name={isPro ? 'workspace-premium' : 'person-outline'} size={24} color={isPro ? c.amber : c.textMuted} />
            </View>
            {!isPro ? (
              <PrimaryButton label="Go Pro" icon="workspace-premium" onPress={() => navigation.navigate('Paywall')} style={{ marginTop: 14 }} />
            ) : null}
          </Panel>
        </Section>

        <Section title="Appearance">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {THEME_CHOICES.map((opt) => {
              const active = themeMode === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setThemeMode(opt.value)}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    backgroundColor: active ? c.amberSoft : c.panel,
                    borderColor: active ? withAlpha(c.amberBright, 0.5) : c.border,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <MaterialIcons name={opt.icon} size={24} color={active ? c.amber : c.textMuted} />
                  <Label tone={active ? 'amber' : 'muted'} style={{ marginTop: 9 }}>{opt.label}</Label>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Company (on job worksheets)">
          <Panel>
            <Field label="Company name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="My Plumbing Co." />
            <Field label="Address" value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} placeholder="123 Main St" />
            <Field label="City" value={form.city} onChangeText={(t) => setForm({ ...form, city: t })} />
            <View style={{ flexDirection: stackLocationFields ? 'column' : 'row', gap: CONTROL_GAP }}>
              <Field label="State" value={form.state} onChangeText={(t) => setForm({ ...form, state: t })} maxLength={2} autoCapitalize="characters" style={{ flex: 1, marginBottom: 0 }} />
              <Field label="ZIP" value={form.zip} onChangeText={(t) => setForm({ ...form, zip: t })} keyboardType="numeric" style={{ flex: stackLocationFields ? undefined : 1.4, marginBottom: 0 }} />
            </View>
            <Field label="Phone" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} keyboardType="phone-pad" placeholder="(555) 123-4567" />
            <Field label="Email" value={form.email} onChangeText={(t) => setForm({ ...form, email: t })} keyboardType="email-address" autoCapitalize="none" placeholder="office@myplumbing.co" />
          </Panel>
        </Section>

        <PrimaryButton label={saved ? 'Saved ✓' : 'Save settings'} icon={saved ? undefined : 'save'} onPress={handleSave} />

        <Section title="Local data">
          <Panel style={{ marginTop: SECTION_GAP, marginBottom: 12 }}>
            <Body tone="primary">Backup and device transfer</Body>
            <Small tone="muted" style={{ marginTop: 5, marginBottom: 14 }}>
              Save a local JSON backup through your device share sheet. Restore replaces this device's records after confirmation. Pro access and generated PDF files are excluded.
            </Small>
            <SecondaryButton label={transferring ? 'Working…' : 'Export backup'} icon="ios-share" onPress={() => { void exportBackup(); }} disabled={transferring} />
            <View style={{ marginTop: 10 }}><SecondaryButton label="Restore backup" icon="file-open" onPress={() => { void restoreBackup(); }} disabled={transferring} /></View>
          </Panel>
          <Panel style={{ marginTop: SECTION_GAP }}>
            <Body tone="primary">Delete data on this device</Body>
            <Small tone="muted" style={{ marginTop: 5, marginBottom: 14 }}>
              Removes app records, company details, calculation history, generated worksheets, legacy app storage, and the legacy local database. Purchase records remain with the app store and subscription provider.
            </Small>
            <View style={{ flexDirection: 'row' }}>
              <SecondaryButton
                label={deleting ? 'Deleting…' : 'Delete all local data'}
                icon="delete-forever"
                tint={c.fail}
                onPress={deleting || transferring ? () => {} : confirmDeleteAllData}
              />
            </View>
          </Panel>
        </Section>

        <Small style={{ textAlign: 'center', marginTop: 18 }}>BaseCalc Plumbing v1.0 · Plumbing field reference</Small>
        <Small tone="muted" style={{ textAlign: 'center', marginTop: 10 }}>
          App records stay on this device and are not synced to a BaseCalc account. Android app backup is disabled. Device or computer backups managed by the operating system may retain an older copy, so delete local data before making a backup or transferring the device.
        </Small>
      </ListScreenScrollView>
    </Screen>
  );
}
