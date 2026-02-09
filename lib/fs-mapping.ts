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
// NEW: 4-level tree structure (대분류 > 중분류1 > 중분류2 > 소분류)
import { readCashflowCSV, buildTree, flattenTree, TreeNode } from './csv-tree';

export async function calculateCF(
  year: number = 2025
): Promise<TableRow[]> {
  // CSV 데이터 읽기
  const rows2025 = await readCashflowCSV(2025);
  const rows2026 = await readCashflowCSV(2026);
  
  // 트리 구조 생성
  const tree = buildTree(rows2025, rows2026);
  
  // TreeNode를 TableRow로 변환
  function treeNodeToTableRow(node: TreeNode, year: number): TableRow {
    const currentYearValue = year === 2025 ? node.value2025 : node.value2026;
    const previousYearValue = year === 2025 ? null : node.value2025;
    
    return {
      account: node.label,
      level: node.depth - 1, // depth 1~4 -> level 0~3
      isGroup: !node.isLeaf,
      isCalculated: !node.isLeaf,
      isBold: node.depth <= 2,
      isHighlight: node.depth === 1 ? 'sky' : (node.label === '비용' ? 'gray' : undefined),
      values: [
        // 월별 데이터 (0으로 채움 - 연간합계만 표시)
        ...new Array(12).fill(0),
        // 현재년도 합계
        currentYearValue,
        // YoY (2026년일 때만 계산)
        year === 2026 ? node.yoy : null,
      ],
      format: 'number',
      children: node.children?.map(child => treeNodeToTableRow(child, year)),
      year2024Value: previousYearValue, // 2025년이면 null, 2026년이면 2025년 값
      year2023Value: null, // 필요시 추가
    };
  }
  
  const tableRows = tree.map(node => treeNodeToTableRow(node, year));
  
  // Flatten the tree structure for rendering
  function flattenTableRows(rows: TableRow[]): TableRow[] {
    const result: TableRow[] = [];
    
    function traverse(row: TableRow) {
      const { children, ...rowWithoutChildren } = row;
      
      // "합계" 행은 제외 (단, "비용" 제외 - 비용은 유지)
      const isExcludedTotal = (row.account.endsWith(' 합계') || row.account === '합계') && row.account !== '비용';
      
      if (!isExcludedTotal) {
        result.push(rowWithoutChildren);
      }
      
      if (children) {
        for (const child of children) {
          traverse(child);
        }
      }
    }
    
    for (const row of rows) {
      traverse(row);
    }
    
    return result;
  }
  
  return flattenTableRows(tableRows);
}

// ==================== Cashflow Table (현금흐름표) ====================
// Moved to fs-mapping-new.ts for 4-level tree structure
export { calculateCashflowTable } from './fs-mapping-new';

// ==================== Cashflow Table 3-Level (현금흐름표 3단계) ====================
const cashflow대분류순서 = ['영업활동', '자산성지출', '기타수익', 'from 차입금', '현금잔액'];

