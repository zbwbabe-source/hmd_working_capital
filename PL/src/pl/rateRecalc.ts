import { Node, MonthKey } from './tree';
import { Row } from './types';

/**
 * 트리를 깊은 복사
 */
function deepCopyNode(node: Node): Node {
  const copied: Node = {
    key: node.key,
    label: node.label,
    level: node.level,
    rollup: { ...node.rollup },
    hasRateRow: node.hasRateRow
  };
  
  if (node.children) {
    copied.children = node.children.map(child => deepCopyNode(child));
  }
  
  if (node.rows) {
    copied.rows = node.rows.map(row => ({
      ...row,
      months: { ...row.months }
    }));
  }
  
  return copied;
}

/**
 * 트리에서 특정 대분류(lvl1) 노드 찾기
 */
function findLvl1Node(tree: Node[], lvl1: string): Node | null {
  return tree.find(node => node.label === lvl1) || null;
}

/**
 * 트리에서 특정 lvl2 leaf 노드 찾기 (재귀)
 */
function findLvl2LeafByLabel(node: Node, lvl2: string): Node | null {
  if (node.level === 2 && node.label === lvl2 && node.rows) {
    return node;
  }
  
  if (node.children) {
    for (const child of node.children) {
      const found = findLvl2LeafByLabel(child, lvl2);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * 월별 비율 계산
 */
function calculateRateMonths(
  numerMonths: Record<MonthKey, number>,
  denomMonths: Record<MonthKey, number>
): Record<MonthKey, number> {
  const monthKeys: MonthKey[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'];
  const result: Record<MonthKey, number> = {
    m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0,
    m7: 0, m8: 0, m9: 0, m10: 0, m11: 0, m12: 0
  };
  
  monthKeys.forEach(mk => {
    const numer = numerMonths[mk] || 0;
    const denom = denomMonths[mk] || 0;
    
    if (denom === 0) {
      result[mk] = 0;
    } else {
      result[mk] = (numer / denom) * 100;
    }
  });
  
  return result;
}

/**
 * "Tag대비 원가율" 비율 재계산
 * 
 * 규칙:
 * - Tag대비 원가율(%) = (매출원가 / TAG매출) * 100
 * - lvl2 기준으로 매칭 (동일 중분류)
 * - 트리는 불변으로 유지 (깊은 복사 후 수정)
 */
export function applyRateRecalc(
  prevTree: Node[],
  currTree: Node[]
): {
  prevTree: Node[];
  currTree: Node[];
} {
  // 트리 깊은 복사
  const newPrevTree = prevTree.map(node => deepCopyNode(node));
  const newCurrTree = currTree.map(node => deepCopyNode(node));
  
  // 재계산 함수
  const recalcTree = (tree: Node[]) => {
    // 필요한 대분류 노드 찾기
    const 원가율Node = findLvl1Node(tree, 'Tag대비 원가율');
    const 매출원가Node = findLvl1Node(tree, '매출원가');
    const TAG매출Node = findLvl1Node(tree, 'TAG매출');
    
    if (!원가율Node || !매출원가Node || !TAG매출Node) {
      // 필요한 노드가 없으면 재계산 불가
      return;
    }
    
    // Tag대비 원가율 아래의 모든 leaf 노드 찾기
    const processNode = (node: Node) => {
      if (node.rows && node.level === 2) {
        // lvl2 leaf 노드 - rows 수정
        const lvl2Label = node.label;
        
        // 매칭되는 매출원가와 TAG매출의 lvl2 leaf 찾기
        const 원가Leaf = findLvl2LeafByLabel(매출원가Node, lvl2Label);
        const TAG매출Leaf = findLvl2LeafByLabel(TAG매출Node, lvl2Label);
        
        if (원가Leaf && TAG매출Leaf) {
          // 비율 재계산
          const newRateMonths = calculateRateMonths(원가Leaf.rollup, TAG매출Leaf.rollup);
          
          // rows 중 isRateRow=true인 행들의 months 업데이트
          node.rows.forEach(row => {
            if (row.isRateRow && row.lvl1 === 'Tag대비 원가율') {
              row.months = newRateMonths;
            }
          });
        }
      }
      
      // 자식 노드 재귀 처리
      if (node.children) {
        node.children.forEach(child => processNode(child));
      }
    };
    
    // Tag대비 원가율 노드부터 처리 시작
    if (원가율Node.children) {
      원가율Node.children.forEach(child => processNode(child));
    }
  };
  
  // 전년/당년 각각 재계산
  recalcTree(newPrevTree);
  recalcTree(newCurrTree);
  
  return {
    prevTree: newPrevTree,
    currTree: newCurrTree
  };
}
