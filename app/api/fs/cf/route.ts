import { NextRequest, NextResponse } from 'next/server';
import { calculateCF } from '@/lib/fs-mapping';

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

    // buildTree 기반 calculateCF 사용
    const tableRows = await calculateCF(year);

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
