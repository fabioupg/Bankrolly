import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CARD_ASPECT, normalizeCard } from '@/utils/cards';

const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const RED = '#e03131';
const BLACK = '#1c2230';

interface Props {
  card: string;
  /** Rendered card height in points; width is derived from the card aspect ratio. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders a playing card natively (rank + suit glyph on a white face) instead
 * of clipping a sprite sheet — crisp at every size and immune to asset issues.
 * Unparseable values fall back to a face-down card back.
 */
export function PlayingCard({ card, height = 60, style }: Props) {
  const c = normalizeCard(card);
  const width = height * CARD_ASPECT;
  const borderRadius = Math.max(3, height * 0.12);

  if (!c) return <CardBack height={height} style={style} />;

  const suit = c[1];
  const color = suit === 'h' || suit === 'd' ? RED : BLACK;
  const rank = c[0] === 'T' ? '10' : c[0];

  return (
    <View style={[styles.face, { width, height, borderRadius }, style]}>
      <Text
        allowFontScaling={false}
        style={{
          color,
          fontSize: height * 0.4,
          lineHeight: height * 0.46,
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {rank}
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          color,
          fontSize: height * 0.36,
          lineHeight: height * 0.42,
          textAlign: 'center',
          marginTop: -height * 0.04,
        }}
      >
        {SUIT_GLYPH[suit]}
      </Text>
    </View>
  );
}

/** A face-down card: red back with an inner frame, like a real deck. */
export function CardBack({ height = 60, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const width = height * CARD_ASPECT;
  const borderRadius = Math.max(3, height * 0.12);
  return (
    <View style={[styles.back, { width, height, borderRadius }, style]}>
      <View
        style={[
          styles.backInner,
          {
            width: Math.max(2, width - height * 0.16),
            height: Math.max(2, height - height * 0.16),
            borderRadius: Math.max(2, borderRadius - 2),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#b9c0cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    backgroundColor: '#c22434',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8f1a26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backInner: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
