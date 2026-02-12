import fs from 'fs';
import Papa from 'papaparse';
import iconv from 'iconv-lite';
import { TableRow } from './types';

/**
 * 금액 파싱 함수 (콤마, 음수, 공백 처리)
 */
function parseAmount(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  
  const str = String(value).trim();
  if (str === '' || str === '-') return 0;
  
  // 콤마 및 공백 제거
  const cleaned = str.replace(/,/g, '').replace(/\s/g, '');
  const num = Number(cleaned);
  
  return isNaN(num) ? 0 : num;
}

/**
 * B/S CSV 파일을 읽어서 Financial Position 데이터 반환
 */
export async function readBSCSV(year: number = 2026): Promise<{
  financialPosition: TableRow[];
  workingCapital: TableRow[];
}> {
  // 파일명 형식: 2601BS.csv (26년 01월)
  const yearPrefix = String(year).slice(-2); // 2026 -> 26
  const bsFilePath = `${process.cwd()}/BS/${yearPrefix}01BS.csv`;
  const wcFilePath = `${process.cwd()}/BS/${year}01_bs_WC.csv`;
  
  if (!fs.existsSync(bsFilePath)) {
    throw new Error(`B/S CSV 파일을 찾을 수 없습니다: ${bsFilePath}`);
  }

  // Financial Position 파일 읽기
  let bsContent: string;
  try {
    bsContent = fs.readFileSync(bsFilePath, 'utf-8');
  } catch (err) {
    try {
      const buffer = fs.readFileSync(bsFilePath);
      bsContent = iconv.decode(buffer, 'cp949');
    } catch (err2) {
      throw new Error(`B/S CSV 파일을 읽을 수 없습니다: ${bsFilePath}`);
    }
  }

  const bsParsed = Papa.parse(bsContent, {
    header: false,
    skipEmptyLines: true,
  });

  const bsRows = bsParsed.data as string[][];
  if (bsRows.length === 0) {
    throw new Error('B/S CSV 파일이 비어있습니다.');
  }

  const financialPosition = parseFinancialPositionSection(bsRows, year);

  // 운전자본 파일 읽기
  let workingCapital: TableRow[] = [];
  if (fs.existsSync(wcFilePath)) {
    try {
      let wcContent: string;
      try {
        wcContent = fs.readFileSync(wcFilePath, 'utf-8');
      } catch (err) {
        const buffer = fs.readFileSync(wcFilePath);
        wcContent = iconv.decode(buffer, 'cp949');
      }

      const wcParsed = Papa.parse(wcContent, {
        header: false,
        skipEmptyLines: true,
      });

      const wcRows = wcParsed.data as string[][];
      if (wcRows.length > 0) {
        workingCapital = parseWorkingCapitalSection(wcRows, year);
      }
    } catch (err) {
      console.warn('운전자본 파일 읽기 실패, 빈 배열 반환:', err);
    }
  }

  return {
    financialPosition,
    workingCapital,
  };
}

/**
 * Financial Position 섹션 파싱
 * 구조: 대분류, 중분류, 소분류, 2412, 2512, 2601~2612
 */
interface TempRow {
  대분류: string;
  중분류: string;
  소분류: string;
  values: number[];
  yoy: number | null;
}

function parseFinancialPositionSection(rows: string[][], year: number): TableRow[] {
  if (rows.length < 2) return [];

  const headers = rows[0];
  
  // 컬럼 인덱스 찾기
  const col2412 = headers.findIndex(h => h?.trim() === '2412');
  const col2512 = headers.findIndex(h => h?.trim() === '2512');
  const col2601 = headers.findIndex(h => h?.trim() === '2601');
  
  if (col2412 === -1 || col2512 === -1 || col2601 === -1) {
    console.warn('B/S CSV 헤더에서 컬럼을 찾을 수 없습니다:', headers);
  }

  const tempRows: TempRow[] = [];

  // 1단계: 데이터 행 파싱
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;

    const 대분류 = row[0]?.trim() || '';
    const 중분류 = row[1]?.trim() || '';
    const 소분류 = row[2]?.trim() || '';

    // 대분류가 없으면 스킵
    if (!대분류) continue;

    // 월별 데이터 파싱: 2412, 2512, 2601~2612 (총 14개월)
    const values: number[] = [];
    
    // 2412
    values.push(col2412 >= 0 ? parseAmount(row[col2412]) : 0);
    // 2512
    values.push(col2512 >= 0 ? parseAmount(row[col2512]) : 0);
    // 2601~2612 (12개월)
    for (let monthIdx = 1; monthIdx <= 12; monthIdx++) {
      const colIdx = col2601 + monthIdx - 1;
      values.push(colIdx >= 0 && colIdx < row.length ? parseAmount(row[colIdx]) : 0);
    }

    // YoY 계산: 2612 - 2512 (증감금액)
    const val2612 = values[13] || 0; // 26년 12월 (인덱스 13)
    const val2512 = values[1] || 0;   // 25년 12월 (인덱스 1)
    const yoy = val2612 - val2512;    // 증감금액

    tempRows.push({
      대분류,
      중분류,
      소분류,
      values,
      yoy,
    });
  }

  // 2단계: 계층 구조 생성
  return buildHierarchy(tempRows);
}

