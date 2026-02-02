import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readWorkingCapitalCSV } from '@/lib/csv';
import { calculateWorkingCapitalTable } from '@/lib/fs-mapping';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : 2025;
    
    if (![2025, 2026].includes(year)) {
      return NextResponse.json(
        { error: '유효하지 않은 연도입니다. 2025 또는 2026을 선택하세요.' },
        { status: 400 }
      );
    }
    
    // 현재 연도 CSV 파일 읽기
    const filePath = path.join(process.cwd(), '운전자본', `${year}.csv`);
    const data = await readWorkingCapitalCSV(filePath, year);
    
    // 전년도 합계 계산
    let previousYearTotals: Map<string, number> | undefined = undefined;
    const prevYear = year - 1;
    
    try {
      const prevFilePath = path.join(process.cwd(), '운전자본', `${prevYear}.csv`);
      const prevData = await readWorkingCapitalCSV(prevFilePath, prevYear);
      
      // 전년도 각 대분류/중분류의 12개월 합계 계산
      previousYearTotals = new Map<string, number>();
      
      // 대분류별로 그룹화
      const groupedBy대분류 = new Map<string, typeof prevData>();
      for (const row of prevData) {
        if (!groupedBy대분류.has(row.대분류)) {
          groupedBy대분류.set(row.대분류, []);
        }
        groupedBy대분류.get(row.대분류)!.push(row);
      }
      
      // 대분류 합계 계산
      for (const [대분류, 중분류Rows] of groupedBy대분류) {
        const 대분류합계 = 중분류Rows.reduce((sum, row) => {
          return sum + row.values.reduce((a, b) => a + b, 0);
        }, 0);
        previousYearTotals.set(대분류, 대분류합계);
        
        // 중분류별 합계도 저장
        for (const 중분류Row of 중분류Rows) {
          const 중분류합계 = 중분류Row.values.reduce((a, b) => a + b, 0);
          const accountKey = `${대분류}-${중분류Row.중분류}`;
          previousYearTotals.set(accountKey, 중분류합계);
        }
      }
    } catch (err) {
      console.error(`${prevYear}년 데이터 로드 실패:`, err);
    }
    
    const tableRows = calculateWorkingCapitalTable(data, previousYearTotals);
    
    return NextResponse.json({
      year,
      type: 'WORKING_CAPITAL',
      rows: tableRows,
    });
  } catch (error) {
    console.error('운전자본 API 에러:', error);
    return NextResponse.json(
      { error: '운전자본 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
