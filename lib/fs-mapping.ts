import { FinancialData, TableRow, ComparisonData, BrandComparisonData } from './types';
import { WorkingCapitalRow } from './csv';

// 월별 데이터를 Map으로 변환
export function createMonthDataMap(data: FinancialData[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  
  data.forEach(({ account, month, value }) => {
    if (!map.has(account)) {
      map.set(account, new Array(12).fill(0));
    }
    const arr = map.get(account)!;
    arr[month - 1] = value;
  });
  
  return map;
}

// 계정 값 가져오기 (없으면 0으로 채워진 배열)
export function getAccountValues(map: Map<string, number[]>, account: string): number[] {
  return map.get(account) || new Array(12).fill(0);
}

// ==================== CF (현금흐름표) ====================
export function calculateCF(
  data: FinancialData[], 
  year2024Values: Map<string, number>,
  year: number = 2025,
  previousYearTotals?: Map<string, number>
): TableRow[] {
  const map = createMonthDataMap(data);
  
  const INITIAL_CASH = 140853827.859988;
  
  // 2024년 값 가져오기 헬퍼
  const get2024Value = (account: string): number | null => {
    return year2024Values.get(account) ?? null;
  };
  
  const sum2024Values = (accounts: string[]): number | null => {
    let sum = 0;
    let hasValue = false;
    for (const acc of accounts) {
      const val = year2024Values.get(acc);
      if (val !== undefined) {
        sum += val;
        hasValue = true;
      }
    }
    return hasValue ? sum : null;
  };
  
  // 매출수금
  const MLB = getAccountValues(map, 'MLB');
  const KIDS = getAccountValues(map, 'KIDS');
  const Discovery = getAccountValues(map, 'Discovery');
  const Duvetica = getAccountValues(map, 'Duvetica');
  const Supra = getAccountValues(map, 'Supra');
  const 매출수금 = MLB.map((v, i) => v + KIDS[i] + Discovery[i] + Duvetica[i] + Supra[i]);
  
  // 기타수익
  const 대리상선금 = getAccountValues(map, '대리상선금');
  const 대리상보증금 = getAccountValues(map, '대리상보증금');
  const 정부보조금 = getAccountValues(map, '정부보조금');
  const 기타수익 = getAccountValues(map, '기타수익');
  const 기타수익합계 = 대리상선금.map((v, i) => v + 대리상보증금[i] + 정부보조금[i] + 기타수익[i]);
  
  const 입금 = 매출수금.map((v, i) => v + 기타수익합계[i]);
  
  // 상품대
  const 본사 = getAccountValues(map, '본사');
  const 위탁생산 = getAccountValues(map, '위탁생산');
  const 상품대 = 본사.map((v, i) => v + 위탁생산[i]);
  
  const 본사선급금 = getAccountValues(map, '본사선급금');
  const 운영비 = getAccountValues(map, '운영비');
  const 출금 = 상품대.map((v, i) => v + 본사선급금[i] + 운영비[i]);
  
  const 영업활동 = 입금.map((v, i) => v + 출금[i]);
  
  // 재무활동
  const 차입금입금 = getAccountValues(map, '차입금입금');
  const 차입금상환 = getAccountValues(map, '차입금상환');
  const 재무활동 = 차입금입금.map((v, i) => v + 차입금상환[i]);
  
  // 투자활동
  const 자산성지출 = getAccountValues(map, '자산성지출');
  const 투자활동 = 자산성지출;
  
  // 합계 계산 (12개월)
  const sumArray = (arr: number[]) => arr.reduce((sum: number, v) => sum + v, 0);
  
  // 2024년 데이터 계산
  const 기초현금2024 = year2024Values.get('기초현금') ?? 140853827.859988;
  const 영업활동2024 = sum2024Values(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra', '대리상선금', '대리상보증금', '정부보조금', '기타수익', '본사', '위탁생산', '본사선급금', '운영비']);
  const 입금2024 = sum2024Values(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra', '대리상선금', '대리상보증금', '정부보조금', '기타수익']);
  const 매출수금2024 = sum2024Values(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra']);
  const 기타수익2024 = sum2024Values(['대리상선금', '대리상보증금', '정부보조금', '기타수익']);
  const 출금2024 = sum2024Values(['본사', '위탁생산', '본사선급금', '운영비']);
  const 상품대2024 = sum2024Values(['본사', '위탁생산']);
  const 재무활동2024 = sum2024Values(['차입금입금', '차입금상환']);
  const 투자활동2024 = sum2024Values(['자산성지출']);
  const 기말현금2024 = 기초현금2024 + (영업활동2024 ?? 0) + (재무활동2024 ?? 0) + (투자활동2024 ?? 0);
  
  // 현재년도 기말현금 계산
  const 기초현금 = new Array(12).fill(0);
  const 기말현금 = new Array(12).fill(0);
  
  if (year === 2025) {
    기초현금[0] = 기말현금2024;
  } else if (year === 2026 && previousYearTotals) {
    const 기말현금2025 = previousYearTotals.get('기말현금') ?? 기말현금2024;
    기초현금[0] = 기말현금2025;
  }
  
  기말현금[0] = 기초현금[0] + 영업활동[0] + 재무활동[0] + 투자활동[0];
  
  for (let i = 1; i < 12; i++) {
    기초현금[i] = 기말현금[i - 1];
    기말현금[i] = 기초현금[i] + 영업활동[i] + 재무활동[i] + 투자활동[i];
  }

  // YoY 계산 헬퍼 함수
  const calculateYoY = (currentYearTotal: number | null, previousValue: number | null): number | null => {
    if (currentYearTotal === null || previousValue === null) return null;
    return currentYearTotal - previousValue;
  };

  // 전년도 값 가져오기 헬퍼
  const getPreviousValue = (account: string, currentTotal: number): number | null => {
    if (year === 2026 && previousYearTotals) {
      return previousYearTotals.get(account) ?? null;
    } else {
      return get2024Value(account);
    }
  };

  // 전년도 합계 가져오기 헬퍼
  const getPreviousTotal = (accounts: string[], currentTotal: number): number | null => {
    if (year === 2026 && previousYearTotals) {
      let sum = 0;
      let hasValue = false;
      for (const acc of accounts) {
        const val = previousYearTotals.get(acc);
        if (val !== undefined) {
          sum += val;
          hasValue = true;
        }
      }
      return hasValue ? sum : null;
    } else {
      return sum2024Values(accounts);
    }
  };

  const rows: TableRow[] = [
    {
      account: '기초현금',
      level: 0,
      isGroup: false,
      isCalculated: true,
      isBold: true,
      isHighlight: 'yellow',
      values: [...기초현금, year === 2025 ? 기말현금2024 : (previousYearTotals?.get('기말현금') ?? 기말현금2024), calculateYoY(기초현금[0], year === 2025 ? 기초현금2024 : (previousYearTotals?.get('기초현금') ?? 기초현금2024))],
      format: 'number',
      year2024Value: year === 2025 ? 기초현금2024 : (previousYearTotals?.get('기초현금') ?? 기초현금2024),
    },
    {
      account: '1. 영업활동',
      level: 0,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: [...영업활동, sumArray(영업활동), calculateYoY(sumArray(영업활동), getPreviousTotal(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra', '대리상선금', '대리상보증금', '정부보조금', '기타수익', '본사', '위탁생산', '본사선급금', '운영비'], sumArray(영업활동)))],
      format: 'number',
      year2024Value: getPreviousTotal(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra', '대리상선금', '대리상보증금', '정부보조금', '기타수익', '본사', '위탁생산', '본사선급금', '운영비'], sumArray(영업활동)),
    },
    {
      account: '입금',
      level: 1,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'gray',
      values: [...입금, sumArray(입금), calculateYoY(sumArray(입금), getPreviousTotal(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra', '대리상선금', '대리상보증금', '정부보조금', '기타수익'], sumArray(입금)))],
      format: 'number',
      year2024Value: getPreviousTotal(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra', '대리상선금', '대리상보증금', '정부보조금', '기타수익'], sumArray(입금)),
    },
    {
      account: '매출수금',
      level: 2,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      values: [...매출수금, sumArray(매출수금), calculateYoY(sumArray(매출수금), getPreviousTotal(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra'], sumArray(매출수금)))],
      format: 'number',
      year2024Value: getPreviousTotal(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra'], sumArray(매출수금)),
    },
    { account: 'MLB', level: 3, isGroup: false, isCalculated: false, values: [...MLB, sumArray(MLB), calculateYoY(sumArray(MLB), getPreviousValue('MLB', sumArray(MLB)))], format: 'number', year2024Value: getPreviousValue('MLB', sumArray(MLB)) },
    { account: 'KIDS', level: 3, isGroup: false, isCalculated: false, values: [...KIDS, sumArray(KIDS), calculateYoY(sumArray(KIDS), getPreviousValue('KIDS', sumArray(KIDS)))], format: 'number', year2024Value: getPreviousValue('KIDS', sumArray(KIDS)) },
    { account: 'Discovery', level: 3, isGroup: false, isCalculated: false, values: [...Discovery, sumArray(Discovery), calculateYoY(sumArray(Discovery), getPreviousValue('Discovery', sumArray(Discovery)))], format: 'number', year2024Value: getPreviousValue('Discovery', sumArray(Discovery)) },
    { account: 'Duvetica', level: 3, isGroup: false, isCalculated: false, values: [...Duvetica, sumArray(Duvetica), calculateYoY(sumArray(Duvetica), getPreviousValue('Duvetica', sumArray(Duvetica)))], format: 'number', year2024Value: getPreviousValue('Duvetica', sumArray(Duvetica)) },
    { account: 'Supra', level: 3, isGroup: false, isCalculated: false, values: [...Supra, sumArray(Supra), calculateYoY(sumArray(Supra), getPreviousValue('Supra', sumArray(Supra)))], format: 'number', year2024Value: getPreviousValue('Supra', sumArray(Supra)) },
    {
      account: '기타수익',
      level: 2,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      values: [...기타수익합계, sumArray(기타수익합계), calculateYoY(sumArray(기타수익합계), 기타수익2024)],
      format: 'number',
      year2024Value: getPreviousTotal(['대리상선금', '대리상보증금', '정부보조금', '기타수익'], sumArray(기타수익합계)),
    },
    { account: '대리상선금', level: 3, isGroup: false, isCalculated: false, values: [...대리상선금, sumArray(대리상선금), calculateYoY(sumArray(대리상선금), getPreviousValue('대리상선금', sumArray(대리상선금)))], format: 'number', year2024Value: getPreviousValue('대리상선금', sumArray(대리상선금)) },
    { account: '대리상보증금', level: 3, isGroup: false, isCalculated: false, values: [...대리상보증금, sumArray(대리상보증금), calculateYoY(sumArray(대리상보증금), getPreviousValue('대리상보증금', sumArray(대리상보증금)))], format: 'number', year2024Value: getPreviousValue('대리상보증금', sumArray(대리상보증금)) },
    { account: '정부보조금', level: 3, isGroup: false, isCalculated: false, values: [...정부보조금, sumArray(정부보조금), calculateYoY(sumArray(정부보조금), getPreviousValue('정부보조금', sumArray(정부보조금)))], format: 'number', year2024Value: getPreviousValue('정부보조금', sumArray(정부보조금)) },
    { account: '기타수익', level: 3, isGroup: false, isCalculated: false, values: [...기타수익, sumArray(기타수익), calculateYoY(sumArray(기타수익), getPreviousValue('기타수익', sumArray(기타수익)))], format: 'number', year2024Value: getPreviousValue('기타수익', sumArray(기타수익)) },
    {
      account: '출금',
      level: 1,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'gray',
      values: [...출금, sumArray(출금), calculateYoY(sumArray(출금), 출금2024)],
      format: 'number',
      year2024Value: getPreviousTotal(['본사', '위탁생산', '본사선급금', '운영비'], sumArray(출금)),
    },
    {
      account: '상품대',
      level: 2,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      values: [...상품대, sumArray(상품대), calculateYoY(sumArray(상품대), getPreviousTotal(['본사', '위탁생산'], sumArray(상품대)))],
      format: 'number',
      year2024Value: getPreviousTotal(['본사', '위탁생산'], sumArray(상품대)),
    },
    { account: '본사', level: 3, isGroup: false, isCalculated: false, values: [...본사, sumArray(본사), calculateYoY(sumArray(본사), getPreviousValue('본사', sumArray(본사)))], format: 'number', year2024Value: getPreviousValue('본사', sumArray(본사)) },
    { account: '위탁생산', level: 3, isGroup: false, isCalculated: false, values: [...위탁생산, sumArray(위탁생산), calculateYoY(sumArray(위탁생산), getPreviousValue('위탁생산', sumArray(위탁생산)))], format: 'number', year2024Value: getPreviousValue('위탁생산', sumArray(위탁생산)) },
    { account: '본사선급금', level: 2, isGroup: false, isCalculated: false, values: [...본사선급금, sumArray(본사선급금), calculateYoY(sumArray(본사선급금), getPreviousValue('본사선급금', sumArray(본사선급금)))], format: 'number', year2024Value: getPreviousValue('본사선급금', sumArray(본사선급금)) },
    { account: '운영비', level: 2, isGroup: false, isCalculated: false, values: [...운영비, sumArray(운영비), calculateYoY(sumArray(운영비), getPreviousValue('운영비', sumArray(운영비)))], format: 'number', year2024Value: getPreviousValue('운영비', sumArray(운영비)) },
    {
      account: '2. 재무활동',
      level: 0,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: [...재무활동, sumArray(재무활동), calculateYoY(sumArray(재무활동), getPreviousTotal(['차입금입금', '차입금상환'], sumArray(재무활동)))],
      format: 'number',
      year2024Value: getPreviousTotal(['차입금입금', '차입금상환'], sumArray(재무활동)),
    },
    { account: '차입금입금', level: 1, isGroup: false, isCalculated: false, values: [...차입금입금, sumArray(차입금입금), calculateYoY(sumArray(차입금입금), getPreviousValue('차입금입금', sumArray(차입금입금)))], format: 'number', year2024Value: getPreviousValue('차입금입금', sumArray(차입금입금)) },
    { account: '차입금상환', level: 1, isGroup: false, isCalculated: false, values: [...차입금상환, sumArray(차입금상환), calculateYoY(sumArray(차입금상환), getPreviousValue('차입금상환', sumArray(차입금상환)))], format: 'number', year2024Value: getPreviousValue('차입금상환', sumArray(차입금상환)) },
    {
      account: '3. 투자활동',
      level: 0,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: [...투자활동, sumArray(투자활동), calculateYoY(sumArray(투자활동), getPreviousTotal(['자산성지출'], sumArray(투자활동)))],
      format: 'number',
      year2024Value: getPreviousTotal(['자산성지출'], sumArray(투자활동)),
    },
    { account: '자산성지출', level: 1, isGroup: false, isCalculated: false, values: [...자산성지출, sumArray(자산성지출), calculateYoY(sumArray(자산성지출), getPreviousValue('자산성지출', sumArray(자산성지출)))], format: 'number', year2024Value: getPreviousValue('자산성지출', sumArray(자산성지출)) },
    {
      account: '기말현금',
      level: 0,
      isGroup: false,
      isCalculated: true,
      isBold: true,
      isHighlight: 'yellow',
      values: [...기말현금, 기말현금[11], calculateYoY(기말현금[11], year === 2026 && previousYearTotals ? (previousYearTotals.get('기말현금') ?? 기말현금2024) : 기말현금2024)],
      format: 'number',
      year2024Value: year === 2026 && previousYearTotals ? (previousYearTotals.get('기말현금') ?? 기말현금2024) : 기말현금2024,
    },
  ];
  
  return rows;
}

// ==================== Working Capital Table (운전자본표) ====================
export function calculateWorkingCapitalTable(
  data: WorkingCapitalRow[],
  previousYearTotals?: Map<string, number>
): TableRow[] {
  // 대분류별로 그룹화
  const groupedBy대분류 = new Map<string, WorkingCapitalRow[]>();
  
  for (const row of data) {
    if (!groupedBy대분류.has(row.대분류)) {
      groupedBy대분류.set(row.대분류, []);
    }
    groupedBy대분류.get(row.대분류)!.push(row);
  }
  
  const rows: TableRow[] = [];
  const 대분류순서 = Array.from(new Set(data.map(r => r.대분류)));
  
  // YoY 계산 헬퍼
  const calculateYoY = (currentTotal: number, previousTotal: number | null | undefined): number | null => {
    if (previousTotal === null || previousTotal === undefined) return null;
    return currentTotal - previousTotal;
  };
  
  for (const 대분류 of 대분류순서) {
    const 중분류Rows = groupedBy대분류.get(대분류) || [];
    
    // 대분류 합계 계산 (중분류 합산)
    const 대분류합계 = new Array(12).fill(0);
    for (const 중분류Row of 중분류Rows) {
      for (let i = 0; i < 12; i++) {
        대분류합계[i] += 중분류Row.values[i];
      }
    }
    
    // 연간 합계 추가
    const 연간합계 = 대분류합계.reduce((sum, v) => sum + v, 0);
    
    // 전년도 대분류 합계
    const previousTotal = previousYearTotals?.get(대분류);
    
    // YoY 계산
    const yoyValue = calculateYoY(연간합계, previousTotal);
    
    // 대분류 행 추가 (하늘색 배경)
    rows.push({
      account: 대분류,
      level: 0,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: [...대분류합계, 연간합계, yoyValue],
      format: 'number',
      year2024Value: previousTotal ?? null,
    });
    
    // 중분류 행 추가
    for (const 중분류Row of 중분류Rows) {
      const 중분류연간합계 = 중분류Row.values.reduce((sum, v) => sum + v, 0);
      const accountKey = `${대분류}-${중분류Row.중분류}`;
      const previousValue = previousYearTotals?.get(accountKey);
      
      // 중분류 YoY 계산
      const 중분류YoY = calculateYoY(중분류연간합계, previousValue);
      
      rows.push({
        account: 중분류Row.중분류,
        level: 1,
        isGroup: false,
        isCalculated: false,
        values: [...중분류Row.values, 중분류연간합계, 중분류YoY],
        format: 'number',
        year2024Value: previousValue ?? null,
      });
    }
  }
  
  return rows;
}
