'use client';

import React, { useMemo, useState } from 'react';
import type { Node } from '@/PL/src/pl/tree';
import type { MonthKey, Source } from '@/PL/src/pl/types';
import { calcCols, calcRateColsFromNumerDenom, type Months } from '@/PL/src/pl/calc';

type DetailSource = Exclude<Source, 'Total'>;

type PLTableProps = {
  prevTree: Node[];
  currTree: Node[];
  detailPrevTrees: Record<DetailSource, Node[]>;
  detailCurrTrees: Record<DetailSource, Node[]>;
  baseMonthIndex: number;
  showMonthly: boolean;
  showYTD: boolean;
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

function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatPercent(num: number | null): string {
  if (num === null || num === undefined) return '-';
  return `${num.toFixed(1)}%`;
}

function formatChange(curr: number | null, prev: number | null, isRate: boolean = false): JSX.Element {
  if (curr === null || prev === null) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  const diff = curr - prev;

  if (isRate) {
    const diffText = diff >= 0 ? `+${diff.toFixed(1)}%p` : `${diff.toFixed(1)}%p`;
    if (prev < 0 && curr > 0) return <div className="text-xs text-green-600 font-semibold">{diffText}, 흑자전환</div>;
    if (prev > 0 && curr < 0) return <div className="text-xs text-red-600 font-semibold">{diffText}, 적자전환</div>;
    return <div className={`text-xs ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{diffText}</div>;
  }

  const ratio = prev === 0 ? null : (curr / prev) * 100;
  const diffText = diff >= 0 ? `+${formatNumber(diff)}` : `△${formatNumber(Math.abs(diff))}`;
  const rateText = ratio === null ? '-' : `${ratio.toFixed(0)}%`;
  if (prev < 0 && curr > 0) return <div className="text-xs text-green-600 font-semibold">{diffText}, 흑자전환</div>;
  if (prev > 0 && curr < 0) return <div className="text-xs text-red-600 font-semibold">{diffText}, 적자전환</div>;

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

export default function PLTable({
  prevTree,
  currTree,
  detailPrevTrees,
  detailCurrTrees,
  baseMonthIndex,
  showMonthly,
  showYTD,
  isExpandedAll,
  onToggleNode,
  expandedNodes,
}: PLTableProps) {
  const [showMonthDetails, setShowMonthDetails] = useState<boolean>(false);
  const [showYtdDetails, setShowYtdDetails] = useState<boolean>(false);
  const [showAnnualDetails, setShowAnnualDetails] = useState<boolean>(false);

  const baseWindowLabel = baseMonthIndex <= 1 ? '1월' : `${baseMonthIndex}월`;
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

  const detailCurrMaps = useMemo(
    () => ({
      HK_MLB: buildNodeMap(detailCurrTrees.HK_MLB),
      HK_Discovery: buildNodeMap(detailCurrTrees.HK_Discovery),
      TW_MLB: buildNodeMap(detailCurrTrees.TW_MLB),
      TW_Discovery: buildNodeMap(detailCurrTrees.TW_Discovery),
    }),
    [detailCurrTrees]
  );

  const monthHeaders = Array.from({ length: 12 }, (_, i) =>
    i < baseMonthIndex ? `${i + 1}월(실적)` : `${i + 1}월(계획)`
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-blue-700 text-white">
            <th className="border border-white/30 px-4 py-3 text-left font-semibold sticky left-0 bg-blue-700 z-20 min-w-[220px]">
              계정과목
            </th>

            {showMonthly &&
              monthHeaders.map((month, idx) => (
                <th key={`month-${idx}`} className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[110px]">
                  {month}
                </th>
              ))}

            <th className="border-l-2 border-l-gray-400 border-r border-t border-b border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-blue-800">
              전년({baseWindowLabel})
            </th>
            <th
              className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] cursor-pointer"
              onClick={() => setShowMonthDetails((prev) => !prev)}
            >
              <span className="inline-flex items-center gap-2">
                당년({baseWindowLabel})
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white/20 px-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-white/30">
                  {showMonthDetails ? '▼' : '▶'}
                </span>
              </span>
            </th>
            {showMonthDetails &&
              DETAIL_COLUMNS.map((detail) => (
                <th key={`month-detail-${detail.source}`} className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-slate-700">
                  {detail.label}
                </th>
              ))}

            {showYTD && (
              <>
                <th className="border-l-2 border-l-gray-400 border-r border-t border-b border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-blue-800">
                  전년YTD
                </th>
                <th
                  className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] cursor-pointer"
                  onClick={() => setShowYtdDetails((prev) => !prev)}
                >
                  <span className="inline-flex items-center gap-2">
                    당년YTD
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white/20 px-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-white/30">
                      {showYtdDetails ? '▼' : '▶'}
                    </span>
                  </span>
                </th>
                {showYtdDetails &&
                  DETAIL_COLUMNS.map((detail) => (
                    <th key={`ytd-detail-${detail.source}`} className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-slate-700">
                      {detail.label}
                    </th>
                  ))}
              </>
            )}

            <th className="border-l-2 border-l-gray-400 border-r border-t border-b border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-blue-800">
              25년 연간
            </th>
            <th
              className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] cursor-pointer"
              onClick={() => setShowAnnualDetails((prev) => !prev)}
            >
              <span className="inline-flex items-center gap-2">
                26년 연간
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-white/20 px-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-white/30">
                  {showAnnualDetails ? '▼' : '▶'}
                </span>
              </span>
            </th>
            {showAnnualDetails &&
              DETAIL_COLUMNS.map((detail) => (
                <th key={`annual-detail-${detail.source}`} className="border border-white/30 px-4 py-3 text-center font-semibold min-w-[120px] bg-slate-700">
                  {detail.label}
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

            const detailCells = (scope: 'month' | 'ytd' | 'annual') =>
              DETAIL_COLUMNS.map((detail) => {
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

                return (
                  <td key={`${scope}-${detail.source}-${key}`} className="border border-gray-200 px-2 py-2 text-right bg-white">
                    <div className={`font-semibold ${currValue !== null && currValue < 0 ? 'text-red-600' : ''}`}>
                      {renderValue(currValue, isRate)}
                    </div>
                    {formatChange(currValue, prevValue, isRate)}
                  </td>
                );
              });

            return (
              <tr key={key} className={`${rowBg} hover:bg-gray-100 transition-colors`}>
                <td className={`border border-gray-200 px-2 py-2 ${paddingLeft} sticky left-0 ${rowBg} z-10`}>
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
                    <span className={depth <= 2 ? 'font-semibold' : ''}>{node.label}</span>
                  </div>
                </td>

                {showMonthly &&
                  monthHeaders.map((_, monthIdx) => {
                    const monthKey = `m${monthIdx + 1}` as MonthKey;
                    const prevVal = prevMonths[monthKey] || 0;
                    const currVal = currMonths[monthKey] || 0;

                    return (
                      <td key={`month-${monthIdx}-${key}`} className="border border-gray-200 px-2 py-2 text-right">
                        <div className={`font-semibold ${currVal < 0 ? 'text-red-600' : ''}`}>
                          {renderValue(currVal, isRate)}
                        </div>
                        {formatChange(currVal, prevVal, isRate)}
                      </td>
                    );
                  })}

                <td className="border-l-2 border-l-gray-300 border-r border-t border-b border-gray-200 px-2 py-2 text-right bg-slate-50">
                  <div className={`font-semibold ${(baseResult.prevMonth ?? 0) < 0 ? 'text-red-600' : ''}`}>
                    {renderValue(baseResult.prevMonth, isRate)}
                  </div>
                </td>

                <td className="border border-gray-200 px-2 py-2 text-right">
                  <div className={`font-semibold ${(baseResult.currMonth ?? 0) < 0 ? 'text-red-600' : ''}`}>
                    {renderValue(baseResult.currMonth, isRate)}
                  </div>
                  {formatChange(baseResult.currMonth, baseResult.prevMonth, isRate)}
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
                      {formatChange(baseResult.currYTD, baseResult.prevYTD, isRate)}
                    </td>
                    {showYtdDetails && detailCells('ytd')}
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
                  {formatChange(yearResult.currYearTotal, yearResult.prevYearTotal, isRate)}
                </td>
                {showAnnualDetails && detailCells('annual')}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
