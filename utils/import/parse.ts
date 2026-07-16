// Low-level CSV reading and value normalisation for imports from other apps.
//
// Everything here is defensive: these files come from a dozen competitors, each
// with its own idea of what a number, a date or a duration looks like, and some
// of them are outright broken (see repairRow). A bad row must never take the
// whole import down.

export type DateOrder = 'auto' | 'mdy' | 'dmy';

/** RFC-4180 reader: quoted fields, "" escapes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/**
 * BINK writes notes unquoted, so a comma inside a note splits into extra fields
 * and the row stops lining up with the header. The note is the last column, so
 * anything past the header width belongs back inside it.
 */
export function repairRow(row: string[], width: number): { row: string[]; repaired: boolean } {
  if (row.length <= width) return { row, repaired: false };
  return {
    row: [...row.slice(0, width - 1), row.slice(width - 1).join(',')],
    repaired: true,
  };
}

/**
 * Numbers, in every dialect these exports use.
 *
 * An empty cell is null, never 0 — "no buy-in recorded" and "bought in for
 * nothing" are different facts, and collapsing them silently corrupts a profit.
 */
export function parseNum(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Accountant's notation: (180) means -180.
  let negated = false;
  if (/^\(.*\)$/.test(s)) {
    negated = true;
    s = s.slice(1, -1);
  }

  s = s.replace(/[^\d.,+-]/g, ''); // drop currency symbols and spaces
  if (!s || s === '-' || s === '+') return null;

  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');
  if (comma > -1 && dot > -1) {
    // Whichever separator comes last is the decimal one.
    s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (comma > -1) {
    // "1,234" is thousands; "0,5" is a decimal comma.
    const grouped = /^[+-]?\d{1,3}(,\d{3})+$/.test(s);
    s = grouped ? s.replace(/,/g, '') : s.replace(',', '.');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negated ? -n : n;
}

export interface ParsedDate {
  date: Date | null;
  /** True when day/month order could not be settled from the value itself. */
  ambiguous: boolean;
}

function applyTime(d: Date, time: string): Date {
  const t = (time ?? '').trim();
  if (!t) return d;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(t);
  if (!m) return d;
  let h = Number(m[1]);
  const suffix = m[4]?.toLowerCase();
  if (suffix === 'pm' && h < 12) h += 12;
  if (suffix === 'am' && h === 12) h = 0;
  d.setHours(h, Number(m[2]), Number(m[3] ?? 0), 0);
  return d;
}

/**
 * Dates, in the formats these exports actually use. A time without a zone is
 * treated as local — that is what the source app meant by it.
 *
 * 01/02/2026 is genuinely undecidable, so it is reported as ambiguous rather
 * than guessed, and the user is asked which way round it goes.
 */
export function parseDateTime(dateRaw: string, timeRaw = '', order: DateOrder = 'auto'): ParsedDate {
  const s = (dateRaw ?? '').trim();
  if (!s) return { date: null, ambiguous: false };

  // ISO / PBT: 2024-09-20 18:51:57 · 2026-01-12T18:30:00Z · 2026-01-12
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(Z)?/.exec(s);
  if (m) {
    const [, y, mo, d, h, mi, sec, zulu] = m;
    const date = zulu
      ? new Date(Date.UTC(+y, +mo - 1, +d, +(h ?? 0), +(mi ?? 0), +(sec ?? 0)))
      : new Date(+y, +mo - 1, +d, +(h ?? 0), +(mi ?? 0), +(sec ?? 0));
    return { date: h ? date : applyTime(date, timeRaw), ambiguous: false };
  }

  // 12.01.2026 — dotted is day-first in every locale that writes it that way.
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (m) {
    return { date: applyTime(new Date(+m[3], +m[2] - 1, +m[1]), timeRaw), ambiguous: false };
  }

  // 01/12/2026 — could be either way round.
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    // A value above 12 can only be a day, and that overrides even an explicit
    // order: 13/01 under "mdy" is a day-first row, not month thirteen — JS Date
    // would silently roll month 13 over into January of the next year.
    const settled = a > 12 || b > 12;
    const dayFirst = a > 12 ? true : b > 12 ? false : order === 'dmy';
    const day = dayFirst ? a : b;
    const month = dayFirst ? b : a;
    return {
      date: applyTime(new Date(year, month - 1, day), timeRaw),
      ambiguous: !settled && order === 'auto',
    };
  }

  const fallback = new Date(s);
  return { date: Number.isNaN(fallback.getTime()) ? null : fallback, ambiguous: false };
}

/**
 * Durations, which arrive as minutes (465), decimal hours (7.75) or clock time
 * (7:45). The ranges do not overlap in practice: nobody plays 465 hours, and a
 * 7-minute session is not worth logging.
 */
export function parseDuration(raw: string | undefined | null): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  let m = /^(\d+):(\d{1,2})$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);

  m = /^(\d+)\s*h[a-z]*\s*(?:(\d+)\s*m)?/i.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);

  const n = parseNum(s);
  if (n == null || n < 0) return null;
  if (Number.isInteger(n) && n > 24) return n; // minutes
  if (n <= 24) return Math.round(n * 60); // decimal hours
  return Math.round(n);
}

/** Header key for matching: lowercase, alphanumerics only. */
export function normalizeKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** YYYY-MM-DD in local time — the shape every Bankrolly date column uses. */
export function toLocalDateString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
