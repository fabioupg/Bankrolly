import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases';

export const PRO_ENTITLEMENT_ID = 'pro';

// Public RevenueCat SDK keys — safe to ship in the binary (they are not secrets).
// Hardcoded fallback so a missing EXPO_PUBLIC_* env var at build/update time can
// never disable purchases in a store build again (App Review rejection 2.1(b)).
const IOS_KEY_FALLBACK = 'appl_aIhsPthcSiyJaFpPopaejSOwzBu';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || IOS_KEY_FALLBACK;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';

export function getApiKey(): string {
  if (Platform.OS === 'ios') return IOS_KEY;
  if (Platform.OS === 'android') return ANDROID_KEY;
  return '';
}

export function isPurchasesConfigurable(): boolean {
  if (Platform.OS === 'web') return false;
  return Boolean(getApiKey());
}

let configured = false;

export async function configurePurchases(userId: string | null): Promise<void> {
  if (!isPurchasesConfigurable()) return;
  if (!configured) {
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.WARN);
    }
    Purchases.configure({
      apiKey: getApiKey(),
      appUserID: userId,
    });
    configured = true;
  } else if (userId) {
    try {
      await Purchases.logIn(userId);
    } catch {
      // ignore
    }
  }
}

export async function identifyPurchases(userId: string | null): Promise<void> {
  if (!isPurchasesConfigurable() || !configured) return;
  try {
    if (userId) await Purchases.logIn(userId);
    else await Purchases.logOut();
  } catch {
    // ignore — anonymous calls allowed
  }
}

export function hasProEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return Boolean(info.entitlements.active[PRO_ENTITLEMENT_ID]);
}

export async function fetchCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isPurchasesConfigurable() || !configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export async function fetchOfferings(): Promise<PurchasesOffering | null> {
  if (!isPurchasesConfigurable() || !configured) return null;
  // Errors intentionally propagate so the store can surface the real
  // StoreKit/RevenueCat message instead of a generic "not loaded".
  const offerings = await Purchases.getOfferings();
  if (offerings.current) return offerings.current;
  // No "current" offering set in the RevenueCat dashboard — fall back to
  // the "default" offering, then to the first available one.
  if (offerings.all['default']) return offerings.all['default'];
  const first = Object.values(offerings.all)[0];
  return first ?? null;
}

export { Purchases };
export type { CustomerInfo, PurchasesOffering };
