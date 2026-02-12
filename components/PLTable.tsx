'use client';

import React, { useState, useMemo } from 'react';
import type { Node } from '@/PL/src/pl/tree';
import type { MonthKey } from '@/PL/src/pl/types';
import { calcCols, calcRateColsFromNumerDenom, type Months } from '@/PL/src/pl/calc';

type PLTableProps = {
  prevTree: Node[];
  currTree: Node[];
  baseMonthIndex: number;
  showMonthly: boolean;
  showYTD: boolean;
  isExpandedAll: boolean;
  onToggleNode: (nodeKey: string) => void;
  expandedNodes: Set<string>;
};

// 숫자 포맷팅 (천단위 콤마)
function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// 퍼센트 포맷팅
function formatPercent(num: number | null): string {
  if (num === null || num === undefined) return '-';
  return `${num.toFixed(1)}%`;
}

// 증감 표시 (2줄 중 아래줄)
function formatChange(curr: number | null, prev: number | null, isRate: boolean = false): JSX.Element {
  if (curr === null || prev === null) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  const diff = curr - prev;
  const rate = prev === 0 ? null : (curr / prev) * 100;

  const color = diff >= 0 ? 'text-green-600' : 'text-red-600';

  if (isRate) {
    // 퍼센트 행은 %p 차이만 표시
    const diffText = diff >= 0 ? `△${diff.toFixed(1)}` : `△${Math.abs(diff).toFixed(1)}`;
    return (
      <div className={`text-xs ${color}`}>
        {diffText}
      </div>
    );
  }

  // 금액 행은 증감값, 증감률 표시
  const diffText = diff >= 0 ? `+${formatNumber(diff)}` : `△${formatNumber(Math.abs(diff))}`;
  const rateText = rate === null ? '-' : `${rate.toFixed(0)}%`;

  return (
    <div className={`text-xs ${color}`}>
      {diffText} , {rateText}
    </div>
  );
}

