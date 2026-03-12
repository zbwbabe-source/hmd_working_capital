import { NextResponse } from 'next/server';
import { getRows } from '@/PL/src/pl/csvLoader';
import { buildTree } from '@/PL/src/pl/tree';
import { applyRateRecalc } from '@/PL/src/pl/rateRecalc';
import type { Year, Source } from '@/PL/src/pl/types';

const VALID_SOURCES: Source[] = ['Total', 'HK_MLB', 'HK_Discovery', 'TW_MLB', 'TW_Discovery'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const sourceParam = searchParams.get('source') ?? searchParams.get('brand');

    if (!yearParam || !sourceParam) {
      return NextResponse.json(
        { error: 'year and source are required.' },
        { status: 400 }
      );
    }

    const year = parseInt(yearParam, 10) as Year;
    const source = sourceParam as Source;

    if (![2025, 2026].includes(year)) {
      return NextResponse.json(
        { error: 'invalid year.' },
        { status: 400 }
      );
    }

    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: 'invalid source.' },
        { status: 400 }
      );
    }

    try {
      const rows = await getRows(year, source);
      const tree = buildTree(rows);
      const recalculated = applyRateRecalc(year === 2025 ? tree : [], year === 2026 ? tree : []);

      return NextResponse.json({
        tree: year === 2025 ? recalculated.prevTree : recalculated.currTree,
        year,
        source,
      });
    } catch (err) {
      console.warn(`PL data missing: ${year} ${source}`, err);
      return NextResponse.json({ tree: [], year, source });
    }
  } catch (error) {
    console.error('PL route error:', error);
    return NextResponse.json(
      { error: 'failed to load PL data.' },
      { status: 500 }
    );
  }
}
