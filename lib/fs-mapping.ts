import { FinancialData, TableRow, ComparisonData, BrandComparisonData } from './types';
import { CashflowRow, WorkingCapitalRow, WorkingCapitalStatementRow } from './csv';

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
  
  // 현금잔액 (CSV에서 직접 읽기)
  const 현금잔액CSV = getAccountValues(map, '현금잔액');
  
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
    // Net Cash = 영업활동 + 자산성지출 + 기타수익 + from 차입금(재무활동)
    (() => {
      const netCash = 영업활동.map((_, i) => 영업활동[i] + 자산성지출[i] + 기타수익합계[i] + 재무활동[i]);
      const netCashAnnual = sumArray(netCash);
      const prev영업 = getPreviousTotal(['MLB', 'KIDS', 'Discovery', 'Duvetica', 'Supra', '대리상선금', '대리상보증금', '정부보조금', '기타수익', '본사', '위탁생산', '본사선급금', '운영비'], netCashAnnual);
      const prev자산 = getPreviousTotal(['자산성지출'], netCashAnnual);
      const prev기타 = getPreviousTotal(['대리상선금', '대리상보증금', '정부보조금', '기타수익'], netCashAnnual);
      const prev재무 = getPreviousTotal(['차입금입금', '차입금상환'], netCashAnnual);
      const prevNetCash = (prev영업 ?? 0) + (prev자산 ?? 0) + (prev기타 ?? 0) + (prev재무 ?? 0);
      const year2024NetCash = (prev영업 != null || prev자산 != null || prev기타 != null || prev재무 != null) ? prevNetCash : null;
      return {
        account: 'Net Cash',
        level: 0,
        isGroup: false,
        isCalculated: true,
        isBold: false,
        isHighlight: 'darkGray' as const,
        values: [...netCash, netCashAnnual, calculateYoY(netCashAnnual, year2024NetCash)] as (number | null)[],
        format: 'number' as const,
        year2024Value: year2024NetCash,
      };
    })(),
    {
      account: '현금잔액',
      level: 0,
      isGroup: false,
      isCalculated: false,
      isBold: true,
      isHighlight: 'yellow',
      values: [...현금잔액CSV, 현금잔액CSV[11] || 0, calculateYoY(현금잔액CSV[11] || 0, year === 2026 && previousYearTotals ? (previousYearTotals.get('현금잔액') ?? null) : null)],
      format: 'number',
      year2024Value: year === 2026 && previousYearTotals ? (previousYearTotals.get('현금잔액') ?? null) : null,
    },
  ];

  return rows;
}

// ==================== Cashflow Table (현금흐름표 - cashflow 폴더, 대분류/중분류/소분류) ====================
const 현금흐름대분류순서 = ['영업활동', '자산성지출', '기타수익', 'from 차입금'];
const 현금흐름중분류순서 = ['매출수금', '물품대', '본사선급금', '비용'];

