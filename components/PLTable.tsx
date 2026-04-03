'use client';

import React, { useMemo, useState } from 'react';
import type { Node } from '@/PL/src/pl/tree';
import type { ScenarioFactorMap, ScenarioTreeSet } from '@/PL/src/pl/scenario';
import type { MonthKey, Source } from '@/PL/src/pl/types';
import { calcCols, calcRateColsFromNumerDenom, type Months } from '@/PL/src/pl/calc';
import { translateFinanceLabel } from '@/lib/translate-finance-label';

type DetailSource = Exclude<Source, 'Total'>;

type PLTableProps = {
  locale?: 'ko' | 'en';
  prevTree: Node[];
  currTree: Node[];
  detailPrevTrees: Record<DetailSource, Node[]>;
  detailCurrTrees: Record<DetailSource, Node[]>;
  annualScenarioTrees: ScenarioTreeSet | null;
  baseMonthIndex: number;
  showMonthly: boolean;
  showYTD: boolean;
  annualOnly: boolean;
  detailGoodScenarioPercent: ScenarioFactorMap;
  detailBadScenarioPercent: ScenarioFactorMap;
  defaultGoodScenarioPercent: number;
  defaultBadScenarioPercent: number;
  onDetailGoodScenarioChange: (source: keyof ScenarioFactorMap, next: number) => void;
  onDetailBadScenarioChange: (source: keyof ScenarioFactorMap, next: number) => void;
  isExpandedAll: boolean;
  onToggleNode: (nodeKey: string) => void;
  expandedNodes: Set<string>;
};

const DETAIL_COLUMNS: Array<{ source: DetailSource; label: string }> = [
  { source: 'HK_MLB', label: '홍콩 MLB' },
  { source: 'HK_Discovery', label: '홍콩 DX' },
  { source: 'TW_MLB', label: '대만 MLB' },
  { source: 'TW_Discovery', label: '대만 DX' },
];

const PL_LABELS_EN: Record<string, string> = {
  매출: 'Sales',
  실판매출: 'Sell-out',
  TAG매출: 'TAG',
  'Tag대비 원가율': 'COGS / TAG',
  매출원가: 'COGS',
  매출총이익: 'GP',
  매출총이익률: 'GM',
  판관비: 'SG&A',
  '오프라인 직접비': 'Off. Direct Exp.',
  '온라인 직접비': 'On. Direct Exp.',
  영업비: 'Office Exp.',
  '직접비+영업비': 'Direct Exp. + OpEx',
  영업이익: 'OP',
  영업이익률: 'OPM',
  당기순이익: 'NI',
  순이익률: 'NPM',
  홍콩: 'HK',
  마카오: 'Macau',
  대만: 'TW',
  리테일: 'Retail',
  아울렛: 'Outlet',
  온라인: 'Online',
  매장급여: 'Store Payroll',
  매장관리비: 'Store Admin',
  매장광고비: 'Store Mktg',
  '물류비(Tag대비)': 'Logistics (TAG)',
  지급수수료: 'Commissions',
  매장임차료: 'Store Rent',
  매장감가상각비: 'Store D&A',
  매장기타: 'Store Misc.',
  여비교통비: 'T&E',
  '지급수수료 일반': 'Gen. Fee',
  급여: 'Payroll',
  광고비: 'Mktg',
  임차료: 'Rent',
  감가상각비: 'D&A',
  보험료: 'Insurance',
  기타: 'Misc.',
  합계: 'Total',
};

const translatePlLabel = (label: string, locale: 'ko' | 'en') => {
  if (locale === 'ko') return label;
  return PL_LABELS_EN[label] ?? translateFinanceLabel(label, 'short');
};

function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatPercent(num: number | null): string {
  if (num === null || num === undefined) return '-';
  return `${num.toFixed(1)}%`;
}

