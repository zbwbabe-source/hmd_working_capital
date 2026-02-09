import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readCashflowCSV, type CashflowRow } from '@/lib/csv';
import { calculateCashflowTable } from '@/lib/fs-mapping-new';

function buildTotalsFromCashflowRows(rows: CashflowRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    // Only use "합계" rows, skip regional breakdowns (홍콩마카오, 대만)
    if (r.소분류 && r.소분류 !== '합계') continue;
    
    // 현금잔액은 12월 값 사용, 다른 항목은 합계 사용
    const isBalance = r.대분류 === '현금잔액';
    const annual = isBalance ? r.values[11] : r.values.reduce((s, v) => s + v, 0);
    
    // 4-level keys
    const 대분류 = r.대분류;
    const 중분류1 = r.중분류1;
    const 중분류2 = r.중분류2;
    const 소분류 = r.소분류;
    
    if (대분류) {
      map.set(대분류, (map.get(대분류) ?? 0) + annual);
    }
    if (대분류 && 중분류1) {
      const key = `${대분류}-${중분류1}`;
      map.set(key, (map.get(key) ?? 0) + annual);
    }
    if (대분류 && 중분류1 && 중분류2) {
      const key = `${대분류}-${중분류1}-${중분류2}`;
      map.set(key, (map.get(key) ?? 0) + annual);
    }
    if (대분류 && 중분류1 && 중분류2 && 소분류) {
      const key = `${대분류}-${중분류1}-${중분류2}-${소분류}`;
      map.set(key, (map.get(key) ?? 0) + annual);
    }
  }
  return map;
}

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

    const filePath = path.join(process.cwd(), 'cashflow', `${year}.csv`);
    const data = await readCashflowCSV(filePath, year);

    let previousYearTotals: Map<string, number> | undefined;
    let year2023Totals: Map<string, number> | undefined;

    const prevYear = year - 1;
    try {
      const prevFilePath = path.join(process.cwd(), 'cashflow', `${prevYear}.csv`);
      const prevData = await readCashflowCSV(prevFilePath, prevYear);
      previousYearTotals = buildTotalsFromCashflowRows(prevData);
    } catch (err) {
      console.error(`${prevYear}년 cashflow 로드 실패:`, err);
      previousYearTotals = undefined;
    }

    if (year === 2025) {
      try {
        const path2023 = path.join(process.cwd(), 'cashflow', '2023.csv');
        const data2023 = await readCashflowCSV(path2023, 2023);
        year2023Totals = buildTotalsFromCashflowRows(data2023);
      } catch (err) {
        console.error('2023년 cashflow 로드 실패:', err);
      }
    } else if (year === 2026) {
      try {
        const path2024 = path.join(process.cwd(), 'cashflow', '2024.csv');
        const data2024 = await readCashflowCSV(path2024, 2024);
        year2023Totals = buildTotalsFromCashflowRows(data2024);
      } catch (err) {
        console.error('2024년 cashflow 로드 실패:', err);
      }
    }

    const tableRows = calculateCashflowTable(data, previousYearTotals, year2023Totals);

    return NextResponse.json({
      year,
      type: 'CF',
      rows: tableRows,
    });
  } catch (error) {
    console.error('CF API 에러:', error);
    return NextResponse.json(
      { error: 'CF 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