export function calculateCashflowTable(
  data: CashflowRow[],
  previousYearTotals?: Map<string, number>,
  year2023Totals?: Map<string, number>
): TableRow[] {
  const groupedBy대분류 = new Map<string, CashflowRow[]>();
  for (const row of data) {
    if (!groupedBy대분류.has(row.대분류)) groupedBy대분류.set(row.대분류, []);
    groupedBy대분류.get(row.대분류)!.push(row);
  }

  const rows: TableRow[] = [];
  const 대분류연간합계: { 대분류: string; 연간합계: number; year2024Value: number | null; year2023Value: number | null }[] = [];
  const calculateYoY = (currentTotal: number, previousTotal: number | null | undefined): number | null => {
    if (previousTotal === null || previousTotal === undefined) return null;
    return currentTotal - previousTotal;
  };

  for (const 대분류 of 현금흐름대분류순서) {
    const 대분류Rows = groupedBy대분류.get(대분류) || [];
    if (대분류Rows.length === 0) continue;

    const 대분류합계 = new Array(12).fill(0);
    for (const r of 대분류Rows) {
      for (let i = 0; i < 12; i++) 대분류합계[i] += r.values[i];
    }
    const 연간합계 = 대분류합계.reduce((sum, v) => sum + v, 0);
    const yoyValue = calculateYoY(연간합계, previousYearTotals?.get(대분류));
    const year2024Val = previousYearTotals?.get(대분류) ?? null;
    const year2023Val = year2023Totals?.get(대분류) ?? null;
    대분류연간합계.push({ 대분류, 연간합계, year2024Value: year2024Val, year2023Value: year2023Val });

    const 중분류Set = new Set(대분류Rows.map((r) => r.중분류).filter(Boolean));
    const 중분류Ordered = 현금흐름중분류순서.filter((c) => 중분류Set.has(c));
    const 중분류Rest = [...중분류Set].filter((c) => !현금흐름중분류순서.includes(c));
    const 중분류List = [...중분류Ordered, ...중분류Rest.sort()];

    rows.push({
      account: 대분류,
      level: 0,
      isGroup: 중분류List.length > 0,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: [...대분류합계, 연간합계, yoyValue],
      format: 'number',
      year2024Value: year2024Val,
      year2023Value: year2023Val,
    });

    for (const 중분류 of 중분류List) {
      const 중분류RowsList = 대분류Rows.filter((r) => r.중분류 === 중분류);
      const 중분류합계 = new Array(12).fill(0);
      for (const r of 중분류RowsList) {
        for (let i = 0; i < 12; i++) 중분류합계[i] += r.values[i];
      }
      const 중분류연간합계 = 중분류합계.reduce((sum, v) => sum + v, 0);
      const accountKey = `${대분류}-${중분류}`;
      const 중분류YoY = calculateYoY(중분류연간합계, previousYearTotals?.get(accountKey));

      const has소분류 = 중분류RowsList.some((r) => !!r.소분류);
      rows.push({
        account: 중분류,
        level: 1,
        isGroup: has소분류,
        isCalculated: true,
        isBold: true,
        values: [...중분류합계, 중분류연간합계, 중분류YoY],
        format: 'number',
        year2024Value: previousYearTotals?.get(accountKey) ?? null,
        year2023Value: year2023Totals?.get(accountKey) ?? null,
      });

      for (const r of 중분류RowsList) {
        if (!r.소분류) continue;
        const 소분류연간합계 = r.values.reduce((sum, v) => sum + v, 0);
        const 소분류Key = `${대분류}-${중분류}-${r.소분류}`;
        const 소분류YoY = calculateYoY(소분류연간합계, previousYearTotals?.get(소분류Key));
        rows.push({
          account: r.소분류,
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...r.values, 소분류연간합계, 소분류YoY],
          format: 'number',
          year2024Value: previousYearTotals?.get(소분류Key) ?? null,
          year2023Value: year2023Totals?.get(소분류Key) ?? null,
        });
      }
    }
  }

  // Net Cash = 영업활동 + 자산성지출 + 기타수익 + from 차입금 (from 차입금 바로 아래 행에 항상 표시)
  if (대분류연간합계.length > 0) {
    const netCashValues = new Array(14).fill(0);
    let netCashAnnual = 0;
    let netCashYear2024: number | null = null;
    let netCashYear2023: number | null = null;
    for (const d of 대분류연간합계) {
      const row = rows.find((r) => r.account === d.대분류);
      if (row && row.values.length >= 14) {
        for (let i = 0; i < 14; i++) netCashValues[i] += row.values[i] ?? 0;
      }
      netCashAnnual += d.연간합계;
      if (d.year2024Value != null) netCashYear2024 = (netCashYear2024 ?? 0) + d.year2024Value;
      if (d.year2023Value != null) netCashYear2023 = (netCashYear2023 ?? 0) + d.year2023Value;
    }
    netCashValues[12] = netCashAnnual;
    netCashValues[13] = calculateYoY(netCashAnnual, netCashYear2024) ?? 0;
    rows.push({
      account: 'Net Cash',
      level: 0,
      isGroup: false,
      isCalculated: true,
      isBold: false,
      isHighlight: 'darkGray',
      values: netCashValues,
      format: 'number',
      year2024Value: netCashYear2024,
      year2023Value: netCashYear2023,
    });
  }

  return rows;
}

// ==================== Working Capital Table (운전자본표) ====================
const 대분류순서 = ['영업활동', '자산성지출', '기타수익', 'from 차입금'];
const 중분류순서 = ['매출수금', '물품대', '본사선급금', '비용'];