/**
 * 계층 구조 생성
 */
function buildHierarchy(tempRows: TempRow[]): TableRow[] {
  // 대분류별로 그룹화
  const 대분류Map = new Map<string, TempRow[]>();
  
  for (const row of tempRows) {
    if (!대분류Map.has(row.대분류)) {
      대분류Map.set(row.대분류, []);
    }
    대분류Map.get(row.대분류)!.push(row);
  }

  const result: TableRow[] = [];

  // 각 대분류 처리
  for (const [대분류명, rows] of 대분류Map) {
    // 중분류별로 그룹화
    const 중분류Map = new Map<string, TempRow[]>();
    
    for (const row of rows) {
      if (row.중분류) {
        if (!중분류Map.has(row.중분류)) {
          중분류Map.set(row.중분류, []);
        }
        중분류Map.get(row.중분류)!.push(row);
      }
    }

    // 중분류들을 TableRow로 변환
    const 중분류Rows: TableRow[] = [];
    
    for (const [중분류명, 소분류Rows] of 중분류Map) {
      // 소분류가 있는지 확인
      const has소분류 = 소분류Rows.some(r => r.소분류 !== '');
      
      if (has소분류) {
        // 소분류가 있는 경우: 중분류는 그룹, 소분류들을 children으로
        const children: TableRow[] = 소분류Rows
          .filter(r => r.소분류 !== '')
          .map(r => ({
            account: r.소분류,
            level: 2,
            isGroup: false,
            isCalculated: false,
            isBold: false,
            isHighlight: undefined,
            values: [...r.values, r.yoy],
            format: 'number' as const,
          }));

        // 중분류 값 = 소분류들의 합계 (YoY 제외)
        const 중분류ValuesRaw = calculateSum(children);
        // YoY 재계산: 증감금액
        const val2612 = 중분류ValuesRaw[13] || 0;
        const val2512 = 중분류ValuesRaw[1] || 0;
        const 중분류YoY = val2612 - val2512;
        중분류ValuesRaw[중분류ValuesRaw.length - 1] = 중분류YoY;

        중분류Rows.push({
          account: 중분류명,
          level: 1,
          isGroup: true,
          isCalculated: true,
          isBold: true,
          isHighlight: undefined,
          values: 중분류ValuesRaw,
          format: 'number',
          children,
        });
      } else {
        // 소분류가 없는 경우 (자본): 중분류가 leaf node
        const firstRow = 소분류Rows[0];
        중분류Rows.push({
          account: 중분류명,
          level: 1,
          isGroup: false,
          isCalculated: false,
          isBold: true,
          isHighlight: undefined,
          values: [...firstRow.values, firstRow.yoy],
          format: 'number',
        });
      }
    }

    // 대분류 값 = 중분류들의 합계 (YoY 제외)
    const 대분류ValuesRaw = calculateSum(중분류Rows);
    // YoY 재계산: 증감금액
    const val2612 = 대분류ValuesRaw[13] || 0;
    const val2512 = 대분류ValuesRaw[1] || 0;
    const 대분류YoY = val2612 - val2512;
    대분류ValuesRaw[대분류ValuesRaw.length - 1] = 대분류YoY;

    // 대분류 TableRow 생성
    result.push({
      account: 대분류명,
      level: 0,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: 대분류ValuesRaw,
      format: 'number',
      children: 중분류Rows,
    });
  }

  return result;
}

/**
 * TableRow 배열의 값들을 합산
 */
function calculateSum(rows: TableRow[]): (number | null)[] {
  if (rows.length === 0) return [];
  
  const length = rows[0].values.length;
  const sum: (number | null)[] = new Array(length).fill(0);
  
  for (const row of rows) {
    for (let i = 0; i < row.values.length; i++) {
      const val = row.values[i];
      if (val !== null && val !== undefined) {
        sum[i] = (sum[i] || 0) + val;
      }
    }
  }
  
  return sum;
}

