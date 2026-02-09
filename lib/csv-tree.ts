import fs from 'fs';
import Papa from 'papaparse';
import iconv from 'iconv-lite';

/**
 * 금액 파싱 함수 (콤마, 음수, 소수, 문자열 처리)
 */
export function parseMoney(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  
  // 문자열 처리
  const str = String(value).trim();
  if (str === '' || str === '-') return 0;
  
  // 콤마 제거
  const cleaned = str.replace(/,/g, '');
  const num = Number(cleaned);
  
  return isNaN(num) ? 0 : num;
}

/**
 * 트리 노드 구조
 */
export interface TreeNode {
  key: string;
  label: string;
  depth: 1 | 2 | 3 | 4;
  value2025: number;
  value2026: number;
  yoy: number;
  children?: TreeNode[];
  isLeaf: boolean;
}

/**
 * CSV 원본 행
 */
export interface CSVRow {
  대분류: string;
  중분류1: string;
  중분류2: string;
  소분류: string;
  months: number[]; // 12개월 데이터
}

/**
 * CSV 파일 읽기
 */
export async function readCashflowCSV(year: number): Promise<CSVRow[]> {
  const filePath = `${process.cwd()}/cashflow/${year}.csv`;
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    const buffer = fs.readFileSync(filePath);
    content = iconv.decode(buffer, 'euc-kr');
  }

  const parsed = Papa.parse(content, {
    header: false,
    skipEmptyLines: true,
  });

  const rows = parsed.data as string[][];
  if (rows.length === 0) return [];

  const result: CSVRow[] = [];
  
  // 데이터 행 파싱 (헤더 제외)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    const 대분류 = row[0]?.trim() || '';
    const 중분류1 = row[1]?.trim() || '';
    const 중분류2 = row[2]?.trim() || '';
    const 소분류 = row[3]?.trim() || '';
    
    // 1월~12월 데이터 (컬럼 4~15)
    const months: number[] = [];
    for (let j = 4; j < 16; j++) {
      months.push(parseMoney(row[j]));
    }
    
    result.push({
      대분류,
      중분류1,
      중분류2,
      소분류,
      months,
    });
  }
  
  return result;
}

/**
 * CSV 데이터로부터 트리 생성
 */
