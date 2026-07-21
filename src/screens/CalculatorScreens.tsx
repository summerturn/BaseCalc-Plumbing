import { type ComponentProps, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  CalculationResult,
  MetricResult,
  PipeMaterial,
  BackflowType,
  DrainSlope,
  PIPE_MATERIAL_OPTIONS,
  DRAIN_PIPE_SIZES,
  DRAIN_SLOPE_OPTIONS,
  pipeMaterialLabel,
  pipeSizesForMaterial,
} from '../engine/PlumbingEngine';
import { PlumbingEngine } from '../engine/PlumbingEngine';
import { useAppStore } from '../store/useAppStore';
import { CATEGORY } from '../theme/appTheme';
import { useColors } from '../theme/useAppTheme';
import { Fonts } from '../theme/typography';
import { Body, Display, H1, H2, Label, Mono, Small } from '../components/Type';
import {
  BackBar,
  Field,
  FormScrollView,
  IconTile,
  MetricReadout,
  Panel,
  PrimaryButton,
  ResultReadout,
  SCREEN_H_PAD,
  SCREEN_TOP_PAD,
  Screen,
  Segmented,
  TABLET_BREAKPOINT,
  useBottomClearance,
  withAlpha,
} from '../components/ui';
import { isPremiumCalculatorRoute } from '../lib/accessControl';

