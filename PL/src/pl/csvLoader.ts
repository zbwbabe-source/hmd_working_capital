import * as fs from 'fs';
import * as path from 'path';
import { Row, Brand, Year, MonthKey } from './types';

/**
 * CSV 파일명 매핑
 */
function getFileName(year: Year, brand: Brand): string {
  return `${year} ${brand}.csv`;
}

/**
 * 헤더/셀 값 정규화
 * - BOM 제거
 * - trim
 * - 연속 공백 정리
 */
function normalizeCell(s: string): string {
  return s
    .replace(/^\uFEFF/, '')         // BOM 제거
    .replace(/\u00A0/g, ' ')        // non-breaking space -> space
    .replace(/\s+/g, ' ')           // 연속 공백 정리
    .trim();
}

/**
 * Delimiter 감지 및 분리
 * - 기본: \t (탭)
 * - fallback: , (콤마)
 * - 큰따옴표로 감싸진 필드 지원
 */
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
  
  // 마지막 필드 추가
  if (current || line.endsWith(',') || line.endsWith('\t')) {
    result.push(current.trim());
  }
  
  return result;
}

/**
 * Delimiter 감지 및 분리 (레거시 - 대체됨)
 */
function detectDelimiterAndSplit(line: string, expectedMinCols: number = 5): { delimiter: string; cols: string[] } {
  // parseCSVLine 사용
  const cols = parseCSVLine(line);
  
  // delimiter는 탭 또는 콤마 중 실제 사용된 것 반환
  const delimiter = line.includes('\t') ? '\t' : ',';
  
  return { delimiter, cols };
}

/**
 * CSV 값 파싱 강화
 * - "(2,344)" -> -2344 (괄호는 음수)
 * - "18,689" -> 18689
 * - "-" / "" / null -> 0
 * - "33.00%" -> 33.00
 */
function parseValue(val: string | null | undefined): number {
  if (!val) return 0;
  
  const normalized = normalizeCell(val);
  
  if (normalized === '' || normalized === '-') return 0;
  
  // 괄호 체크 (음수)
  let isNegative = false;
  let cleanValue = normalized;
  
  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    isNegative = true;
    cleanValue = normalized.slice(1, -1).trim();
  }
  
  // % 포함 여부 체크
  if (cleanValue.includes('%')) {
    // "33.00%" -> 33.00
    const numStr = cleanValue.replace('%', '').replace(/,/g, '');
    return parseFloat(numStr) || 0;
  }
  
  // 일반 숫자 (천단위 콤마 제거)
  const numStr = cleanValue.replace(/,/g, '');
  const num = parseFloat(numStr) || 0;
  
  return isNegative ? -num : num;
}

/**
 * 해당 행이 % 행인지 확인
 */
function isPercentageRow(values: string[]): boolean {
  return values.some(v => v && v.includes('%'));
}

/**
 * 월 컬럼명에서 월 번호 추출 (정규식 강화)
 * "26년1월", "26년 1월", "26년01월", "2026년1월", "2026년 01월" 모두 허용
 */
function extractMonthNumber(colName: string): number | null {
  const normalized = normalizeCell(colName);
  const match = normalized.match(/(\d{2}|\d{4})년\s*(\d{1,2})월/);
  
  if (match) {
    const monthNum = parseInt(match[2], 10);
    if (monthNum >= 1 && monthNum <= 12) {
      return monthNum;
    }
  }
  
  return null;
}

/**
 * CSV 파일 읽기 및 파싱
 */
