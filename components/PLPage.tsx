'use client';

import React, { useEffect, useMemo, useState } from 'react';
import PLTable from '@/components/PLTable';
import { calcRateColsFromNumerDenom, type Months } from '@/PL/src/pl/calc';
import { buildScenarioTreeSet } from '@/PL/src/pl/scenario';
import type { Node } from '@/PL/src/pl/tree';
import type { MonthKey, Source, Year } from '@/PL/src/pl/types';

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

function buildNodeMap(nodes: Node[]): Map<string, Node> {
  const map = new Map<string, Node>();

  const visit = (items: Node[]) => {
    items.forEach((node) => {
      map.set(node.key, node);
      if (node.children) visit(node.children);
    });
  };

  visit(nodes);
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
  if (node.rows && node.rows.length > 0 && node.hasRateRow) return node.rows[0].months;
  return (node.rollup || empty) as Months;
}

function getOperatingMarginSnapshot(tree: Node[]) {
  const map = buildNodeMap(tree);
  const opNode = map.get('L1|영업이익');
  const sellOutNode = map.get('L1|실판매출');

  if (!opNode || !sellOutNode) {
    return {
      monthly: {} as Record<MonthKey, number>,
      annual: 0,
    };
  }

  const result = calcRateColsFromNumerDenom(
    12,
    getNodeMonths(opNode),
    getNodeMonths(sellOutNode),
    getNodeMonths(opNode),
    getNodeMonths(sellOutNode)
  );

  const monthly = {} as Record<MonthKey, number>;
  for (let i = 1; i <= 12; i++) {
    const monthKey = `m${i}` as MonthKey;
    monthly[monthKey] = calcRateColsFromNumerDenom(
      i,
      getNodeMonths(opNode),
      getNodeMonths(sellOutNode),
      getNodeMonths(opNode),
      getNodeMonths(sellOutNode)
    ).currMonth;
  }

  return {
    monthly,
    annual: result.currYearTotal,
  };
}

interface PLPageProps {
  locale?: 'ko' | 'en';
}

