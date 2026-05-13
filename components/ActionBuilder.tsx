import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip } from '@/components/Chip';
import { ACTIONS, POSITIONS, STREETS, type ActionType, type Position, type Street } from '@/db/schema';
import { colors, radius, spacing, typography } from '@/theme/colors';

interface BuiltAction {
  street: Street;
  position: Position;
  action: ActionType;
  size: string;
}

interface BuiltStreet {
  street: Street;
  board: string;
  actions: BuiltAction[];
}

interface Props {
  onApply: (text: string) => void;
}

const ACTION_NEEDS_SIZE: Record<ActionType, boolean> = {
  fold: false,
  check: false,
  call: false,
  open: true,
  limp: false,
  bet: true,
  raise: true,
  '3-bet': true,
  '4-bet': true,
  '5-bet': true,
  'all-in': false,
  shove: false,
};

const ACTION_LABELS: Record<ActionType, string> = {
  fold: 'folds',
  check: 'checks',
  call: 'calls',
  open: 'opens',
  limp: 'limps',
  bet: 'bets',
  raise: 'raises',
  '3-bet': '3-bets',
  '4-bet': '4-bets',
  '5-bet': '5-bets',
  'all-in': 'shoves all-in',
  shove: 'shoves',
};

const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

export function ActionBuilder({ onApply }: Props) {
  const [streets, setStreets] = useState<BuiltStreet[]>([
    { street: 'preflop', board: '', actions: [] },
  ]);
  const [activeStreet, setActiveStreet] = useState<Street>('preflop');
  const [position, setPosition] = useState<Position>('UTG');
  const [action, setAction] = useState<ActionType>('open');
  const [size, setSize] = useState('');

  const ensureStreet = (street: Street) => {
    setStreets((prev) => {
      if (prev.find((s) => s.street === street)) return prev;
      return [...prev, { street, board: '', actions: [] }];
    });
    setActiveStreet(street);
  };

  const removeStreet = (street: Street) => {
    if (street === 'preflop') return;
    setStreets((prev) => prev.filter((s) => s.street !== street));
    if (activeStreet === street) setActiveStreet('preflop');
  };

  const updateBoard = (street: Street, board: string) => {
    setStreets((prev) => prev.map((s) => (s.street === street ? { ...s, board } : s)));
  };

  const addAction = () => {
    if (ACTION_NEEDS_SIZE[action] && !size.trim()) {
      Alert.alert('Missing size', `${ACTION_LABELS[action]} usually needs a sizing (e.g. 2.5).`);
      return;
    }
    const entry: BuiltAction = {
      street: activeStreet,
      position,
      action,
      size: size.trim(),
    };
    setStreets((prev) =>
      prev.map((s) => (s.street === activeStreet ? { ...s, actions: [...s.actions, entry] } : s)),
    );
    setSize('');
  };

  const removeLast = () => {
    setStreets((prev) =>
      prev.map((s) =>
        s.street === activeStreet ? { ...s, actions: s.actions.slice(0, -1) } : s,
      ),
    );
  };

  const clearAll = () => {
    setStreets([{ street: 'preflop', board: '', actions: [] }]);
    setActiveStreet('preflop');
    setSize('');
  };

  const text = useMemo(() => buildText(streets), [streets]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Action builder</Text>
        <Pressable onPress={clearAll} hitSlop={8}>
          <Text style={styles.clear}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.streetTabs}>
        {STREETS.map((s) => {
          const present = streets.find((x) => x.street === s);
          return (
            <Pressable
              key={s}
              onPress={() => (present ? setActiveStreet(s) : ensureStreet(s))}
              onLongPress={() => removeStreet(s)}
              style={({ pressed }) => [
                styles.streetTab,
                activeStreet === s && styles.streetTabActive,
                !present && styles.streetTabAdd,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                style={[
                  styles.streetTabLabel,
                  activeStreet === s && styles.streetTabLabelActive,
                  !present && styles.streetTabLabelAdd,
                ]}
              >
                {present ? STREET_LABELS[s] : `+ ${STREET_LABELS[s]}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeStreet !== 'preflop' ? (
        <TextInput
          value={streets.find((s) => s.street === activeStreet)?.board ?? ''}
          onChangeText={(v) => updateBoard(activeStreet, v)}
          placeholder={
            activeStreet === 'flop'
              ? 'Flop cards e.g. Js 9h 2c'
              : activeStreet === 'turn'
              ? 'Turn card e.g. Th'
              : 'River card e.g. 4s'
          }
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          style={styles.boardInput}
        />
      ) : null}

      <Text style={styles.miniLabel}>Position</Text>
      <View style={styles.chipsRow}>
        {POSITIONS.map((p) => (
          <Chip key={p} label={p} tone="accent" active={position === p} onPress={() => setPosition(p)} />
        ))}
      </View>

      <Text style={styles.miniLabel}>Action</Text>
      <View style={styles.chipsRow}>
        {ACTIONS.map((a) => (
          <Chip
            key={a}
            label={a}
            tone="accent"
            active={action === a}
            onPress={() => {
              setAction(a);
              if (!ACTION_NEEDS_SIZE[a]) setSize('');
            }}
          />
        ))}
      </View>

      {ACTION_NEEDS_SIZE[action] ? (
        <View style={styles.sizeRow}>
          <Text style={styles.miniLabel}>Size (bb)</Text>
          <TextInput
            value={size}
            onChangeText={setSize}
            keyboardType="decimal-pad"
            placeholder="2.5"
            placeholderTextColor={colors.textDim}
            style={styles.sizeInput}
          />
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable onPress={addAction} style={styles.addBtn}>
          <Text style={styles.addLabel}>+ Add to {STREET_LABELS[activeStreet]}</Text>
        </Pressable>
        <Pressable onPress={removeLast} style={styles.undoBtn}>
          <Text style={styles.undoLabel}>↶ Undo</Text>
        </Pressable>
      </View>

      <View style={styles.preview}>
        <Text style={styles.previewLabel}>Preview</Text>
        <Text style={styles.previewText}>{text || '— no actions yet —'}</Text>
      </View>

      <Pressable
        onPress={() => {
          if (!text.trim()) {
            Alert.alert('Nothing to apply', 'Add at least one action first.');
            return;
          }
          onApply(text);
          clearAll();
        }}
        style={styles.applyBtn}
      >
        <Text style={styles.applyLabel}>↓ Insert into action line</Text>
      </Pressable>
    </View>
  );
}

function actionToPhrase(a: BuiltAction): string {
  const verb = ACTION_LABELS[a.action];
  const sized = ACTION_NEEDS_SIZE[a.action] && a.size ? ` ${a.size}bb` : '';
  return `${a.position} ${verb}${sized}`;
}

function buildText(streets: BuiltStreet[]): string {
  const order: Street[] = ['preflop', 'flop', 'turn', 'river'];
  const sorted = [...streets].sort(
    (a, b) => order.indexOf(a.street) - order.indexOf(b.street),
  );
  return sorted
    .filter((s) => s.actions.length > 0 || s.board.trim())
    .map((s) => {
      const head =
        s.street === 'preflop'
          ? 'Preflop'
          : `${STREET_LABELS[s.street]}${s.board.trim() ? ` (${s.board.trim()})` : ''}`;
      const phrase = s.actions.map(actionToPhrase).join(', ');
      return `${head}: ${phrase || '—'}`;
    })
    .join('\n');
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  clear: {
    color: colors.loss,
    fontSize: typography.small,
    fontWeight: '700',
  },
  streetTabs: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  streetTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  streetTabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  streetTabAdd: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
  },
  streetTabLabel: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
  },
  streetTabLabelActive: { color: '#fff' },
  streetTabLabelAdd: { color: colors.textMuted },
  boardInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: typography.body,
  },
  miniLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sizeRow: {
    gap: 6,
  },
  sizeInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: typography.body,
    width: 120,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  addLabel: { color: '#fff', fontWeight: '700', fontSize: typography.small },
  undoBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  undoLabel: {
    color: colors.textMuted,
    fontWeight: '700',
    fontSize: typography.small,
  },
  preview: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  previewText: {
    color: colors.text,
    fontSize: typography.small,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  applyBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  applyLabel: {
    color: colors.profit,
    fontSize: typography.small,
    fontWeight: '700',
  },
});
