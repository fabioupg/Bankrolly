import { useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';
import { CardBack, PlayingCard } from '@/components/PlayingCard';
import { CARD_ASPECT, parseCards } from '@/utils/cards';
import { seatLayout, type TableState } from '@/utils/table';
import { colors, typography } from '@/theme/colors';

// Container aspect ratio (height / width). Tall enough that nine seat circles
// fit around the rim without crowding, like a classic replayer table.
const ASPECT = 0.95;
const SEAT_W = 68;
const SEAT_H = 100;
const CIRCLE = 54;
const SEAT_CARD_H = 32;
const BOARD_CARD_H = 36;

interface Props {
  state: TableState;
  /** Hero hole cards, space-separated (e.g. "Ah Kd"), shown on the hero seat. */
  heroCards: string;
  /** Community cards, space-separated; empty slots render as outlines. */
  board?: string;
  onSeatPress?: (index: number) => void;
  /** Seats rendered faded, e.g. players who folded during a replay. */
  dimmedSeats?: readonly number[];
  /** Seat highlighted as currently acting during a replay. */
  activeSeat?: number | null;
}

/**
 * Visual poker table in the classic replayer style: every seat is a circle
 * with two cards on top (face-down for unknown holdings, face-up for the hero
 * or a tagged villain), the board sits in the middle of the felt, and the
 * dealer button is a white "B" chip. Tap a seat to edit player & actions.
 */
export function PokerTable({
  state,
  heroCards,
  board = '',
  onSeatPress,
  dimmedSeats,
  activeSeat = null,
}: Props) {
  const [width, setWidth] = useState(0);
  const height = width * ASPECT;
  const seats = seatLayout(state.playerCount);
  const hero = parseCards(heroCards);
  const boardCards = parseCards(board).slice(0, 5);

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
              rx={width * 0.43}
              ry={height * 0.43}
              fill={colors.accentDark}
            />
            <Ellipse
              cx={width / 2}
              cy={height / 2}
              rx={width * 0.395}
              ry={height * 0.395}
              fill={colors.felt}
              stroke={colors.borderStrong}
              strokeWidth={1}
            />
          </Svg>

          {/* Board + logo, centered on the felt */}
          <View style={[styles.center, { top: height / 2 - (BOARD_CARD_H + 40) / 2 }]}>
            <View style={styles.boardRow}>
              {Array.from({ length: 5 }, (_, i) =>
                boardCards[i] ? (
                  <PlayingCard key={i} card={boardCards[i]} height={BOARD_CARD_H} />
                ) : (
                  <View
                    key={i}
                    style={[
                      styles.boardSlot,
                      { height: BOARD_CARD_H, width: BOARD_CARD_H * CARD_ASPECT },
                    ]}
                  />
                ),
              )}
            </View>
            <Text style={styles.logoText} allowFontScaling={false}>
              BANKROLLY
            </Text>
          </View>

          {/* Seats */}
          {seats.map((pt) => {
            const seat = state.seats[pt.index];
            if (!seat) return null;
            const left = pt.xPct * width - SEAT_W / 2;
            const top = pt.yPct * height - SEAT_H / 2;
            const isButton = state.buttonSeat === pt.index;
            const lastAction = seat.actions[seat.actions.length - 1];
            const seatCards = seat.isHero ? hero : parseCards(seat.cards);
            const showFaces = seatCards.length > 0;
            const dimmed = dimmedSeats?.includes(pt.index) ?? false;
            const active = activeSeat === pt.index;

            return (
              <Pressable
                key={pt.index}
                onPress={onSeatPress ? () => onSeatPress(pt.index) : undefined}
                disabled={!onSeatPress}
                style={({ pressed }) => [
                  styles.seat,
                  { left, top, width: SEAT_W, height: SEAT_H },
                  dimmed && styles.seatDimmed,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {/* Cards peek out above the seat circle */}
                <View style={styles.seatCards}>
                  {showFaces ? (
                    // Index in the key: persisted tableState JSON is not validated,
                    // so the same card code could legally appear twice.
                    seatCards.map((c, i) => (
                      <PlayingCard
                        key={`${c}-${i}`}
                        card={c}
                        height={seatCards.length > 2 ? SEAT_CARD_H - 8 : SEAT_CARD_H}
                      />
                    ))
                  ) : (
                    <>
                      <CardBack height={SEAT_CARD_H} />
                      <CardBack height={SEAT_CARD_H} style={{ marginLeft: -4 }} />
                    </>
                  )}
                </View>

                <View
                  style={[
                    styles.circle,
                    seat.isHero && styles.circleHero,
                    active && styles.circleActive,
                  ]}
                >
                  <Text style={styles.pos} allowFontScaling={false}>
                    {seat.position}
                  </Text>
                </View>

                {/* Name under the circle: hero always, villains when tagged */}
                {(seat.isHero || seat.name) && (
                  <Text
                    style={[styles.name, seat.isHero && styles.nameHero]}
                    numberOfLines={1}
                  >
                    {seat.isHero ? seat.name || 'Hero' : seat.name}
                  </Text>
                )}
                {lastAction ? (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionText} numberOfLines={1}>
                      {lastAction.action}
                      {lastAction.size ? ` ${lastAction.size}` : ''}
                    </Text>
                  </View>
                ) : null}

                {isButton ? (
                  <View style={styles.dealer}>
                    <Text style={styles.dealerText} allowFontScaling={false}>
                      B
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
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  boardRow: {
    flexDirection: 'row',
    gap: 4,
  },
  boardSlot: {
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  logoText: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 4,
  },
  seat: {
    position: 'absolute',
    alignItems: 'center',
  },
  seatDimmed: {
    opacity: 0.35,
  },
  seatCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: SEAT_W,
    zIndex: 2,
    marginBottom: -CIRCLE * 0.36,
    gap: 2,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 7,
  },
  circleHero: {
    borderColor: colors.profit,
  },
  circleActive: {
    borderColor: colors.accent,
    borderWidth: 3,
  },
  pos: {
    color: colors.text,
    fontSize: typography.micro,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  name: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    maxWidth: SEAT_W,
  },
  nameHero: {
    color: colors.text,
  },
  actionBadge: {
    marginTop: 2,
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    maxWidth: SEAT_W,
  },
  actionText: {
    color: '#fff',
    fontSize: typography.micro,
    fontWeight: '700',
  },
  dealer: {
    position: 'absolute',
    top: SEAT_CARD_H - 10,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    borderWidth: 1,
    borderColor: '#c8cdd6',
  },
  dealerText: {
    color: colors.accentDark,
    fontSize: 13,
    fontWeight: '900',
  },
});
