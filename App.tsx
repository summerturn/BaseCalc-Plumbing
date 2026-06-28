import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import './src/styles.css';

import {
  CalculatorDashboardScreen,
  PipeVelocityScreen,
  FlowRateScreen,
  PipeSizingScreen,
  PressureDropScreen,
  DrainageSizingScreen,
  VentSizingScreen,
  WaterHeaterScreen,
  GasPipeSizingScreen,
  PumpHeadScreen,
  PipeVolumeScreen,
  WaterPressureScreen,
  PipeExpansionScreen,
  FixtureUnitsScreen,
  WaterMeterSizingScreen,
  IrrigationFlowScreen,
  SepticTankScreen,
  GreaseInterceptorScreen,
  BackflowPressureScreen,
} from './src/screens/CalculatorScreens';
import { ClientsScreen, AddClientScreen, EditClientScreen, ClientDetailScreen } from './src/screens/ClientsScreen';
import { JobTicketsScreen, CreateJobTicketScreen, JobTicketDetailScreen } from './src/screens/InvoicesScreen';
import { MaterialsScreen } from './src/screens/MaterialsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { TAB_BAR_MIN_HEIGHT } from './src/components/ui';
import { AppThemeProvider, useAppTheme } from './src/theme/useAppTheme';
import { fontMap } from './src/theme/typography';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  Calculators: 'water-drop',
  Jobs: 'work-outline',
  Materials: 'inventory-2',
  History: 'history',
  Settings: 'settings',
};

function CalculatorStack() {
  const { colors } = useAppTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="CalculatorDashboard" component={CalculatorDashboardScreen} />
      <Stack.Screen name="PipeVelocity" component={PipeVelocityScreen} />
      <Stack.Screen name="FlowRate" component={FlowRateScreen} />
      <Stack.Screen name="PipeSizing" component={PipeSizingScreen} />
      <Stack.Screen name="PressureDrop" component={PressureDropScreen} />
      <Stack.Screen name="DrainageSizing" component={DrainageSizingScreen} />
      <Stack.Screen name="VentSizing" component={VentSizingScreen} />
      <Stack.Screen name="WaterHeater" component={WaterHeaterScreen} />
      <Stack.Screen name="GasPipeSizing" component={GasPipeSizingScreen} />
      <Stack.Screen name="PumpHead" component={PumpHeadScreen} />
      <Stack.Screen name="PipeVolume" component={PipeVolumeScreen} />
      <Stack.Screen name="WaterPressure" component={WaterPressureScreen} />
      <Stack.Screen name="PipeExpansion" component={PipeExpansionScreen} />
      <Stack.Screen name="FixtureUnits" component={FixtureUnitsScreen} />
      <Stack.Screen name="WaterMeterSizing" component={WaterMeterSizingScreen} />
      <Stack.Screen name="IrrigationFlow" component={IrrigationFlowScreen} />
      <Stack.Screen name="SepticTank" component={SepticTankScreen} />
      <Stack.Screen name="GreaseInterceptor" component={GreaseInterceptorScreen} />
      <Stack.Screen name="BackflowPressure" component={BackflowPressureScreen} />
    </Stack.Navigator>
  );
}

function ClientStack() {
  const { colors } = useAppTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="ClientsList" component={ClientsScreen} />
      <Stack.Screen name="AddClient" component={AddClientScreen} />
      <Stack.Screen name="EditClient" component={EditClientScreen} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen name="CreateJobTicket" component={CreateJobTicketScreen} />
      <Stack.Screen name="JobTicketDetail" component={JobTicketDetailScreen} />
    </Stack.Navigator>
  );
}

function JobStack() {
  const { colors } = useAppTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="JobTicketsList" component={JobTicketsScreen} />
      <Stack.Screen name="JobTicketDetail" component={JobTicketDetailScreen} />
      <Stack.Screen name="CreateJobTicket" component={CreateJobTicketScreen} />
      <Stack.Screen name="JobContacts" component={ClientStack} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { colors } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <Tab.Navigator
      key={`tabs-${colors.mode}`}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => <MaterialIcons name={TAB_ICONS[route.name]} size={size} color={color} />,
        tabBarActiveTintColor: colors.amberBright,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: TAB_BAR_MIN_HEIGHT + bottom,
          paddingTop: 8,
          paddingBottom: bottom > 0 ? bottom : 10,
          paddingHorizontal: 4,
          backgroundColor: colors.bgElevated,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        tabBarItemStyle: { paddingVertical: 1 },
        tabBarLabelStyle: { fontFamily: 'Saira_600SemiBold', fontSize: 10.5, lineHeight: 14, letterSpacing: 0.4, marginTop: 3 },
        sceneStyle: { backgroundColor: colors.bg },
      })}
    >
      <Tab.Screen name="Calculators" component={CalculatorStack} />
      <Tab.Screen name="Jobs" component={JobStack} />
      <Tab.Screen name="Materials" component={MaterialsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { colors, isDark } = useAppTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.panel,
      text: colors.text,
      border: colors.border,
      primary: colors.amberBright,
      notification: colors.amberBright,
    },
  };

  return (
    <>
      <StatusBar style={colors.statusBarStyle} />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Paywall" component={PaywallScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts(fontMap);
  const [timedOut, setTimedOut] = useState(false);
  const ready = fontsLoaded || !!fontError || timedOut;

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <Root />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
