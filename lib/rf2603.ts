import type { TableRow } from './types';

function maskRows(rows: TableRow[], keepValueIndexes: number[]): TableRow[] {
  const keep = new Set(keepValueIndexes);

  return rows.map((row) => ({
    ...row,
    values: row.values.map((value, index) => (keep.has(index) ? value : null)),
    children: row.children ? maskRows(row.children, keepValueIndexes) : row.children,
  }));
}

export function maskRf2603AnnualOnly(rows: TableRow[], annualValueIndex: number): TableRow[] {
  return maskRows(rows, [annualValueIndex]);
}