export function calculateWorkingCapitalTable(
  data: WorkingCapitalRow[],
  previousYearTotals?: Map<string, number>,
  year2023Totals?: Map<string, number>
): TableRow[] {
  const groupedBy대분류 = new Map<string, WorkingCapitalRow[]>();
  for (const row of data) {
    if (!groupedBy대분류.has(row.대분류)) {
      groupedBy대분류.set(row.대분류, []);
    }
    groupedBy대분류.get(row.대분류)!.push(row);
  }

  const rows: TableRow[] = [];
  const calculateYoY = (currentTotal: number, previousTotal: number | null | undefined): number | null => {
    if (previousTotal === null || previousTotal === undefined) return null;
    return currentTotal - previousTotal;
  };

  for (const 대분류 of 대분류순서) {
    const 대분류Rows = groupedBy대분류.get(대분류) || [];
    if (대분류Rows.length === 0) continue;

    const 대분류합계 = new Array(12).fill(0);
    for (const r of 대분류Rows) {
      for (let i = 0; i < 12; i++) 대분류합계[i] += r.values[i];
    }
    const 연간합계 = 대분류합계.reduce((sum, v) => sum + v, 0);
    const yoyValue = calculateYoY(연간합계, previousYearTotals?.get(대분류));

    const 중분류Set = new Set(대분류Rows.map(r => r.중분류).filter(Boolean));
    const 중분류Ordered = 중분류순서.filter(c => 중분류Set.has(c));
    const 중분류Rest = [...중분류Set].filter(c => !중분류순서.includes(c));
    const 중분류List = [...중분류Ordered, ...중분류Rest.sort()];

    rows.push({
      account: 대분류,
      level: 0,
      isGroup: 중분류List.length > 0,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: [...대분류합계, 연간합계, yoyValue],
      format: 'number',
      year2024Value: previousYearTotals?.get(대분류) ?? null,
      year2023Value: year2023Totals?.get(대분류) ?? null,
    });

    for (const 중분류 of 중분류List) {
      const 중분류RowsList = 대분류Rows.filter(r => r.중분류 === 중분류);
      const 중분류합계 = new Array(12).fill(0);
      for (const r of 중분류RowsList) {
        for (let i = 0; i < 12; i++) 중분류합계[i] += r.values[i];
      }
      const 중분류연간합계 = 중분류합계.reduce((sum, v) => sum + v, 0);
      const accountKey = `${대분류}-${중분류}`;
      const 중분류YoY = calculateYoY(중분류연간합계, previousYearTotals?.get(accountKey));

      const has소분류 = 중분류RowsList.some(r => !!r.소분류);
      rows.push({
        account: 중분류,
        level: 1,
        isGroup: has소분류,
        isCalculated: true,
        isBold: true,
        values: [...중분류합계, 중분류연간합계, 중분류YoY],
        format: 'number',
        year2024Value: previousYearTotals?.get(accountKey) ?? null,
        year2023Value: year2023Totals?.get(accountKey) ?? null,
      });

      for (const r of 중분류RowsList) {
        if (!r.소분류) continue;
        const 소분류연간합계 = r.values.reduce((sum, v) => sum + v, 0);
        const 소분류Key = `${대분류}-${중분류}-${r.소분류}`;
        const 소분류YoY = calculateYoY(소분류연간합계, previousYearTotals?.get(소분류Key));

        rows.push({
          account: r.소분류,
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...r.values, 소분류연간합계, 소분류YoY],
          format: 'number',
          year2024Value: previousYearTotals?.get(소분류Key) ?? null,
          year2023Value: year2023Totals?.get(소분류Key) ?? null,
        });
      }
    }
  }

  return rows;
}

// ==================== Working Capital Statement (운전자본표 - 운전자본 폴더) ====================
const 운전자본표대분류순서 = ['매출채권', '재고자산', '매입채무'];

