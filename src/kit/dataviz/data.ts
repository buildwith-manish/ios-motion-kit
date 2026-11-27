/**
 * Tiny CSV/JSON helpers so a video can feed the primitives straight from a spreadsheet export. No dependencies.
 */

/** One CSV row: header -> value. Numeric-looking cells become numbers. */
export type DataRow = Record<string, string | number>;

const splitCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
};

/**
 * Parses CSV text (first line = header, `"quoted, cells"` supported, blank lines skipped) to rows. Cells that look
 * like numbers become numbers, everything else stays a trimmed string.
 * @example csvToRows('name,value\nA,10\nB,7.5') // [{name: 'A', value: 10}, {name: 'B', value: 7.5}]
 */
export const csvToRows = (csv: string): DataRow[] => {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const head = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: DataRow = {};
    head.forEach((h, i) => {
      const raw = (cells[i] ?? '').trim();
      const n = Number(raw);
      row[h] = raw !== '' && Number.isFinite(n) ? n : raw;
    });
    return row;
  });
};

/**
 * One numeric column of rows, e.g. for a Sparkline's `data`. Non-numeric cells become NaN-free zeros.
 * @example columnNumbers(csvToRows(csv), 'value')
 */
export const columnNumbers = (rows: readonly DataRow[], key: string): number[] =>
  rows.map((r) => {
    const v = r[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });
