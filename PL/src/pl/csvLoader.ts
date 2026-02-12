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
 * CSV 값 파싱
 * - "" 또는 null -> 0
 * - "18,689" -> 18689
 * - "33.00%" -> 33.00
 */
function parseValue(val: string | null | undefined): number {
  if (!val || val.trim() === '') return 0;
  
  const trimmed = val.trim();
  
  // % 포함 여부 체크
  if (trimmed.includes('%')) {
    // "33.00%" -> 33.00
    const numStr = trimmed.replace('%', '').replace(/,/g, '');
    return parseFloat(numStr) || 0;
  }
  
  // 일반 숫자 (천단위 콤마 제거)
  const numStr = trimmed.replace(/,/g, '');
  return parseFloat(numStr) || 0;
}

/**
 * 해당 행이 % 행인지 확인
 */
function isPercentageRow(values: string[]): boolean {
  return values.some(v => v && v.includes('%'));
}

/**
 * 월 컬럼명에서 월 번호 추출
 * "26년1월" -> 1
 * "25년12월" -> 12
 */
function extractMonthNumber(colName: string): number | null {
  const match = colName.match(/(\d+)월/);
  if (match) {
    return parseInt(match[1], 10);
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
  
  // 헤더 파싱
  const headerLine = lines[0];
  const headers = headerLine.split(',').map(h => h.trim());
  
  // 월 컬럼 인덱스 찾기 (예: "26년1월", "26년2월", ...)
  const monthColumnIndices: Array<{ index: number; monthNum: number }> = [];
  headers.forEach((header, idx) => {
    const monthNum = extractMonthNumber(header);
    if (monthNum !== null && monthNum >= 1 && monthNum <= 12) {
      monthColumnIndices.push({ index: idx, monthNum });
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
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = line.split(',').map(c => c.trim());
    
    if (cells.length < headers.length) {
      // 행이 불완전하면 스킵
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
      months[monthKey] = parseValue(cells[col.index]);
    });
    
    rows.push({
      year,
      brand,
      lvl1,
      lvl2,
      lvl3: lvl3 && lvl3.trim() !== '' ? lvl3 : null,
      months,
      isRateRow: isRate
    });
  }
  
  return rows;
}
