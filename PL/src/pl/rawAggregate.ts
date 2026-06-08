/**
 * Raw PL 연결 레이어
 * ------------------------------------------------------------------
 * HKMCTW_PL 레포가 생성한 pl-data.json(매장×계정 원시 레코드)을
 * 현재 cashflow PL의 CSV 구조(대분류/중분류/소분류 + 월별)로 집계한다.
 *
 * - 채널 분류:  오프라인 직접비 = 리테일 + 아울렛 / 온라인 직접비 = 온라인 / 영업비 = 오피스
 * - source:     {HK,MC}=홍콩계열, TW=대만계열  ×  M=MLB, X=Discovery
 * - 매핑표:     SGA(판매관리비) 1~15 계정 → 현재 CSV 세부항목  (ACCOUNT_MAPPING)
 *
 * 상위 합계(TAG/실판/매출원가/매출총이익/판관비/영업이익)는 Raw와 100% 일치하며,
 * 세부 소분류 분배만 아래 ACCOUNT_MAPPING 규칙을 따른다(필요 시 이 표만 수정).
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Source, Year } from './types';

// ── pl-data.json 타입 (필요한 필드만) ──────────────────────────────
interface RawRecord {
  brand: string | null;     // M | X
  country: string | null;   // HK | MC | TW
  channel: string | null;   // 리테일 | 아울렛 | 온라인 | 오피스
  store: string | null;
  account: string;
  monthly: (number | null)[]; // 60개월 2022.01 ~ 2026.12
}
interface RawData {
  meta: { yearLabels: string[]; monthLabels: string[]; actualThrough?: string };
  records: RawRecord[];
}

// ── 차원 라벨 ──────────────────────────────────────────────────────
const COUNTRY_KO: Record<string, string> = { HK: '홍콩', MC: '마카오', TW: '대만' };
const COUNTRY_ORDER = ['홍콩', '마카오', '대만'];
const SALES_CHANNELS = ['리테일', '아울렛', '온라인']; // 매출 소분류 순서
const OFFLINE_CHANNELS = ['리테일', '아울렛'];
const ONLINE_CHANNELS = ['온라인'];
const OFFICE_CHANNELS = ['오피스'];

// ── Raw SGA(판매관리비) 직속 계정 1~15 ─────────────────────────────
const A = {
  payroll: '1. 급 여',
  travel: '2. TRAVEL & MEAL',
  uniform: '3. 피복비(유니폼)',
  rent: '4. 임차료',
  maint: '5. 유지보수비',
  utility: '6. 수도광열비',
  supply: '7. 소모품비',
  comm: '8. 통신비',
  ad: '9. 광고선전비',
  fee: '10. 지급수수료',
  freight: '11. 운반비',
  etcFee: '12. 기타 수수료(매장관리비 외)',
  insurance: '13. 보험료',
  depr: '14. 감가상각비',
  dutyfree: '15. 면세점 직접비',
} as const;

/**
 * 집계 매핑표 — 현재 CSV 세부항목(중분류) ← Raw 계정 리스트
 * 각 채널 그룹 안에서 1~15 계정이 정확히 하나의 버킷에 들어가도록 구성(누락/중복 없음 → 섹션합 = 판관비).
 */
export const ACCOUNT_MAPPING: Record<'offline' | 'online' | 'office', Array<{ label: string; accounts: string[] }>> = {
  // 오프라인 직접비 (리테일+아울렛)
  offline: [
    { label: '매장급여', accounts: [A.payroll] },
    { label: '매장관리비', accounts: [A.maint, A.utility, A.supply, A.comm, A.etcFee] },
    { label: '매장광고비', accounts: [A.ad] },
    { label: '물류비(Tag대비)', accounts: [A.freight] },
    { label: '지급수수료', accounts: [A.fee] },
    { label: '매장임차료', accounts: [A.rent] },
    { label: '매장감가상각비', accounts: [A.depr] },
    { label: '매장기타', accounts: [A.travel, A.uniform, A.insurance, A.dutyfree] },
  ],
  // 온라인 직접비 (온라인)
  online: [
    { label: '지급수수료', accounts: [A.fee] },
    { label: '매장광고비', accounts: [A.ad] },
    { label: '매장관리비', accounts: [A.maint, A.utility, A.supply, A.comm, A.etcFee] },
    { label: '물류비(Tag대비)', accounts: [A.freight] },
    { label: '매장기타', accounts: [A.payroll, A.travel, A.uniform, A.rent, A.insurance, A.depr, A.dutyfree] },
  ],
  // 영업비 (오피스)
  office: [
    { label: '급여', accounts: [A.payroll] },
    { label: '광고비', accounts: [A.ad] },
    { label: '여비교통비', accounts: [A.travel] },
    { label: '지급수수료 일반', accounts: [A.fee] },
    { label: '임차료', accounts: [A.rent] },
    { label: '감가상각비', accounts: [A.depr] },
    { label: '보험료', accounts: [A.insurance] },
    { label: '기타', accounts: [A.uniform, A.maint, A.utility, A.supply, A.comm, A.freight, A.etcFee, A.dutyfree] },
  ],
};

