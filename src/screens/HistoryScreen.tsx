import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { CATEGORY } from '../theme/appTheme';
import { useColors } from '../theme/useAppTheme';
import { Body, H2, Label, Mono } from '../components/Type';
import {
  ACTION_RAIL_WIDTH,
  EmptyState,
  LIST_CARD_GAP,
  ListScreenHeader,
  ListScreenScrollView,
  Panel,
  Screen,
  useBottomClearance,
} from '../components/ui';
import { FooterAdBanner } from '../components/AdBanner';

const typeLabels: Record<string, string> = {
  pipeVelocity: 'Pipe Velocity',
  flowRate: 'Flow Rate',
  pipeSizing: 'Pipe Sizing',
  pressureDrop: 'Pressure Drop',
  drainageSizing: 'Drainage Sizing',
  ventSizing: 'Vent Sizing',
  waterHeater: 'Water Heater',
  gasPipeSizing: 'Gas Pipe Sizing',
  pumpHead: 'Pump Head',
  pipeVolume: 'Pipe Volume',
  waterPressure: 'Water Pressure',
  pipeExpansion: 'Pipe Expansion',
  fixtureUnits: 'Fixture Units',
  waterMeterSizing: 'Water Meter Sizing',
  irrigationFlow: 'Irrigation Flow',
  septicTank: 'Septic Tank',
  greaseInterceptor: 'Grease Interceptor',
  backflowPressure: 'Backflow Pressure',
};

const typeColors: Record<string, string> = {
  pipeVelocity: CATEGORY.water,
  flowRate: CATEGORY.water,
  pipeSizing: CATEGORY.water,
  pressureDrop: CATEGORY.pressure,
  drainageSizing: CATEGORY.drainage,
  ventSizing: CATEGORY.drainage,
  waterHeater: CATEGORY.heating,
  gasPipeSizing: CATEGORY.gas,
  pumpHead: CATEGORY.pressure,
  pipeVolume: CATEGORY.water,
  waterPressure: CATEGORY.pressure,
  pipeExpansion: CATEGORY.general,
  fixtureUnits: CATEGORY.fixtures,
  waterMeterSizing: CATEGORY.water,
  irrigationFlow: CATEGORY.irrigation,
  septicTank: CATEGORY.drainage,
  greaseInterceptor: CATEGORY.drainage,
  backflowPressure: CATEGORY.pressure,
};

export function HistoryScreen() {
  const { calculations, deleteCalculation } = useAppStore();
  const c = useColors();
  const bottomClearance = useBottomClearance();

  const items = [...calculations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Screen>
      <ListScreenScrollView bottomPadding={bottomClearance}>
        <ListScreenHeader title="History" subtitle="Saved calculations on this device." />

        {items.length === 0 ? (
          <EmptyState icon="history" title="No history yet" subtitle="Run a calculation to keep a job-site record here." />
        ) : (
          items.map((item) => {
            const color = typeColors[item.type] ?? c.amber;
            return (
              <Panel key={item.id} style={{ marginBottom: LIST_CARD_GAP }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 9, height: 9, borderRadius: 9, backgroundColor: color, marginTop: 7 }} />
                  <View style={{ flex: 1 }}>
                    <H2 style={{ fontSize: 17 }} numberOfLines={1}>{typeLabels[item.type] || item.type}</H2>
                    <Mono tone="muted" style={{ fontSize: 11.5, marginTop: 3 }} numberOfLines={1}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Mono>
                    {item.result?.message ? (
                      <Body tone="dim" style={{ marginTop: 10 }} numberOfLines={2}>{item.result.message}</Body>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => deleteCalculation(item.id)}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      width: ACTION_RAIL_WIDTH,
                      height: 38,
                      borderRadius: 12,
                      backgroundColor: c.inset,
                      borderColor: c.border,
                      borderWidth: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <MaterialIcons name="delete-outline" size={20} color={c.textMuted} />
                  </Pressable>
                </View>
              </Panel>
            );
          })
        )}
        <FooterAdBanner />
      </ListScreenScrollView>
    </Screen>
  );
}