export default function PLTable({
  prevTree,
  currTree,
  baseMonthIndex,
  showMonthly,
  showYTD,
  isExpandedAll,
  onToggleNode,
  expandedNodes,
}: PLTableProps) {
  // 트리를 플랫하게 펼치기
  const flattenTree = (nodes: Node[], parentExpanded: boolean = true): Array<Node & { depth: number }> => {
    if (!nodes || nodes.length === 0) return [];
    
    const result: Array<Node & { depth: number }> = [];

    nodes.forEach(node => {
      const depth = node.level;
      result.push({ ...node, depth });

      // 확장 상태 확인
      const isExpanded = isExpandedAll || expandedNodes.has(node.key);

      if (node.children && isExpanded && parentExpanded) {
        result.push(...flattenTree(node.children, true));
      }
    });

    return result;
  };

  const prevFlat = useMemo(() => flattenTree(prevTree), [prevTree, isExpandedAll, expandedNodes]);
  const currFlat = useMemo(() => flattenTree(currTree), [currTree, isExpandedAll, expandedNodes]);

  // 행 데이터 병합 (prevFlat과 currFlat의 key로 매칭)
  const mergedRows = useMemo(() => {
    const keyMap = new Map<string, { prev: Node | null; curr: Node | null; depth: number }>();

    prevFlat.forEach(node => {
      keyMap.set(node.key, { prev: node, curr: null, depth: node.depth });
    });

    currFlat.forEach(node => {
      const existing = keyMap.get(node.key);
      if (existing) {
        existing.curr = node;
      } else {
        keyMap.set(node.key, { prev: null, curr: node, depth: node.depth });
      }
    });

    return Array.from(keyMap.entries()).map(([key, value]) => ({
      key,
      ...value,
    }));
  }, [prevFlat, currFlat]);

  // 배경색 결정 (강조 행)
  const getRowBgColor = (label: string): string => {
    const highlightLabels = ['매출총이익', '영업이익', '영업이익률', 'Tag대비 원가율'];
    if (highlightLabels.includes(label)) {
      return 'bg-amber-50';
    }
    return 'bg-blue-50/30';
  };

  // 월별 컬럼 헤더
  const monthHeaders = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-blue-700 text-white">
            {/* 계정과목 */}
            <th className="border border-gray-300 px-4 py-3 text-left font-semibold sticky left-0 bg-blue-700 z-20">
              계정과목
            </th>

            {/* 월별 데이터 (showMonthly일 때만) */}
            {showMonthly && monthHeaders.map((month, idx) => (
              <th key={`month-${idx}`} className="border border-gray-300 px-4 py-3 text-center font-semibold min-w-[100px]">
                {month}
              </th>
            ))}

            {/* 전년(기준월) / 당년(기준월) - 항상 표시 */}
            <th className="border-l-4 border-gray-400 border-r border-gray-300 px-4 py-3 text-center font-semibold min-w-[120px]">
              전년({baseMonthIndex}월)
            </th>
            <th className="border border-gray-300 px-4 py-3 text-center font-semibold min-w-[120px]">
              당년({baseMonthIndex}월) ▶
            </th>

            {/* YTD (showYTD일 때만) */}
            {showYTD && (
              <>
                <th className="border-l-4 border-gray-400 border-r border-gray-300 px-4 py-3 text-center font-semibold min-w-[120px]">
                  전년YTD
                </th>
                <th className="border border-gray-300 px-4 py-3 text-center font-semibold min-w-[120px]">
                  당년YTD ▶
                </th>
              </>
            )}

            {/* 연간 */}
            <th className="border-l-4 border-gray-400 border-r border-gray-300 px-4 py-3 text-center font-semibold min-w-[120px]">
              2025년연간
            </th>
            <th className="border border-gray-300 px-4 py-3 text-center font-semibold min-w-[120px]">
              2026년연간 ▶
            </th>
          </tr>
        </thead>
        <tbody>
          {mergedRows.map(({ key, prev, curr, depth }) => {
            const node = curr || prev;
            if (!node) return null;

            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = isExpandedAll || expandedNodes.has(key);
            const isRate = node.hasRateRow;

            // 들여쓰기
            const paddingLeft = depth === 1 ? 'pl-4' : depth === 2 ? 'pl-8' : 'pl-12';

            // 월별 데이터 계산
            const prevMonths = (prev?.rollup || {}) as Months;
            const currMonths = (curr?.rollup || {}) as Months;

            // 기준월 계산
            const baseMonthResult = calcCols(baseMonthIndex, prevMonths, currMonths, isRate);

            // YTD 계산
            let ytdResult = null;
            if (showYTD) {
              ytdResult = calcCols(baseMonthIndex, prevMonths, currMonths, isRate);
            }

            // 연간 계산
            const yearResult = calcCols(12, prevMonths, currMonths, isRate);

            return (
              <tr key={key} className={`${getRowBgColor(node.label)} hover:bg-gray-100 transition-colors`}>
                {/* 계정과목 */}
                <td className={`border border-gray-300 px-2 py-2 ${paddingLeft} sticky left-0 ${getRowBgColor(node.label)} z-10`}>
                  <div className="flex items-center gap-2">
                    {hasChildren && (
                      <button
                        onClick={() => onToggleNode(key)}
                        className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-900"
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                    {!hasChildren && <span className="w-5"></span>}
                    <span className={depth === 1 ? 'font-bold' : ''}>
                      {node.label}
                    </span>
                  </div>
                </td>

                {/* 월별 데이터 (showMonthly일 때만) */}
                {showMonthly && monthHeaders.map((_, monthIdx) => {
                  const monthKey = `m${monthIdx + 1}` as MonthKey;
                  const prevVal = prevMonths[monthKey] || 0;
                  const currVal = currMonths[monthKey] || 0;

                  return (
                    <td key={`month-${monthIdx}`} className="border border-gray-300 px-2 py-2 text-right">
                      <div className="font-semibold">{isRate ? formatPercent(currVal) : formatNumber(currVal)}</div>
                      {formatChange(currVal, prevVal, isRate)}
                    </td>
                  );
                })}

                {/* 전년(기준월) */}
                <td className="border-l-4 border-gray-400 border-r border-gray-300 px-2 py-2 text-right">
                  <div className="font-semibold">
                    {isRate ? formatPercent(baseMonthResult.prevMonth) : formatNumber(baseMonthResult.prevMonth)}
                  </div>
                </td>

                {/* 당년(기준월) */}
                <td className="border border-gray-300 px-2 py-2 text-right">
                  <div className="font-semibold">
                    {isRate ? formatPercent(baseMonthResult.currMonth) : formatNumber(baseMonthResult.currMonth)}
                  </div>
                  {formatChange(baseMonthResult.currMonth, baseMonthResult.prevMonth, isRate)}
                </td>

                {/* YTD (showYTD일 때만) */}
                {showYTD && ytdResult && (
                  <>
                    <td className="border-l-4 border-gray-400 border-r border-gray-300 px-2 py-2 text-right">
                      <div className="font-semibold">
                        {isRate ? '-' : formatNumber(ytdResult.prevYTD)}
                      </div>
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-right">
                      <div className="font-semibold">
                        {isRate ? '-' : formatNumber(ytdResult.currYTD)}
                      </div>
                      {!isRate && formatChange(ytdResult.currYTD, ytdResult.prevYTD, false)}
                    </td>
                  </>
                )}

                {/* 2025년연간 */}
                <td className="border-l-4 border-gray-400 border-r border-gray-300 px-2 py-2 text-right">
                  <div className="font-semibold">
                    {isRate ? formatPercent(yearResult.prevYearTotal) : formatNumber(yearResult.prevYearTotal)}
                  </div>
                </td>

                {/* 2026년연간 */}
                <td className="border border-gray-300 px-2 py-2 text-right">
                  <div className="font-semibold">
                    {isRate ? formatPercent(yearResult.currYearTotal) : formatNumber(yearResult.currYearTotal)}
                  </div>
                  {formatChange(yearResult.currYearTotal, yearResult.prevYearTotal, isRate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
