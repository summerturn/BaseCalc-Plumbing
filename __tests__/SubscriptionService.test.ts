jest.mock('../src/lib/config', () => ({
  CONFIG: {
    revenueCat: {
      iosApiKey: 'appl_test_public_key',
      androidApiKey: 'goog_test_public_key',
    },
  },
  isRevenueCatConfigured: jest.fn(() => true),
  SUBSCRIPTION_ENTITLEMENT_ID: 'pro',
  SUBSCRIPTION_TIERS: {
    monthly: 'basecalc_plumbing_pro_monthly',
    yearly: 'basecalc_plumbing_pro_yearly',
  },
  LIFETIME_PRODUCT_ID: 'basecalc_plumbing_pro_lifetime',
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getOfferings: jest.fn(),
    getProducts: jest.fn(),
    purchasePackage: jest.fn(),
    purchaseStoreProduct: jest.fn(),
    restorePurchases: jest.fn(),
    getCustomerInfo: jest.fn(),
    invalidateCustomerInfoCache: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
    logIn: jest.fn(),
  },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
  },
  PURCHASE_TYPE: {
    SUBS: 'SUBS',
    INAPP: 'INAPP',
  },
}));

import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import { isRevenueCatConfigured } from '../src/lib/config';
import { SubscriptionService } from '../src/services/SubscriptionService';

const purchasesMock = jest.mocked(Purchases);
const revenueCatConfiguredMock = jest.mocked(isRevenueCatConfigured);

function expectRestoreDoesNotPurchase(): void {
  expect(purchasesMock.purchasePackage).not.toHaveBeenCalled();
  expect(purchasesMock.purchaseStoreProduct).not.toHaveBeenCalled();
}

function customerInfo(activeEntitlements: Record<string, { isActive: boolean; productIdentifier?: string; willRenew?: boolean }>): CustomerInfo {
  return {
    entitlements: {
      active: activeEntitlements,
    },
  } as unknown as CustomerInfo;
}

function product(identifier: string): PurchasesStoreProduct {
  return { identifier, priceString: '$7.00' } as PurchasesStoreProduct;
}

describe('SubscriptionService storefront validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    revenueCatConfiguredMock.mockReturnValue(true);
  });

  test('fails closed on cold start without a platform store key and does not call RevenueCat', async () => {
    revenueCatConfiguredMock.mockReturnValue(false);

    await expect(SubscriptionService.restorePurchases())
      .rejects.toThrow('Store checkout is not available in this build.');

    expect(purchasesMock.configure).not.toHaveBeenCalled();
    expect(purchasesMock.restorePurchases).not.toHaveBeenCalled();
    expectRestoreDoesNotPurchase();
  });

  test('restores lifetime ownership when RevenueCat returns the active Pro entitlement', async () => {
    purchasesMock.restorePurchases.mockResolvedValueOnce(
      customerInfo({ pro: { isActive: true, productIdentifier: 'basecalc_plumbing_pro_lifetime', willRenew: false } })
    );

    await expect(SubscriptionService.restorePurchases()).resolves.toBe(true);

    expect(purchasesMock.restorePurchases).toHaveBeenCalledTimes(1);
    expectRestoreDoesNotPurchase();
  });

  test('restores an active legacy subscription through the shared Pro entitlement', async () => {
    purchasesMock.restorePurchases.mockResolvedValueOnce(
      customerInfo({ pro: { isActive: true, productIdentifier: 'basecalc_plumbing_pro_monthly', willRenew: true } })
    );

    await expect(SubscriptionService.restorePurchases()).resolves.toBe(true);
    expectRestoreDoesNotPurchase();
  });

  test.each([
    ['no active entitlements', customerInfo({})],
    ['inactive Pro entitlement', customerInfo({ pro: { isActive: false } })],
  ])('does not grant Pro for %s', async (_label, restoredInfo) => {
    purchasesMock.restorePurchases.mockResolvedValueOnce(restoredInfo);

    await expect(SubscriptionService.restorePurchases()).resolves.toBe(false);
    expectRestoreDoesNotPurchase();
  });

  test('propagates a store SDK failure so the paywall can report restore failure', async () => {
    const sdkError = new Error('Store service unavailable');
    purchasesMock.restorePurchases.mockRejectedValueOnce(sdkError);

    await expect(SubscriptionService.restorePurchases()).rejects.toBe(sdkError);
    expectRestoreDoesNotPurchase();
  });

  test('ignores legacy package slots whose products do not match configured SKUs', async () => {
    const legacyPackage = {
      identifier: '$rc_monthly',
      product: product('legacy_plumbing_monthly'),
    } as PurchasesPackage;
    const legacyOffering = {
      identifier: 'legacy',
      availablePackages: [legacyPackage],
      monthly: legacyPackage,
      annual: null,
    } as unknown as PurchasesOfferings['current'];
    const configuredProduct = product('basecalc_plumbing_pro_monthly');
    purchasesMock.getOfferings.mockResolvedValueOnce({
      current: legacyOffering,
      all: { legacy: legacyOffering },
    } as PurchasesOfferings);
    // First call resolves the SUBS (monthly/yearly) fallback, second resolves the INAPP (lifetime) fallback.
    purchasesMock.getProducts.mockResolvedValueOnce([configuredProduct]).mockResolvedValueOnce([]);

    const result = await SubscriptionService.getStorefront();

    expect(result.offering).toBeNull();
    expect(result.packages.monthly).toBeNull();
    expect(result.products.monthly).toBe(configuredProduct);
    expect(result.products.lifetime).toBeNull();
  });

  test('resolves the lifetime package from the current offering', async () => {
    const monthlyPackage = {
      identifier: '$rc_monthly',
      product: product('basecalc_plumbing_pro_monthly'),
    } as PurchasesPackage;
    const yearlyPackage = {
      identifier: '$rc_annual',
      product: product('basecalc_plumbing_pro_yearly'),
    } as PurchasesPackage;
    const lifetimePackage = {
      identifier: '$rc_lifetime',
      product: product('basecalc_plumbing_pro_lifetime'),
    } as PurchasesPackage;
    const offering = {
      identifier: 'default',
      availablePackages: [monthlyPackage, yearlyPackage, lifetimePackage],
    } as unknown as PurchasesOfferings['current'];
    purchasesMock.getOfferings.mockResolvedValueOnce({
      current: offering,
      all: { default: offering },
    } as PurchasesOfferings);

    const result = await SubscriptionService.getStorefront();

    expect(result.packages.lifetime).toBe(lifetimePackage);
    expect(result.products.lifetime?.identifier).toBe('basecalc_plumbing_pro_lifetime');
    expect(purchasesMock.getProducts).not.toHaveBeenCalled();
  });

  test('falls back to a direct INAPP lookup for lifetime when no offering package matches', async () => {
    purchasesMock.getOfferings.mockResolvedValueOnce({ current: null, all: {} } as PurchasesOfferings);
    const lifetimeProduct = product('basecalc_plumbing_pro_lifetime');
    purchasesMock.getProducts.mockResolvedValueOnce([]).mockResolvedValueOnce([lifetimeProduct]);

    const result = await SubscriptionService.getStorefront();

    expect(result.products.lifetime).toBe(lifetimeProduct);
    expect(purchasesMock.getProducts).toHaveBeenLastCalledWith(
      ['basecalc_plumbing_pro_lifetime'],
      'INAPP'
    );
  });
});