export async function getRows(year: Year, brand: Brand): Promise<Row[]> {
  const fileName = getFileName(year, brand);
  const filePath = path.join(process.cwd(), 'PL', 'data', fileName);
  
  // 파일 읽기
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length < 2) {
    throw new Error(`CSV 파일이 비어있거나 헤더만 있습니다: ${fileName}`);
  }
  
  // 검증 로그 여부
  const isDebugTarget = year === 2026 && brand === 'Total';
  
  // 헤더 파싱
  const headers = parseCSVLine(lines[0]).map(h => normalizeCell(h));
  
  if (isDebugTarget) {
    console.log('DELIMITER', lines[0].includes('\t') ? 'TAB' : 'COMMA');
    console.log('HEADERS LEN', headers.length);
  }
  
  // 월 컬럼 인덱스 찾기 및 매핑
  const monthColumnIndices: Array<{ index: number; monthNum: number; header: string }> = [];
  const monthMap: Record<string, string> = {};
  
  headers.forEach((header, idx) => {
    const monthNum = extractMonthNumber(header);
    if (monthNum !== null && monthNum >= 1 && monthNum <= 12) {
      monthColumnIndices.push({ index: idx, monthNum, header });
      const monthKey = `m${monthNum}`;
      monthMap[monthKey] = header;
    }
  });
  
  if (monthColumnIndices.length === 0) {
    throw new Error(`월 컬럼을 찾을 수 없습니다: ${fileName}`);
  }
  
  // 대분류, 중분류, 소분류 컬럼 인덱스 찾기
  const lvl1Index = headers.findIndex(h => h === '대분류' || h.includes('대분류'));
  const lvl2Index = headers.findIndex(h => h === '중분류' || h.includes('중분류'));
  const lvl3Index = headers.findIndex(h => h === '소분류' || h.includes('소분류'));
  
  if (lvl1Index === -1 || lvl2Index === -1) {
    throw new Error(`대분류 또는 중분류 컬럼을 찾을 수 없습니다: ${fileName}`);
  }
  
  // 데이터 행 파싱
  const rows: Row[] = [];
  let firstTAGRow: Row | null = null;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = parseCSVLine(line).map(c => normalizeCell(c));
    
    // 첫 데이터 행 검증 로그
    if (isDebugTarget && i === 1) {
      console.log('COLS LEN', cells.length);
    }
    
    if (cells.length < headers.length - 5) {
      // 행이 너무 짧으면 스킵 (일부 컬럼 누락은 허용)
      continue;
    }
    
    const lvl1 = cells[lvl1Index] || '';
    const lvl2 = cells[lvl2Index] || '';
    const lvl3 = lvl3Index !== -1 ? (cells[lvl3Index] || null) : null;
    
    // 대분류나 중분류가 비어있으면 스킵
    if (!lvl1 && !lvl2) continue;
    
    // 월별 값 추출
    const monthValues: string[] = monthColumnIndices.map(col => cells[col.index] || '');
    const isRate = isPercentageRow(monthValues);
    
    // months 객체 생성
    const months: Record<MonthKey, number> = {
      m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0,
      m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0
    };
    
    monthColumnIndices.forEach(col => {
      const monthKey = `m${col.monthNum}` as MonthKey;
      const rawValue = cells[col.index] || '';
      const parsedValue = parseValue(rawValue);
      months[monthKey] = parsedValue;
    });
    
    const row: Row = {
      year,
      brand,
      lvl1,
      lvl2,
      lvl3: lvl3 && lvl3.trim() !== '' ? lvl3 : null,
      months,
      isRateRow: isRate
    };
    
    rows.push(row);
    
    // 첫 TAG매출 행 검증 로그
    if (isDebugTarget && !firstTAGRow && lvl1 === 'TAG매출') {
      firstTAGRow = row;
      console.log('[TAG매출 첫 행] m1:', row.months.m1, 'm2:', row.months.m2, 'm3:', row.months.m3);
    }
    
    // 매출원가 첫 행 로그
    if (isDebugTarget && lvl1 === '매출원가') {
      console.log('[매출원가] lvl2:', lvl2, 'm1:', row.months.m1, 'm2:', row.months.m2);
    }
  }
  
  if (isDebugTarget) {
    console.log('[CSV LOADED] Total rows:', rows.length);
  }
  
  return rows;
}


