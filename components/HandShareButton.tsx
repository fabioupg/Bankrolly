import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { parseCards } from '@/utils/cards';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface Props {
  heroCards: string;
  board: string;
  position: string;
  street: string;
  result: number;
  actionLine: string;
}

const W = 640;
const H = 380;
const CARD_W = 58;
const CARD_H = 82;
const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

function suitColor(suit: string): string {
  return suit === 'h' || suit === 'd' ? '#e23b3b' : '#16202b';
}

function ShareCard({ x, y, code }: { x: number; y: number; code: string }) {
  const rank = code[0] === 'T' ? '10' : code[0];
  const suit = code[1];
  return (
    <G>
      <Rect x={x} y={y} width={CARD_W} height={CARD_H} rx={8} fill="#f7f7f2" />
      <SvgText x={x + 8} y={y + 26} fontSize={22} fontWeight="bold" fill={suitColor(suit)}>
        {rank}
      </SvgText>
      <SvgText x={x + CARD_W / 2} y={y + CARD_H - 18} fontSize={34} textAnchor="middle" fill={suitColor(suit)}>
        {SUIT_GLYPH[suit] ?? '?'}
      </SvgText>
    </G>
  );
}

/**
 * Renders the hand as a branded poker graphic (offscreen) and shares it as a
 * PNG. Uses react-native-svg's toDataURL so no native capture dependency is
 * needed; the file is written + shared the same way the CSV export works.
 */
export function HandShareButton({ heroCards, board, position, street, result, actionLine }: Props) {
  const svgRef = useRef<Svg>(null);
  const [sharing, setSharing] = useState(false);

  const hero = parseCards(heroCards);
  const boardCards = parseCards(board);
  const canShare = hero.length > 0 || boardCards.length > 0;
  const resultLabel = result > 0 ? `+${result}` : `${result}`;
  const firstLine = actionLine.split('\n')[0]?.slice(0, 64) ?? '';

  const share = () => {
    const ref = svgRef.current as unknown as { toDataURL?: (cb: (b64: string) => void) => void } | null;
    if (!ref?.toDataURL) {
      Alert.alert('Share failed', 'Could not render the image on this device.');
      return;
    }
    setSharing(true);
    ref.toDataURL(async (base64: string) => {
      try {
        const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        if (!dir) throw new Error('No writable directory available');
        const path = `${dir}bankrolly-hand-${Date.now()}.png`;
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path, { mimeType: 'image/png', dialogTitle: 'Share hand' });
        } else {
          Alert.alert('Saved', 'Sharing is not available on this device.');
        }
      } catch (e) {
        Alert.alert('Share failed', (e as Error).message);
      } finally {
        setSharing(false);
      }
    });
  };

  return (
    <View>
      <Pressable
        onPress={share}
        disabled={!canShare || sharing}
        style={[styles.btn, (!canShare || sharing) && styles.btnDisabled]}
      >
        {sharing ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.btnLabel}>📤 Share hand as image</Text>
        )}
      </Pressable>
      {!canShare ? <Text style={styles.hint}>Add hero cards or a board to share.</Text> : null}

      {/* Offscreen render target captured by toDataURL. */}
      <View style={styles.offscreen} pointerEvents="none">
        <Svg ref={svgRef} width={W} height={H}>
          <Defs>
            <LinearGradient id="felt" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#114a2c" />
              <Stop offset="1" stopColor="#0c361f" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} rx={24} fill="#0b0f0d" />
          <Rect x={16} y={16} width={W - 32} height={H - 32} rx={18} fill="url(#felt)" />

          <SvgText x={36} y={58} fontSize={30} fontWeight="bold" fill="#ffffff">
            BANKROLLY
          </SvgText>
          <SvgText x={36} y={82} fontSize={15} fill="#9fe0bb">
            Hand Review
          </SvgText>

          <SvgText x={36} y={130} fontSize={14} fill="#bfe8cf" fontWeight="bold">
            HERO
          </SvgText>
          {hero.map((c, i) => (
            <ShareCard key={`h-${c}`} x={36 + i * (CARD_W + 10)} y={140} code={c} />
          ))}

          <SvgText x={36} y={258} fontSize={14} fill="#bfe8cf" fontWeight="bold">
            BOARD
          </SvgText>
          {boardCards.length ? (
            boardCards.map((c, i) => (
              <ShareCard key={`b-${c}`} x={36 + i * (CARD_W + 10)} y={268} code={c} />
            ))
          ) : (
            <SvgText x={36} y={300} fontSize={16} fill="#7fae93">
              preflop
            </SvgText>
          )}

          <SvgText x={W - 36} y={130} fontSize={16} textAnchor="end" fill="#ffffff">
            {position} · {street}
          </SvgText>
          <SvgText
            x={W - 36}
            y={160}
            fontSize={26}
            fontWeight="bold"
            textAnchor="end"
            fill={result >= 0 ? '#4ade80' : '#f87171'}
          >
            {resultLabel}
          </SvgText>
          {firstLine ? (
            <SvgText x={W - 36} y={300} fontSize={13} textAnchor="end" fill="#c9e8d5">
              {firstLine}
            </SvgText>
          ) : null}

          <SvgText x={W / 2} y={H - 26} fontSize={12} textAnchor="middle" fill="#7fae93">
            Tracked with Bankrolly · bankrolly.online
          </SvgText>
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  hint: {
    color: colors.textDim,
    fontSize: typography.micro,
    marginTop: 4,
    textAlign: 'center',
  },
  offscreen: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: W,
    height: H,
  },
});
