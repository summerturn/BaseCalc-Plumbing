import { FREE_TIER_LIMITS } from './config';

export const PREMIUM_CALCULATOR_ROUTES = [
  'PipeSizing',
  'PressureDrop',
  'DrainageSizing',
  'VentSizing',
  'WaterHeater',
  'GasPipeSizing',
  'PumpHead',
  'PipeExpansion',
  'FixtureUnits',
  'WaterMeterSizing',
  'IrrigationFlow',
  'SepticTank',
  'GreaseInterceptor',
  'BackflowPressure',
] as const;

const premiumRouteSet = new Set<string>(PREMIUM_CALCULATOR_ROUTES);

export function isPremiumCalculatorRoute(routeName: string): boolean {
  return premiumRouteSet.has(routeName);
}

export function canCreateClientForPlan(isPro: boolean, currentClientCount: number): boolean {
  return isPro || currentClientCount < FREE_TIER_LIMITS.maxClients;
}

export function canCreateInvoiceForPlan(isPro: boolean, activeInvoiceCount: number): boolean {
  return isPro || activeInvoiceCount < FREE_TIER_LIMITS.maxActiveInvoices;
}

export type SubscriptionPlanKey = 'monthly' | 'yearly';

export function selectAvailableSubscriptionPlan(
  preferred: SubscriptionPlanKey,
  availability: Record<SubscriptionPlanKey, boolean>
): SubscriptionPlanKey | null {
  if (availability[preferred]) return preferred;
  if (availability.yearly) return 'yearly';
  if (availability.monthly) return 'monthly';
  return null;
}