// ── 유틸 ───────────────────────────────────────────────────────────
const RAW_LOCAL_PATH = path.join(process.cwd(), 'PL', 'raw', 'pl-data.json');

export function loadRawData(filePath: string = RAW_LOCAL_PATH): RawData {
  const txt = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(txt) as RawData;
}

function yearIndex(raw: RawData, year: Year): number {
  const idx = raw.meta.yearLabels.indexOf(String(year));
  if (idx < 0) throw new Error(`year ${year} not found in pl-data.json`);
  return idx;
}

function brandOf(source: Source): string | null {
  if (source === 'Total') return null;
  return source.includes('MLB') ? 'M' : 'X';
}
function regionCountries(source: Source): string[] | null {
  if (source === 'Total') return null;
  return source.startsWith('HK') ? ['HK', 'MC'] : ['TW'];
}

function matchSource(r: RawRecord, source: Source): boolean {
  const b = brandOf(source);
  if (b && r.brand !== b) return false;
  const c = regionCountries(source);
  if (c && (!r.country || !c.includes(r.country))) return false;
  return true;
}

type Months = number[]; // length 12
const zero12 = (): Months => new Array(12).fill(0);
function addInto(target: Months, r: RawRecord, yi: number) {
  const base = yi * 12;
  for (let m = 0; m < 12; m++) target[m] += r.monthly[base + m] ?? 0;
}

// ── 한 행(row) 표현: CSV로 직렬화하기 위한 중간 구조 ────────────────
export interface AggRow {
  lvl1: string;
  lvl2: string;
  lvl3: string;
  months: Months;
  isRate?: boolean;
}

/**
 * (year, source)에 대해 현재 CSV 구조의 행들을 집계 생성.
 */
