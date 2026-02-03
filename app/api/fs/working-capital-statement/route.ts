import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readWorkingCapitalStatementCSV } from '@/lib/csv';
import { calculateWorkingCapitalStatementTable } from '@/lib/fs-mapping';

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

    const filePath = path.join(process.cwd(), '운전자본', `${year}.csv`);
    const data = await readWorkingCapitalStatementCSV(filePath, year);

    let previousYearTotals: Map<string, number> | undefined = undefined;
    const prevYear = year - 1;

    try {
      const prevFilePath = path.join(process.cwd(), '운전자본', `${prevYear}.csv`);
      const prevData = await readWorkingCapitalStatementCSV(prevFilePath, prevYear);

      previousYearTotals = new Map<string, number>();
      const groupedBy대분류 = new Map<string, typeof prevData>();
      for (const row of prevData) {
        if (!groupedBy대분류.has(row.대분류)) {
          groupedBy대분류.set(row.대분류, []);
        }
        groupedBy대분류.get(row.대분류)!.push(row);
      }

      for (const [대분류, 대분류Rows] of groupedBy대분류) {
        const 대분류합계 = 대분류Rows.reduce((sum, row) => sum + row.values.reduce((a, b) => a + b, 0), 0);
        previousYearTotals.set(대분류, 대분류합계);
        for (const row of 대분류Rows) {
          const 중분류합계 = row.values.reduce((a, b) => a + b, 0);
          previousYearTotals.set(`${대분류}-${row.중분류}`, 중분류합계);
        }
      }
    } catch (err) {
      console.error(`${prevYear}년 운전자본표 데이터 로드 실패:`, err);
    }

    const tableRows = calculateWorkingCapitalStatementTable(data, previousYearTotals);

    return NextResponse.json({
      year,
      type: 'WORKING_CAPITAL_STATEMENT',
      rows: tableRows,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '운전자본표 데이터를 불러오는데 실패했습니다.';
    console.error('운전자본표 API 에러:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
