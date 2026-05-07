import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  biggestLosses,
  biggestWins,
  buildBankrollSeries,
  cashProfit,
  currentStreak,
  hourlyByVenue,
  hourlyRate,
  isLosingStreak,
  itmPercent,
  profitInRange,
  tournamentInvested,
  tournamentNet,
  tournamentRoiOverTime,
  unifySessions,
  type SessionEntry,
  type Streak,
  type VenueStat,
  type BankrollPoint,
  type RoiPoint,
} from '@/utils/calculations';
import { startOfMonthISO } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';
import { useSessionStore } from './useSessionStore';
import { useTournamentStore } from './useTournamentStore';

interface SettingsState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'pokerledger-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export interface DerivedStats {
  totalProfit: number;
  cashProfit: number;
  tournamentProfit: number;
  totalCashMinutes: number;
  hourlyRate: number;
  totalTournamentInvested: number;
  totalTournamentReturn: number;
  tournamentROI: number;
  itmPercent: number;
  thisMonthProfit: number;
  streak: Streak;
  losingStreakWarning: boolean;
  totalSessions: number;
  totalCashSessions: number;
  totalTournaments: number;
  recent: SessionEntry[];
  unified: SessionEntry[];
  bankrollSeries: BankrollPoint[];
  venueStats: VenueStat[];
  roiOverTime: RoiPoint[];
  biggestWins: SessionEntry[];
  biggestLosses: SessionEntry[];
}

export function useDerivedStats(): DerivedStats {
  const cash = useSessionStore((s) => s.sessions);
  const tourneys = useTournamentStore((s) => s.tourneys);

  const cashProfitTotal = cash.reduce((sum, c) => sum + cashProfit(c), 0);
  const totalCashMinutes = cash.reduce((sum, c) => sum + c.durationMinutes, 0);
  const tInvested = tourneys.reduce((sum, t) => sum + tournamentInvested(t), 0);
  const tReturn = tourneys.reduce((sum, t) => sum + t.prize + t.bounties, 0);
  const tournamentProfitTotal = tourneys.reduce((sum, t) => sum + tournamentNet(t), 0);

  const unified = unifySessions(cash, tourneys);
  const oldestFirst = [...unified].reverse();
  const series = buildBankrollSeries(cash, tourneys);
  const monthStart = startOfMonthISO();

  return {
    totalProfit: cashProfitTotal + tournamentProfitTotal,
    cashProfit: cashProfitTotal,
    tournamentProfit: tournamentProfitTotal,
    totalCashMinutes,
    hourlyRate: hourlyRate(cashProfitTotal, totalCashMinutes),
    totalTournamentInvested: tInvested,
    totalTournamentReturn: tReturn,
    tournamentROI: tInvested > 0 ? ((tReturn - tInvested) / tInvested) * 100 : 0,
    itmPercent: itmPercent(tourneys),
    thisMonthProfit: profitInRange(unified, monthStart),
    streak: currentStreak(oldestFirst.map((e) => e.profit)),
    losingStreakWarning: isLosingStreak(oldestFirst.map((e) => e.profit), 5),
    totalSessions: cash.length + tourneys.length,
    totalCashSessions: cash.length,
    totalTournaments: tourneys.length,
    recent: unified.slice(0, 5),
    unified,
    bankrollSeries: series,
    venueStats: hourlyByVenue(cash),
    roiOverTime: tournamentRoiOverTime(tourneys),
    biggestWins: biggestWins(unified, 5),
    biggestLosses: biggestLosses(unified, 5),
  };
}