export function aggregateRows(raw: RawData, year: Year, source: Source): AggRow[] {
  const yi = yearIndex(raw, year);
  const recs = raw.records.filter((r) => matchSource(r, source));
  const rows: AggRow[] = [];

  // 매출 소분류 조합(전체 데이터 기준 존재하는 country×channel) — source 간 구조 안정화
  const salesCombos: Array<{ countryKo: string; channel: string }> = [];
  for (const ck of COUNTRY_ORDER) {
    for (const ch of SALES_CHANNELS) {
      const exists = raw.records.some(
        (r) => r.country && COUNTRY_KO[r.country] === ck && r.channel === ch && OFFICE_CHANNELS.indexOf(r.channel) < 0,
      );
      if (exists) salesCombos.push({ countryKo: ck, channel: ch });
    }
  }

  const sumByAccountAndCombo = (account: string, countryKo: string, channel: string): Months => {
    const out = zero12();
    for (const r of recs) {
      if (r.account !== account) continue;
      if (!r.country || COUNTRY_KO[r.country] !== countryKo) continue;
      if (r.channel !== channel) continue;
      addInto(out, r, yi);
    }
    return out;
  };
  const sumByAccount = (account: string, channels?: string[]): Months => {
    const out = zero12();
    for (const r of recs) {
      if (r.account !== account) continue;
      if (channels && (!r.channel || channels.indexOf(r.channel) < 0)) continue;
      addInto(out, r, yi);
    }
    return out;
  };
  const sumAccounts = (accounts: string[], channels: string[]): Months => {
    const set = new Set(accounts);
    const out = zero12();
    for (const r of recs) {
      if (!set.has(r.account)) continue;
      if (!r.channel || channels.indexOf(r.channel) < 0) continue;
      addInto(out, r, yi);
    }
    return out;
  };

  // 1) TAG매출
  for (const { countryKo, channel } of salesCombos) {
    rows.push({ lvl1: 'TAG매출', lvl2: countryKo, lvl3: channel, months: sumByAccountAndCombo('Tag매출액', countryKo, channel) });
  }
  // 2) 실판매출
  for (const { countryKo, channel } of salesCombos) {
    rows.push({ lvl1: '실판매출', lvl2: countryKo, lvl3: channel, months: sumByAccountAndCombo('실매출액', countryKo, channel) });
  }
  // 3) 매출원가
  const cogs = sumByAccount('매출원가합계');
  rows.push({ lvl1: '매출원가', lvl2: '매출원가합계', lvl3: '', months: cogs });
  // 4) Tag대비 원가율 (rate placeholder — route의 applyRateRecalc가 매출원가/TAG매출로 재계산)
  rows.push({ lvl1: 'Tag대비 원가율', lvl2: 'Tag대비 원가율합계', lvl3: '', months: zero12(), isRate: true });
  // 5) 매출총이익
  const gp = sumByAccount('매출총이익');
  rows.push({ lvl1: '매출총이익', lvl2: '매출총이익합계', lvl3: '', months: gp });
  // 6) 오프라인 직접비
  for (const bucket of ACCOUNT_MAPPING.offline) {
    rows.push({ lvl1: '오프라인 직접비', lvl2: bucket.label, lvl3: '', months: sumAccounts(bucket.accounts, OFFLINE_CHANNELS) });
  }
  // 7) 온라인 직접비
  for (const bucket of ACCOUNT_MAPPING.online) {
    rows.push({ lvl1: '온라인 직접비', lvl2: bucket.label, lvl3: '', months: sumAccounts(bucket.accounts, ONLINE_CHANNELS) });
  }
  // 8) 영업비
  for (const bucket of ACCOUNT_MAPPING.office) {
    rows.push({ lvl1: '영업비', lvl2: bucket.label, lvl3: '', months: sumAccounts(bucket.accounts, OFFICE_CHANNELS) });
  }
  // 9) 직접비+영업비 = 판매관리비 전체(채널 무관)
  const sgaTotal = sumByAccount('판매관리비');
  rows.push({ lvl1: '직접비+영업비', lvl2: '직접비+영업비 계', lvl3: '', months: sgaTotal });
  // 10) 영업이익 = 매출총이익 − (직접비+영업비)  (표가 정확히 맞도록 파생 계산)
  const op = gp.map((v, i) => v - sgaTotal[i]);
  rows.push({ lvl1: '영업이익', lvl2: '영업이익 계', lvl3: '', months: op });

  return rows;
}

// ── CSV 직렬화 ─────────────────────────────────────────────────────
function fmtCell(v: number): string {
  if (!isFinite(v)) return '0';
  // 정수면 정수로, 아니면 소수 그대로(콤마 미사용 → 따옴표 불필요). csvLoader가 그대로 파싱.
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
}

export function rowsToCsv(rows: AggRow[], year: Year): string {
  const yy = String(year).slice(-2);
  const header = ['대분류', '중분류', '소분류', ...Array.from({ length: 12 }, (_, i) => `${yy}년${i + 1}월`)].join(',');
  const lines = rows.map((r) => {
    const cells = [r.lvl1, r.lvl2, r.lvl3, ...r.months.map((m) => (r.isRate ? `${fmtCell(m)}%` : fmtCell(m)))];
    return cells.join(',');
  });
  return '﻿' + [header, ...lines].join('\n') + '\n';
}

// ── 전체 재생성 ────────────────────────────────────────────────────
export const TARGET_YEARS: Year[] = [2025, 2026];
export const TARGET_SOURCES: Source[] = ['Total', 'HK_MLB', 'HK_Discovery', 'TW_MLB', 'TW_Discovery'];

export interface RefreshFileResult {
  year: Year;
  source: Source;
  file: string;
  rows: number;
  bytes: number;
}

/**
 * pl-data.json → PL/data/{year}_{source}.csv 10개 재생성.
 */
export function regenerateAllCsvs(rawFilePath?: string): RefreshFileResult[] {
  const raw = loadRawData(rawFilePath);
  const dataDir = path.join(process.cwd(), 'PL', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const results: RefreshFileResult[] = [];
  for (const year of TARGET_YEARS) {
    for (const source of TARGET_SOURCES) {
      const rows = aggregateRows(raw, year, source);
      const csv = rowsToCsv(rows, year);
      const fileName = `${year}_${source}.csv`;
      const outPath = path.join(dataDir, fileName);
      fs.writeFileSync(outPath, csv, 'utf-8');
      results.push({ year, source, file: fileName, rows: rows.length, bytes: Buffer.byteLength(csv, 'utf-8') });
    }
  }
  return results;
}
