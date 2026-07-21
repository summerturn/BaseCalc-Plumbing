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
  },
}));

import Purchases, {
  type PurchasesOfferings,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import { SubscriptionService } from '../src/services/SubscriptionService';

const purchasesMock = jest.mocked(Purchases);

function product(identifier: string): PurchasesStoreProduct {
  return { identifier, priceString: '$7.00' } as PurchasesStoreProduct;
}

describe('SubscriptionService storefront validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    purchasesMock.getProducts.mockResolvedValueOnce([configuredProduct]);

    const result = await SubscriptionService.getStorefront();

    expect(result.offering).toBeNull();
    expect(result.packages.monthly).toBeNull();
    expect(result.products.monthly).toBe(configuredProduct);
  });
});
