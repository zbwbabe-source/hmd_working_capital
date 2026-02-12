import { Row, MonthKey } from './types';

export type Node = {
  key: string;
  label: string;
  level: 1 | 2 | 3;
  children?: Node[];
  rows?: Row[];  // leaf에만 붙임
  rollup: Record<MonthKey, number>; // 금액행 합산용(%) 제외
  hasRateRow: boolean; // leaf rows 중 isRateRow=true가 하나라도 있으면 true
};

/**
 * 빈 rollup 객체 생성
 */
function createEmptyRollup(): Record<MonthKey, number> {
  return {
    m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0,
    m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0
  };
}

/**
 * Row[]의 월별 금액 합산 (isRateRow=false인 행만)
 */
function sumRowsRollup(rows: Row[]): Record<MonthKey, number> {
  const rollup = createEmptyRollup();
  const monthKeys: MonthKey[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'];
  
  rows.forEach(row => {
    if (!row.isRateRow) {
      monthKeys.forEach(mk => {
        rollup[mk] += row.months[mk] || 0;
      });
    }
  });
  
  return rollup;
}

/**
 * children의 rollup 합산
 */
function sumChildrenRollup(children: Node[]): Record<MonthKey, number> {
  const rollup = createEmptyRollup();
  const monthKeys: MonthKey[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'];
  
  children.forEach(child => {
    monthKeys.forEach(mk => {
      rollup[mk] += child.rollup[mk] || 0;
    });
  });
  
  return rollup;
}

/**
 * Row[]를 트리 구조로 변환
 * 
 * 트리 규칙:
 * - lvl1(대분류) -> lvl2(중분류)는 항상 생성
 * - lvl3(소분류)는 lvl1이 "TAG매출" 또는 "실판매출"인 경우에만 생성
 * - 그 외 lvl1은 lvl2가 leaf
 * 
 * leaf 판정:
 * - TAG매출/실판매출: leaf = lvl3(소분류) 노드
 * - 그 외: leaf = lvl2(중분류) 노드
 */
export function buildTree(rows: Row[]): Node[] {
  if (!rows || rows.length === 0) {
    return [];
  }
  
  // lvl1별로 그룹화
  const lvl1Map = new Map<string, Row[]>();
  rows.forEach(row => {
    const key = row.lvl1 || '';
    if (!lvl1Map.has(key)) {
      lvl1Map.set(key, []);
    }
    lvl1Map.get(key)!.push(row);
  });
  
  const rootNodes: Node[] = [];
  
  // 각 lvl1(대분류)별로 처리
  lvl1Map.forEach((lvl1Rows, lvl1) => {
    if (!lvl1) return; // 빈 대분류는 스킵
    
    const needsLvl3 = lvl1 === 'TAG매출' || lvl1 === '실판매출';
    
    // lvl2별로 그룹화
    const lvl2Map = new Map<string, Row[]>();
    lvl1Rows.forEach(row => {
      const key = row.lvl2 || '';
      if (!lvl2Map.has(key)) {
        lvl2Map.set(key, []);
      }
      lvl2Map.get(key)!.push(row);
    });
    
    const lvl2Nodes: Node[] = [];
    
    // 각 lvl2(중분류)별로 처리
    lvl2Map.forEach((lvl2Rows, lvl2) => {
      if (!lvl2) return; // 빈 중분류는 스킵
      
      if (needsLvl3) {
        // TAG매출/실판매출: lvl3(소분류) 생성
        const lvl3Map = new Map<string, Row[]>();
        lvl2Rows.forEach(row => {
          const key = row.lvl3 || '(기타)';
          if (!lvl3Map.has(key)) {
            lvl3Map.set(key, []);
          }
          lvl3Map.get(key)!.push(row);
        });
        
        const lvl3Nodes: Node[] = [];
        
        // 각 lvl3(소분류)별로 leaf 노드 생성
        lvl3Map.forEach((lvl3Rows, lvl3) => {
          const hasRate = lvl3Rows.some(r => r.isRateRow);
          const rollup = sumRowsRollup(lvl3Rows);
          
          lvl3Nodes.push({
            key: `L3|${lvl1}|${lvl2}|${lvl3}`,
            label: lvl3,
            level: 3,
            rows: lvl3Rows,
            rollup,
            hasRateRow: hasRate
          });
        });
        
        // lvl2 노드 생성 (children 포함)
        const lvl2Rollup = sumChildrenRollup(lvl3Nodes);
        const lvl2HasRate = lvl3Nodes.some(n => n.hasRateRow);
        
        lvl2Nodes.push({
          key: `L2|${lvl1}|${lvl2}`,
          label: lvl2,
          level: 2,
          children: lvl3Nodes,
          rollup: lvl2Rollup,
          hasRateRow: lvl2HasRate
        });
        
      } else {
        // 그 외: lvl2가 leaf (lvl3 무시)
        const hasRate = lvl2Rows.some(r => r.isRateRow);
        const rollup = sumRowsRollup(lvl2Rows);
        
        lvl2Nodes.push({
          key: `L2|${lvl1}|${lvl2}`,
          label: lvl2,
          level: 2,
          rows: lvl2Rows,
          rollup,
          hasRateRow: hasRate
        });
      }
    });
    
    // lvl1 노드 생성 (children 포함)
    const lvl1Rollup = sumChildrenRollup(lvl2Nodes);
    const lvl1HasRate = lvl2Nodes.some(n => n.hasRateRow);
    
    rootNodes.push({
      key: `L1|${lvl1}`,
      label: lvl1,
      level: 1,
      children: lvl2Nodes,
      rollup: lvl1Rollup,
      hasRateRow: lvl1HasRate
    });
  });
  
  return rootNodes;
}