export function calculateWorkingCapitalStatementTable(
  data: WorkingCapitalStatementRow[],
  previousYearTotals?: Map<string, number>,
  year2023Totals?: Map<string, number>,
  twoYearsAgoTotals?: Map<string, number>
): TableRow[] {
  const groupedBy대분류 = new Map<string, WorkingCapitalStatementRow[]>();
  for (const row of data) {
    if (!groupedBy대분류.has(row.대분류)) {
      groupedBy대분류.set(row.대분류, []);
    }
    groupedBy대분류.get(row.대분류)!.push(row);
  }

  const rows: TableRow[] = [];
  const 대분류RowData: { values: number[]; 기말: number; year2024Value: number | null; year2023Value: number | null }[] = [];
  
  // 마지막 유효한 월 인덱스 찾기
  const getLastValidIndex = (values: number[]): number => {
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] != null && values[i] !== 0) {
        return i;
      }
    }
    return values.length - 1;
  };
  
  const calculateYoY = (currentTotal: number, previousTotal: number | null | undefined): number | null => {
    if (previousTotal === null || previousTotal === undefined) return null;
    return currentTotal - previousTotal;
  };

  for (const 대분류 of 운전자본표대분류순서) {
    const 대분류Rows = groupedBy대분류.get(대분류) || [];
    if (대분류Rows.length === 0) continue;

    const 대분류합계 = new Array(12).fill(0);
    for (const r of 대분류Rows) {
      for (let i = 0; i < 12; i++) 대분류합계[i] += r.values[i];
    }
    const lastIdx = getLastValidIndex(대분류합계);
    const 기말 = 대분류합계[lastIdx] ?? 0;
    const yoyValue = calculateYoY(기말, previousYearTotals?.get(대분류));

    대분류RowData.push({
      values: [...대분류합계, 기말, yoyValue],
      기말,
      year2024Value: previousYearTotals?.get(대분류) ?? null,
      year2023Value: year2023Totals?.get(대분류) ?? null,
    });
    rows.push({
      account: 대분류,
      level: 0,
      isGroup: 대분류Rows.length > 0,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: [...대분류합계, 기말, yoyValue],
      format: 'number',
      year2024Value: previousYearTotals?.get(대분류) ?? null,
      year2023Value: year2023Totals?.get(대분류) ?? null,
    });

    for (const r of 대분류Rows) {
      const lastIdx = getLastValidIndex(r.values);
      const 중분류기말 = r.values[lastIdx] ?? 0;
      const accountKey = `${대분류}-${r.중분류}`;
      const 중분류YoY = calculateYoY(중분류기말, previousYearTotals?.get(accountKey));

      rows.push({
        account: r.중분류,
        level: 1,
        isGroup: false,
        isCalculated: false,
        values: [...r.values, 중분류기말, 중분류YoY],
        format: 'number',
        year2024Value: previousYearTotals?.get(accountKey) ?? null,
        year2023Value: year2023Totals?.get(accountKey) ?? null,
      });
    }
  }

  // 운전자본 합계 행 (헤더와 매출채권 사이): 매출채권 + 재고자산 + 매입채무
  if (대분류RowData.length >= 3) {
    const sumValues = new Array(14).fill(0);
    let sum기말 = 0;
    let sumYear2024: number | null = null;
    let sumYear2023: number | null = null;
    for (const r of 대분류RowData) {
      for (let i = 0; i < r.values.length; i++) sumValues[i] += r.values[i] ?? 0;
      sum기말 += r.기말;
      if (r.year2024Value != null) sumYear2024 = (sumYear2024 ?? 0) + r.year2024Value;
      if (r.year2023Value != null) sumYear2023 = (sumYear2023 ?? 0) + r.year2023Value;
    }
    const 합계YoY = calculateYoY(sum기말, sumYear2024);
    sumValues[12] = sum기말;
    sumValues[13] = 합계YoY ?? 0;
    rows.unshift({
      account: '운전자본 합계',
      level: 0,
      isGroup: false,
      isCalculated: true,
      isBold: true,
      isHighlight: 'yellow',
      values: sumValues,
      format: 'number',
      year2024Value: sumYear2024,
      year2023Value: sumYear2023,
    });

    // 전월대비 행 기초 컬럼: 2024년(기말)=2024-2023, 2025년(기말)=2025-2024 등
    let momYear2024: number | null = null;
    if (sumYear2023 != null) {
      momYear2024 = sumYear2024 != null ? sumYear2024 - sumYear2023 : null;
    } else if (twoYearsAgoTotals != null && sumYear2024 != null) {
      const sumTwoYearsAgo = 운전자본표대분류순서.reduce((s, 대분류) => s + (twoYearsAgoTotals!.get(대분류) ?? 0), 0);
      momYear2024 = sumYear2024 - sumTwoYearsAgo;
    }
    // 전월대비 행 year2023Value: 2025 뷰에서는 2023-2022 없음(null). 2026 뷰에서는 2024기말-2023기말
    let momYear2023: number | null = null;
    if (twoYearsAgoTotals != null && year2023Totals != null) {
      const sumTwoYearsAgo = 운전자본표대분류순서.reduce((s, 대분류) => s + (twoYearsAgoTotals!.get(대분류) ?? 0), 0);
      const sumYear2023 = 운전자본표대분류순서.reduce((s, 대분류) => s + (year2023Totals!.get(대분류) ?? 0), 0);
      momYear2023 = sumTwoYearsAgo - sumYear2023;
    }

    // 전월대비 행 (운전자본 합계와 매출채권 사이): 1월=당년1월-전년12월, 2~12월=당월-전월, 기말=당년기말-전년기말, YoY=비움
    const momValues: (number | null)[] = new Array(14);
    momValues[0] = sumYear2024 != null ? sumValues[0] - sumYear2024 : null;
    for (let i = 1; i <= 11; i++) {
      momValues[i] = sumValues[i] - sumValues[i - 1];
    }
    momValues[12] = sumYear2024 != null ? sum기말 - sumYear2024 : null;
    momValues[13] = null; // YoY 컬럼 비움
    rows.splice(1, 0, {
      account: '전월대비',
      level: 0,
      isGroup: false,
      isCalculated: true,
      isBold: false,
      isHighlight: 'gray',
      values: momValues,
      format: 'number',
      year2024Value: momYear2024,
      year2023Value: momYear2023,
    });
  }

  return rows;
}
