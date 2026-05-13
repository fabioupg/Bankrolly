import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases';

export const PRO_ENTITLEMENT_ID = 'pro';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
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
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export { Purchases };
export type { CustomerInfo, PurchasesOffering };
