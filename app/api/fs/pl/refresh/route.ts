import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { regenerateAllCsvs } from '@/PL/src/pl/rawAggregate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/fs/pl/refresh  — "Rawdata update"
 *
 * 1. (가능하면) 외부 HKMCTW_PL 레포의 최신 pl-data.json 을 PL/raw/pl-data.json 으로 복사
 * 2. PL/raw/pl-data.json 을 읽어 PL/data/{year}_{source}.csv 10개 재생성
 * 3. 결과 리포트 반환
 *
 * 외부 소스 경로 우선순위: env(PL_RAW_SOURCE) > 기본 HKMCTW_PL 경로. 둘 다 없으면 로컬 복사본 사용.
 */
const EXTERNAL_SOURCE_CANDIDATES = [
  process.env.PL_RAW_SOURCE,
  'D:\\Claude_Code\\HKMCTW_PL\\public\\pl-data.json',
].filter(Boolean) as string[];

export async function POST() {
  try {
    const localPath = path.join(process.cwd(), 'PL', 'raw', 'pl-data.json');
    fs.mkdirSync(path.dirname(localPath), { recursive: true });

    // 1) 외부 소스에서 최신본 가져오기 (있으면)
    let pulledFrom: string | null = null;
    for (const src of EXTERNAL_SOURCE_CANDIDATES) {
      try {
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, localPath);
          pulledFrom = src;
          break;
        }
      } catch {
        // 접근 불가 시 다음 후보 / 로컬 복사본 사용
      }
    }

    if (!fs.existsSync(localPath)) {
      return NextResponse.json(
        { error: 'pl-data.json 을 찾을 수 없습니다. PL/raw/pl-data.json 을 두거나 PL_RAW_SOURCE 를 설정하세요.' },
        { status: 404 },
      );
    }

    // 2) CSV 재생성
    const results = regenerateAllCsvs(localPath);
    const rawStat = fs.statSync(localPath);

    return NextResponse.json({
      success: true,
      pulledFrom,
      source: pulledFrom ? '외부 최신본' : '로컬 복사본',
      rawBytes: rawStat.size,
      rawModified: rawStat.mtime.toISOString(),
      files: results,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, stack: (e as Error).stack },
      { status: 500 },
    );
  }
}