function formatChange(curr: number | null, prev: number | null, isRate: boolean = false, locale: 'ko' | 'en' = 'ko'): JSX.Element {
  const isEnglish = locale === 'en';
  if (curr === null || prev === null) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  const diff = curr - prev;

  if (isRate) {
    const diffText = diff >= 0 ? `+${diff.toFixed(1)}%p` : `${diff.toFixed(1)}%p`;
    if (prev < 0 && curr > 0) return <div className="text-xs text-green-600 font-semibold">{diffText}, {isEnglish ? 'To profit' : '흑자전환'}</div>;
    if (prev > 0 && curr < 0) return <div className="text-xs text-red-600 font-semibold">{diffText}, {isEnglish ? 'To loss' : '적자전환'}</div>;
    return <div className={`text-xs ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{diffText}</div>;
  }

  const ratio = prev === 0 ? null : (curr / prev) * 100;
  const diffText = diff >= 0 ? `+${formatNumber(diff)}` : `△${formatNumber(Math.abs(diff))}`;
  const rateText = ratio === null ? '-' : `${ratio.toFixed(0)}%`;
  if (prev < 0 && curr > 0) return <div className="text-xs text-green-600 font-semibold">{diffText}, {isEnglish ? 'To profit' : '흑자전환'}</div>;
  if (prev > 0 && curr < 0) return <div className="text-xs text-red-600 font-semibold">{diffText}, {isEnglish ? 'To loss' : '적자전환'}</div>;

  return (
    <div className={`text-xs ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
      {diffText}, {rateText}
    </div>
  );
}

function flattenTree(
  nodes: Node[],
  isExpandedAll: boolean,
  expandedNodes: Set<string>,
  parentExpanded: boolean = true
): Array<Node & { depth: number }> {
  if (!nodes || nodes.length === 0) return [];

  const result: Array<Node & { depth: number }> = [];

  nodes.forEach((node) => {
    const depth = node.level;
    result.push({ ...node, depth });

    const isExpanded = isExpandedAll || expandedNodes.has(node.key);
    if (node.children && isExpanded && parentExpanded) {
      result.push(...flattenTree(node.children, isExpandedAll, expandedNodes, true));
    }
  });

  return result;
}

function buildNodeMap(nodes: Node[]): Map<string, Node> {
  const map = new Map<string, Node>();

  const walk = (items: Node[]) => {
    items.forEach((node) => {
      map.set(node.key, node);
      if (node.children) walk(node.children);
    });
  };

  walk(nodes);
  return map;
}

function getNodeMonths(node: Node | null | undefined): Months {
  const empty: Months = {
    m1: 0,
    m2: 0,
    m3: 0,
    m4: 0,
    m5: 0,
    m6: 0,
    m7: 0,
    m8: 0,
    m9: 0,
    m10: 0,
    m11: 0,
    m12: 0,
  };

  if (!node) return empty;

  if (node.hasRateRow) {
    if (node.rows && node.rows.length > 0) return node.rows[0].months;
    if (node.children && node.children.length > 0) return getNodeMonths(node.children[0]);
  }

  return (node.rollup || empty) as Months;
}

function getRateBaseNodes(
  node: Node,
  nodeMap: Map<string, Node>
): { numerNode: Node | null; denomNode: Node | null } {
  if (node.level === 1) {
    return {
      numerNode: nodeMap.get('L1|매출원가') ?? null,
      denomNode: nodeMap.get('L1|TAG매출') ?? null,
    };
  }

  if (node.level === 2) {
    const [, , lvl2] = node.key.split('|');
    return {
      numerNode: nodeMap.get(`L2|매출원가|${lvl2}`) ?? null,
      denomNode: nodeMap.get(`L2|TAG매출|${lvl2}`) ?? null,
    };
  }

  return { numerNode: null, denomNode: null };
}

function renderValue(value: number | null, isRate: boolean) {
  return isRate ? formatPercent(value) : formatNumber(value);
}

function getScenarioValue(
  node: Node,
  scenarioNode: Node | undefined,
  scenarioMap: Map<string, Node>
): number | null {
  if (!scenarioNode) return null;

  if (node.hasRateRow) {
    const rateBase = getRateBaseNodes(scenarioNode, scenarioMap);
    if (!rateBase.numerNode || !rateBase.denomNode) return null;

    return calcRateColsFromNumerDenom(
      12,
      getNodeMonths(rateBase.numerNode),
      getNodeMonths(rateBase.denomNode),
      getNodeMonths(rateBase.numerNode),
      getNodeMonths(rateBase.denomNode)
    ).currYearTotal;
  }

  return calcCols(12, getNodeMonths(scenarioNode), getNodeMonths(scenarioNode), false).currYearTotal;
}

function getOpMarginResult(
  monthIndex: number,
  numerMap: Map<string, Node>,
  denomMap: Map<string, Node>
) {
  const numerNode = numerMap.get('L1|영업이익');
  const denomNode = denomMap.get('L1|실판매출');
  if (!numerNode || !denomNode) return null;

  return calcRateColsFromNumerDenom(
    monthIndex,
    getNodeMonths(numerNode),
    getNodeMonths(denomNode),
    getNodeMonths(numerNode),
    getNodeMonths(denomNode)
  );
}

function renderScenarioControl(
  value: number,
  defaultValue: number,
  onChange: (next: number) => void,
  tone: 'good' | 'bad',
  bounds?: { min: number; max: number }
) {
  const min = bounds?.min ?? (tone === 'good' ? 110 : 70);
  const max = bounds?.max ?? (tone === 'good' ? 150 : 90);

  return (
    <div className="mt-1 flex items-center justify-center gap-1">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/30 bg-transparent text-[11px] font-bold text-white hover:bg-white/10 disabled:opacity-40"
        onClick={(event) => {
          event.stopPropagation();
          onChange(Math.max(min, value - 10));
        }}
        disabled={value <= min}
      >
        -
      </button>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/30 bg-transparent text-[11px] font-bold text-white hover:bg-white/10 disabled:opacity-40"
        onClick={(event) => {
          event.stopPropagation();
          onChange(Math.min(max, value + 10));
        }}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

export default function PLTable({
  locale = 'ko',
  prevTree,
  currTree,
  detailPrevTrees,
  detailCurrTrees,
  annualScenarioTrees,
  baseMonthIndex,
  showMonthly,
  showYTD,
  annualOnly,
  detailGoodScenarioPercent,
  detailBadScenarioPercent,
  defaultGoodScenarioPercent,
  defaultBadScenarioPercent,
  onDetailGoodScenarioChange,
  onDetailBadScenarioChange,
  isExpandedAll,
  onToggleNode,
  expandedNodes,
}: PLTableProps) {
  const isEnglish = locale === 'en';
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [showMonthDetails, setShowMonthDetails] = useState<boolean>(false);
  const [showYtdDetails, setShowYtdDetails] = useState<boolean>(false);
  const [showAnnualDetails, setShowAnnualDetails] = useState<boolean>(false);
  const [showGoodDetails, setShowGoodDetails] = useState<boolean>(false);
  const [showBadDetails, setShowBadDetails] = useState<boolean>(false);

  const baseWindowLabel = isEnglish ? monthNamesEn[Math.max(baseMonthIndex - 1, 0)] : (baseMonthIndex <= 1 ? '1월' : `${baseMonthIndex}월`);
  const ytdMonthLabel = isEnglish ? monthNamesEn[Math.max(baseMonthIndex - 1, 0)] : `${baseMonthIndex}월`;
  const detailColumns = isEnglish
    ? DETAIL_COLUMNS.map((detail) => ({
        ...detail,
        label: detail.label
          .replace('홍콩', 'HK')
          .replace('대만', 'TW')
          .replace('Discovery', 'DX'),
      }))
    : DETAIL_COLUMNS;
  const prevFlat = useMemo(() => flattenTree(prevTree, isExpandedAll, expandedNodes), [prevTree, isExpandedAll, expandedNodes]);
  const currFlat = useMemo(() => flattenTree(currTree, isExpandedAll, expandedNodes), [currTree, isExpandedAll, expandedNodes]);

  const mergedRows = useMemo(() => {
    const keyMap = new Map<string, { prev: Node | null; curr: Node | null; depth: number }>();

    prevFlat.forEach((node) => {
      keyMap.set(node.key, { prev: node, curr: null, depth: node.depth });
    });

    currFlat.forEach((node) => {
      const existing = keyMap.get(node.key);
      if (existing) {
        existing.curr = node;
      } else {
        keyMap.set(node.key, { prev: null, curr: node, depth: node.depth });
      }
    });

    return Array.from(keyMap.entries()).map(([key, value]) => ({ key, ...value }));
  }, [prevFlat, currFlat]);

  const detailPrevMaps = useMemo(
    () => ({
      HK_MLB: buildNodeMap(detailPrevTrees.HK_MLB),
      HK_Discovery: buildNodeMap(detailPrevTrees.HK_Discovery),
      TW_MLB: buildNodeMap(detailPrevTrees.TW_MLB),
      TW_Discovery: buildNodeMap(detailPrevTrees.TW_Discovery),
    }),
    [detailPrevTrees]
  );

  const totalPrevMap = useMemo(() => buildNodeMap(prevTree), [prevTree]);
  const totalCurrMap = useMemo(() => buildNodeMap(currTree), [currTree]);
  const totalGoodMap = useMemo(
    () => buildNodeMap(annualScenarioTrees?.total.good ?? []),
    [annualScenarioTrees]
  );
  const totalBadMap = useMemo(
    () => buildNodeMap(annualScenarioTrees?.total.bad ?? []),
    [annualScenarioTrees]
  );

  const detailCurrMaps = useMemo(
    () => ({
      HK_MLB: buildNodeMap(detailCurrTrees.HK_MLB),
      HK_Discovery: buildNodeMap(detailCurrTrees.HK_Discovery),
      TW_MLB: buildNodeMap(detailCurrTrees.TW_MLB),
      TW_Discovery: buildNodeMap(detailCurrTrees.TW_Discovery),
    }),
    [detailCurrTrees]
  );
  const detailGoodMaps = useMemo(
    () => ({
      HK_MLB: buildNodeMap(annualScenarioTrees?.detail.HK_MLB.good ?? []),
      HK_Discovery: buildNodeMap(annualScenarioTrees?.detail.HK_Discovery.good ?? []),
      TW_MLB: buildNodeMap(annualScenarioTrees?.detail.TW_MLB.good ?? []),
      TW_Discovery: buildNodeMap(annualScenarioTrees?.detail.TW_Discovery.good ?? []),
    }),
    [annualScenarioTrees]
  );
  const detailBadMaps = useMemo(
    () => ({
      HK_MLB: buildNodeMap(annualScenarioTrees?.detail.HK_MLB.bad ?? []),
      HK_Discovery: buildNodeMap(annualScenarioTrees?.detail.HK_Discovery.bad ?? []),
      TW_MLB: buildNodeMap(annualScenarioTrees?.detail.TW_MLB.bad ?? []),
      TW_Discovery: buildNodeMap(annualScenarioTrees?.detail.TW_Discovery.bad ?? []),
    }),
    [annualScenarioTrees]
  );

  const monthHeaders = Array.from({ length: 12 }, (_, i) =>
    i < baseMonthIndex ? (isEnglish ? `${monthNamesEn[i]} (Act)` : `${i + 1}월(실적)`) : (isEnglish ? `${monthNamesEn[i]} (Plan)` : `${i + 1}월(계획)`)
  );
  const nonAccountColumnCount =
    (!annualOnly && showMonthly ? monthHeaders.length : 0) +
    (!annualOnly ? 2 + (showMonthDetails ? detailColumns.length : 0) : 0) +
    (!annualOnly && showYTD ? 2 + (showYtdDetails ? detailColumns.length : 0) : 0) +
    2 +
    (showAnnualDetails ? detailColumns.length : 0) +
    1 +
    (showGoodDetails ? detailColumns.length : 0) +
    1 +
    (showBadDetails ? detailColumns.length : 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[260px]" />
          {Array.from({ length: nonAccountColumnCount }, (_, idx) => (
            <col key={`col-${idx}`} className="w-[120px]" />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="bg-blue-900 text-white">
            <th
              className="border border-white/30 px-4 py-2 text-left font-semibold sticky left-0 bg-blue-900 z-20 w-[260px] min-w-[260px] max-w-[260px]"
              rowSpan={2}
            >
              {isEnglish ? 'Account' : '계정과목'}
            </th>

            {!annualOnly && showMonthly && (
              <th
                className="border border-white/30 px-4 py-2 text-center font-semibold"
                colSpan={monthHeaders.length}
              >
                {isEnglish ? 'Monthly Data' : '월별 데이터'}
              </th>
            )}

            {!annualOnly && (
              <th
                className="border border-white/30 px-4 py-2 text-center font-semibold"
                colSpan={2 + (showMonthDetails ? detailColumns.length : 0)}
              >
                {isEnglish ? 'Base Month' : '기준월'}
              </th>
            )}

            {!annualOnly && showYTD && (
              <th
                className="border border-white/30 px-4 py-2 text-center font-semibold"
                colSpan={2 + (showYtdDetails ? detailColumns.length : 0)}
              >
                YTD
              </th>
            )}

            <th
              className="border border-white/30 px-4 py-2 text-center font-semibold"
              colSpan={2 + (showAnnualDetails ? detailColumns.length : 0)}
            >
              {isEnglish ? 'Annual Rolling' : '연간 Rolling'}
            </th>
            <th
              className="border border-white/30 px-4 py-2 text-center font-semibold bg-blue-800"
              colSpan={2 + (showGoodDetails ? detailColumns.length : 0) + (showBadDetails ? detailColumns.length : 0)}
            >
              {isEnglish ? 'Operating Scenario' : '영업상황 Scenario'}
            </th>
          </tr>
          <tr className="bg-blue-700 text-white">
            {!annualOnly && showMonthly &&
              monthHeaders.map((month, idx) => (
                <th key={`month-${idx}`} className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[110px]">
                  {month}
                </th>
              ))}

            {!annualOnly && (
              <>
                <th className="border-l-2 border-l-gray-400 border-r border-t border-b border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-blue-800">
                  {isEnglish ? `Prev (${baseWindowLabel})` : `전년(${baseWindowLabel})`}
                </th>
                <th
                  className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px]"
                >
                  <span className="inline-flex items-center gap-2">
                    {isEnglish ? `Curr (${baseWindowLabel})` : `당년(${baseWindowLabel})`}
                    <button
                      type="button"
                      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white/20 px-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-white/30"
                      onClick={() => setShowMonthDetails((prev) => !prev)}
                    >
                      {showMonthDetails ? '▼' : '▶'}
                    </button>
                  </span>
                </th>
                {showMonthDetails &&
                  detailColumns.map((detail) => (
                    <th key={`month-detail-${detail.source}`} className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-slate-700">
                      {detail.label}
                    </th>
                  ))}
              </>
            )}

            {!annualOnly && showYTD && (
              <>
                <th className="border-l-2 border-l-gray-400 border-r border-t border-b border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-blue-800">
                  {isEnglish ? `Prev YTD (${ytdMonthLabel})` : `전년YTD ${ytdMonthLabel}`}
                </th>
                <th
                  className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px]"
                >
                  <span className="inline-flex items-center gap-2">
                    {isEnglish ? `Curr YTD (${ytdMonthLabel})` : `당년YTD ${ytdMonthLabel}`}
                    <button
                      type="button"
                      className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white/20 px-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-white/30"
                      onClick={() => setShowYtdDetails((prev) => !prev)}
                    >
                      {showYtdDetails ? '▼' : '▶'}
                    </button>
                  </span>
                </th>
                {showYtdDetails &&
                  detailColumns.map((detail) => (
                    <th key={`ytd-detail-${detail.source}`} className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-slate-700">
                      {detail.label}
                    </th>
                  ))}
              </>
            )}

            <th className="border-l-2 border-l-gray-400 border-r border-t border-b border-white/30 px-4 py-3 text-center font-semibold w-[120px] min-w-[120px] bg-blue-800">
              {isEnglish ? '25 Annual' : '25년 연간'}
            </th>
            <th
              className="border border-white/30 px-4 py-3 text-center font-semibold w-[120px] min-w-[120px]"
            >
              <span className="inline-flex items-center gap-2">
                {isEnglish ? '26 Annual' : '26년 연간'}
                <button
                  type="button"
                  className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white/20 px-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-white/30"
                  onClick={() => setShowAnnualDetails((prev) => !prev)}
                >
                  {showAnnualDetails ? '▼' : '▶'}
                </button>
              </span>
            </th>
            {showAnnualDetails &&
              detailColumns.map((detail) => (
                <th key={`annual-detail-${detail.source}`} className="border border-white/30 px-4 py-3 text-center font-semibold w-[120px] min-w-[120px] bg-slate-700">
                  {detail.label}
                </th>
              ))}
            <th
              className="border border-white/30 px-4 py-3 text-center font-semibold w-[120px] min-w-[120px] bg-emerald-700"
            >
              <div className="flex min-h-[92px] flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-2">
                  <span>{isEnglish ? '26 Upside Total' : '26년 상향 합계'}</span>
                  <button
                    type="button"
                    className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white/20 px-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-white/30"
                    onClick={() => setShowGoodDetails((prev) => !prev)}
                  >
                    {showGoodDetails ? '▼' : '▶'}
                  </button>
                </div>
              </div>
            </th>
            {showGoodDetails &&
              detailColumns.map((detail) => (
                <th key={`annual-detail-good-${detail.source}`} className="border border-white/30 px-3 py-3 text-center font-semibold w-[120px] min-w-[120px] bg-emerald-800">
                  <div className="flex min-h-[92px] flex-col items-center justify-between">
                    <div>{isEnglish ? `${detail.label} Upside` : `${detail.label} 상향`}</div>
                    <div className="text-[14px] font-bold leading-none text-white">{detailGoodScenarioPercent[detail.source]}%</div>
                    {renderScenarioControl(
                      detailGoodScenarioPercent[detail.source],
                      defaultGoodScenarioPercent,
                      (next) => onDetailGoodScenarioChange(detail.source, next),
                      'good',
                      { min: 70, max: 150 }
                    )}
                  </div>
                </th>
              ))}
            <th
              className="border border-white/30 px-4 py-3 text-center font-semibold w-[120px] min-w-[120px] bg-amber-700"
            >
              <div className="flex min-h-[92px] flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-2">
                  <span>{isEnglish ? '26 Downside Total' : '26년 하향 합계'}</span>
                  <button
                    type="button"
                    className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white/20 px-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-white/30"
                    onClick={() => setShowBadDetails((prev) => !prev)}
                  >
                    {showBadDetails ? '▼' : '▶'}
                  </button>
                </div>
              </div>
            </th>
            {showBadDetails &&
              detailColumns.map((detail) => (
                <th key={`annual-detail-bad-${detail.source}`} className="border border-white/30 px-3 py-3 text-center font-semibold w-[120px] min-w-[120px] bg-amber-800">
                  <div className="flex min-h-[92px] flex-col items-center justify-between">
                    <div>{isEnglish ? `${detail.label} Downside` : `${detail.label} 하향`}</div>
                    <div className="text-[14px] font-bold leading-none text-white">{detailBadScenarioPercent[detail.source]}%</div>
                    {renderScenarioControl(
                      detailBadScenarioPercent[detail.source],
                      defaultBadScenarioPercent,
                      (next) => onDetailBadScenarioChange(detail.source, next),
                      'bad',
                      { min: 70, max: 150 }
                    )}
                  </div>
                </th>
              ))}
          </tr>
        </thead>

        <tbody>
          {mergedRows.map(({ key, prev, curr, depth }) => {
            const node = curr || prev;
            if (!node) return null;

            const hasChildren = !!(node.children && node.children.length > 0);
            const isExpanded = isExpandedAll || expandedNodes.has(key);
            const isRate = node.hasRateRow;
            const paddingLeft = depth === 1 ? 'pl-4' : depth === 2 ? 'pl-8' : 'pl-12';
            const rowBg = depth === 1 ? 'bg-slate-100' : depth === 2 ? 'bg-blue-50/50' : 'bg-white';
            const prevMonths = getNodeMonths(prev);
            const currMonths = getNodeMonths(curr);
            const totalPrevRateBase = prev ? getRateBaseNodes(prev, totalPrevMap) : { numerNode: null, denomNode: null };
            const totalCurrRateBase = curr ? getRateBaseNodes(curr, totalCurrMap) : { numerNode: null, denomNode: null };
            const hasRateBase =
              isRate &&
              totalPrevRateBase.numerNode &&
              totalPrevRateBase.denomNode &&
              totalCurrRateBase.numerNode &&
              totalCurrRateBase.denomNode;
            const baseResult = hasRateBase
              ? calcRateColsFromNumerDenom(
                  baseMonthIndex,
                  getNodeMonths(totalPrevRateBase.numerNode),
                  getNodeMonths(totalPrevRateBase.denomNode),
                  getNodeMonths(totalCurrRateBase.numerNode),
                  getNodeMonths(totalCurrRateBase.denomNode)
                )
              : calcCols(baseMonthIndex, prevMonths, currMonths, isRate);
            const yearResult = hasRateBase
              ? calcRateColsFromNumerDenom(
                  12,
                  getNodeMonths(totalPrevRateBase.numerNode),
                  getNodeMonths(totalPrevRateBase.denomNode),
                  getNodeMonths(totalCurrRateBase.numerNode),
                  getNodeMonths(totalCurrRateBase.denomNode)
                )
              : calcCols(12, prevMonths, currMonths, isRate);
            const totalGoodValue = getScenarioValue(node, totalGoodMap.get(key), totalGoodMap);
            const totalBadValue = getScenarioValue(node, totalBadMap.get(key), totalBadMap);

            const detailCells = (scope: 'month' | 'ytd' | 'annual' | 'annualGood' | 'annualBad') =>
              detailColumns.flatMap((detail) => {
                const prevDetail = detailPrevMaps[detail.source].get(key);
                const currDetail = detailCurrMaps[detail.source].get(key);
                const prevDetailMonths = getNodeMonths(prevDetail);
                const currDetailMonths = getNodeMonths(currDetail);
                const detailPrevRateBase = prevDetail ? getRateBaseNodes(prevDetail, detailPrevMaps[detail.source]) : { numerNode: null, denomNode: null };
                const detailCurrRateBase = currDetail ? getRateBaseNodes(currDetail, detailCurrMaps[detail.source]) : { numerNode: null, denomNode: null };
                const detailHasRateBase =
                  isRate &&
                  detailPrevRateBase.numerNode &&
                  detailPrevRateBase.denomNode &&
                  detailCurrRateBase.numerNode &&
                  detailCurrRateBase.denomNode;
                const detailResult = detailHasRateBase
                  ? calcRateColsFromNumerDenom(
                      baseMonthIndex,
                      getNodeMonths(detailPrevRateBase.numerNode),
                      getNodeMonths(detailPrevRateBase.denomNode),
                      getNodeMonths(detailCurrRateBase.numerNode),
                      getNodeMonths(detailCurrRateBase.denomNode)
                    )
                  : calcCols(baseMonthIndex, prevDetailMonths, currDetailMonths, isRate);

                let prevValue: number | null = null;
                let currValue: number | null = null;

                if (scope === 'month') {
                  prevValue = detailResult.prevMonth;
                  currValue = detailResult.currMonth;
                } else if (scope === 'ytd') {
                  prevValue = detailResult.prevYTD;
                  currValue = detailResult.currYTD;
                } else {
                  prevValue = detailResult.prevYearTotal;
                  currValue = detailResult.currYearTotal;
                }

                const actualCell = (
                  <td key={`${scope}-${detail.source}-${key}`} className="border border-gray-200 px-2 py-2 text-right bg-white">
                    <div className={`font-semibold ${currValue !== null && currValue < 0 ? 'text-red-600' : ''}`}>
                      {renderValue(currValue, isRate)}
                    </div>
                    {formatChange(currValue, prevValue, isRate, locale)}
                  </td>
                );

                if (scope === 'month' || scope === 'ytd' || scope === 'annual') return [actualCell];

                const detailGoodValue = getScenarioValue(node, detailGoodMaps[detail.source].get(key), detailGoodMaps[detail.source]);
                const detailBadValue = getScenarioValue(node, detailBadMaps[detail.source].get(key), detailBadMaps[detail.source]);

                if (scope === 'annualGood') {
                  return [
                    <td key={`${scope}-${detail.source}-${key}`} className="border border-gray-200 px-2 py-2 text-right bg-emerald-50">
                      <div className={`font-semibold ${detailGoodValue !== null && detailGoodValue < 0 ? 'text-red-600' : ''}`}>
                        {renderValue(detailGoodValue, isRate)}
                      </div>
                      {formatChange(detailGoodValue, prevValue, isRate, locale)}
                    </td>,
                  ];
                }

                return [
                  <td key={`${scope}-${detail.source}-${key}`} className="border border-gray-200 px-2 py-2 text-right bg-amber-50">
                    <div className={`font-semibold ${detailBadValue !== null && detailBadValue < 0 ? 'text-red-600' : ''}`}>
                      {renderValue(detailBadValue, isRate)}
                    </div>
                    {formatChange(detailBadValue, prevValue, isRate, locale)}
                  </td>,
                ];
              });

            const mainRow = (
              <tr key={key} className={`${rowBg} hover:bg-gray-100 transition-colors`}>
                <td className={`border border-gray-200 px-2 py-2 ${paddingLeft} sticky left-0 ${rowBg} z-10 w-[260px] min-w-[260px] max-w-[260px]`}>
                  <div className="flex items-center gap-2">
                    {hasChildren ? (
                      <button
                        onClick={() => onToggleNode(key)}
                        className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-900"
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    ) : (
                      <span className="w-5" />
                    )}
                    <span className={depth <= 2 ? 'font-semibold' : ''}>{translatePlLabel(node.label, locale)}</span>
                  </div>
                </td>

                {!annualOnly && showMonthly &&
                  monthHeaders.map((_, monthIdx) => {
                    const monthKey = `m${monthIdx + 1}` as MonthKey;
                    const prevVal = prevMonths[monthKey] || 0;
                    const currVal = currMonths[monthKey] || 0;

                    return (
                      <td key={`month-${monthIdx}-${key}`} className="border border-gray-200 px-2 py-2 text-right">
                        <div className={`font-semibold ${currVal < 0 ? 'text-red-600' : ''}`}>
                          {renderValue(currVal, isRate)}
                        </div>
                        {formatChange(currVal, prevVal, isRate, locale)}
                      </td>
                    );
                  })}

                {!annualOnly && (
                  <>
                    <td className="border-l-2 border-l-gray-300 border-r border-t border-b border-gray-200 px-2 py-2 text-right bg-slate-50">
                      <div className={`font-semibold ${(baseResult.prevMonth ?? 0) < 0 ? 'text-red-600' : ''}`}>
                        {renderValue(baseResult.prevMonth, isRate)}
                      </div>
                    </td>

                    <td className="border border-gray-200 px-2 py-2 text-right">
                      <div className={`font-semibold ${(baseResult.currMonth ?? 0) < 0 ? 'text-red-600' : ''}`}>
                        {renderValue(baseResult.currMonth, isRate)}
                      </div>
                      {formatChange(baseResult.currMonth, baseResult.prevMonth, isRate, locale)}
                    </td>
                    {showMonthDetails && detailCells('month')}

                    {showYTD && (
                      <>
                        <td className="border-l-2 border-l-gray-300 border-r border-t border-b border-gray-200 px-2 py-2 text-right bg-slate-50">
                          <div className={`font-semibold ${(baseResult.prevYTD ?? 0) < 0 ? 'text-red-600' : ''}`}>
                            {renderValue(baseResult.prevYTD, isRate)}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-right">
                          <div className={`font-semibold ${(baseResult.currYTD ?? 0) < 0 ? 'text-red-600' : ''}`}>
                            {renderValue(baseResult.currYTD, isRate)}
                          </div>
                          {formatChange(baseResult.currYTD, baseResult.prevYTD, isRate, locale)}
                        </td>
                        {showYtdDetails && detailCells('ytd')}
                      </>
                    )}
                  </>
                )}

                <td className="border-l-2 border-l-gray-300 border-r border-t border-b border-gray-200 px-2 py-2 text-right bg-slate-50">
                  <div className={`font-semibold ${(yearResult.prevYearTotal ?? 0) < 0 ? 'text-red-600' : ''}`}>
                    {renderValue(yearResult.prevYearTotal, isRate)}
                  </div>
                </td>
                <td className="border border-gray-200 px-2 py-2 text-right">
                  <div className={`font-semibold ${(yearResult.currYearTotal ?? 0) < 0 ? 'text-red-600' : ''}`}>
                    {renderValue(yearResult.currYearTotal, isRate)}
                  </div>
                  {formatChange(yearResult.currYearTotal, yearResult.prevYearTotal, isRate, locale)}
                </td>
                {showAnnualDetails && detailCells('annual')}
                <td className="border border-gray-200 px-2 py-2 text-right bg-emerald-50">
                  <div className={`font-semibold ${totalGoodValue !== null && totalGoodValue < 0 ? 'text-red-600' : ''}`}>
                    {renderValue(totalGoodValue, isRate)}
                  </div>
                  {formatChange(totalGoodValue, yearResult.prevYearTotal, isRate, locale)}
                </td>
                {showGoodDetails && detailCells('annualGood')}
                <td className="border border-gray-200 px-2 py-2 text-right bg-amber-50">
                  <div className={`font-semibold ${totalBadValue !== null && totalBadValue < 0 ? 'text-red-600' : ''}`}>
                    {renderValue(totalBadValue, isRate)}
                  </div>
                  {formatChange(totalBadValue, yearResult.prevYearTotal, isRate, locale)}
                </td>
                {showBadDetails && detailCells('annualBad')}
              </tr>
            );

            if (node.label !== '영업이익') {
              return mainRow;
            }

            const opMarginPrev = getOpMarginResult(baseMonthIndex, totalPrevMap, totalPrevMap);
            const opMarginCurr = getOpMarginResult(baseMonthIndex, totalCurrMap, totalCurrMap);
            const opMarginYearPrev = getOpMarginResult(12, totalPrevMap, totalPrevMap);
            const opMarginYearCurr = getOpMarginResult(12, totalCurrMap, totalCurrMap);
            const opMarginGood = getOpMarginResult(12, totalGoodMap, totalGoodMap);
            const opMarginBad = getOpMarginResult(12, totalBadMap, totalBadMap);
            const opMarginDetailCells = (scope: 'month' | 'ytd' | 'annual' | 'annualGood' | 'annualBad') =>
              detailColumns.map((detail) => {
                const prevMap = detailPrevMaps[detail.source];
                const currMap = detailCurrMaps[detail.source];
                const goodMap = detailGoodMaps[detail.source];
                const badMap = detailBadMaps[detail.source];
                const prevRate = getOpMarginResult(baseMonthIndex, prevMap, prevMap);
                const currRate = getOpMarginResult(baseMonthIndex, currMap, currMap);
                const prevYearRate = getOpMarginResult(12, prevMap, prevMap);
                const currYearRate = getOpMarginResult(12, currMap, currMap);
                const goodRate = getOpMarginResult(12, goodMap, goodMap);
                const badRate = getOpMarginResult(12, badMap, badMap);

                let value: number | null = null;
                let compare: number | null = null;
                let cellBg = 'bg-white';

                if (scope === 'month') {
                  value = currRate?.currMonth ?? null;
                  compare = prevRate?.currMonth ?? null;
                } else if (scope === 'ytd') {
                  value = currRate?.currYTD ?? null;
                  compare = prevRate?.currYTD ?? null;
                } else if (scope === 'annual') {
                  value = currYearRate?.currYearTotal ?? null;
                  compare = prevYearRate?.currYearTotal ?? null;
                } else if (scope === 'annualGood') {
                  value = goodRate?.currYearTotal ?? null;
                  compare = prevYearRate?.currYearTotal ?? null;
                  cellBg = 'bg-emerald-50';
                } else {
                  value = badRate?.currYearTotal ?? null;
                  compare = prevYearRate?.currYearTotal ?? null;
                  cellBg = 'bg-amber-50';
                }

                return (
                  <td key={`opm-${scope}-${detail.source}-${key}`} className={`border border-gray-200 px-2 py-2 text-right ${cellBg}`}>
                    <div className="font-semibold">{renderValue(value, true)}</div>
                    {formatChange(value, compare, true, locale)}
                  </td>
                );
              });

            const opMarginRow = (
              <tr key={`${key}-margin`} className="bg-blue-50/30 hover:bg-gray-100 transition-colors">
                <td className="border border-gray-200 px-2 py-2 pl-4 sticky left-0 bg-blue-50/30 z-10 w-[260px] min-w-[260px] max-w-[260px]">
                  <div className="flex items-center gap-2">
                    <span className="w-5" />
                    <span className="font-semibold">{translatePlLabel('영업이익률', locale)}</span>
                  </div>
                </td>
                {!annualOnly && showMonthly &&
                  monthHeaders.map((_, monthIdx) => {
                    const monthRatePrev = getOpMarginResult(monthIdx + 1, totalPrevMap, totalPrevMap);
                    const monthRateCurr = getOpMarginResult(monthIdx + 1, totalCurrMap, totalCurrMap);
                    return (
                      <td key={`opm-month-${monthIdx}`} className="border border-gray-200 px-2 py-2 text-right">
                        <div className="font-semibold">{renderValue(monthRateCurr?.currMonth ?? null, true)}</div>
                        {formatChange(monthRateCurr?.currMonth ?? null, monthRatePrev?.currMonth ?? null, true, locale)}
                      </td>
                    );
                  })}
                {!annualOnly && (
                  <>
                    <td className="border-l-2 border-l-gray-300 border-r border-t border-b border-gray-200 px-2 py-2 text-right bg-slate-50">
                      <div className="font-semibold">{renderValue(opMarginPrev?.currMonth ?? null, true)}</div>
                    </td>
                    <td className="border border-gray-200 px-2 py-2 text-right">
                      <div className="font-semibold">{renderValue(opMarginCurr?.currMonth ?? null, true)}</div>
                      {formatChange(opMarginCurr?.currMonth ?? null, opMarginPrev?.currMonth ?? null, true, locale)}
                    </td>
                    {showMonthDetails && opMarginDetailCells('month')}
                    {showYTD && (
                      <>
                        <td className="border-l-2 border-l-gray-300 border-r border-t border-b border-gray-200 px-2 py-2 text-right bg-slate-50">
                          <div className="font-semibold">{renderValue(opMarginPrev?.currYTD ?? null, true)}</div>
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-right">
                          <div className="font-semibold">{renderValue(opMarginCurr?.currYTD ?? null, true)}</div>
                          {formatChange(opMarginCurr?.currYTD ?? null, opMarginPrev?.currYTD ?? null, true, locale)}
                        </td>
                        {showYtdDetails && opMarginDetailCells('ytd')}
                      </>
                    )}
                  </>
                )}
                <td className="border-l-2 border-l-gray-300 border-r border-t border-b border-gray-200 px-2 py-2 text-right bg-slate-50">
                  <div className="font-semibold">{renderValue(opMarginYearPrev?.currYearTotal ?? null, true)}</div>
                </td>
                <td className="border border-gray-200 px-2 py-2 text-right">
                  <div className="font-semibold">{renderValue(opMarginYearCurr?.currYearTotal ?? null, true)}</div>
                  {formatChange(opMarginYearCurr?.currYearTotal ?? null, opMarginYearPrev?.currYearTotal ?? null, true, locale)}
                </td>
                {showAnnualDetails && opMarginDetailCells('annual')}
                <td className="border border-gray-200 px-2 py-2 text-right bg-emerald-50">
                  <div className="font-semibold">{renderValue(opMarginGood?.currYearTotal ?? null, true)}</div>
                  {formatChange(opMarginGood?.currYearTotal ?? null, opMarginYearPrev?.currYearTotal ?? null, true, locale)}
                </td>
                {showGoodDetails && opMarginDetailCells('annualGood')}
                <td className="border border-gray-200 px-2 py-2 text-right bg-amber-50">
                  <div className="font-semibold">{renderValue(opMarginBad?.currYearTotal ?? null, true)}</div>
                  {formatChange(opMarginBad?.currYearTotal ?? null, opMarginYearPrev?.currYearTotal ?? null, true, locale)}
                </td>
                {showBadDetails && opMarginDetailCells('annualBad')}
              </tr>
            );

            return (
              <React.Fragment key={`${key}-group`}>
                {mainRow}
                {opMarginRow}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
