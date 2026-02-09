import { FinancialData, TableRow } from './types';
import { CashflowRow } from './csv';

/**
 * NEW 4-level Cashflow Table
 * CSV Structure: 대분류, 중분류1, 중분류2, 소분류
 * Tree Levels: Level 0 (대분류) > Level 1 (중분류1) > Level 2 (중분류2) > Level 3 (소분류)
 */
export function calculateCashflowTable(
  data: CashflowRow[],
  previousYearTotals?: Map<string, number>,
  year2023Totals?: Map<string, number>
): TableRow[] {
  // 4-level tree structure
  interface TreeNode4 {
    label: string;
    level: number;
    children: Map<string, TreeNode4>;
    values: number[];
    isLeaf: boolean;
    path: string[];
  }
  
  const root = new Map<string, TreeNode4>();
  
  const calculateYoY = (currentTotal: number, previousTotal: number | null | undefined): number | null => {
    if (previousTotal === null || previousTotal === undefined) return null;
    return currentTotal - previousTotal;
  };
  
  // Build tree from CSV data
  for (const row of data) {
    const { 대분류, 중분류1, 중분류2, 소분류, values } = row;
    
    if (!대분류) continue;
    
    // Debug logging for specific cases
    if (중분류1 === '매출수금' && (중분류2 === '홍콩마카오' || 중분류2 === '대만')) {
      console.log(`Processing: ${대분류}-${중분류1}-${중분류2}-${소분류}, values[0]=${values[0]}`);
    }
    if (중분류2 === '광고비' && (소분류 === '홍콩마카오' || 소분류 === '대만')) {
      console.log(`Processing 광고비: ${대분류}-${중분류1}-${중분류2}-${소분류}, values[0]=${values[0]}`);
    }
    
    // Determine if this row is regional or aggregate
    const isRegional = 중분류2 === '홍콩마카오' || 중분류2 === '대만' || 소분류 === '홍콩마카오' || 소분류 === '대만';
    const isAggregate = 중분류2 === '합계' || 소분류 === '합계';
    
    // Level 0: 대분류
    // Only accumulate aggregate values to parent levels, but keep all children for display
    if (!root.has(대분류)) {
      root.set(대분류, {
        label: 대분류,
        level: 0,
        children: new Map(),
        values: new Array(12).fill(0),
        isLeaf: false,
        path: [대분류],
      });
    }
    const l0 = root.get(대분류)!;
    
    // Accumulate only aggregate values to parent
    if (isAggregate) {
      for (let i = 0; i < 12; i++) {
        l0.values[i] += values[i];
      }
    }
    
    if (!중분류1) continue;
    
    // Level 1: 중분류1
    if (!l0.children.has(중분류1)) {
      l0.children.set(중분류1, {
        label: 중분류1,
        level: 1,
        children: new Map(),
        values: new Array(12).fill(0),
        isLeaf: !중분류2,
        path: [대분류, 중분류1],
      });
    }
    const l1 = l0.children.get(중분류1)!;
    
    if (isAggregate) {
      for (let i = 0; i < 12; i++) {
        l1.values[i] += values[i];
      }
    }
    
    if (!중분류2) continue;
    
    l1.isLeaf = false;
    
    // Level 2: 중분류2
    if (!l1.children.has(중분류2)) {
      l1.children.set(중분류2, {
        label: 중분류2,
        level: 2,
        children: new Map(),
        values: new Array(12).fill(0),
        isLeaf: !소분류,
        path: [대분류, 중분류1, 중분류2],
      });
    }
    const l2 = l1.children.get(중분류2)!;
    
    // For Level 2, accumulate aggregate values for parent calculation
    if (isAggregate && !isRegional) {
      for (let i = 0; i < 12; i++) {
        l2.values[i] += values[i];
      }
    }
    
    if (!소분류) continue;
    
    // Skip adding "합계" as a child - it's already represented in the parent level
    if (소분류 === '합계') continue;
    
    // If 중분류2 and 소분류 are the same (e.g., 홍콩마카오-홍콩마카오), 
    // use the values directly in Level 2 and don't create Level 3
    if (중분류2 === 소분류) {
      for (let i = 0; i < 12; i++) {
        l2.values[i] = values[i];
      }
      l2.isLeaf = true;
      continue;
    }
    
    l2.isLeaf = false;
    
    // Level 3: 소분류 - display only regional breakdowns (홍콩마카오, 대만)
    if (!l2.children.has(소분류)) {
      l2.children.set(소분류, {
        label: 소분류,
        level: 3,
        children: new Map(),
        values: [...values],
        isLeaf: true,
        path: [대분류, 중분류1, 중분류2, 소분류],
      });
    } else {
      const l3 = l2.children.get(소분류)!;
      for (let i = 0; i < 12; i++) {
        l3.values[i] += values[i];
      }
    }
  }
  
  // Convert tree to flat TableRow[]
  const tableRows: TableRow[] = [];
  
  function processNode(node: TreeNode4) {
    // 현금잔액의 경우 12월 값을 사용, 다른 항목은 합계 사용
    const isBalance = node.path[0] === '현금잔액';
    const annual = isBalance ? node.values[11] : node.values.reduce((sum, v) => sum + v, 0);
    
    const key = node.path.join('-');
    const yoy = calculateYoY(annual, previousYearTotals?.get(key));
    
    // 지역 항목(홍콩마카오, 대만)에 '-' 접두사 추가
    let displayLabel = node.label;
    if (node.label === '홍콩마카오' || node.label === '대만') {
      displayLabel = '-' + node.label;
    }
    
    tableRows.push({
      account: displayLabel,
      level: node.level,
      isGroup: !node.isLeaf && node.children.size > 0,
      isCalculated: !node.isLeaf,
      isBold: node.level <= 1,
      isHighlight: node.level === 0 ? 'sky' : (node.label === '비용' ? 'gray' : undefined),
      values: [...node.values, annual, yoy],
      format: 'number',
      year2024Value: previousYearTotals?.get(key) ?? null,
      year2023Value: year2023Totals?.get(key) ?? null,
    });
    
    // Process children
    if (node.children.size > 0) {
      for (const [_, childNode] of node.children.entries()) {
        processNode(childNode);
      }
    }
  }
  
  // Process in order
  const 대분류순서 = ['영업활동', '자산성지출', '기타수익', 'from 차입금', '현금잔액'];
  
  for (const 대분류 of 대분류순서) {
    const node = root.get(대분류);
    if (node) {
      processNode(node);
    }
  }
  
  // Add Net Cash
  const 영업활동 = tableRows.find(r => r.account === '영업활동' && r.level === 0);
  const 자산성지출 = tableRows.find(r => r.account === '자산성지출' && r.level === 0);
  const 기타수익 = tableRows.find(r => r.account === '기타수익' && r.level === 0);
  
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
    
    tableRows.push({
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
  
  return tableRows;
}
