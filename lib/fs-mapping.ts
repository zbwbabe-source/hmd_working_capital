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
  
  // 합계 계산
  const sumArray = (arr: number[]) => arr.reduce((sum: number, v) => sum + v, 0);
  
  // YoY 계산
  const calculateYoY = (currentYearTotal: number | null, previousValue: number | null): number | null => {
    if (currentYearTotal === null || previousValue === null) return null;
    return currentYearTotal - previousValue;
  };
  
  // 전년도 값 가져오기 헬퍼
  const getPreviousValue = (account: string): number | null => {
    if (year === 2026 && previousYearTotals) {
      return previousYearTotals.get(account) ?? null;
    } else {
      return year2024Values.get(account) ?? null;
    }
  };
  
  // CSV에서 데이터 읽기 (새로운 구조)
  // 계정명 형식: "매출수금", "매출수금_홍콩마카오", "매출수금_대만"
  const 매출수금 = getAccountValues(map, '매출수금');
  const 매출수금홍콩 = getAccountValues(map, '매출수금_홍콩마카오');
  const 매출수금대만 = getAccountValues(map, '매출수금_대만');
  
  const 물품대 = getAccountValues(map, '물품대');
  const 물품대홍콩 = getAccountValues(map, '물품대_홍콩마카오');
  const 물품대대만 = getAccountValues(map, '물품대_대만');
  
  const 기타수익 = getAccountValues(map, '기타수익');
  const 기타수익홍콩 = getAccountValues(map, '기타수익_홍콩마카오');
  const 기타수익대만 = getAccountValues(map, '기타수익_대만');
  
  const 광고비 = getAccountValues(map, '광고비');
  const 광고비홍콩 = getAccountValues(map, '광고비_홍콩마카오');
  const 광고비대만 = getAccountValues(map, '광고비_대만');
  
  const 매장임차료 = getAccountValues(map, '매장 임차료');
  const 매장임차료홍콩 = getAccountValues(map, '매장 임차료_홍콩마카오');
  const 매장임차료대만 = getAccountValues(map, '매장 임차료_대만');
  
  const 매장운영비 = getAccountValues(map, '매장 운영비');
  const 매장운영비홍콩 = getAccountValues(map, '매장 운영비_홍콩마카오');
  const 매장운영비대만 = getAccountValues(map, '매장 운영비_대만');
  
  const 사무실운영비 = getAccountValues(map, '사무실 운영비');
  const 사무실운영비홍콩 = getAccountValues(map, '사무실 운영비_홍콩마카오');
  const 사무실운영비대만 = getAccountValues(map, '사무실 운영비_대만');
  
  const 수입관세 = getAccountValues(map, '수입관세');
  const 수입관세홍콩 = getAccountValues(map, '수입관세_홍콩마카오');
  const 수입관세대만 = getAccountValues(map, '수입관세_대만');
  
  const 인건비 = getAccountValues(map, '인건비');
  const 인건비홍콩 = getAccountValues(map, '인건비_홍콩마카오');
  const 인건비대만 = getAccountValues(map, '인건비_대만');
  
  const 보증금지급 = getAccountValues(map, '보증금지급');
  const 보증금지급홍콩 = getAccountValues(map, '보증금지급_홍콩마카오');
  const 보증금지급대만 = getAccountValues(map, '보증금지급_대만');
  
  const 기타비용 = getAccountValues(map, '기타');
  const 기타비용홍콩 = getAccountValues(map, '기타_홍콩마카오');
  const 기타비용대만 = getAccountValues(map, '기타_대만');
  
  const 인테리어VMD = getAccountValues(map, '인테리어/VMD');
  const 인테리어VMD홍콩 = getAccountValues(map, '인테리어/VMD_홍콩마카오');
  const 인테리어VMD대만 = getAccountValues(map, '인테리어/VMD_대만');
  
  const 비품취득 = getAccountValues(map, '비품취득');
  const 비품취득홍콩 = getAccountValues(map, '비품취득_홍콩마카오');
  const 비품취득대만 = getAccountValues(map, '비품취득_대만');
  
  const 현금잔액 = getAccountValues(map, '현금잔액');
  const 현금잔액홍콩 = getAccountValues(map, '현금잔액_홍콩마카오');
  const 현금잔액대만 = getAccountValues(map, '현금잔액_대만');
  
  // 영업활동 총합 계산
  const 비용합계 = 광고비.map((v, i) => 
    v + 매장임차료[i] + 매장운영비[i] + 사무실운영비[i] + 수입관세[i] + 인건비[i] + 보증금지급[i] + 기타비용[i]
  );
  
  const 영업활동 = 매출수금.map((v, i) => v + 물품대[i] + 기타수익[i] + 비용합계[i]);
  
  // 자산성지출 총합
  const 자산성지출 = 인테리어VMD.map((v, i) => v + 비품취득[i]);
  
  // Net Cash 계산
  const netCash = 영업활동.map((v, i) => v + 자산성지출[i] + 기타수익[i]);

  const rows: TableRow[] = [
    // 영업활동
    {
      account: '영업활동',
      level: 0,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: [...영업활동, sumArray(영업활동), calculateYoY(sumArray(영업활동), getPreviousValue('영업활동'))],
      format: 'number',
      year2024Value: getPreviousValue('영업활동'),
    },
    // 매출수금 (토글 가능)
    {
      account: '매출수금',
      level: 1,
      isGroup: true,
      isCalculated: false,
      isBold: true,
      values: [...매출수금, sumArray(매출수금), calculateYoY(sumArray(매출수금), getPreviousValue('매출수금'))],
      format: 'number',
      year2024Value: getPreviousValue('매출수금'),
      children: [
        {
          account: '홍콩마카오',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...매출수금홍콩, sumArray(매출수금홍콩), calculateYoY(sumArray(매출수금홍콩), getPreviousValue('매출수금_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('매출수금_홍콩마카오'),
        },
        {
          account: '대만',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...매출수금대만, sumArray(매출수금대만), calculateYoY(sumArray(매출수금대만), getPreviousValue('매출수금_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('매출수금_대만'),
        },
      ],
    },
    // 물품대 (토글 가능)
    {
      account: '물품대',
      level: 1,
      isGroup: true,
      isCalculated: false,
      isBold: true,
      values: [...물품대, sumArray(물품대), calculateYoY(sumArray(물품대), getPreviousValue('물품대'))],
      format: 'number',
      year2024Value: getPreviousValue('물품대'),
      children: [
        {
          account: '홍콩마카오',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...물품대홍콩, sumArray(물품대홍콩), calculateYoY(sumArray(물품대홍콩), getPreviousValue('물품대_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('물품대_홍콩마카오'),
        },
        {
          account: '대만',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...물품대대만, sumArray(물품대대만), calculateYoY(sumArray(물품대대만), getPreviousValue('물품대_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('물품대_대만'),
        },
      ],
    },
    // 비용
    {
      account: '비용',
      level: 1,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'gray',
      values: [...비용합계, sumArray(비용합계), calculateYoY(sumArray(비용합계), getPreviousValue('비용'))],
      format: 'number',
      year2024Value: getPreviousValue('비용'),
    },
    // 광고비 (토글 가능)
    {
      account: '광고비',
      level: 2,
      isGroup: true,
      isCalculated: false,
      values: [...광고비, sumArray(광고비), calculateYoY(sumArray(광고비), getPreviousValue('광고비'))],
      format: 'number',
      year2024Value: getPreviousValue('광고비'),
      children: [
        {
          account: '홍콩마카오',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...광고비홍콩, sumArray(광고비홍콩), calculateYoY(sumArray(광고비홍콩), getPreviousValue('광고비_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('광고비_홍콩마카오'),
        },
        {
          account: '대만',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...광고비대만, sumArray(광고비대만), calculateYoY(sumArray(광고비대만), getPreviousValue('광고비_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('광고비_대만'),
        },
      ],
    },
    // 매장 임차료 (토글 가능)
    {
      account: '매장 임차료',
      level: 2,
      isGroup: true,
      isCalculated: false,
      values: [...매장임차료, sumArray(매장임차료), calculateYoY(sumArray(매장임차료), getPreviousValue('매장 임차료'))],
      format: 'number',
      year2024Value: getPreviousValue('매장 임차료'),
      children: [
        {
          account: '홍콩마카오',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...매장임차료홍콩, sumArray(매장임차료홍콩), calculateYoY(sumArray(매장임차료홍콩), getPreviousValue('매장 임차료_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('매장 임차료_홍콩마카오'),
        },
        {
          account: '대만',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...매장임차료대만, sumArray(매장임차료대만), calculateYoY(sumArray(매장임차료대만), getPreviousValue('매장 임차료_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('매장 임차료_대만'),
        },
      ],
    },
    // 매장 운영비 (토글 가능)
    {
      account: '매장 운영비',
      level: 2,
      isGroup: true,
      isCalculated: false,
      values: [...매장운영비, sumArray(매장운영비), calculateYoY(sumArray(매장운영비), getPreviousValue('매장 운영비'))],
      format: 'number',
      year2024Value: getPreviousValue('매장 운영비'),
      children: [
        {
          account: '홍콩마카오',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...매장운영비홍콩, sumArray(매장운영비홍콩), calculateYoY(sumArray(매장운영비홍콩), getPreviousValue('매장 운영비_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('매장 운영비_홍콩마카오'),
        },
        {
          account: '대만',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...매장운영비대만, sumArray(매장운영비대만), calculateYoY(sumArray(매장운영비대만), getPreviousValue('매장 운영비_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('매장 운영비_대만'),
        },
      ],
    },
    // 사무실 운영비 (토글 가능)
    {
      account: '사무실 운영비',
      level: 2,
      isGroup: true,
      isCalculated: false,
      values: [...사무실운영비, sumArray(사무실운영비), calculateYoY(sumArray(사무실운영비), getPreviousValue('사무실 운영비'))],
      format: 'number',
      year2024Value: getPreviousValue('사무실 운영비'),
      children: [
        {
          account: '홍콩마카오',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...사무실운영비홍콩, sumArray(사무실운영비홍콩), calculateYoY(sumArray(사무실운영비홍콩), getPreviousValue('사무실 운영비_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('사무실 운영비_홍콩마카오'),
        },
        {
          account: '대만',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...사무실운영비대만, sumArray(사무실운영비대만), calculateYoY(sumArray(사무실운영비대만), getPreviousValue('사무실 운영비_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('사무실 운영비_대만'),
        },
      ],
    },
    // 수입관세 (토글 가능)
    {
      account: '수입관세',
      level: 2,
      isGroup: true,
      isCalculated: false,
      values: [...수입관세, sumArray(수입관세), calculateYoY(sumArray(수입관세), getPreviousValue('수입관세'))],
      format: 'number',
      year2024Value: getPreviousValue('수입관세'),
      children: [
        {
          account: '홍콩마카오',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...수입관세홍콩, sumArray(수입관세홍콩), calculateYoY(sumArray(수입관세홍콩), getPreviousValue('수입관세_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('수입관세_홍콩마카오'),
        },
        {
          account: '대만',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...수입관세대만, sumArray(수입관세대만), calculateYoY(sumArray(수입관세대만), getPreviousValue('수입관세_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('수입관세_대만'),
        },
      ],
    },
    // 인건비 (토글 가능)
    {
      account: '인건비',
      level: 2,
      isGroup: true,
      isCalculated: false,
      values: [...인건비, sumArray(인건비), calculateYoY(sumArray(인건비), getPreviousValue('인건비'))],
      format: 'number',
      year2024Value: getPreviousValue('인건비'),
      children: [
        {
          account: '홍콩마카오',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...인건비홍콩, sumArray(인건비홍콩), calculateYoY(sumArray(인건비홍콩), getPreviousValue('인건비_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('인건비_홍콩마카오'),
        },
        {
          account: '대만',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...인건비대만, sumArray(인건비대만), calculateYoY(sumArray(인건비대만), getPreviousValue('인건비_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('인건비_대만'),
        },
      ],
    },
    // 보증금지급 (토글 가능)
    {
      account: '보증금지급',
      level: 2,
      isGroup: true,
      isCalculated: false,
      values: [...보증금지급, sumArray(보증금지급), calculateYoY(sumArray(보증금지급), getPreviousValue('보증금지급'))],
      format: 'number',
      year2024Value: getPreviousValue('보증금지급'),
      children: [
        {
          account: '홍콩마카오',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...보증금지급홍콩, sumArray(보증금지급홍콩), calculateYoY(sumArray(보증금지급홍콩), getPreviousValue('보증금지급_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('보증금지급_홍콩마카오'),
        },
        {
          account: '대만',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...보증금지급대만, sumArray(보증금지급대만), calculateYoY(sumArray(보증금지급대만), getPreviousValue('보증금지급_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('보증금지급_대만'),
        },
      ],
    },
    // 기타 (토글 가능)
    {
      account: '기타',
      level: 2,
      isGroup: true,
      isCalculated: false,
      values: [...기타비용, sumArray(기타비용), calculateYoY(sumArray(기타비용), getPreviousValue('기타'))],
      format: 'number',
      year2024Value: getPreviousValue('기타'),
      children: [
        {
          account: '홍콩마카오',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...기타비용홍콩, sumArray(기타비용홍콩), calculateYoY(sumArray(기타비용홍콩), getPreviousValue('기타_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('기타_홍콩마카오'),
        },
        {
          account: '대만',
          level: 3,
          isGroup: false,
          isCalculated: false,
          values: [...기타비용대만, sumArray(기타비용대만), calculateYoY(sumArray(기타비용대만), getPreviousValue('기타_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('기타_대만'),
        },
      ],
    },
    // 기타수익 (토글 가능)
    {
      account: '기타수익',
      level: 1,
      isGroup: true,
      isCalculated: false,
      isBold: true,
      values: [...기타수익, sumArray(기타수익), calculateYoY(sumArray(기타수익), getPreviousValue('기타수익'))],
      format: 'number',
      year2024Value: getPreviousValue('기타수익'),
      children: [
        {
          account: '홍콩마카오',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...기타수익홍콩, sumArray(기타수익홍콩), calculateYoY(sumArray(기타수익홍콩), getPreviousValue('기타수익_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('기타수익_홍콩마카오'),
        },
        {
          account: '대만',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...기타수익대만, sumArray(기타수익대만), calculateYoY(sumArray(기타수익대만), getPreviousValue('기타수익_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('기타수익_대만'),
        },
      ],
    },
    // 자산성지출
    {
      account: '자산성지출',
      level: 0,
      isGroup: true,
      isCalculated: true,
      isBold: true,
      isHighlight: 'sky',
      values: [...자산성지출, sumArray(자산성지출), calculateYoY(sumArray(자산성지출), getPreviousValue('자산성지출'))],
      format: 'number',
      year2024Value: getPreviousValue('자산성지출'),
    },
    // 인테리어/VMD (토글 가능)
    {
      account: '인테리어/VMD',
      level: 1,
      isGroup: true,
      isCalculated: false,
      values: [...인테리어VMD, sumArray(인테리어VMD), calculateYoY(sumArray(인테리어VMD), getPreviousValue('인테리어/VMD'))],
      format: 'number',
      year2024Value: getPreviousValue('인테리어/VMD'),
      children: [
        {
          account: '홍콩마카오',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...인테리어VMD홍콩, sumArray(인테리어VMD홍콩), calculateYoY(sumArray(인테리어VMD홍콩), getPreviousValue('인테리어/VMD_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('인테리어/VMD_홍콩마카오'),
        },
        {
          account: '대만',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...인테리어VMD대만, sumArray(인테리어VMD대만), calculateYoY(sumArray(인테리어VMD대만), getPreviousValue('인테리어/VMD_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('인테리어/VMD_대만'),
        },
      ],
    },
    // 비품취득 (토글 가능)
    {
      account: '비품취득',
      level: 1,
      isGroup: true,
      isCalculated: false,
      values: [...비품취득, sumArray(비품취득), calculateYoY(sumArray(비품취득), getPreviousValue('비품취득'))],
      format: 'number',
      year2024Value: getPreviousValue('비품취득'),
      children: [
        {
          account: '홍콩마카오',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...비품취득홍콩, sumArray(비품취득홍콩), calculateYoY(sumArray(비품취득홍콩), getPreviousValue('비품취득_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('비품취득_홍콩마카오'),
        },
        {
          account: '대만',
          level: 2,
          isGroup: false,
          isCalculated: false,
          values: [...비품취득대만, sumArray(비품취득대만), calculateYoY(sumArray(비품취득대만), getPreviousValue('비품취득_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('비품취득_대만'),
        },
      ],
    },
    // Net Cash
    {
      account: 'Net Cash',
      level: 0,
      isGroup: false,
      isCalculated: true,
      isBold: false,
      isHighlight: 'darkGray',
      values: [...netCash, sumArray(netCash), calculateYoY(sumArray(netCash), getPreviousValue('Net Cash'))],
      format: 'number',
      year2024Value: getPreviousValue('Net Cash'),
    },
    // 현금잔액 (토글 가능)
    {
      account: '현금잔액',
      level: 0,
      isGroup: true,
      isCalculated: false,
      isBold: true,
      isHighlight: 'yellow',
      values: [...현금잔액, 현금잔액[11] || 0, calculateYoY(현금잔액[11] || 0, getPreviousValue('현금잔액'))],
      format: 'number',
      year2024Value: getPreviousValue('현금잔액'),
      children: [
        {
          account: '홍콩마카오',
          level: 1,
          isGroup: false,
          isCalculated: false,
          values: [...현금잔액홍콩, 현금잔액홍콩[11] || 0, calculateYoY(현금잔액홍콩[11] || 0, getPreviousValue('현금잔액_홍콩마카오'))],
          format: 'number',
          year2024Value: getPreviousValue('현금잔액_홍콩마카오'),
        },
        {
          account: '대만',
          level: 1,
          isGroup: false,
          isCalculated: false,
          values: [...현금잔액대만, 현금잔액대만[11] || 0, calculateYoY(현금잔액대만[11] || 0, getPreviousValue('현금잔액_대만'))],
          format: 'number',
          year2024Value: getPreviousValue('현금잔액_대만'),
        },
      ],
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