export function calculateCashflowTable3Level(
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

  for (const 대분류 of cashflow대분류순서) {
    const 대분류Rows = groupedBy대분류.get(대분류) || [];
    if (대분류Rows.length === 0) continue;

    // 현금잔액은 12월 값만 사용, 나머지는 합계
    const isBalance = 대분류 === '현금잔액';
    let 연간합계 = 0;
    const 대분류합계 = new Array(12).fill(0);
    
    // "합계"만 포함하고 지역(홍마, 대만, 홍콩마카오)이 없는 행만 더하기
    const 합계Rows = 대분류Rows.filter(r => {
      const 소분류 = r.소분류.trim();
      // "합계"를 포함하고
      const has합계 = 소분류 === '합계' || 소분류.includes('합계');
      // 지역명이 없어야 함
      const has지역 = 소분류.includes('홍마') || 소분류.includes('대만') || 소분류.includes('홍콩마카오');
      return has합계 && !has지역;
    });
    
    // 디버그 로그
    if (대분류 === '영업활동') {
      console.log('=== 영업활동 합계 행들 ===');
      합계Rows.forEach(r => {
        const annual = r.annual !== undefined ? r.annual : r.values.reduce((s, v) => s + v, 0);
        console.log(`${r.중분류} - ${r.소분류}: annual=${r.annual}, calculated=${r.values.reduce((s, v) => s + v, 0)}`);
      });
    }
    
    for (const r of 합계Rows) {
      for (let i = 0; i < 12; i++) {
        대분류합계[i] += r.values[i];
      }
      
      // P열의 연간 합계가 있으면 우선 사용
      if (r.annual !== undefined && r.annual !== null) {
        연간합계 += r.annual;
      } else if (isBalance) {
        연간합계 += r.values[11]; // 12월 값
      } else {
        연간합계 += r.values.reduce((sum, v) => sum + v, 0);
      }
    }
    
    if (대분류 === '영업활동') {
      console.log(`영업활동 연간합계: ${연간합계}`);
    }
    
    const yoyValue = calculateYoY(연간합계, previousYearTotals?.get(대분류));

    const 중분류Set = new Set(대분류Rows.map(r => r.중분류).filter(Boolean));
    const 중분류List = [...중분류Set];

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
      
      // "합계"만 포함하고 지역(홍마, 대만, 홍콩마카오)이 없는 행만 더하기
      const 중분류합계Rows = 중분류RowsList.filter(r => {
        const 소분류 = r.소분류.trim();
        // "합계"를 포함하고
        const has합계 = 소분류 === '합계' || 소분류.includes('합계');
        // 지역명이 없어야 함
        const has지역 = 소분류.includes('홍마') || 소분류.includes('대만') || 소분류.includes('홍콩마카오');
        return has합계 && !has지역;
      });
      
      let 중분류연간합계 = 0;
      for (const r of 중분류합계Rows) {
        for (let i = 0; i < 12; i++) {
          중분류합계[i] += r.values[i];
        }
        
        // P열의 연간 합계가 있으면 우선 사용
        if (r.annual !== undefined && r.annual !== null) {
          중분류연간합계 += r.annual;
        } else if (isBalance) {
          중분류연간합계 += r.values[11]; // 현금잔액은 12월 값
        } else {
          중분류연간합계 += r.values.reduce((sum, v) => sum + v, 0);
        }
      }
      
      const accountKey = `${대분류}-${중분류}`;
      const 중분류YoY = calculateYoY(중분류연간합계, previousYearTotals?.get(accountKey));

      const has소분류 = 중분류RowsList.some(r => !!r.소분류);
      
      // 중분류가 "비용"이면 회색 하이라이트
      const isExpense = 중분류 === '비용';
      
      rows.push({
        account: 중분류,
        level: 1,
        isGroup: has소분류,
        isCalculated: true,
        isBold: true,
        isHighlight: isExpense ? 'gray' : undefined,
        values: [...중분류합계, 중분류연간합계, 중분류YoY],
        format: 'number',
        year2024Value: previousYearTotals?.get(accountKey) ?? null,
        year2023Value: year2023Totals?.get(accountKey) ?? null,
      });

      // 소분류 처리
      for (const r of 중분류RowsList) {
        if (!r.소분류) continue;
        
        // 소분류가 단순히 "합계"인 경우는 건너뛰기 (중분류에 이미 포함됨)
        // 하지만 "광고비 합계"처럼 항목명이 포함된 경우는 표시
        if (r.소분류 === '합계') continue;
        
        let 소분류연간합계 = 0;
        // P열의 연간 합계가 있으면 우선 사용
        if (r.annual !== undefined && r.annual !== null) {
          소분류연간합계 = r.annual;
        } else if (isBalance) {
          소분류연간합계 = r.values[11]; // 현금잔액은 12월 값
        } else {
          소분류연간합계 = r.values.reduce((sum, v) => sum + v, 0);
        }
        
        const 소분류Key = `${대분류}-${중분류}-${r.소분류}`;
        const 소분류YoY = calculateYoY(소분류연간합계, previousYearTotals?.get(소분류Key));

        // 소분류 이름 처리
        let displayLabel = r.소분류;
        let level = 2;
        let isBold = false;
        let isGroup = false;
        
        // "합계"를 포함하는 경우 (예: "광고비 합계")
        if (r.소분류.includes('합계')) {
          // 합계 항목은 그대로 표시 (굵게)
          isBold = true;
          isGroup = true; // 하위에 지역 항목이 있을 수 있음
        } 
        // 지역 항목(홍콩마카오, 대만, 홍마)에 '-' 접두사 추가
        else if (r.소분류 === '홍콩마카오' || r.소분류 === '대만' || r.소분류 === '홍마' || r.소분류.includes('홍마') || r.소분류.includes('대만')) {
          displayLabel = '-' + r.소분류;
        }
        
        rows.push({
          account: displayLabel,
          level: level,
          isGroup: isGroup,
          isCalculated: false,
          isBold: isBold,
          values: [...r.values, 소분류연간합계, 소분류YoY],
          format: 'number',
          year2024Value: previousYearTotals?.get(소분류Key) ?? null,
          year2023Value: year2023Totals?.get(소분류Key) ?? null,
        });
      }
    }
  }

  // Net Cash 계산
  const 영업활동 = rows.find(r => r.account === '영업활동' && r.level === 0);
  const 자산성지출 = rows.find(r => r.account === '자산성지출' && r.level === 0);
  const 기타수익 = rows.find(r => r.account === '기타수익' && r.level === 0);

  if (영업활동 && 자산성지출 && 기타수익) {
    const netCashValues = new Array(14).fill(0);
    for (let i = 0; i < 14; i++) {
      netCashValues[i] = (영업활동.values[i] ?? 0) + (자산성지출.values[i] ?? 0) + (기타수익.values[i] ?? 0);
    }

    const netCashAnnual = netCashValues[12];
    const netCashYear2024 = (previousYearTotals?.get('영업활동') ?? 0) + 
                            (previousYearTotals?.get('자산성지출') ?? 0) + 
                            (previousYearTotals?.get('기타수익') ?? 0);
    const netCashYear2023 = (year2023Totals?.get('영업활동') ?? 0) + 
                            (year2023Totals?.get('자산성지출') ?? 0) + 
                            (year2023Totals?.get('기타수익') ?? 0);

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
