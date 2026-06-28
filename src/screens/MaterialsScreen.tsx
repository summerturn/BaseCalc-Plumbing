import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Body, H2, Label, Small } from '../components/Type';
import {
  Divider,
  IconTile,
  ListScreenHeader,
  ListScreenScrollView,
  Panel,
  Screen,
  SECTION_GAP,
  useBottomClearance,
} from '../components/ui';
import { FooterAdBanner } from '../components/AdBanner';
import { useColors } from '../theme/useAppTheme';

type MaterialGroup = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accent: string;
  items: string[];
};

const MATERIAL_GROUPS: MaterialGroup[] = [
  {
    title: 'Pipe + Fittings',
    subtitle: 'Check after pipe sizing, velocity, pressure drop, and volume calculators.',
    icon: 'water',
    accent: 'blue',
    items: ['Copper or CPVC pipe by size', 'Couplings, elbows, and tees', 'Pipe dope / thread sealant', 'Hangers, straps, and supports'],
  },
  {
    title: 'Fixtures + Trim',
    subtitle: 'Use after fixture-unit and meter sizing calculations.',
    icon: 'countertops',
    accent: 'amber',
    items: ['Faucets, valves, and stops', 'Toilet / lavatory trim kits', 'Shower / tub cartridges', 'Escutcheons and finish hardware'],
  },
  {
    title: 'Water Heaters + Gas',
    subtitle: 'Match water heater, gas pipe, and backflow notes.',
    icon: 'bathtub',
    accent: 'green',
    items: ['Water heater with first-hour rating', 'Gas pipe and fittings', 'Drip leg / sediment trap', 'Gas shutoff valve'],
  },
  {
    title: 'Drainage + Vent',
    subtitle: 'Tie to drainage, vent, septic, and grease interceptor sizing.',
    icon: 'remove-circle-outline',
    accent: 'purple',
    items: ['Drain pipe and fittings', 'Vent pipe and caps', 'Cleanouts', 'Septic or grease-interceptor specs'],
  },
  {
    title: 'Tools + Closeout',
    subtitle: 'Keep the job worksheet useful before billing happens.',
    icon: 'fact-check',
    accent: 'teal',
    items: ['Pipe cutter, reamer, and wrenches', 'Leak test gauge', 'Photos before cover-up', 'Final invoice goes to SpeakSheet'],
  },
];

function accentColor(colors: ReturnType<typeof useColors>, accent: MaterialGroup['accent']): string {
  if (accent === 'blue') return colors.info;
  if (accent === 'green') return colors.pass;
  if (accent === 'purple') return colors.textMuted;
  if (accent === 'teal') return '#2DD4BF';
  return colors.amberBright;
}

function MaterialPanel({ group }: { group: MaterialGroup }) {
  const c = useColors();
  const color = accentColor(c, group.accent);

  return (
    <Panel style={{ marginBottom: SECTION_GAP }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
        <IconTile icon={group.icon} color={color} size={48} />
        <View style={{ flex: 1 }}>
          <H2 style={{ fontSize: 17 }} numberOfLines={1}>{group.title}</H2>
          <Small tone="muted" style={{ marginTop: 3 }}>{group.subtitle}</Small>
        </View>
      </View>
      <Divider style={{ marginVertical: 14 }} />
      <View style={{ gap: 10 }}>
        {group.items.map((item) => (
          <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <MaterialIcons name="check-circle" size={18} color={color} />
            <Body tone="dim" style={{ flex: 1 }}>{item}</Body>
          </View>
        ))}
      </View>
    </Panel>
  );
}

export function MaterialsScreen() {
  const bottomClearance = useBottomClearance();

  return (
    <Screen>
      <ListScreenScrollView bottomPadding={bottomClearance}>
        <ListScreenHeader
          title="Materials"
          subtitle="Field pull-list starters tied to the calculator workflow."
        />
        <View style={{ marginBottom: 4 }}>
          <Label>Plan the job</Label>
        </View>
        {MATERIAL_GROUPS.map((group) => (
          <MaterialPanel key={group.title} group={group} />
        ))}
        <FooterAdBanner />
      </ListScreenScrollView>
    </Screen>
  );
}
