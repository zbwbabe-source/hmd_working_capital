import * as fs from 'fs';
import * as path from 'path';
import { Row, Source, Year, MonthKey } from './types';

function getFileName(year: Year, source: Source): string {
  return `${year}_${source}.csv`;
}

function normalizeCell(s: string): string {
  return s
    .replace(/^\uFEFF/, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === '\t') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current || line.endsWith(',') || line.endsWith('\t')) {
    result.push(current.trim());
  }

  return result;
}

function parseValue(val: string | null | undefined): number {
  if (!val) return 0;

  const normalized = normalizeCell(val);
  if (normalized === '' || normalized === '-') return 0;

  let isNegative = false;
  let cleanValue = normalized;

  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    isNegative = true;
    cleanValue = normalized.slice(1, -1).trim();
  }

  if (cleanValue.includes('%')) {
    const numStr = cleanValue.replace('%', '').replace(/,/g, '');
    return parseFloat(numStr) || 0;
  }

  const numStr = cleanValue.replace(/,/g, '');
  const num = parseFloat(numStr) || 0;
  return isNegative ? -num : num;
}

function isPercentageRow(values: string[]): boolean {
  return values.some((v) => v && v.includes('%'));
}

function extractMonthNumber(colName: string): number | null {
  const normalized = normalizeCell(colName);
  const match = normalized.match(/(\d{2}|\d{4})\D*(\d{1,2})/);

  if (!match) return null;

  const monthNum = parseInt(match[2], 10);
  return monthNum >= 1 && monthNum <= 12 ? monthNum : null;
}

export async function getRows(year: Year, source: Source): Promise<Row[]> {
  const fileName = getFileName(year, source);
  const filePath = path.join(process.cwd(), 'PL', 'data', fileName);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error(`CSV is empty or missing header: ${fileName}`);
  }

  const headers = parseCSVLine(lines[0]).map((h) => normalizeCell(h));
  const monthColumnIndices: Array<{ index: number; monthNum: number }> = [];

  headers.forEach((header, idx) => {
    const monthNum = extractMonthNumber(header);
    if (monthNum !== null) {
      monthColumnIndices.push({ index: idx, monthNum });
    }
  });

  if (monthColumnIndices.length === 0) {
    throw new Error(`Month columns not found: ${fileName}`);
  }

  const lvl1Index = headers.findIndex((h) => h === '대분류' || h.includes('대분류'));
  const lvl2Index = headers.findIndex((h) => h === '중분류' || h.includes('중분류'));
  const lvl3Index = headers.findIndex((h) => h === '소분류' || h.includes('소분류'));

  if (lvl1Index === -1 || lvl2Index === -1) {
    throw new Error(`Level columns not found: ${fileName}`);
  }

  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]).map((c) => normalizeCell(c));
    if (cells.length < headers.length - 5) continue;

    const lvl1 = cells[lvl1Index] || '';
    const lvl2 = cells[lvl2Index] || '';
    const lvl3 = lvl3Index !== -1 ? (cells[lvl3Index] || null) : null;

    if (!lvl1 && !lvl2) continue;

    const monthValues: string[] = monthColumnIndices.map((col) => cells[col.index] || '');
    const isRate = isPercentageRow(monthValues);
    const months: Record<MonthKey, number> = {
      m1: 0,
      m2: 0,
      m3: 0,
      m4: 0,
      m5: 0,
      m6: 0,
      m7: 0,
      m8: 0,
      m9: 0,
      m10: 0,
      m11: 0,
      m12: 0,
    };

    monthColumnIndices.forEach((col) => {
      const monthKey = `m${col.monthNum}` as MonthKey;
      const rawValue = cells[col.index] || '';
      months[monthKey] = parseValue(rawValue);
    });

    rows.push({
      year,
      source,
      lvl1,
      lvl2,
      lvl3: lvl3 && lvl3.trim() !== '' ? lvl3 : null,
      months,
      isRateRow: isRate,
    });
  }

  return rows;
}
