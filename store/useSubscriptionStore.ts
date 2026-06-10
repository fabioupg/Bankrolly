import { create } from 'zustand';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import {
  Purchases,
  configurePurchases,
  fetchCustomerInfo,
  fetchOfferings,
  hasProEntitlement,
  identifyPurchases,
  isPurchasesConfigurable,
} from '@/lib/revenuecat';

interface SubscriptionState {
  ready: boolean;
  configurable: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  loading: boolean;
  lastError: string | null;
  init: (userId: string | null) => Promise<void>;
  identify: (userId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<{ success: boolean; userCanceled: boolean; error?: string }>;
  restore: () => Promise<{ success: boolean; error?: string }>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  ready: false,
  configurable: isPurchasesConfigurable(),
  isPro: false,
  customerInfo: null,
  offering: null,
  loading: false,
  lastError: null,

  init: async (userId) => {
    set({ loading: true, lastError: null });
    try {
      await configurePurchases(userId);
      const [info, offering] = await Promise.all([fetchCustomerInfo(), fetchOfferings()]);
      set({
        ready: true,
        customerInfo: info,
        offering,
        isPro: hasProEntitlement(info),
        loading: false,
        lastError: offering ? null : 'Offering "default" not loaded — check RevenueCat dashboard',
      });
    } catch (err) {
      set({
        ready: true,
        loading: false,
        lastError: (err as Error)?.message ?? 'Init failed',
      });
    }
  },

  identify: async (userId) => {
    if (!get().configurable) return;
    await identifyPurchases(userId);
    await get().refresh();
  },

  refresh: async () => {
    if (!get().configurable) return;
    try {
      const [info, offering] = await Promise.all([fetchCustomerInfo(), fetchOfferings()]);
      set({
        customerInfo: info,
        offering,
        isPro: hasProEntitlement(info),
        lastError: offering ? null : 'Offering "default" not loaded — check RevenueCat dashboard',
      });
    } catch (err) {
      set({ lastError: (err as Error)?.message ?? 'Refresh failed' });
    }
  },

  purchase: async (pkg) => {
    if (!get().configurable) {
      return { success: false, userCanceled: false, error: 'Purchases unavailable on this build' };
    }
    set({ loading: true });
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPro = hasProEntitlement(customerInfo);
      set({ customerInfo, isPro, loading: false });
      if (!isPro) {
        // Purchase went through but the "pro" entitlement is not active —
        // surface it instead of failing silently.
        return {
          success: false,
          userCanceled: false,
          error:
            'Your purchase completed but Pro could not be activated. Tap "Restore purchases" or contact bankrolly@fabulousio.com.',
        };
      }
      return { success: true, userCanceled: false };
    } catch (err: unknown) {
      const e = err as { userCancelled?: boolean; message?: string };
      set({ loading: false });
      return {
        success: false,
        userCanceled: Boolean(e?.userCancelled),
        error: e?.message,
      };
    }
  },

  restore: async () => {
    if (!get().configurable) {
      return { success: false, error: 'Purchases unavailable on this build' };
    }
    set({ loading: true });
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPro = hasProEntitlement(customerInfo);
      set({ customerInfo, isPro, loading: false });
      return { success: isPro };
    } catch (err: unknown) {
      const e = err as { message?: string };
      set({ loading: false });
      return { success: false, error: e?.message };
    }
  },
}));
