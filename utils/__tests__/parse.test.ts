import { describe, expect, it } from 'vitest';
import {
  normalizeKey,
  parseCsv,
  parseDateTime,
  parseDuration,
  parseNum,
  repairRow,
  toLocalDateString,
} from '@/utils/import/parse';

describe('parseCsv', () => {
  it('handles quoted fields, escaped quotes, CRLF and BOM', () => {
    expect(parseCsv('a,b\r\n"x, y",z\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'z'],
    ]);
    expect(parseCsv('"he said ""hi""",ok')).toEqual([['he said "hi"', 'ok']]);
    expect(parseCsv('﻿a,b')).toEqual([['a', 'b']]);
  });

  it('drops rows that are entirely empty', () => {
    expect(parseCsv('a,b\n,\n\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('repairRow', () => {
  it('folds overflow fields back into the trailing note column', () => {
    expect(repairRow(['a', 'b', 'c', 'd'], 3)).toEqual({
      row: ['a', 'b', 'c,d'],
      repaired: true,
    });
    expect(repairRow(['a', 'b'], 3)).toEqual({ row: ['a', 'b'], repaired: false });
  });
});

describe('parseNum', () => {
  it('reads every separator dialect', () => {
    expect(parseNum('1,234')).toBe(1234);
    expect(parseNum('0,5')).toBe(0.5);
    expect(parseNum('1.234,56')).toBe(1234.56);
    expect(parseNum('1,234.56')).toBe(1234.56);
  });

  it('strips currency symbols and keeps signs', () => {
    expect(parseNum('€ -50')).toBe(-50);
    expect(parseNum('$1,000.25')).toBe(1000.25);
    expect(parseNum('(180)')).toBe(-180); // accountant's negative
  });

  it('keeps "empty" distinct from zero', () => {
    expect(parseNum('')).toBeNull();
    expect(parseNum(null)).toBeNull();
    expect(parseNum('abc')).toBeNull();
    expect(parseNum('0')).toBe(0);
  });
});

describe('parseDateTime', () => {
  it('reads ISO with and without time', () => {
    const withTime = parseDateTime('2024-09-20 18:51:57');
    expect(withTime.ambiguous).toBe(false);
    expect(withTime.date?.getFullYear()).toBe(2024);
    expect(withTime.date?.getHours()).toBe(18);

    const zulu = parseDateTime('2026-01-12T18:30:00Z');
    expect(zulu.date?.getTime()).toBe(Date.UTC(2026, 0, 12, 18, 30, 0));
  });

  it('treats dotted dates as day-first', () => {
    const d = parseDateTime('12.01.2026');
    expect(d.ambiguous).toBe(false);
    expect(d.date?.getMonth()).toBe(0);
    expect(d.date?.getDate()).toBe(12);
  });

  it('resolves slash dates by order, flags the undecidable ones', () => {
    // A day above 12 settles it regardless of the requested order.
    const forced = parseDateTime('13/01/2026', '', 'mdy');
    expect(forced.date?.getDate()).toBe(13);
    expect(forced.ambiguous).toBe(false);

    expect(parseDateTime('01/02/2026').ambiguous).toBe(true);
    expect(parseDateTime('01/02/2026', '', 'mdy').date?.getMonth()).toBe(0);
    expect(parseDateTime('01/02/2026', '', 'dmy').date?.getMonth()).toBe(1);
  });

  it('applies a separate time column, including am/pm', () => {
    const d = parseDateTime('12.01.2026', '7:30 pm');
    expect(d.date?.getHours()).toBe(19);
    expect(d.date?.getMinutes()).toBe(30);
  });

  it('returns null for garbage', () => {
    expect(parseDateTime('not a date').date).toBeNull();
    expect(parseDateTime('').date).toBeNull();
  });
});

describe('parseDuration', () => {
  it('reads clock time, hour text, minutes and decimal hours', () => {
    expect(parseDuration('7:45')).toBe(465);
    expect(parseDuration('2h 30m')).toBe(150);
    expect(parseDuration('3h')).toBe(180);
    expect(parseDuration('465')).toBe(465); // integer above 24 → minutes
    expect(parseDuration('7.75')).toBe(465); // decimal hours
    expect(parseDuration('24')).toBe(1440); // 24 still reads as hours
  });

  it('rejects blanks and negatives', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('-5')).toBeNull();
    expect(parseDuration(null)).toBeNull();
  });
});

describe('header + date helpers', () => {
  it('normalizes header keys to alphanumerics', () => {
    expect(normalizeKey('Buy-In ($)')).toBe('buyin');
    expect(normalizeKey(' Cash Out ')).toBe('cashout');
  });

  it('formats local dates as YYYY-MM-DD', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