/**
 * 운전자본 섹션 파싱
 * 구조: 대분류, 중분류, 2412, 2512, 2601~2612 (2단계 계층)
 */
interface WCTempRow {
  대분류: string;
  중분류: string;
  values: number[];
  yoy: number | null;
}

function parseWorkingCapitalSection(rows: string[][], year: number): TableRow[] {
  if (rows.length < 2) return [];

  const headers = rows[0];
  
  // 컬럼 인덱스 찾기
  const col2412 = headers.findIndex(h => h?.trim() === '2412');
  const col2512 = headers.findIndex(h => h?.trim() === '2512');
  const col2601 = headers.findIndex(h => h?.trim() === '2601');
  
  if (col2412 === -1 || col2512 === -1 || col2601 === -1) {
    console.warn('운전자본 CSV 헤더에서 컬럼을 찾을 수 없습니다:', headers);
  }

  const tempRows: WCTempRow[] = [];

  // 1단계: 데이터 행 파싱
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const 대분류 = row[0]?.trim() || '';
    const 중분류 = row[1]?.trim() || '';

    // 대분류가 없으면 스킵
    if (!대분류) continue;

    // 월별 데이터 파싱: 2412, 2512, 2601~2612 (총 14개월)
    const values: number[] = [];
    
    // 2412
    values.push(col2412 >= 0 ? parseAmount(row[col2412]) : 0);
    // 2512
    values.push(col2512 >= 0 ? parseAmount(row[col2512]) : 0);
    // 2601~2612 (12개월)
    for (let monthIdx = 1; monthIdx <= 12; monthIdx++) {
      const colIdx = col2601 + monthIdx - 1;
      values.push(colIdx >= 0 && colIdx < row.length ? parseAmount(row[colIdx]) : 0);
    }

    // YoY 계산: 2612 - 2512 (증감금액)
    const val2612 = values[13] || 0;
    const val2512 = values[1] || 0;
    const yoy = val2612 - val2512; // 증감금액

    tempRows.push({
      대분류,
      중분류,
      values,
      yoy,
    });
  }

  // 2단계: 2단계 계층 구조 생성
  return buildWCHierarchy(tempRows);
}

/**
 * 운전자본 계층 구조 생성 (2단계: 대분류 → 중분류)
 */
function buildWCHierarchy(tempRows: WCTempRow[]): TableRow[] {
  // 대분류별로 그룹화
  const 대분류Map = new Map<string, WCTempRow[]>();
  
  for (const row of tempRows) {
    if (!대분류Map.has(row.대분류)) {
      대분류Map.set(row.대분류, []);
    }
    대분류Map.get(row.대분류)!.push(row);
  }

  const result: TableRow[] = [];

  // 각 대분류 처리
  for (const [대분류명, rows] of 대분류Map) {
    // 중분류들을 TableRow로 변환 (leaf nodes)
    const 중분류Rows: TableRow[] = rows.map(r => ({
      account: r.중분류,
      level: 1,
      isGroup: false,
      isCalculated: false,
      isBold: false,
      isHighlight: undefined,
      values: [...r.values, r.yoy],
      format: 'number' as const,
    }));

    // 대분류 값 = 중분류들의 합계 (YoY 제외)
    const 대분류ValuesRaw = calculateSum(중분류Rows);
    // YoY는 재계산: 증감금액
    const val2612 = 대분류ValuesRaw[13] || 0; // 26년 12월
    const val2512 = 대분류ValuesRaw[1] || 0;   // 25년 12월
    const 대분류YoY = val2612 - val2512;
    
    // 마지막 값(YoY)을 재계산된 값으로 교체
    대분류ValuesRaw[대분류ValuesRaw.length - 1] = 대분류YoY;

    // 대분류 TableRow 생성
    result.push({
      account: 대분류명,
      level: 0,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'yellow',
      values: 대분류ValuesRaw,
      format: 'number',
      children: 중분류Rows,
    });
  }

  // BALANCE 검증 항목 추가 (모든 대분류의 합계, YoY 제외)
  const balanceValues = calculateSum(result);
  // YoY는 null로 설정
  balanceValues[balanceValues.length - 1] = null;
  
  result.push({
    account: 'Balance Check',
    level: 0,
    isGroup: false,
    isCalculated: true,
    isBold: true,
    isHighlight: 'none',
    values: balanceValues,
    format: 'number',
  });

  return result;
}

