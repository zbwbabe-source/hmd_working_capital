import { NextRequest, NextResponse } from 'next/server';
import { readBSCSV } from '@/lib/bs-parser';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : 2026;

    if (![2025, 2026].includes(year)) {
      return NextResponse.json(
        { error: '유효하지 않은 연도입니다. 2025 또는 2026을 선택하세요.' },
        { status: 400 }
      );
    }

    // B/S 데이터 로드
    const { financialPosition, workingCapital } = await readBSCSV(year);

    return NextResponse.json({
      year,
      type: 'BS',
      financialPosition,
      workingCapital,
    });
  } catch (error) {
    console.error('B/S API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'B/S 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
