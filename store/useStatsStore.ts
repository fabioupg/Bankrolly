import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  biggestLosses,
  biggestWins,
  buildBankrollSeries,
  cashProfit,
  currentStreak,
  hourlyByStakes,
  hourlyByVenue,
  hourlyRate,
  isLosingStreak,
  itmPercent,
  maxDrawdown,
  profitByWeekday,
  profitInRange,
  profitStdDev,
  tournamentInvested,
  tournamentNet,
  tournamentRoiOverTime,
  unifySessions,
  type SessionEntry,
  type StakesStat,
  type Streak,
  type VenueStat,
  type WeekdayStat,
  type BankrollPoint,
  type RoiPoint,
} from '@/utils/calculations';
import { startOfMonthISO } from '@/utils/formatters';
import type { Currency } from '@/utils/formatters';
import { onlineNet } from '@/utils/onlineSession';
import { useSessionStore } from './useSessionStore';
import { useTournamentStore } from './useTournamentStore';
import { useOnlineSessionStore } from './useOnlineSessionStore';

interface SettingsState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** Monthly profit goal in the display currency; 0 = no goal set. */
  monthlyProfitTarget: number;
  setMonthlyProfitTarget: (n: number) => void;
  /** Monthly hours-played goal; 0 = no goal set. */
  monthlyHoursTarget: number;
  setMonthlyHoursTarget: (n: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),
      monthlyProfitTarget: 0,
      setMonthlyProfitTarget: (monthlyProfitTarget) => set({ monthlyProfitTarget }),
      monthlyHoursTarget: 0,
      setMonthlyHoursTarget: (monthlyHoursTarget) => set({ monthlyHoursTarget }),
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
  onlineProfit: number;
  totalCashMinutes: number;
  hourlyRate: number;
  totalTournamentMinutes: number;
  mttHourlyRate: number;
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
  stakesStats: StakesStat[];
  weekdayProfit: WeekdayStat[];
  profitStdDev: number;
  maxDrawdown: number;
  avgCashBuyIn: number;
  roiOverTime: RoiPoint[];
  biggestWins: SessionEntry[];
  biggestLosses: SessionEntry[];
}

/**
 * Derives every stat from the session stores. Pass a date-only ISO string
 * (YYYY-MM-DD) to restrict everything to sessions on or after that date.
 */
export function useDerivedStats(sinceIso?: string): DerivedStats {
  const cashAll = useSessionStore((s) => s.sessions);
  const tourneysAll = useTournamentStore((s) => s.tourneys);
  const onlineAll = useOnlineSessionStore((s) => s.sessions);

  const cash = sinceIso ? cashAll.filter((c) => c.date >= sinceIso) : cashAll;
  const tourneys = sinceIso ? tourneysAll.filter((t) => t.date >= sinceIso) : tourneysAll;
  const online = sinceIso ? onlineAll.filter((o) => o.date >= sinceIso) : onlineAll;

  const cashProfitTotal = cash.reduce((sum, c) => sum + cashProfit(c), 0);
  const totalCashMinutes = cash.reduce((sum, c) => sum + c.durationMinutes, 0);
  const tInvested = tourneys.reduce((sum, t) => sum + tournamentInvested(t), 0);
  const tReturn = tourneys.reduce((sum, t) => sum + t.prize + t.bounties, 0);
  const tournamentProfitTotal = tourneys.reduce((sum, t) => sum + tournamentNet(t), 0);
  const totalTournamentMinutes = tourneys.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  const timedTournamentProfit = tourneys
    .filter((t) => t.durationMinutes > 0)
    .reduce((sum, t) => sum + tournamentNet(t), 0);
  const onlineProfitTotal = online.reduce((sum, o) => sum + onlineNet(o), 0);

  const unified = unifySessions(cash, tourneys, online);
  const oldestFirst = [...unified].reverse();
  const series = buildBankrollSeries(cash, tourneys, online);
  const monthStart = startOfMonthISO();

  return {
    totalProfit: cashProfitTotal + tournamentProfitTotal + onlineProfitTotal,
    cashProfit: cashProfitTotal,
    tournamentProfit: tournamentProfitTotal,
    onlineProfit: onlineProfitTotal,
    totalCashMinutes,
    hourlyRate: hourlyRate(cashProfitTotal, totalCashMinutes),
    totalTournamentMinutes,
    // Rate over tournaments that recorded a duration only — mixing in
    // zero-minute tourneys would inflate the hourly.
    mttHourlyRate: hourlyRate(timedTournamentProfit, totalTournamentMinutes),
    totalTournamentInvested: tInvested,
    totalTournamentReturn: tReturn,
    tournamentROI: tInvested > 0 ? ((tReturn - tInvested) / tInvested) * 100 : 0,
    itmPercent: itmPercent(tourneys),
    thisMonthProfit: profitInRange(unified, monthStart),
    streak: currentStreak(oldestFirst.map((e) => e.profit)),
    losingStreakWarning: isLosingStreak(oldestFirst.map((e) => e.profit), 5),
    totalSessions: cash.length + tourneys.length + online.length,
    totalCashSessions: cash.length,
    totalTournaments: tourneys.length,
    recent: unified.slice(0, 5),
    unified,
    bankrollSeries: series,
    venueStats: hourlyByVenue(cash),
    stakesStats: hourlyByStakes(cash),
    weekdayProfit: profitByWeekday(unified),
    profitStdDev: profitStdDev(unified.map((e) => e.profit)),
    maxDrawdown: maxDrawdown(series),
    avgCashBuyIn: cash.length ? cash.reduce((s, c) => s + c.buyIn, 0) / cash.length : 0,
    roiOverTime: tournamentRoiOverTime(tourneys),
    biggestWins: biggestWins(unified, 5),
    biggestLosses: biggestLosses(unified, 5),
  };
}
