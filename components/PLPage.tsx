'use client';

import React, { useEffect, useState } from 'react';
import PLTable from '@/components/PLTable';
import type { Node } from '@/PL/src/pl/tree';
import type { Source, Year } from '@/PL/src/pl/types';

const DETAIL_SOURCES: Source[] = ['HK_MLB', 'HK_Discovery', 'TW_MLB', 'TW_Discovery'];
const ALL_SOURCES: Source[] = ['Total', ...DETAIL_SOURCES];

type TreeMap = Record<Source, Node[]>;

const EMPTY_TREE_MAP: TreeMap = {
  Total: [],
  HK_MLB: [],
  HK_Discovery: [],
  TW_MLB: [],
  TW_Discovery: [],
};

export default function PLPage() {
  const [selectedYear, setSelectedYear] = useState<Year>(2026);
  const [baseMonthIndex, setBaseMonthIndex] = useState<number>(2);
  const [isExpandedAll, setIsExpandedAll] = useState<boolean>(false);
  const [showMonthly, setShowMonthly] = useState<boolean>(false);
  const [showYTD, setShowYTD] = useState<boolean>(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [trees2025, setTrees2025] = useState<TreeMap>(EMPTY_TREE_MAP);
  const [trees2026, setTrees2026] = useState<TreeMap>(EMPTY_TREE_MAP);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const responses = await Promise.all(
          [2025, 2026].flatMap((year) =>
            ALL_SOURCES.map(async (source) => {
              const response = await fetch(`/api/fs/pl?year=${year}&source=${source}`, {
                cache: 'no-store',
              });
              const data = await response.json();
              return { year: year as Year, source, tree: (data.tree ?? []) as Node[] };
            })
          )
        );

        if (cancelled) return;

        const next2025: TreeMap = { ...EMPTY_TREE_MAP };
        const next2026: TreeMap = { ...EMPTY_TREE_MAP };

        responses.forEach(({ year, source, tree }) => {
          if (year === 2025) next2025[source] = tree;
          if (year === 2026) next2026[source] = tree;
        });

        setTrees2025(next2025);
        setTrees2026(next2026);
      } catch (err) {
        if (cancelled) return;
        console.error('PL load failed:', err);
        setError('손익 데이터를 불러오지 못했습니다.');
        setTrees2025({ ...EMPTY_TREE_MAP });
        setTrees2026({ ...EMPTY_TREE_MAP });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (isExpandedAll) setExpandedNodes(new Set());
    setIsExpandedAll((prev) => !prev);
  };

  const years: Year[] = [2026];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const displayPrevTree = selectedYear === 2026 ? trees2025.Total : [];
  const displayCurrTree = selectedYear === 2026 ? trees2026.Total : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-300 px-6 py-4">
        <div className="flex items-center gap-6">
          <div className="flex gap-2">
            {years.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  selectedYear === year
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                {year}년
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">기준월</label>
            <select
              value={baseMonthIndex}
              onChange={(e) => setBaseMonthIndex(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded bg-white text-sm"
            >
              {months.map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 border-b border-gray-300 px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleAll}
            className="px-4 py-2 bg-gray-700 text-white rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {isExpandedAll ? '접기 ▲' : '펼치기 ▼'}
          </button>

          <button
            onClick={() => setShowMonthly((prev) => !prev)}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            월별 데이터 {showMonthly ? '접기 ◀' : '펼치기 ▶'}
          </button>

          <button
            onClick={() => setShowYTD((prev) => !prev)}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            {showYTD ? 'YTD 숨기기 (현재 전체보기)' : 'YTD 보기 (현재 전체보기)'}
          </button>

          <span className="text-xs text-gray-500 ml-2">(비교 컬럼은 항상 표시됩니다)</span>
        </div>
      </div>

      <div className="p-6">
        {loading && <div className="text-center py-12 text-gray-600">로딩 중...</div>}
        {error && <div className="text-center py-12 text-red-600">{error}</div>}

        {!loading && !error && (
          <PLTable
            prevTree={displayPrevTree}
            currTree={displayCurrTree}
            detailPrevTrees={{
              HK_MLB: trees2025.HK_MLB,
              HK_Discovery: trees2025.HK_Discovery,
              TW_MLB: trees2025.TW_MLB,
              TW_Discovery: trees2025.TW_Discovery,
            }}
            detailCurrTrees={{
              HK_MLB: trees2026.HK_MLB,
              HK_Discovery: trees2026.HK_Discovery,
              TW_MLB: trees2026.TW_MLB,
              TW_Discovery: trees2026.TW_Discovery,
            }}
            baseMonthIndex={baseMonthIndex}
            showMonthly={showMonthly}
            showYTD={showYTD}
            isExpandedAll={isExpandedAll}
            onToggleNode={handleToggleNode}
            expandedNodes={expandedNodes}
          />
        )}
      </div>
    </div>
  );
}
