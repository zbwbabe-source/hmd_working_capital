import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readWorkingCapitalCSV, type WorkingCapitalRow } from '@/lib/csv';
import { calculateCashflowTable3Level } from '@/lib/fs-mapping';

function buildTotalsFromRows(rows: WorkingCapitalRow[]): Map<string, number> {
  const map = new Map<string, number>();
  
  for (const r of rows) {
    const { 대분류, 중분류, 소분류, values, annual } = r;
    
    // P열의 연간 합계가 있으면 우선 사용, 없으면 계산
    // 현금잔액은 12월 값 사용, 다른 항목은 합계 사용
    const isBalance = 대분류 === '현금잔액';
    let annualValue: number;
    
    if (annual !== undefined && annual !== null) {
      // CSV의 2025합계 컬럼 값 사용
      annualValue = annual;
    } else {
      // 없으면 기존 방식대로 계산
      annualValue = isBalance ? values[11] : values.reduce((s, v) => s + v, 0);
    }
    
    // 대분류 키 - "합계"만 포함
    if (대분류) {
      const 소분류Trim = 소분류?.trim() ?? '';
      const has합계 = 소분류Trim === '합계' || 소분류Trim.includes('합계');
      const has지역 = 소분류Trim.includes('홍마') || 소분류Trim.includes('대만') || 소분류Trim.includes('홍콩마카오');
      
      if (has합계 && !has지역) {
        const key = 대분류;
        map.set(key, (map.get(key) ?? 0) + annualValue);
      }
    }
    
    // 대분류-중분류 키 - "합계"만 포함
    if (대분류 && 중분류) {
      const 소분류Trim = 소분류?.trim() ?? '';
      const has합계 = 소분류Trim === '합계' || 소분류Trim.includes('합계');
      const has지역 = 소분류Trim.includes('홍마') || 소분류Trim.includes('대만') || 소분류Trim.includes('홍콩마카오');
      
      if (has합계 && !has지역) {
        const key = `${대분류}-${중분류}`;
        map.set(key, (map.get(key) ?? 0) + annualValue);
      }
    }
    
    // 대분류-중분류-소분류 키
    if (대분류 && 중분류 && 소분류) {
      const key = `${대분류}-${중분류}-${소분류}`;
      map.set(key, annualValue);
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
    const data = await readWorkingCapitalCSV(filePath, year);

    let previousYearTotals: Map<string, number> | undefined;
    let year2023Totals: Map<string, number> | undefined;

    const prevYear = year - 1;
    try {
      const prevFilePath = path.join(process.cwd(), 'cashflow', `${prevYear}.csv`);
      const prevData = await readWorkingCapitalCSV(prevFilePath, prevYear);
      previousYearTotals = buildTotalsFromRows(prevData);
    } catch (err) {
      console.error(`${prevYear}년 cashflow 로드 실패:`, err);
      previousYearTotals = undefined;
    }

    if (year === 2025) {
      try {
        const path2023 = path.join(process.cwd(), 'cashflow', '2023.csv');
        const data2023 = await readWorkingCapitalCSV(path2023, 2023);
        year2023Totals = buildTotalsFromRows(data2023);
      } catch (err) {
        console.error('2023년 cashflow 로드 실패:', err);
      }
    } else if (year === 2026) {
      try {
        const path2024 = path.join(process.cwd(), 'cashflow', '2024.csv');
        const data2024 = await readWorkingCapitalCSV(path2024, 2024);
        year2023Totals = buildTotalsFromRows(data2024);
      } catch (err) {
        console.error('2024년 cashflow 로드 실패:', err);
      }
    }

    const tableRows = calculateCashflowTable3Level(data, previousYearTotals, year2023Totals);

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
