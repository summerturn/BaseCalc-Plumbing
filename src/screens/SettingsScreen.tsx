import { type ComponentProps, useState } from 'react';
import { Alert, Pressable, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
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
                onPress={deleting ? () => {} : confirmDeleteAllData}
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
