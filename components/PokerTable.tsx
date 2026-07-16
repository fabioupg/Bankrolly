import { useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import { PlayingCard } from '@/components/PlayingCard';
import { parseCards } from '@/utils/cards';
import { seatLayout, type TableState } from '@/utils/table';
import { colors, radius, typography } from '@/theme/colors';

const LOGO = require('@/assets/table-logo.png');

// Container aspect ratio (height / width). A slightly squashed oval reads as a
// poker table without eating too much vertical space in the form.
const ASPECT = 0.74;
const SEAT_W = 74;
const SEAT_H = 58;

interface Props {
  state: TableState;
  /** Hero hole cards, space-separated (e.g. "Ah Kd"), shown on the hero seat. */
  heroCards: string;
  onSeatPress: (index: number) => void;
}

/**
 * Visual poker table: a felt oval with the Bankrolly logo in the middle and a
 * tappable seat for every player. Seat positions, the dealer button and the
 * hero highlight are all derived from the passed `TableState`.
 */
export function PokerTable({ state, heroCards, onSeatPress }: Props) {
  const [width, setWidth] = useState(0);
  const height = width * ASPECT;
  const seats = seatLayout(state.playerCount);
  const hero = parseCards(heroCards);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 ? (
        <View style={{ width, height }}>
          {/* Felt + rail */}
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Ellipse
              cx={width / 2}
              cy={height / 2}
              rx={width * 0.42}
              ry={height * 0.42}
              fill={colors.accentDark}
            />
            <Ellipse
              cx={width / 2}
              cy={height / 2}
              rx={width * 0.385}
              ry={height * 0.385}
              fill={colors.felt}
              stroke={colors.borderStrong}
              strokeWidth={1}
            />
          </Svg>

          {/* Center logo */}
          <View style={[styles.logoWrap, { left: width / 2 - 56, top: height / 2 - 28 }]}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Seats */}
          {seats.map((pt) => {
            const seat = state.seats[pt.index];
            if (!seat) return null;
            const left = pt.xPct * width - SEAT_W / 2;
            const top = pt.yPct * height - SEAT_H / 2;
            const isButton = state.buttonSeat === pt.index;
            const lastAction = seat.actions[seat.actions.length - 1];
            const label = seat.isHero ? 'Hero' : seat.name || 'Empty';
            const seatCards = seat.isHero ? hero : parseCards(seat.cards);

            return (
              <Pressable
                key={pt.index}
                onPress={() => onSeatPress(pt.index)}
                style={({ pressed }) => [
                  styles.seat,
                  { left, top, width: SEAT_W, minHeight: SEAT_H },
                  seat.isHero && styles.seatHero,
                  !seat.name && !seat.isHero && styles.seatEmpty,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {isButton ? (
                  <View style={styles.dealer}>
                    <Text style={styles.dealerText}>D</Text>
                  </View>
                ) : null}

                {seatCards.length > 0 ? (
                  <View style={styles.heroCards}>
                    {seatCards.map((c) => (
                      <PlayingCard key={c} card={c} height={26} />
                    ))}
                  </View>
                ) : null}

                <Text style={styles.pos}>{seat.position}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {label}
                </Text>

                {lastAction ? (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionText} numberOfLines={1}>
                      {lastAction.action}
                      {lastAction.size ? ` ${lastAction.size}` : ''}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
  logoWrap: {
    position: 'absolute',
    width: 112,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.92,
  },
  logo: {
    width: 112,
    height: 56,
  },
  seat: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
  },
  seatHero: {
    borderColor: colors.profit,
    backgroundColor: colors.accentSoft,
  },
  seatEmpty: {
    borderStyle: 'dashed',
    backgroundColor: colors.bgElevated,
  },
  heroCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 2,
    maxWidth: SEAT_W - 4,
  },
  pos: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  name: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '600',
    maxWidth: SEAT_W - 8,
  },
  actionBadge: {
    marginTop: 2,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    maxWidth: SEAT_W - 4,
  },
  actionText: {
    color: '#fff',
    fontSize: typography.micro,
    fontWeight: '700',
  },
  dealer: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.warn,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dealerText: {
    color: '#1a1205',
    fontSize: typography.micro,
    fontWeight: '900',
  },
});
