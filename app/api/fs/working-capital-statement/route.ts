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

      // 마지막 유효한 월 찾기 헬퍼 함수
      const getLastValidIndex = (values: number[]): number => {
        for (let i = values.length - 1; i >= 0; i--) {
          if (values[i] != null && values[i] !== 0) {
            return i;
          }
        }
        return values.length - 1;
      };

      for (const [대분류, 대분류Rows] of groupedBy대분류) {
        // 대분류 기말 = 각 중분류의 마지막 월 값 합계
        const 대분류기말 = 대분류Rows.reduce((sum, row) => {
          const lastIdx = getLastValidIndex(row.values);
          return sum + (row.values[lastIdx] ?? 0);
        }, 0);
        previousYearTotals.set(대분류, 대분류기말);
        
        for (const row of 대분류Rows) {
          const lastIdx = getLastValidIndex(row.values);
          const 중분류기말 = row.values[lastIdx] ?? 0;
          previousYearTotals.set(`${대분류}-${row.중분류}`, 중분류기말);
        }
      }
    } catch (err) {
      console.error(`${prevYear}년 운전자본표 데이터 로드 실패:`, err);
    }

    // 2025년 선택 시 2023년 기말 추가 (2023년(기말) 컬럼용). 2026년 선택 시에도 전월대비 행 2024년(기말) 값(2024-2023) 계산용으로 사용.
    let year2023Totals: Map<string, number> | undefined = undefined;
    if (year === 2025 || year === 2026) {
      try {
        const getLastValidIndex = (values: number[]): number => {
          for (let i = values.length - 1; i >= 0; i--) {
            if (values[i] != null && values[i] !== 0) return i;
          }
          return values.length - 1;
        };
        const path2023 = path.join(process.cwd(), '운전자본', '2023.csv');
        const data2023 = await readWorkingCapitalStatementCSV(path2023, 2023);
        year2023Totals = new Map<string, number>();
        const grouped2023 = new Map<string, typeof data2023>();
        for (const row of data2023) {
          if (!grouped2023.has(row.대분류)) grouped2023.set(row.대분류, []);
          grouped2023.get(row.대분류)!.push(row);
        }
        for (const [대분류, 대분류Rows] of grouped2023) {
          const 대분류합계 = new Array(12).fill(0);
          for (const r of 대분류Rows) {
            for (let i = 0; i < 12; i++) 대분류합계[i] += r.values[i];
          }
          const lastIdx = getLastValidIndex(대분류합계);
          year2023Totals.set(대분류, 대분류합계[lastIdx] ?? 0);
          for (const r of 대분류Rows) {
            const lastIdxR = getLastValidIndex(r.values);
            year2023Totals.set(`${대분류}-${r.중분류}`, r.values[lastIdxR] ?? 0);
          }
        }
      } catch (err) {
        console.error('2023년 운전자본표 데이터 로드 실패:', err);
      }
    }

    // 2026년 선택 시 2024년 기말 추가 (전월대비 행 2025년(기말) 기초 컬럼용: 2025-2024)
    let twoYearsAgoTotals: Map<string, number> | undefined = undefined;
    if (year === 2026) {
      try {
        const getLastValidIndex = (values: number[]): number => {
          for (let i = values.length - 1; i >= 0; i--) {
            if (values[i] != null && values[i] !== 0) return i;
          }
          return values.length - 1;
        };
        const path2024 = path.join(process.cwd(), '운전자본', '2024.csv');
        const data2024 = await readWorkingCapitalStatementCSV(path2024, 2024);
        twoYearsAgoTotals = new Map<string, number>();
        const grouped2024 = new Map<string, typeof data2024>();
        for (const row of data2024) {
          if (!grouped2024.has(row.대분류)) grouped2024.set(row.대분류, []);
          grouped2024.get(row.대분류)!.push(row);
        }
        for (const [대분류, 대분류Rows] of grouped2024) {
          const 대분류합계 = new Array(12).fill(0);
          for (const r of 대분류Rows) {
            for (let i = 0; i < 12; i++) 대분류합계[i] += r.values[i];
          }
          const lastIdx = getLastValidIndex(대분류합계);
          twoYearsAgoTotals.set(대분류, 대분류합계[lastIdx] ?? 0);
          for (const r of 대분류Rows) {
            const lastIdxR = getLastValidIndex(r.values);
            twoYearsAgoTotals.set(`${대분류}-${r.중분류}`, r.values[lastIdxR] ?? 0);
          }
        }
      } catch (err) {
        console.error('2024년 운전자본표 데이터 로드 실패:', err);
      }
    }

    const tableRows = calculateWorkingCapitalStatementTable(data, previousYearTotals, year2023Totals, twoYearsAgoTotals);

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