export default function PLPage({ locale = 'ko' }: PLPageProps) {
  const isEnglish = locale === 'en';
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [goodScenarioPercent, setGoodScenarioPercent] = useState<number>(120);
  const [badScenarioPercent, setBadScenarioPercent] = useState<number>(80);
  const [selectedYear, setSelectedYear] = useState<Year>(2026);
  const [baseMonthIndex, setBaseMonthIndex] = useState<number>(2);
  const [isExpandedAll, setIsExpandedAll] = useState<boolean>(false);
  const [showMonthly, setShowMonthly] = useState<boolean>(false);
  const [showYTD, setShowYTD] = useState<boolean>(true);
  const [showAnnualOnly, setShowAnnualOnly] = useState<boolean>(false);
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
        setError(isEnglish ? 'Failed to load P/L data.' : '손익 데이터를 불러오지 못했습니다.');
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
  const annualScenarioTrees = useMemo(
    () =>
      selectedYear === 2026
        ? buildScenarioTreeSet({
            HK_MLB: trees2026.HK_MLB,
            HK_Discovery: trees2026.HK_Discovery,
            TW_MLB: trees2026.TW_MLB,
            TW_Discovery: trees2026.TW_Discovery,
          }, goodScenarioPercent / 100, badScenarioPercent / 100)
        : null,
    [badScenarioPercent, goodScenarioPercent, selectedYear, trees2026]
  );
  const exportPayload = useMemo(() => {
    if (selectedYear !== 2026 || !annualScenarioTrees) {
      return {
        year: 2026,
        exportedAt: new Date().toISOString(),
        actual: {
          Total: trees2026.Total,
          HK_MLB: trees2026.HK_MLB,
          HK_Discovery: trees2026.HK_Discovery,
          TW_MLB: trees2026.TW_MLB,
          TW_Discovery: trees2026.TW_Discovery,
        },
      };
    }

    return {
      year: 2026,
      exportedAt: new Date().toISOString(),
      actual: {
        Total: trees2026.Total,
        HK_MLB: trees2026.HK_MLB,
        HK_Discovery: trees2026.HK_Discovery,
        TW_MLB: trees2026.TW_MLB,
        TW_Discovery: trees2026.TW_Discovery,
      },
      scenarios: {
        [`good_${goodScenarioPercent}pct_of_current`]: {
          Total: annualScenarioTrees.total.good,
          HK_MLB: annualScenarioTrees.detail.HK_MLB.good,
          HK_Discovery: annualScenarioTrees.detail.HK_Discovery.good,
          TW_MLB: annualScenarioTrees.detail.TW_MLB.good,
          TW_Discovery: annualScenarioTrees.detail.TW_Discovery.good,
        },
        [`bad_${badScenarioPercent}pct_of_current`]: {
          Total: annualScenarioTrees.total.bad,
          HK_MLB: annualScenarioTrees.detail.HK_MLB.bad,
          HK_Discovery: annualScenarioTrees.detail.HK_Discovery.bad,
          TW_MLB: annualScenarioTrees.detail.TW_MLB.bad,
          TW_Discovery: annualScenarioTrees.detail.TW_Discovery.bad,
        },
      },
      derivedMetrics: {
        operatingMargin: {
          actual: {
            Total: getOperatingMarginSnapshot(trees2026.Total),
            HK_MLB: getOperatingMarginSnapshot(trees2026.HK_MLB),
            HK_Discovery: getOperatingMarginSnapshot(trees2026.HK_Discovery),
            TW_MLB: getOperatingMarginSnapshot(trees2026.TW_MLB),
            TW_Discovery: getOperatingMarginSnapshot(trees2026.TW_Discovery),
          },
          [`good_${goodScenarioPercent}pct_of_current`]: {
            Total: getOperatingMarginSnapshot(annualScenarioTrees.total.good),
            HK_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_MLB.good),
            HK_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_Discovery.good),
            TW_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_MLB.good),
            TW_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_Discovery.good),
          },
          [`bad_${badScenarioPercent}pct_of_current`]: {
            Total: getOperatingMarginSnapshot(annualScenarioTrees.total.bad),
            HK_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_MLB.bad),
            HK_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_Discovery.bad),
            TW_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_MLB.bad),
            TW_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_Discovery.bad),
          },
        },
      },
      scenarioControls: {
        goodPercentOfCurrent: goodScenarioPercent,
        badPercentOfCurrent: badScenarioPercent,
        stepPercent: 10,
      },
    };
  }, [annualScenarioTrees, badScenarioPercent, goodScenarioPercent, selectedYear, trees2026]);

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pl_2026_monthly_by_brand.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-300 px-6 py-4">
        <div className="flex items-center justify-between gap-6">
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
                  {isEnglish ? year : `${year}년`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">{isEnglish ? 'Base Month' : '기준월'}</label>
              <select
                value={baseMonthIndex}
                onChange={(e) => setBaseMonthIndex(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded bg-white text-sm"
              >
                {months.map((month) => (
                  <option key={month} value={month}>
                    {isEnglish ? monthNamesEn[month - 1] : `${month}월`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportJson}
              className="px-4 py-2 rounded font-medium border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              {isEnglish ? 'JSON' : 'json파일로 내보내기'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 border-b border-gray-300 px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleAll}
            className="px-4 py-2 bg-gray-700 text-white rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {isExpandedAll ? (isEnglish ? 'Collapse ▲' : '접기 ▲') : (isEnglish ? 'Expand ▼' : '펼치기 ▼')}
          </button>

          <button
            onClick={() => setShowMonthly((prev) => !prev)}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            {isEnglish ? `Mo. ${showMonthly ? 'Hide ◀' : 'Show ▶'}` : `월별 데이터 ${showMonthly ? '접기 ◀' : '펼치기 ▶'}`}
          </button>

          <button
            onClick={() => setShowYTD((prev) => !prev)}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            {showYTD ? (isEnglish ? 'Hide YTD' : 'YTD 숨기기 (현재 전체보기)') : (isEnglish ? 'Show YTD' : 'YTD 보기 (현재 전체보기)')}
          </button>

          <button
            onClick={() =>
              setShowAnnualOnly((prev) => {
                const next = !prev;
                if (!next) {
                  setShowMonthly(false);
                }
                return next;
              })
            }
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            {showAnnualOnly ? (isEnglish ? 'Show Full View' : '전체 보기') : (isEnglish ? 'Annual Only' : '연간만 보기')}
          </button>

          <span className="text-xs text-gray-500 ml-2">{isEnglish ? '(Comp cols fixed)' : '(비교 컬럼은 항상 표시됩니다)'}</span>
        </div>
      </div>

      <div className="p-6">
        {loading && <div className="text-center py-12 text-gray-600">{isEnglish ? 'Loading...' : '로딩 중...'}</div>}
        {error && <div className="text-center py-12 text-red-600">{error}</div>}

        {!loading && !error && (
          <PLTable
            locale={locale}
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
            annualScenarioTrees={annualScenarioTrees}
            baseMonthIndex={baseMonthIndex}
            showMonthly={showMonthly}
            showYTD={showYTD}
            annualOnly={showAnnualOnly}
            goodScenarioPercent={goodScenarioPercent}
            badScenarioPercent={badScenarioPercent}
            defaultGoodScenarioPercent={120}
            defaultBadScenarioPercent={80}
            onGoodScenarioChange={setGoodScenarioPercent}
            onBadScenarioChange={setBadScenarioPercent}
            isExpandedAll={isExpandedAll}
            onToggleNode={handleToggleNode}
            expandedNodes={expandedNodes}
          />
        )}
      </div>
    </div>
  );
}
