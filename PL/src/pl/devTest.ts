import { getRows } from './csvLoader';
import { Row } from './types';
import { buildTree } from './tree';
import { calcCols, calcRateColsFromNumerDenom, Months } from './calc';
import { applyRateRecalc } from './rateRecalc';

/**
 * 개발 테스트용 스크립트
 * 사용법: ts-node src/pl/devTest.ts
 */
async function test() {
  try {
    console.log('=== P/L CSV 로더 & 트리 빌더 & 비율 재계산 테스트 ===\n');
    
    // 2025, 2026 데이터 로드
    let prevRows: Row[] = [];
    let currRows: Row[] = [];
    
    try {
      console.log('📂 Loading: 2025 Total.csv');
      prevRows = await getRows(2025, 'Total');
      console.log(`✅ 2025: 총 ${prevRows.length}개의 행 로드됨`);
    } catch (error) {
      console.log('⚠️  2025 Total.csv 파일이 없습니다. 스킵합니다.');
      prevRows = [];
    }
    
    try {
      console.log('📂 Loading: 2026 Total.csv');
      currRows = await getRows(2026, 'Total');
      console.log(`✅ 2026: 총 ${currRows.length}개의 행 로드됨`);
    } catch (error) {
      console.log('⚠️  2026 Total.csv 파일이 없습니다. 스킵합니다.');
      currRows = [];
    }
    
    if (prevRows.length === 0 && currRows.length === 0) {
      console.log('\n⚠️  CSV 파일이 없어 테스트를 종료합니다.');
      return;
    }
    
    // 트리 생성
    console.log('\n=== 트리 구조 생성 ===\n');
    const prevTree = buildTree(prevRows);
    const currTree = buildTree(currRows);
    
    console.log(`✅ 2025 Root 노드 개수: ${prevTree.length}`);
    console.log(`✅ 2026 Root 노드 개수: ${currTree.length}`);
    
    if (currTree.length > 0) {
      console.log('\n📁 2026 Root 노드 목록:');
      currTree.forEach((root, idx) => {
        console.log(`  [${idx + 1}] ${root.label} (level: ${root.level}, children: ${root.children?.length || 0})`);
      });
    }
    
    // 비율 재계산
    console.log('\n\n=== Tag대비 원가율 재계산 ===\n');
    const { prevTree: recalcPrevTree, currTree: recalcCurrTree } = applyRateRecalc(prevTree, currTree);
    
    console.log('✅ 비율 재계산 완료');
    
    // Tag대비 원가율 노드 찾기
    const 원가율Node = recalcCurrTree.find(node => node.label === 'Tag대비 원가율');
    
    if (원가율Node && 원가율Node.children) {
      console.log(`\n📊 Tag대비 원가율 하위 노드 개수: ${원가율Node.children.length}`);
      
      // 첫 번째 child의 첫 번째 row 확인
      const firstChild = 원가율Node.children[0];
      if (firstChild && firstChild.rows && firstChild.rows.length > 0) {
        const firstRow = firstChild.rows.find(r => r.isRateRow && r.lvl1 === 'Tag대비 원가율');
        
        if (firstRow) {
          console.log(`\n📈 재계산된 원가율 행 (${firstRow.lvl2}):`);
          console.log(`  1월: ${firstRow.months.m1.toFixed(2)}%`);
          console.log(`  2월: ${firstRow.months.m2.toFixed(2)}%`);
          console.log(`  3월: ${firstRow.months.m3.toFixed(2)}%`);
          console.log(`  4월: ${firstRow.months.m4.toFixed(2)}%`);
          console.log(`  5월: ${firstRow.months.m5.toFixed(2)}%`);
          console.log(`  6월: ${firstRow.months.m6.toFixed(2)}%`);
          
          // 0~100 범위 체크
          const allInRange = Object.values(firstRow.months).every(v => v >= 0 && v <= 100);
          console.log(`\n  ✓ 모든 월이 0~100 범위 내: ${allInRange ? 'YES' : 'NO'}`);
        } else {
          console.log('⚠️  원가율 행을 찾을 수 없습니다.');
        }
      } else {
        console.log('⚠️  leaf rows가 없습니다.');
      }
    } else {
      console.log('⚠️  Tag대비 원가율 노드를 찾을 수 없습니다.');
    }
    
    // calcRateColsFromNumerDenom 테스트
    console.log('\n\n=== calcRateColsFromNumerDenom 테스트 ===\n');
    
    // 매출원가와 TAG매출 노드 찾기
    const 매출원가Node = recalcCurrTree.find(node => node.label === '매출원가');
    const TAG매출Node = recalcCurrTree.find(node => node.label === 'TAG매출');
    
    if (매출원가Node && TAG매출Node) {
      // 데모용으로 첫 번째 child의 rollup 사용
      const 원가Rollup = 매출원가Node.children?.[0]?.rollup || 매출원가Node.rollup;
      const TAG매출Rollup = TAG매출Node.children?.[0]?.rollup || TAG매출Node.rollup;
      
      const rateResult = calcRateColsFromNumerDenom(
        3,  // 3월 기준
        원가Rollup as Months,
        TAG매출Rollup as Months,
        원가Rollup as Months,
        TAG매출Rollup as Months
      );
      
      console.log('📊 비율 컬럼 계산 (3월 기준):');
      console.log(`  전년동월: ${rateResult.prevMonth.toFixed(2)}%`);
      console.log(`  당년동월: ${rateResult.currMonth.toFixed(2)}%`);
      console.log(`  전년 YTD: ${rateResult.prevYTD.toFixed(2)}%`);
      console.log(`  당년 YTD: ${rateResult.currYTD.toFixed(2)}%`);
      console.log(`  전년 연간: ${rateResult.prevYearTotal.toFixed(2)}%`);
      console.log(`  당년 연간: ${rateResult.currYearTotal.toFixed(2)}%`);
    } else {
      console.log('⚠️  매출원가 또는 TAG매출 노드를 찾을 수 없어 calcRateColsFromNumerDenom 테스트를 스킵합니다.');
    }
    
    // 기존 컬럼 계산 테스트
    if (currTree.length > 0 && currTree[0]) {
      console.log('\n\n=== 기존 컬럼 계산 테스트 ===\n');
      
      const demoMonths = currTree[0].rollup as Months;
      const testMonthIndex = 3;
      
      console.log('📊 금액 행 계산 (3월 기준):');
      const amountResult = calcCols(testMonthIndex, demoMonths, demoMonths, false);
      console.log(`  전년동월 (3월): ${amountResult.prevMonth?.toLocaleString() || 'null'}`);
      console.log(`  당년동월 (3월): ${amountResult.currMonth?.toLocaleString() || 'null'}`);
      console.log(`  전년 YTD (1~3월): ${amountResult.prevYTD?.toLocaleString() || 'null'}`);
      console.log(`  당년 YTD (1~3월): ${amountResult.currYTD?.toLocaleString() || 'null'}`);
      console.log(`  전년 연간: ${amountResult.prevYearTotal?.toLocaleString() || 'null'}`);
      console.log(`  당년 연간: ${amountResult.currYearTotal?.toLocaleString() || 'null'}`);
    }
    
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    if (error instanceof Error) {
      console.error('   메시지:', error.message);
      console.error('   스택:', error.stack);
    }
  }
}

test();
