import { NextRequest, NextResponse } from 'next/server';
import { readBSCSV } from '@/lib/bs-parser';
import { maskRf2603AnnualOnly } from '@/lib/rf2603';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');
    const modeParam = searchParams.get('mode');
    const year = yearParam ? parseInt(yearParam, 10) : 2026;
    const mode = modeParam === 'plan' ? 'plan' : 'rolling';

    if (![2025, 2026].includes(year)) {
      return NextResponse.json(
        { error: '유효하지 않은 연도입니다. 2025 또는 2026을 선택하세요.' },
        { status: 400 }
      );
    }

    // B/S 데이터 로드
    const { financialPosition, workingCapital } = await readBSCSV(year, mode);
    const isRf2603 = mode === 'plan' && year === 2026;

    return NextResponse.json({
      year,
      mode,
      type: 'BS',
      financialPosition: isRf2603 ? maskRf2603AnnualOnly(financialPosition, 13) : financialPosition,
      workingCapital: isRf2603 ? maskRf2603AnnualOnly(workingCapital, 13) : workingCapital,
    });
  } catch (error) {
    console.error('B/S API 에러:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'B/S 데이터를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
