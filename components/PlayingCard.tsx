import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { SHEET, CELL_W, CELL_H, CARD_ASPECT, cardSpritePos } from '@/utils/cards';

const SOURCE = require('@/assets/cards.png');

interface Props {
  card: string;
  /** Rendered card height in points; width is derived from the card aspect ratio. */
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders a single playing card by clipping the shared sprite sheet to one cell.
 * Uses only the one asset (no 52 individual images): the full sheet is scaled and
 * offset inside an overflow-hidden container so exactly one card shows.
 */
export function PlayingCard({ card, height = 60, style }: Props) {
  const pos = cardSpritePos(card);
  const width = height * CARD_ASPECT;
  const borderRadius = Math.max(3, height * 0.09);

  if (!pos) {
    return (
      <View
        style={[
          { width, height, borderRadius, backgroundColor: '#1c2230', borderWidth: 1, borderColor: '#2a3344' },
          style,
        ]}
      />
    );
  }

  const scale = height / CELL_H;
  return (
    <View style={[{ width, height, borderRadius, overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <Image
        source={SOURCE}
        style={{
          width: SHEET.width * scale,
          height: SHEET.height * scale,
          position: 'absolute',
          left: -pos.col * CELL_W * scale,
          top: -pos.row * CELL_H * scale,
        }}
      />
    </View>
  );
}