export function buildTree(rows2025: CSVRow[], rows2026: CSVRow[]): TreeNode[] {
  // 맵 생성: key -> { value2025, value2026 }
  const dataMap = new Map<string, { value2025: number; value2026: number }>();
  
  // 2025 데이터
  for (const row of rows2025) {
    const key = makeKey(row.대분류, row.중분류1, row.중분류2, row.소분류);
    const sum = row.months.reduce((a, b) => a + b, 0);
    dataMap.set(key, { value2025: sum, value2026: 0 });
  }
  
  // 2026 데이터
  for (const row of rows2026) {
    const key = makeKey(row.대분류, row.중분류1, row.중분류2, row.소분류);
    const sum = row.months.reduce((a, b) => a + b, 0);
    const existing = dataMap.get(key) || { value2025: 0, value2026: 0 };
    existing.value2026 = sum;
    dataMap.set(key, existing);
  }
  
  // 계층 구조 생성
  const rootMap = new Map<string, TreeNode>();
  
  // 모든 행을 순회하며 트리 구조 생성
  const allRows = [...rows2025, ...rows2026];
  const uniquePaths = new Set<string>();
  
  for (const row of allRows) {
    const path = `${row.대분류}|${row.중분류1}|${row.중분류2}|${row.소분류}`;
    uniquePaths.add(path);
  }
  
  for (const path of uniquePaths) {
    const [대분류, 중분류1, 중분류2, 소분류] = path.split('|');
    
    // Level 1: 대분류
    if (!rootMap.has(대분류)) {
      rootMap.set(대분류, {
        key: 대분류,
        label: 대분류,
        depth: 1,
        value2025: 0,
        value2026: 0,
        yoy: 0,
        children: [],
        isLeaf: false,
      });
    }
    const l1Node = rootMap.get(대분류)!;
    
    // Level 2: 중분류1
    if (!중분류1) continue;
    
    let l2Node = l1Node.children?.find(n => n.label === 중분류1);
    if (!l2Node) {
      l2Node = {
        key: `${대분류}|${중분류1}`,
        label: 중분류1,
        depth: 2,
        value2025: 0,
        value2026: 0,
        yoy: 0,
        children: [],
        isLeaf: false,
      };
      l1Node.children!.push(l2Node);
    }
    
    // Level 3: 중분류2
    if (!중분류2) continue;
    
    let l3Node = l2Node.children?.find(n => n.label === 중분류2);
    if (!l3Node) {
      // 소분류가 없으면 L3가 leaf
      const isLeaf = !소분류;
      const key = makeKey(대분류, 중분류1, 중분류2, 소분류);
      const data = dataMap.get(key) || { value2025: 0, value2026: 0 };
      
      l3Node = {
        key: `${대분류}|${중분류1}|${중분류2}`,
        label: 중분류2,
        depth: 3,
        value2025: isLeaf ? data.value2025 : 0,
        value2026: isLeaf ? data.value2026 : 0,
        yoy: isLeaf ? data.value2026 - data.value2025 : 0,
        children: isLeaf ? undefined : [],
        isLeaf,
      };
      l2Node.children!.push(l3Node);
    }
    
    // Level 4: 소분류 (있을 때만)
    if (소분류 && !l3Node.isLeaf) {
      let l4Node = l3Node.children?.find(n => n.label === 소분류);
      if (!l4Node) {
        const key = makeKey(대분류, 중분류1, 중분류2, 소분류);
        const data = dataMap.get(key) || { value2025: 0, value2026: 0 };
        
        l4Node = {
          key: `${대분류}|${중분류1}|${중분류2}|${소분류}`,
          label: 소분류,
          depth: 4,
          value2025: data.value2025,
          value2026: data.value2026,
          yoy: data.value2026 - data.value2025,
          children: undefined,
          isLeaf: true,
        };
        l3Node.children!.push(l4Node);
      }
    }
  }
  
  // 부모 노드들의 값 계산 (bottom-up)
  const roots = Array.from(rootMap.values());
  for (const root of roots) {
    calculateParentValues(root);
  }
  
  // 자동 그룹화: "xxx 합계" 패턴을 감지하여 부모-자식 관계 생성
  for (const root of roots) {
    autoGroupSummaryNodes(root);
  }
  
  return roots;
}

/**
 * 부모 노드의 값을 자식들로부터 계산 (재귀)
 */
function calculateParentValues(node: TreeNode): void {
  if (node.isLeaf || !node.children || node.children.length === 0) {
    return;
  }
  
  // 자식들을 먼저 계산
  for (const child of node.children) {
    calculateParentValues(child);
  }
  
  // 자식들의 합산
  node.value2025 = node.children.reduce((sum, child) => sum + child.value2025, 0);
  node.value2026 = node.children.reduce((sum, child) => sum + child.value2026, 0);
  node.yoy = node.value2026 - node.value2025;
}

/**
 * "xxx 합계" 패턴을 감지하여 자동으로 부모-자식 관계 생성
 */
function autoGroupSummaryNodes(node: TreeNode): void {
  if (!node.children || node.children.length === 0) {
    return;
  }
  
  // 각 레벨의 children에 대해 재귀적으로 처리
  for (const child of node.children) {
    autoGroupSummaryNodes(child);
  }
  
  // 현재 레벨에서 "xxx 합계" 패턴 찾기
  const summaryNodes: TreeNode[] = [];
  const otherNodes: TreeNode[] = [];
  
  for (const child of node.children) {
    if (child.label.includes(' 합계')) {
      summaryNodes.push(child);
    } else {
      otherNodes.push(child);
    }
  }
  
  // "xxx 합계" 노드가 있으면 그룹화 수행
  for (const summaryNode of summaryNodes) {
    // "광고비 합계" -> "광고비"
    const prefix = summaryNode.label.replace(' 합계', '');
    
    // 같은 prefix를 가진 다른 노드들 찾기
    const childrenToGroup: TreeNode[] = [];
    const remainingNodes: TreeNode[] = [];
    
    for (const otherNode of otherNodes) {
      // "광고비 홍마", "광고비 대만" 등 매칭
      if (otherNode.label.startsWith(prefix + ' ')) {
        childrenToGroup.push(otherNode);
      } else {
        remainingNodes.push(otherNode);
      }
    }
    
    // 매칭되는 자식이 있으면 그룹화
    if (childrenToGroup.length > 0) {
      // summaryNode를 부모로 변경
      summaryNode.isLeaf = false;
      summaryNode.children = childrenToGroup;
      
      // depth 조정: 자식들의 depth를 1 증가
      for (const child of childrenToGroup) {
        adjustDepth(child, 1);
      }
      
      // otherNodes 업데이트
      otherNodes.length = 0;
      otherNodes.push(...remainingNodes);
    }
  }
  
  // node.children 재구성: summaryNodes + remainingNodes
  node.children = [...summaryNodes, ...otherNodes];
}