type IconName = ComponentProps<typeof MaterialIcons>['name'];
const fmt = (n: number, d: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const BRAND_ICON = require('../../assets/icon.png');

type CalcDef = {
  key: string;
  title: string;
  subtitle: string;
  icon: IconName;
  code: string;
  route: string;
  color: string;
  proOnly?: boolean;
};

const CALCS: CalcDef[] = [
  { key: 'pipe-velocity', title: 'Pipe Velocity', subtitle: 'Material-specific ID', icon: 'water-drop', code: 'V = GPM ÷ A', route: 'PipeVelocity', color: CATEGORY.water },
  { key: 'flow-rate', title: 'Flow Rate', subtitle: 'Material-specific ID', icon: 'opacity', code: 'GPM = V × A', route: 'FlowRate', color: CATEGORY.water },
  { key: 'pipe-volume', title: 'Pipe Volume', subtitle: 'Material-specific ID', icon: 'invert-colors', code: 'Gal = area × L', route: 'PipeVolume', color: CATEGORY.water },
  { key: 'water-pressure', title: 'Water Pressure', subtitle: 'Head ↔ psi', icon: 'compress', code: '1 psi = 2.31 ft', route: 'WaterPressure', color: CATEGORY.pressure },
  { key: 'pipe-sizing', title: 'Pipe Sizing', subtitle: 'Select material', icon: 'line-weight', code: 'Area = GPM ÷ V', route: 'PipeSizing', color: CATEGORY.water, proOnly: true },
  { key: 'pressure-drop', title: 'Pressure Drop', subtitle: 'Material-specific ID', icon: 'trending-down', code: 'psi/ft', route: 'PressureDrop', color: CATEGORY.pressure, proOnly: true },
  { key: 'drainage', title: 'Drainage Sizing', subtitle: 'DFU + slope', icon: 'remove-circle-outline', code: 'IPC 710.1(1)', route: 'DrainageSizing', color: CATEGORY.drainage, proOnly: true },
  { key: 'vent', title: 'Vent Sizing', subtitle: 'Drain + length', icon: 'vertical-align-top', code: 'IPC 906.2', route: 'VentSizing', color: CATEGORY.drainage, proOnly: true },
  { key: 'water-heater', title: 'Water Heater', subtitle: 'First-hour rating', icon: 'bathtub', code: 'FHR', route: 'WaterHeater', color: CATEGORY.heating, proOnly: true },
  { key: 'gas-pipe', title: 'Gas Pipe Sizing', subtitle: 'BTU/hr + length', icon: 'local-fire-department', code: 'Iron pipe', route: 'GasPipeSizing', color: CATEGORY.gas, proOnly: true },
  { key: 'pump-head', title: 'Pump Head', subtitle: 'Total dynamic head', icon: 'arrow-upward', code: 'TDH', route: 'PumpHead', color: CATEGORY.pressure, proOnly: true },
  { key: 'expansion', title: 'Pipe Expansion', subtitle: 'Thermal ΔL', icon: 'unfold-more', code: 'ΔL', route: 'PipeExpansion', color: CATEGORY.general, proOnly: true },
  { key: 'fixture-units', title: 'Fixture Units', subtitle: 'Count fixtures', icon: 'countertops', code: 'FU total', route: 'FixtureUnits', color: CATEGORY.fixtures, proOnly: true },
  { key: 'meter', title: 'Meter Sizing Inputs', subtitle: 'Utility table required', icon: 'speed', code: 'Input check', route: 'WaterMeterSizing', color: CATEGORY.water, proOnly: true },
  { key: 'irrigation', title: 'Irrigation Flow', subtitle: 'Zone GPM', icon: 'grass', code: 'Heads × GPM', route: 'IrrigationFlow', color: CATEGORY.irrigation, proOnly: true },
  { key: 'septic', title: 'Septic Tank Planning', subtitle: 'Bedrooms → planning volume', icon: 'home', code: 'Local rules required', route: 'SepticTank', color: CATEGORY.drainage, proOnly: true },
  { key: 'grease', title: 'Grease Sizing Inputs', subtitle: 'Adopted method required', icon: 'oil-barrel', code: 'Input check', route: 'GreaseInterceptor', color: CATEGORY.drainage, proOnly: true },
  { key: 'backflow', title: 'Backflow Loss Inputs', subtitle: 'Manufacturer curve required', icon: 'tune', code: 'Input check', route: 'BackflowPressure', color: CATEGORY.pressure, proOnly: true },
];

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

// ─── Dashboard ───────────────────────────────────────────────────────

function CalcCard({
  calc,
  featured,
  onPress,
  compact,
  large,
  cardWidth,
  cardHeight,
  locked,
}: {
  calc: CalcDef;
  featured?: boolean;
  onPress: () => void;
  compact?: boolean;
  large?: boolean;
  cardWidth: number;
  cardHeight?: number;
  locked?: boolean;
}) {
  const c = useColors();
  const contentColumnWidth = Math.max(96, Math.min(cardWidth - 28, large ? 170 : compact ? 118 : 136));
  const showProText = Boolean(locked && !compact && cardWidth >= 176);
  const badgeSide = compact ? 26 : 28;
  const base = {
    backgroundColor: c.panel,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden' as const,
    shadowColor: c.shadow,
    shadowOpacity: c.mode === 'dark' ? 0.4 : 0.13,
    shadowRadius: c.mode === 'dark' ? 16 : 13,
    shadowOffset: { width: 0, height: c.mode === 'dark' ? 8 : 6 },
  };

  if (featured) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }]}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: calc.color }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingLeft: 22, paddingRight: 18 }}>
          <IconTile icon={calc.icon} color={calc.color} size={56} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Label tone="amber" style={{ marginBottom: 5 }}>{calc.code}</Label>
            <H1 style={{ fontSize: 22 }} numberOfLines={1}>{calc.title}</H1>
            <Small style={{ marginTop: 3 }} numberOfLines={1}>{calc.subtitle}</Small>
          </View>
          <MaterialIcons name="arrow-forward" size={22} color={c.textMuted} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        base,
        {
          width: cardWidth,
          height: cardHeight,
          justifyContent: 'space-between',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ height: large ? 5 : 4, backgroundColor: calc.color, borderTopLeftRadius: 20, borderTopRightRadius: 20, width: '100%' }} />
      <View
        style={{
          paddingHorizontal: large ? 22 : compact ? 14 : 16,
          paddingTop: large ? 22 : compact ? 13 : 14,
          paddingBottom: large ? 22 : compact ? 14 : 16,
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: contentColumnWidth, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
          <IconTile icon={calc.icon} color={calc.color} size={large ? 60 : compact ? 42 : 44} />
          <View style={{ marginTop: large ? 16 : 12, width: '100%', alignItems: 'center' }}>
            <H2
              style={{ fontSize: large ? 21 : compact ? 15 : 16, textAlign: 'center', width: '100%' }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
            >
              {calc.title}
            </H2>
            <Small
              style={{ fontSize: large ? 14 : undefined, marginTop: large ? 6 : 4, textAlign: 'center', width: '100%' }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.92}
            >
              {calc.subtitle}
            </Small>
          </View>
          <Label tone="muted" style={{ marginTop: large ? 14 : 10, textAlign: 'center', width: '100%' }} numberOfLines={1}>
            {calc.code}
          </Label>
        </View>
      </View>
      {locked ? (
        <View
          style={{
            position: 'absolute',
            top: compact ? 7 : 10,
            right: compact ? 7 : 10,
            width: showProText ? undefined : badgeSide,
            minWidth: showProText ? undefined : badgeSide,
            height: showProText ? undefined : badgeSide,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: showProText ? 4 : 0,
            backgroundColor: c.amberSoft,
            borderColor: withAlpha(c.amberBright, 0.55),
            borderWidth: 1,
            borderRadius: 999,
            paddingHorizontal: showProText ? 8 : 0,
            paddingVertical: showProText ? 4 : 0,
          }}
        >
          <MaterialIcons name="lock" size={showProText ? 12 : 14} color={c.amberBright} />
          {showProText ? <Label tone="amber" style={{ fontSize: 10 }}>PRO</Label> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function BrandLockup({ compact }: { compact: boolean }) {
  const c = useColors();
  const iconSize = compact ? 66 : 74;
  const wordmarkSize = compact ? 31 : 35;
  const wordmarkLineHeight = compact ? 40 : 44;
  const subtitleSize = compact ? 13 : 14;

  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', maxWidth: '100%' }}>
        <Image source={BRAND_ICON} style={{ width: iconSize, height: iconSize, borderRadius: compact ? 18 : 20 }} resizeMode="cover" />
        <View style={{ flexShrink: 1, minWidth: 0, justifyContent: 'center', marginLeft: compact ? 12 : 14, paddingRight: 2 }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.84}
            style={{
              fontFamily: Fonts.display,
              fontSize: wordmarkSize,
              lineHeight: wordmarkLineHeight,
              letterSpacing: 0.2,
              color: c.text,
            }}
          >
            <Text style={{ color: c.text }}>BASE</Text>
            <Text style={{ color: c.amberBright }}>CALC</Text>
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.92}
            style={{
              marginTop: 2,
              fontFamily: Fonts.heading,
              fontSize: subtitleSize,
              lineHeight: subtitleSize + 6,
              letterSpacing: compact ? 1.5 : 1.8,
              textTransform: 'uppercase',
              color: c.textMuted,
            }}
          >
            Plumbing
          </Text>
        </View>
      </View>
    </View>
  );
}

export function CalculatorDashboardScreen({ navigation }: { navigation: { navigate: (s: string) => void } }) {
  const c = useColors();
  const { isPro } = useAppStore();
  const { width } = useWindowDimensions();
  const bottomClearance = useBottomClearance();
  const isTablet = width >= TABLET_BREAKPOINT;
  const compact = width < 390;
  const columns = width >= 1180 ? 4 : isTablet ? 3 : 2;
  const cardGap = compact ? 12 : 14;
  const availableGridWidth = Math.max(0, width - SCREEN_H_PAD * 2);
  const cardWidth = Math.floor(
    (availableGridWidth - cardGap * (columns - 1)) / columns
  );
  const gridWidth = cardWidth * columns + cardGap * (columns - 1);
  const rawCardHeight = Math.round(cardWidth * (isTablet ? 1.03 : compact ? 1.18 : 1.12));
  const cardHeight = Math.max(compact ? 168 : 176, Math.min(isTablet ? 230 : 214, rawCardHeight));
  const rows = chunk(CALCS, columns);
  const openCalculator = (calc: CalcDef) => {
    if (calc.proOnly && !isPro) {
      Alert.alert(
        'Pro calculator',
        `${calc.title} is part of BaseCalc Plumbing Pro. Upgrade to unlock every plumbing calculator.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Paywall') },
        ]
      );
      return;
    }
    navigation.navigate(calc.route);
  };

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingHorizontal: SCREEN_H_PAD, paddingTop: SCREEN_TOP_PAD + 2, paddingBottom: bottomClearance, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 6, marginBottom: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ backgroundColor: c.amberSoft, borderColor: withAlpha(c.amberBright, 0.4), borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
              <Label tone="amber">Plumbing Field Ready</Label>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 7, height: 7, borderRadius: 7, backgroundColor: c.pass, shadowColor: c.pass, shadowOpacity: 0.9, shadowRadius: 5 }} />
              <Mono tone="muted" style={{ fontSize: 11 }}>LIVE</Mono>
            </View>
          </View>

          <BrandLockup compact={compact} />
          <Body
            tone="muted"
            style={{
              marginTop: 10,
              alignSelf: 'center',
              maxWidth: compact ? 330 : 390,
              textAlign: 'center',
            }}
          >
            Plumbing field math for water, drainage, gas, pressure, and fixtures.
          </Body>
        </View>

        <View style={{ width: '100%', alignItems: 'center' }}>
          <View style={{ width: gridWidth, maxWidth: '100%' }}>
            {rows.map((row) => (
              <View
                key={row.map((item) => item.key).join('-')}
                style={{
                  flexDirection: 'row',
                  justifyContent: row.length === columns ? 'space-between' : 'center',
                  alignItems: 'center',
                  marginBottom: cardGap,
                  width: '100%',
                }}
              >
                {row.map((calc, index) => (
                  <View
                    key={calc.key}
                    style={row.length === columns || index === 0 ? undefined : { marginLeft: cardGap }}
                  >
                    <CalcCard
                      calc={calc}
                      compact={compact}
                      large={isTablet}
                      cardWidth={cardWidth}
                      cardHeight={cardHeight}
                      locked={Boolean(calc.proOnly && !isPro)}
                      onPress={() => openCalculator(calc)}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

// ─── Shared calculator shell ─────────────────────────────────────────

export function CalculatorShell({ title, code, children }: { title: string; code?: string; children: React.ReactNode }) {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const route = useRoute<RouteProp<ParamListBase>>();
  const isPro = useAppStore((state) => state.isPro);
  const bottomClearance = useBottomClearance();
  const premiumBlocked = isPremiumCalculatorRoute(route.name) && !isPro;

  useEffect(() => {
    if (premiumBlocked) navigation.navigate('Paywall');
  }, [navigation, premiumBlocked]);

  if (premiumBlocked) {
    return (
      <Screen>
        <FormScrollView bottomPadding={bottomClearance + 28}>
          <BackBar onBack={() => navigation.goBack()} />
          <Panel>
            <H2>Pro calculator</H2>
            <Body tone="muted" style={{ marginTop: 8, marginBottom: 16 }}>
              An active BaseCalc Plumbing Pro subscription is required for this calculator.
            </Body>
            <PrimaryButton label="View Pro options" icon="workspace-premium" onPress={() => navigation.navigate('Paywall')} />
          </Panel>
        </FormScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <FormScrollView bottomPadding={bottomClearance + 28}>
        <BackBar onBack={() => navigation.goBack()} />
        <View style={{ marginBottom: 18 }}>
          {code ? <Label tone="amber" style={{ marginBottom: 7 }}>{code}</Label> : null}
          <Display>{title}</Display>
        </View>
        {children}
      </FormScrollView>
    </Screen>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

const BACKFLOW_OPTIONS: BackflowType[] = ['PVB', 'DCV', 'RPZ'];

type SizedPipeInputs = { material: PipeMaterial; pipeSize: string };

function pipeSizeOptions(material: PipeMaterial): string[] {
  return pipeSizesForMaterial(material).map((pipe) => pipe.nominal);
}

function updatePipeMaterial<T extends SizedPipeInputs>(inputs: T, material: PipeMaterial): T {
  const options = pipeSizeOptions(material);
  const pipeSize = options.includes(inputs.pipeSize) ? inputs.pipeSize : options[0];
  return { ...inputs, material, pipeSize };
}

// ─── Pipe Velocity ───────────────────────────────────────────────────

export function PipeVelocityScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ gpm: 10, pipeSize: '3/4"', material: 'copper' as PipeMaterial });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.pipeVelocity(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'pipeVelocity', inputs, result: res });
  };

  return (
    <CalculatorShell title="Pipe Velocity" code={`${pipeMaterialLabel(inputs.material)} · velocity = GPM ÷ (449 × area)`}>
      <Panel>
        <Field label="Flow rate" suffix="GPM" value={String(inputs.gpm)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, gpm: Number(t) || 0 })} />
        <Segmented label="Material" value={inputs.material} options={PIPE_MATERIAL_OPTIONS} onChange={(material) => setInputs(updatePipeMaterial(inputs, material))} format={pipeMaterialLabel} />
        <Segmented label="Pipe size" value={inputs.pipeSize} options={pipeSizeOptions(inputs.material)} onChange={(pipeSize) => setInputs({ ...inputs, pipeSize })} />
        <PrimaryButton label="Calculate" icon="water-drop" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.water} />
    </CalculatorShell>
  );
}

// ─── Flow Rate ───────────────────────────────────────────────────────

export function FlowRateScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ velocity: 5, pipeSize: '3/4"', material: 'copper' as PipeMaterial });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.flowRate(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'flowRate', inputs, result: res });
  };

  return (
    <CalculatorShell title="Flow Rate" code={`${pipeMaterialLabel(inputs.material)} · GPM = velocity × 449 × area`}>
      <Panel>
        <Field label="Velocity" suffix="ft/s" value={String(inputs.velocity)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, velocity: Number(t) || 0 })} />
        <Segmented label="Material" value={inputs.material} options={PIPE_MATERIAL_OPTIONS} onChange={(material) => setInputs(updatePipeMaterial(inputs, material))} format={pipeMaterialLabel} />
        <Segmented label="Pipe size" value={inputs.pipeSize} options={pipeSizeOptions(inputs.material)} onChange={(pipeSize) => setInputs({ ...inputs, pipeSize })} />
        <PrimaryButton label="Calculate" icon="opacity" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.water} />
    </CalculatorShell>
  );
}

// ─── Pipe Sizing ─────────────────────────────────────────────────────

export function PipeSizingScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ gpm: 10, maxVelocity: 8, material: 'copper' as PipeMaterial });
  const [result, setResult] = useState<CalculationResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.pipeSizing(inputs);
    setResult(res);
    if (res.passes) addCalculation({ type: 'pipeSizing', inputs, result: res });
  };

  return (
    <CalculatorShell title="Pipe Sizing" code={`${pipeMaterialLabel(inputs.material)} · minimum nominal size from GPM`}>
      <Panel>
        <Field label="Flow rate" suffix="GPM" value={String(inputs.gpm)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, gpm: Number(t) || 0 })} />
        <Field label="Max velocity" suffix="ft/s" value={String(inputs.maxVelocity)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, maxVelocity: Number(t) || 0 })} />
        <Segmented label="Material" value={inputs.material} options={PIPE_MATERIAL_OPTIONS} onChange={(material) => setInputs({ ...inputs, material })} format={pipeMaterialLabel} />
        <PrimaryButton label="Calculate" icon="line-weight" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <ResultReadout result={result} />
    </CalculatorShell>
  );
}

// ─── Pressure Drop ───────────────────────────────────────────────────

export function PressureDropScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ gpm: 10, pipeSize: '3/4"', length: 100, material: 'copper' as const });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.pressureDrop(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'pressureDrop', inputs, result: res });
  };

  return (
    <CalculatorShell title="Pressure Drop" code={`${pipeMaterialLabel(inputs.material)} · Hazen-Williams pressure loss`}>
      <Panel>
        <Field label="Flow rate" suffix="GPM" value={String(inputs.gpm)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, gpm: Number(t) || 0 })} />
        <Segmented label="Material" value={inputs.material} options={PIPE_MATERIAL_OPTIONS} onChange={(material) => setInputs(updatePipeMaterial(inputs, material))} format={pipeMaterialLabel} />
        <Segmented label="Pipe size" value={inputs.pipeSize} options={pipeSizeOptions(inputs.material)} onChange={(pipeSize) => setInputs({ ...inputs, pipeSize })} />
        <Field label="Length" suffix="ft" value={String(inputs.length)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, length: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="trending-down" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.pressure} />
    </CalculatorShell>
  );
}

// ─── Drainage Sizing ─────────────────────────────────────────────────

export function DrainageSizingScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState<{
    fixtureUnits: number;
    slope: DrainSlope;
    includesWaterCloset: boolean;
  }>({ fixtureUnits: 10, slope: '1/4', includesWaterCloset: false });
  const [result, setResult] = useState<CalculationResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.drainageSizing(inputs);
    setResult(res);
    if (res.passes) addCalculation({ type: 'drainageSizing', inputs, result: res });
  };

  return (
    <CalculatorShell title="Drainage Sizing" code="2021 IPC 710.1(1) · building drain">
      <Panel>
        <Field label="Fixture units" value={String(inputs.fixtureUnits)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, fixtureUnits: Number(t) || 0 })} />
        <Segmented label="Slope (in/ft)" value={inputs.slope} options={DRAIN_SLOPE_OPTIONS} onChange={(slope) => setInputs({ ...inputs, slope })} />
        <Segmented
          label="Serves water closet"
          value={inputs.includesWaterCloset ? 'Yes' : 'No'}
          options={['No', 'Yes'] as const}
          onChange={(value) => setInputs({ ...inputs, includesWaterCloset: value === 'Yes' })}
        />
        <PrimaryButton label="Calculate" icon="remove-circle-outline" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <ResultReadout result={result} />
    </CalculatorShell>
  );
}

// ─── Vent Sizing ─────────────────────────────────────────────────────

export function VentSizingScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ drainSize: '3"', ventLength: 30 });
  const [result, setResult] = useState<CalculationResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.ventSizing(inputs);
    setResult(res);
    if (res.passes) addCalculation({ type: 'ventSizing', inputs, result: res });
  };

  return (
    <CalculatorShell title="Vent Sizing" code="2021 IPC 906.2 · individual / branch vent">
      <Panel>
        <Segmented label="Drain served" value={inputs.drainSize} options={DRAIN_PIPE_SIZES} onChange={(drainSize) => setInputs({ ...inputs, drainSize })} />
        <Field label="Vent length" suffix="ft" value={String(inputs.ventLength)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, ventLength: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="vertical-align-top" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <ResultReadout result={result} />
    </CalculatorShell>
  );
}

// ─── Water Heater ────────────────────────────────────────────────────

export function WaterHeaterScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ tankGallons: 50, tempRise: 70, inputBtu: 40000, efficiency: 0.8 });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.waterHeater(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'waterHeater', inputs, result: res });
  };

  return (
    <CalculatorShell title="Water Heater" code="First-hour rating estimate">
      <Panel>
        <Field label="Tank gallons" suffix="gal" value={String(inputs.tankGallons)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, tankGallons: Number(t) || 0 })} />
        <Field label="Temperature rise" suffix="°F" value={String(inputs.tempRise)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, tempRise: Number(t) || 0 })} />
        <Field label="Input BTU/hr" suffix="BTU/hr" value={String(inputs.inputBtu)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, inputBtu: Number(t) || 0 })} />
        <Field label="Efficiency" suffix="decimal" value={String(inputs.efficiency)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, efficiency: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="bathtub" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.heating} />
    </CalculatorShell>
  );
}

// ─── Gas Pipe Sizing ─────────────────────────────────────────────────

export function GasPipeSizingScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ btuPerHour: 100000, length: 30 });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.gasPipeSizing(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'gasPipeSizing', inputs, result: res });
  };

  return (
    <CalculatorShell title="Low-Pressure Natural Gas Pipe" code="2021 IFGC Table 402.4(1)">
      <Panel>
        <Body tone="muted" style={{ marginBottom: 16 }}>Fixed basis: Schedule 40 metallic pipe, inlet below 2 psi, 0.3 in. w.c. drop, and 0.60 specific gravity.</Body>
        <Field label="Load" suffix="BTU/hr" value={String(inputs.btuPerHour)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, btuPerHour: Number(t) || 0 })} />
        <Field label="Longest developed length" suffix="ft" value={String(inputs.length)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, length: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="local-fire-department" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.gas} />
    </CalculatorShell>
  );
}

// ─── Pump Head ───────────────────────────────────────────────────────

export function PumpHeadScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ staticLift: 20, frictionPsi: 5, pressurePsi: 20 });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.pumpHead(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'pumpHead', inputs, result: res });
  };

  return (
    <CalculatorShell title="Pump Head" code="TDH = lift + friction + pressure">
      <Panel>
        <Field label="Static lift" suffix="ft" value={String(inputs.staticLift)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, staticLift: Number(t) || 0 })} />
        <Field label="Friction" suffix="psi" value={String(inputs.frictionPsi)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, frictionPsi: Number(t) || 0 })} />
        <Field label="Pressure req." suffix="psi" value={String(inputs.pressurePsi)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, pressurePsi: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="arrow-upward" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.pressure} />
    </CalculatorShell>
  );
}

// ─── Pipe Volume ─────────────────────────────────────────────────────

export function PipeVolumeScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ pipeSize: '3/4"', length: 100, material: 'copper' as PipeMaterial });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.pipeVolume(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'pipeVolume', inputs, result: res });
  };

  return (
    <CalculatorShell title="Pipe Volume" code={`${pipeMaterialLabel(inputs.material)} · gallons of water in pipe`}>
      <Panel>
        <Segmented label="Material" value={inputs.material} options={PIPE_MATERIAL_OPTIONS} onChange={(material) => setInputs(updatePipeMaterial(inputs, material))} format={pipeMaterialLabel} />
        <Segmented label="Pipe size" value={inputs.pipeSize} options={pipeSizeOptions(inputs.material)} onChange={(pipeSize) => setInputs({ ...inputs, pipeSize })} />
        <Field label="Length" suffix="ft" value={String(inputs.length)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, length: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="invert-colors" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.water} />
    </CalculatorShell>
  );
}

// ─── Water Pressure ──────────────────────────────────────────────────

export function WaterPressureScreen() {
  const { addCalculation } = useAppStore();
  const [head, setHead] = useState('');
  const [psi, setPsi] = useState('');
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const inputs = {
      head: head.trim() !== '' ? parseFloat(head) : undefined,
      psi: psi.trim() !== '' ? parseFloat(psi) : undefined,
    };
    const res = PlumbingEngine.waterPressure(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'waterPressure', inputs, result: res });
  };

  return (
    <CalculatorShell title="Water Pressure" code="1 psi ≈ 2.31 ft of head">
      <Panel>
        <Body tone="muted" style={{ marginBottom: 16 }}>Enter head (ft) or pressure (psi) to convert.</Body>
        <Field label="Head" suffix="ft" value={head} onChangeText={setHead} keyboardType="decimal-pad" placeholder="—" />
        <Field label="Pressure" suffix="psi" value={psi} onChangeText={setPsi} keyboardType="decimal-pad" placeholder="—" />
        <PrimaryButton label="Convert" icon="compress" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.pressure} />
    </CalculatorShell>
  );
}

// ─── Pipe Expansion ──────────────────────────────────────────────────

export function PipeExpansionScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ pipeSize: '3/4"', length: 50, deltaT: 40, material: 'copper' as PipeMaterial });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.pipeExpansion(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'pipeExpansion', inputs, result: res });
  };

  return (
    <CalculatorShell title="Pipe Expansion" code="Thermal expansion length">
      <Panel>
        <Segmented label="Material" value={inputs.material} options={PIPE_MATERIAL_OPTIONS} onChange={(material) => setInputs(updatePipeMaterial(inputs, material))} format={pipeMaterialLabel} />
        <Segmented label="Pipe size" value={inputs.pipeSize} options={pipeSizeOptions(inputs.material)} onChange={(pipeSize) => setInputs({ ...inputs, pipeSize })} />
        <Field label="Length" suffix="ft" value={String(inputs.length)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, length: Number(t) || 0 })} />
        <Field label="Temperature change" suffix="°F" value={String(inputs.deltaT)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, deltaT: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="unfold-more" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.general} />
    </CalculatorShell>
  );
}

// ─── Fixture Units ───────────────────────────────────────────────────

export function FixtureUnitsScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({
    toilet: 0,
    lavatory: 0,
    bathtub: 0,
    shower: 0,
    kitchenSink: 0,
    dishwasher: 0,
    washingMachine: 0,
    urinalStandard: 0,
    urinalLowFlow: 0,
  });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.fixtureUnits(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'fixtureUnits', inputs, result: res });
  };

  return (
    <CalculatorShell title="Drainage Fixture Units" code="2021 IPC Table 709.1 selected rows">
      <Panel>
        <Body tone="muted" style={{ marginBottom: 16 }}>Count fixtures individually. Do not also count the same fixtures as a bathroom group.</Body>
        <Field label="Private 1.6 gpf toilets (3 DFU)" value={String(inputs.toilet)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, toilet: Number(t) || 0 })} />
        <Field label="Lavatories (1 DFU)" value={String(inputs.lavatory)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, lavatory: Number(t) || 0 })} />
        <Field label="Bathtubs (2 DFU)" value={String(inputs.bathtub)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, bathtub: Number(t) || 0 })} />
        <Field label="Showers up to 5.7 GPM (2 DFU)" value={String(inputs.shower)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, shower: Number(t) || 0 })} />
        <Field label="Private kitchen sinks (2 DFU)" value={String(inputs.kitchenSink)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, kitchenSink: Number(t) || 0 })} />
        <Field label="Domestic dishwashers (2 DFU)" value={String(inputs.dishwasher)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, dishwasher: Number(t) || 0 })} />
        <Field label="Residential clothes washers (2 DFU)" value={String(inputs.washingMachine)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, washingMachine: Number(t) || 0 })} />
        <Field label="Urinals, standard row (4 DFU)" value={String(inputs.urinalStandard)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, urinalStandard: Number(t) || 0 })} />
        <Field label="Urinals, 1 gpf or less (2 DFU)" value={String(inputs.urinalLowFlow)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, urinalLowFlow: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="countertops" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.fixtures} />
    </CalculatorShell>
  );
}

// ─── Water Meter Sizing ──────────────────────────────────────────────

export function WaterMeterSizingScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ fixtureUnits: 20 });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.waterMeterSizing(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'waterMeterSizing', inputs, result: res });
  };

  return (
    <CalculatorShell title="Meter Sizing Inputs" code="Serving utility data required">
      <Panel>
        <Field label="Fixture units" value={String(inputs.fixtureUnits)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, fixtureUnits: Number(t) || 0 })} />
        <PrimaryButton label="Check inputs" icon="speed" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.water} />
    </CalculatorShell>
  );
}

// ─── Irrigation Flow ─────────────────────────────────────────────────

export function IrrigationFlowScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ heads: 4, gpmPerHead: 2 });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.irrigationFlow(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'irrigationFlow', inputs, result: res });
  };

  return (
    <CalculatorShell title="Irrigation Flow" code="Zone GPM = heads × GPM/head">
      <Panel>
        <Field label="Heads" value={String(inputs.heads)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, heads: Number(t) || 0 })} />
        <Field label="GPM per head" suffix="GPM" value={String(inputs.gpmPerHead)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, gpmPerHead: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="grass" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.irrigation} />
    </CalculatorShell>
  );
}

// ─── Septic Tank ─────────────────────────────────────────────────────

export function SepticTankScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ bedrooms: 3, dailyFlowPerBedroom: 150 });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.septicTank(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'septicTank', inputs, result: res });
  };

  return (
    <CalculatorShell title="Septic Planning Volume" code="Planning only; local rule required">
      <Panel>
        <Body tone="muted" style={{ marginBottom: 16 }}>This estimate is not a permit minimum. Final capacity depends on the current state and local health-department rule.</Body>
        <Field label="Bedrooms" value={String(inputs.bedrooms)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, bedrooms: Number(t) || 0 })} />
        <Field label="Flow per bedroom" suffix="GPD" value={String(inputs.dailyFlowPerBedroom)} keyboardType="numeric" onChangeText={(t) => setInputs({ ...inputs, dailyFlowPerBedroom: Number(t) || 0 })} />
        <PrimaryButton label="Calculate" icon="home" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.drainage} />
    </CalculatorShell>
  );
}

// ─── Grease Interceptor ──────────────────────────────────────────────

export function GreaseInterceptorScreen() {
  const { addCalculation } = useAppStore();
  const [fu, setFu] = useState('');
  const [gpm, setGpm] = useState('');
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const inputs = {
      fixtureUnits: fu.trim() !== '' ? parseFloat(fu) : undefined,
      gpm: gpm.trim() !== '' ? parseFloat(gpm) : undefined,
    };
    const res = PlumbingEngine.greaseInterceptor(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'greaseInterceptor', inputs, result: res });
  };

  return (
    <CalculatorShell title="Grease Sizing Inputs" code="Adopted sizing method required">
      <Panel>
        <Body tone="muted" style={{ marginBottom: 16 }}>Enter one known demand input to check whether a sizing method can be applied.</Body>
        <Field label="Fixture units" value={fu} onChangeText={setFu} keyboardType="decimal-pad" placeholder="—" />
        <Field label="Flow rate" suffix="GPM" value={gpm} onChangeText={setGpm} keyboardType="decimal-pad" placeholder="—" />
        <PrimaryButton label="Check inputs" icon="oil-barrel" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.drainage} />
    </CalculatorShell>
  );
}

// ─── Backflow Pressure ───────────────────────────────────────────────

export function BackflowPressureScreen() {
  const { addCalculation } = useAppStore();
  const [inputs, setInputs] = useState({ gpm: 15, type: 'DCV' as BackflowType });
  const [result, setResult] = useState<MetricResult | null>(null);

  const calculate = () => {
    const res = PlumbingEngine.backflowPressure(inputs);
    setResult(res);
    if (res.ok) addCalculation({ type: 'backflowPressure', inputs, result: res });
  };

  return (
    <CalculatorShell title="Backflow Loss Inputs" code="Manufacturer pressure-loss curve required">
      <Panel>
        <Field label="Flow rate" suffix="GPM" value={String(inputs.gpm)} keyboardType="decimal-pad" onChangeText={(t) => setInputs({ ...inputs, gpm: Number(t) || 0 })} />
        <Segmented label="Device type" value={inputs.type} options={BACKFLOW_OPTIONS} onChange={(type) => setInputs({ ...inputs, type })} />
        <PrimaryButton label="Check inputs" icon="tune" onPress={calculate} style={{ marginTop: 4 }} />
      </Panel>
      <MetricReadout result={result} accent={CATEGORY.pressure} />
    </CalculatorShell>
  );
}
