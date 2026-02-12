import { NextResponse } from 'next/server';
import { getRows } from '@/PL/src/pl/csvLoader';
import { buildTree } from '@/PL/src/pl/tree';
import { applyRateRecalc } from '@/PL/src/pl/rateRecalc';
import type { Year, Brand } from '@/PL/src/pl/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const brandParam = searchParams.get('brand');

    if (!yearParam || !brandParam) {
      return NextResponse.json(
        { error: '연도와 브랜드를 지정해주세요.' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam) as Year;
    const brand = brandParam as Brand;

    // 유효성 검사
    if (![2024, 2025, 2026].includes(year)) {
      return NextResponse.json(
        { error: '유효하지 않은 연도입니다.' },
        { status: 400 }
      );
    }

    if (!['Total', 'MLB', 'Discovery', 'KIDS', 'DUVETICA', 'SUPRA'].includes(brand)) {
      return NextResponse.json(
        { error: '유효하지 않은 브랜드입니다.' },
        { status: 400 }
      );
    }

    try {
      // CSV 로드
      const rows = await getRows(year, brand);
      
      // 트리 생성
      const tree = buildTree(rows);

      return NextResponse.json({ tree, year, brand });
    } catch (err) {
      // 파일이 없는 경우 빈 트리 반환
      console.warn(`PL 데이터 없음: ${year} ${brand}`, err);
      return NextResponse.json({ tree: [], year, brand });
    }
  } catch (error) {
    console.error('P/L 데이터 로드 오류:', error);
    return NextResponse.json(
      { error: 'P/L 데이터를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