/**
 * 노드와 그 하위 노드들의 depth를 조정
 */
function adjustDepth(node: TreeNode, increment: number): void {
  node.depth = (node.depth + increment) as 1 | 2 | 3 | 4;
  if (node.children) {
    for (const child of node.children) {
      adjustDepth(child, increment);
    }
  }
}

/**
 * "xxx 합계" 패턴을 감지하여 자동 그룹화 (재귀)
 * 같은 레벨의 형제 노드 중 "xxx yyy" 패턴을 찾아 "xxx 합계"의 자식으로 이동
 */
function autoGroupSummaryNodes(node: TreeNode): void {
  if (!node.children || node.children.length === 0) {
    return;
  }
  
  // 자식 노드들에 대해 먼저 재귀 처리
  for (const child of node.children) {
    autoGroupSummaryNodes(child);
  }
  
  // "xxx 합계" 패턴 찾기
  const summaryNodes: TreeNode[] = [];
  const otherNodes: TreeNode[] = [];
  
  for (const child of node.children) {
    if (child.label.endsWith(' 합계')) {
      summaryNodes.push(child);
    } else {
      otherNodes.push(child);
    }
  }
  
  // 각 합계 노드에 대해 매칭되는 자식 노드 찾기
  for (const summaryNode of summaryNodes) {
    // "광고비 합계" -> "광고비"
    const prefix = summaryNode.label.replace(' 합계', '');
    
    // 같은 prefix를 가진 다른 노드들 찾기
    const matchingNodes: TreeNode[] = [];
    const remainingNodes: TreeNode[] = [];
    
    for (const otherNode of otherNodes) {
      if (otherNode.label.startsWith(prefix + ' ')) {
        matchingNodes.push(otherNode);
      } else {
        remainingNodes.push(otherNode);
      }
    }
    
    // 매칭되는 노드가 있으면 그룹화
    if (matchingNodes.length > 0) {
      // 합계 노드를 부모로 변경
      summaryNode.isLeaf = false;
      summaryNode.children = matchingNodes;
      
      // depth 조정: 자식들의 depth를 1 증가
      for (const child of matchingNodes) {
        adjustDepth(child, 1);
      }
      
      // otherNodes 업데이트
      otherNodes.length = 0;
      otherNodes.push(...remainingNodes);
    }
  }
  
  // 노드의 children을 summaryNodes + otherNodes로 재구성
  node.children = [...summaryNodes, ...otherNodes];
}

/**
 * 노드와 그 하위 트리의 depth를 조정
 */
function adjustDepth(node: TreeNode, increment: number): void {
  node.depth = (node.depth + increment) as 1 | 2 | 3 | 4;
  if (node.children) {
    for (const child of node.children) {
      adjustDepth(child, increment);
    }
  }
}

/**
 * 키 생성 (빈 값은 무시)
 */
function makeKey(...parts: string[]): string {
  return parts.filter(p => p).join('|');
}

/**
 * 트리를 플랫하게 펼쳐서 테이블 행으로 변환
 */
export interface FlatRow {
  key: string;
  label: string;
  depth: number;
  value2025: number;
  value2026: number;
  yoy: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

export function flattenTree(
  tree: TreeNode[],
  expandedKeys: Set<string>
): FlatRow[] {
  const result: FlatRow[] = [];
  
  function traverse(node: TreeNode) {
    const isExpanded = expandedKeys.has(node.key);
    
    result.push({
      key: node.key,
      label: node.label,
      depth: node.depth,
      value2025: node.value2025,
      value2026: node.value2026,
      yoy: node.yoy,
      hasChildren: !node.isLeaf,
      isExpanded,
    });
    
    // 확장된 경우에만 자식 표시
    if (isExpanded && node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  for (const root of tree) {
    traverse(root);
  }
  
  return result;
}
