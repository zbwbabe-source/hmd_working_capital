'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import PLTable from '@/components/PLTable';
import { calcRateColsFromNumerDenom, type Months } from '@/PL/src/pl/calc';
import { buildScenarioTreeSet, type ScenarioFactorMap } from '@/PL/src/pl/scenario';
import type { Node } from '@/PL/src/pl/tree';
import type { MonthKey, Source, Year } from '@/PL/src/pl/types';
import { translateFinanceLabel } from '@/lib/translate-finance-label';

const DETAIL_SOURCES: Source[] = ['HK_MLB', 'HK_Discovery', 'TW_MLB', 'TW_Discovery'];
const ALL_SOURCES: Source[] = ['Total', ...DETAIL_SOURCES];
const DEFAULT_GOOD_PERCENT = 120;
const DEFAULT_BAD_PERCENT = 80;

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

function pickMonthValue(months: Record<MonthKey, number>, monthKey: MonthKey): number {
  return months[monthKey] ?? 0;
}

function sumMonthValues(months: Record<MonthKey, number>): number {
  return (Object.values(months) as number[]).reduce((sum, value) => sum + (value || 0), 0);
}

function getNodeValue(tree: Node[], key: string, monthKey?: MonthKey): number {
  const node = buildNodeMap(tree).get(key);
  if (!node) return 0;
  if (monthKey) return pickMonthValue(node.rollup, monthKey);
  return sumMonthValues(node.rollup);
}

function calculateYoYRatio(current: number, previous: number): number | null {
  if (!previous) return null;
  return current / previous;
}

function buildPlResultSnapshot(currentTree: Node[], previousTree: Node[], monthKey?: MonthKey) {
  const sellOut = getNodeValue(currentTree, 'L1|실판매출', monthKey);
  const previousSellOut = getNodeValue(previousTree, 'L1|실판매출', monthKey);
  const tagSales = getNodeValue(currentTree, 'L1|TAG매출', monthKey);
  const previousTagSales = getNodeValue(previousTree, 'L1|TAG매출', monthKey);
  const cogs = getNodeValue(currentTree, 'L1|매출원가', monthKey);
  const previousCogs = getNodeValue(previousTree, 'L1|매출원가', monthKey);
  const operatingProfit = getNodeValue(currentTree, 'L1|영업이익', monthKey);
  const previousOperatingProfit = getNodeValue(previousTree, 'L1|영업이익', monthKey);
  const operatingMarginSnapshot = getOperatingMarginSnapshot(currentTree);
  const previousOperatingMarginSnapshot = getOperatingMarginSnapshot(previousTree);
  const operatingMargin = monthKey
    ? operatingMarginSnapshot.monthly[monthKey] ?? 0
    : operatingMarginSnapshot.annual;
  const previousOperatingMargin = monthKey
    ? previousOperatingMarginSnapshot.monthly[monthKey] ?? 0
    : previousOperatingMarginSnapshot.annual;

  return {
    sellOut: {
      value: sellOut,
      yoyRatioVs2025: calculateYoYRatio(sellOut, previousSellOut),
    },
    tagSales: {
      value: tagSales,
      yoyRatioVs2025: calculateYoYRatio(tagSales, previousTagSales),
    },
    cogs: {
      value: cogs,
      yoyRatioVs2025: calculateYoYRatio(cogs, previousCogs),
    },
    operatingProfit: {
      value: operatingProfit,
      yoyRatioVs2025: calculateYoYRatio(operatingProfit, previousOperatingProfit),
    },
    operatingMargin: {
      value: operatingMargin,
      yoyRatioVs2025: calculateYoYRatio(operatingMargin, previousOperatingMargin),
    },
  };
}

type BaseMonthTreeNode = {
  key: string;
  label: string;
  level: 1 | 2 | 3;
  value: number;
  hasRateRow: boolean;
  rows?: Array<{
    year: Year;
    source: Source;
    lvl1: string;
    lvl2: string;
    lvl3: string | null;
    value: number;
    isRateRow: boolean;
  }>;
  children?: BaseMonthTreeNode[];
};

function buildBaseMonthTree(nodes: Node[], monthKey: MonthKey): BaseMonthTreeNode[] {
  return nodes.map((node) => ({
    key: node.key,
    label: node.label,
    level: node.level,
    value: pickMonthValue(node.rollup, monthKey),
    hasRateRow: node.hasRateRow,
    rows: node.rows?.map((row) => ({
      year: row.year,
      source: row.source,
      lvl1: row.lvl1,
      lvl2: row.lvl2,
      lvl3: row.lvl3,
      value: pickMonthValue(row.months, monthKey),
      isRateRow: row.isRateRow,
    })),
    children: node.children ? buildBaseMonthTree(node.children, monthKey) : undefined,
  }));
}

function flattenPlNodes(nodes: Node[], depth: number = 0): Array<Node & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...(node.children ? flattenPlNodes(node.children, depth + 1) : []),
  ]);
}

interface PLPageProps {
  locale?: 'ko' | 'en';
}

export default function PLPage({ locale = 'ko' }: PLPageProps) {
  const isEnglish = locale === 'en';
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [goodScenarioPercent, setGoodScenarioPercent] = useState<number>(DEFAULT_GOOD_PERCENT);
  const [badScenarioPercent, setBadScenarioPercent] = useState<number>(DEFAULT_BAD_PERCENT);
  const [detailGoodScenarioPercent, setDetailGoodScenarioPercent] = useState<ScenarioFactorMap>({
    HK_MLB: DEFAULT_GOOD_PERCENT,
    HK_Discovery: DEFAULT_GOOD_PERCENT,
    TW_MLB: DEFAULT_GOOD_PERCENT,
    TW_Discovery: DEFAULT_GOOD_PERCENT,
  });
  const [detailBadScenarioPercent, setDetailBadScenarioPercent] = useState<ScenarioFactorMap>({
    HK_MLB: DEFAULT_BAD_PERCENT,
    HK_Discovery: DEFAULT_BAD_PERCENT,
    TW_MLB: DEFAULT_BAD_PERCENT,
    TW_Discovery: DEFAULT_BAD_PERCENT,
  });
  const [selectedYear, setSelectedYear] = useState<Year>(2026);
  const [baseMonthIndex, setBaseMonthIndex] = useState<number>(4);
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
          },
          {
            HK_MLB: detailGoodScenarioPercent.HK_MLB / 100,
            HK_Discovery: detailGoodScenarioPercent.HK_Discovery / 100,
            TW_MLB: detailGoodScenarioPercent.TW_MLB / 100,
            TW_Discovery: detailGoodScenarioPercent.TW_Discovery / 100,
          },
          {
            HK_MLB: detailBadScenarioPercent.HK_MLB / 100,
            HK_Discovery: detailBadScenarioPercent.HK_Discovery / 100,
            TW_MLB: detailBadScenarioPercent.TW_MLB / 100,
            TW_Discovery: detailBadScenarioPercent.TW_Discovery / 100,
          })
        : null,
    [detailBadScenarioPercent, detailGoodScenarioPercent, selectedYear, trees2026]
  );
  const baseMonthKey = `m${baseMonthIndex}` as MonthKey;
  const annualResultSummary = useMemo(() => {
    if (selectedYear !== 2026 || !annualScenarioTrees) return null;

    return {
      comparisonBaseYear: 2025,
      actual: {
        Total: buildPlResultSnapshot(trees2026.Total, trees2025.Total),
        HK_MLB: buildPlResultSnapshot(trees2026.HK_MLB, trees2025.HK_MLB),
        HK_Discovery: buildPlResultSnapshot(trees2026.HK_Discovery, trees2025.HK_Discovery),
        TW_MLB: buildPlResultSnapshot(trees2026.TW_MLB, trees2025.TW_MLB),
        TW_Discovery: buildPlResultSnapshot(trees2026.TW_Discovery, trees2025.TW_Discovery),
      },
      scenarios: {
        [`good_${goodScenarioPercent}pct_of_current`]: {
          Total: buildPlResultSnapshot(annualScenarioTrees.total.good, trees2025.Total),
          HK_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.HK_MLB.good, trees2025.HK_MLB),
          HK_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.HK_Discovery.good, trees2025.HK_Discovery),
          TW_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.TW_MLB.good, trees2025.TW_MLB),
          TW_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.TW_Discovery.good, trees2025.TW_Discovery),
        },
        [`bad_${badScenarioPercent}pct_of_current`]: {
          Total: buildPlResultSnapshot(annualScenarioTrees.total.bad, trees2025.Total),
          HK_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.HK_MLB.bad, trees2025.HK_MLB),
          HK_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.HK_Discovery.bad, trees2025.HK_Discovery),
          TW_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.TW_MLB.bad, trees2025.TW_MLB),
          TW_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.TW_Discovery.bad, trees2025.TW_Discovery),
        },
      },
    };
  }, [annualScenarioTrees, badScenarioPercent, goodScenarioPercent, selectedYear, trees2025, trees2026]);

  const baseMonthResultSummary = useMemo(() => {
    if (selectedYear !== 2026 || !annualScenarioTrees) return null;

    return {
      comparisonBaseYear: 2025,
      baseMonth: baseMonthIndex,
      actual: {
        Total: buildPlResultSnapshot(trees2026.Total, trees2025.Total, baseMonthKey),
        HK_MLB: buildPlResultSnapshot(trees2026.HK_MLB, trees2025.HK_MLB, baseMonthKey),
        HK_Discovery: buildPlResultSnapshot(trees2026.HK_Discovery, trees2025.HK_Discovery, baseMonthKey),
        TW_MLB: buildPlResultSnapshot(trees2026.TW_MLB, trees2025.TW_MLB, baseMonthKey),
        TW_Discovery: buildPlResultSnapshot(trees2026.TW_Discovery, trees2025.TW_Discovery, baseMonthKey),
      },
      scenarios: {
        [`good_${goodScenarioPercent}pct_of_current`]: {
          Total: buildPlResultSnapshot(annualScenarioTrees.total.good, trees2025.Total, baseMonthKey),
          HK_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.HK_MLB.good, trees2025.HK_MLB, baseMonthKey),
          HK_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.HK_Discovery.good, trees2025.HK_Discovery, baseMonthKey),
          TW_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.TW_MLB.good, trees2025.TW_MLB, baseMonthKey),
          TW_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.TW_Discovery.good, trees2025.TW_Discovery, baseMonthKey),
        },
        [`bad_${badScenarioPercent}pct_of_current`]: {
          Total: buildPlResultSnapshot(annualScenarioTrees.total.bad, trees2025.Total, baseMonthKey),
          HK_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.HK_MLB.bad, trees2025.HK_MLB, baseMonthKey),
          HK_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.HK_Discovery.bad, trees2025.HK_Discovery, baseMonthKey),
          TW_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.TW_MLB.bad, trees2025.TW_MLB, baseMonthKey),
          TW_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.TW_Discovery.bad, trees2025.TW_Discovery, baseMonthKey),
        },
      },
    };
  }, [annualScenarioTrees, badScenarioPercent, baseMonthIndex, baseMonthKey, goodScenarioPercent, selectedYear, trees2025, trees2026]);

  const exportPayload = useMemo(() => {
    if (selectedYear !== 2026 || !annualScenarioTrees) {
      return {
        exportType: 'full',
        year: 2026,
        baseMonth: baseMonthIndex,
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
      exportType: 'full',
      year: 2026,
      baseMonth: baseMonthIndex,
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
        detailGoodPercentOfCurrent: detailGoodScenarioPercent,
        detailBadPercentOfCurrent: detailBadScenarioPercent,
        stepPercent: 10,
      },
      resultSummary: annualResultSummary,
    };
  }, [annualResultSummary, annualScenarioTrees, badScenarioPercent, baseMonthIndex, detailBadScenarioPercent, detailGoodScenarioPercent, goodScenarioPercent, selectedYear, trees2026]);
  const baseMonthExportPayload = useMemo(() => {
    const actual = {
      Total: buildBaseMonthTree(trees2026.Total, baseMonthKey),
      HK_MLB: buildBaseMonthTree(trees2026.HK_MLB, baseMonthKey),
      HK_Discovery: buildBaseMonthTree(trees2026.HK_Discovery, baseMonthKey),
      TW_MLB: buildBaseMonthTree(trees2026.TW_MLB, baseMonthKey),
      TW_Discovery: buildBaseMonthTree(trees2026.TW_Discovery, baseMonthKey),
    };

    const payload: Record<string, unknown> = {
      exportType: 'base-month',
      year: 2026,
      baseMonth: baseMonthIndex,
      exportedAt: new Date().toISOString(),
      actual,
      derivedMetrics: {
        operatingMargin: {
          actual: {
            Total: getOperatingMarginSnapshot(trees2026.Total).monthly[baseMonthKey] ?? 0,
            HK_MLB: getOperatingMarginSnapshot(trees2026.HK_MLB).monthly[baseMonthKey] ?? 0,
            HK_Discovery: getOperatingMarginSnapshot(trees2026.HK_Discovery).monthly[baseMonthKey] ?? 0,
            TW_MLB: getOperatingMarginSnapshot(trees2026.TW_MLB).monthly[baseMonthKey] ?? 0,
            TW_Discovery: getOperatingMarginSnapshot(trees2026.TW_Discovery).monthly[baseMonthKey] ?? 0,
          },
        },
      },
    };

    if (selectedYear === 2026 && annualScenarioTrees) {
      payload.scenarios = {
        [`good_${goodScenarioPercent}pct_of_current`]: {
          Total: buildBaseMonthTree(annualScenarioTrees.total.good, baseMonthKey),
          HK_MLB: buildBaseMonthTree(annualScenarioTrees.detail.HK_MLB.good, baseMonthKey),
          HK_Discovery: buildBaseMonthTree(annualScenarioTrees.detail.HK_Discovery.good, baseMonthKey),
          TW_MLB: buildBaseMonthTree(annualScenarioTrees.detail.TW_MLB.good, baseMonthKey),
          TW_Discovery: buildBaseMonthTree(annualScenarioTrees.detail.TW_Discovery.good, baseMonthKey),
        },
        [`bad_${badScenarioPercent}pct_of_current`]: {
          Total: buildBaseMonthTree(annualScenarioTrees.total.bad, baseMonthKey),
          HK_MLB: buildBaseMonthTree(annualScenarioTrees.detail.HK_MLB.bad, baseMonthKey),
          HK_Discovery: buildBaseMonthTree(annualScenarioTrees.detail.HK_Discovery.bad, baseMonthKey),
          TW_MLB: buildBaseMonthTree(annualScenarioTrees.detail.TW_MLB.bad, baseMonthKey),
          TW_Discovery: buildBaseMonthTree(annualScenarioTrees.detail.TW_Discovery.bad, baseMonthKey),
        },
      };
      payload.derivedMetrics = {
        operatingMargin: {
          actual: {
            Total: getOperatingMarginSnapshot(trees2026.Total).monthly[baseMonthKey] ?? 0,
            HK_MLB: getOperatingMarginSnapshot(trees2026.HK_MLB).monthly[baseMonthKey] ?? 0,
            HK_Discovery: getOperatingMarginSnapshot(trees2026.HK_Discovery).monthly[baseMonthKey] ?? 0,
            TW_MLB: getOperatingMarginSnapshot(trees2026.TW_MLB).monthly[baseMonthKey] ?? 0,
            TW_Discovery: getOperatingMarginSnapshot(trees2026.TW_Discovery).monthly[baseMonthKey] ?? 0,
          },
          [`good_${goodScenarioPercent}pct_of_current`]: {
            Total: getOperatingMarginSnapshot(annualScenarioTrees.total.good).monthly[baseMonthKey] ?? 0,
            HK_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_MLB.good).monthly[baseMonthKey] ?? 0,
            HK_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_Discovery.good).monthly[baseMonthKey] ?? 0,
            TW_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_MLB.good).monthly[baseMonthKey] ?? 0,
            TW_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_Discovery.good).monthly[baseMonthKey] ?? 0,
          },
          [`bad_${badScenarioPercent}pct_of_current`]: {
            Total: getOperatingMarginSnapshot(annualScenarioTrees.total.bad).monthly[baseMonthKey] ?? 0,
            HK_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_MLB.bad).monthly[baseMonthKey] ?? 0,
            HK_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_Discovery.bad).monthly[baseMonthKey] ?? 0,
            TW_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_MLB.bad).monthly[baseMonthKey] ?? 0,
            TW_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_Discovery.bad).monthly[baseMonthKey] ?? 0,
          },
        },
      };
      payload.scenarioControls = {
        goodPercentOfCurrent: goodScenarioPercent,
        badPercentOfCurrent: badScenarioPercent,
        detailGoodPercentOfCurrent: detailGoodScenarioPercent,
        detailBadPercentOfCurrent: detailBadScenarioPercent,
        stepPercent: 10,
      };
      payload.resultSummary = baseMonthResultSummary;
    }

    return payload;
  }, [annualScenarioTrees, badScenarioPercent, baseMonthIndex, baseMonthKey, baseMonthResultSummary, detailBadScenarioPercent, detailGoodScenarioPercent, goodScenarioPercent, selectedYear, trees2026]);
  const isScenarioAdjusted =
    goodScenarioPercent !== DEFAULT_GOOD_PERCENT || badScenarioPercent !== DEFAULT_BAD_PERCENT;

  const handleGoodScenarioChange = (next: number) => {
    setGoodScenarioPercent(next);
    setDetailGoodScenarioPercent({
      HK_MLB: next,
      HK_Discovery: next,
      TW_MLB: next,
      TW_Discovery: next,
    });
  };

  const handleBadScenarioChange = (next: number) => {
    setBadScenarioPercent(next);
    setDetailBadScenarioPercent({
      HK_MLB: next,
      HK_Discovery: next,
      TW_MLB: next,
      TW_Discovery: next,
    });
  };

  const handleDetailGoodScenarioChange = (source: keyof ScenarioFactorMap, next: number) => {
    setDetailGoodScenarioPercent((prev) => ({
      ...prev,
      [source]: next,
    }));
  };

  const handleDetailBadScenarioChange = (source: keyof ScenarioFactorMap, next: number) => {
    setDetailBadScenarioPercent((prev) => ({
      ...prev,
      [source]: next,
    }));
  };

  const downloadJson = (payload: unknown, fileName: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportFullJson = () => {
    downloadJson(exportPayload, `pl_2026_full.json`);
  };

  const handleExportBaseMonthJson = () => {
    downloadJson(baseMonthExportPayload, `pl_2026_base-month_m${baseMonthIndex}.json`);
  };

  const buildPlExcelRows = useCallback((source: Source, prevTree: Node[], currTree: Node[]) => {
    const prevMap = buildNodeMap(prevTree);
    const currentRows = flattenPlNodes(currTree);
    const goodMap =
      source === 'Total'
        ? buildNodeMap(annualScenarioTrees?.total.good ?? [])
        : buildNodeMap(annualScenarioTrees?.detail[source as keyof ScenarioFactorMap]?.good ?? []);
    const badMap =
      source === 'Total'
        ? buildNodeMap(annualScenarioTrees?.total.bad ?? [])
        : buildNodeMap(annualScenarioTrees?.detail[source as keyof ScenarioFactorMap]?.bad ?? []);

    const accountKey = isEnglish ? 'Account' : '계정과목';
    const levelKey = isEnglish ? 'Level' : '레벨';
    const prevTotalKey = isEnglish ? '25 Total' : '25년 합계';
    const ytdKey = isEnglish ? `26 YTD ${baseMonthIndex}M` : `26년 ${baseMonthIndex}월 YTD`;
    const rollingKey = isEnglish ? '26 Rolling' : '26년 롤링';
    const yoyKey = isEnglish ? '26 Rolling YoY' : '26년 롤링 YoY';
    const goodKey = isEnglish ? `Good ${goodScenarioPercent}%` : `Good ${goodScenarioPercent}%`;
    const badKey = isEnglish ? `Bad ${badScenarioPercent}%` : `Bad ${badScenarioPercent}%`;
    const typeKey = isEnglish ? 'Type' : '유형';
    const monthHeaders = Array.from({ length: 12 }, (_, i) =>
      isEnglish ? `${i + 1}M` : `${i + 1}월`
    );

    return currentRows.map((node) => {
      const months = getNodeMonths(node);
      const prevMonths = getNodeMonths(prevMap.get(node.key));
      const goodMonths = getNodeMonths(goodMap.get(node.key));
      const badMonths = getNodeMonths(badMap.get(node.key));
      const currentTotal = sumMonthValues(months);
      const previousTotal = sumMonthValues(prevMonths);
      const row: Record<string, string | number | null> = {
        [accountKey]: `${'  '.repeat(node.depth)}${isEnglish ? translateFinanceLabel(node.label, 'short') : node.label}`,
        [levelKey]: node.level,
        [typeKey]: node.hasRateRow ? (isEnglish ? 'Rate' : '비율') : (isEnglish ? 'Amount' : '금액'),
        [prevTotalKey]: previousTotal,
      };

      monthHeaders.forEach((header, index) => {
        row[header] = months[`m${index + 1}` as MonthKey] ?? 0;
      });

      row[ytdKey] = Array.from({ length: baseMonthIndex }, (_, i) => months[`m${i + 1}` as MonthKey] ?? 0)
        .reduce((sum, value) => sum + value, 0);
      row[rollingKey] = currentTotal;
      row[yoyKey] = previousTotal ? `${Math.round((currentTotal / previousTotal) * 100)}%` : null;
      row[goodKey] = sumMonthValues(goodMonths);
      row[badKey] = sumMonthValues(badMonths);

      return row;
    });
  }, [annualScenarioTrees, badScenarioPercent, baseMonthIndex, goodScenarioPercent, isEnglish]);

  const appendPlSheet = useCallback((workbook: XLSX.WorkBook, sheetName: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = Object.keys(rows[0]).map((key) => ({
      wch: key === '계정과목' || key === 'Account' ? 34 : 14,
    }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  }, []);

  const handleExportExcel = useCallback(() => {
    const workbook = XLSX.utils.book_new();
    const sourceConfig: Array<{ source: Source; label: string; prev: Node[]; curr: Node[] }> = [
      { source: 'Total', label: isEnglish ? 'PL Total' : 'PL 전체', prev: trees2025.Total, curr: trees2026.Total },
      { source: 'HK_MLB', label: isEnglish ? 'HK MLB' : '홍콩 MLB', prev: trees2025.HK_MLB, curr: trees2026.HK_MLB },
      { source: 'HK_Discovery', label: isEnglish ? 'HK DX' : '홍콩 DX', prev: trees2025.HK_Discovery, curr: trees2026.HK_Discovery },
      { source: 'TW_MLB', label: isEnglish ? 'TW MLB' : '대만 MLB', prev: trees2025.TW_MLB, curr: trees2026.TW_MLB },
      { source: 'TW_Discovery', label: isEnglish ? 'TW DX' : '대만 DX', prev: trees2025.TW_Discovery, curr: trees2026.TW_Discovery },
    ];

    sourceConfig.forEach((config) => {
      appendPlSheet(workbook, config.label, buildPlExcelRows(config.source, config.prev, config.curr));
    });

    if (workbook.SheetNames.length === 0) {
      alert(isEnglish ? 'No P/L data to export.' : '내보낼 PL 데이터가 없습니다.');
      return;
    }

    XLSX.writeFile(workbook, `fnf_dashboard_pl_2026_m${baseMonthIndex}.xlsx`);
  }, [appendPlSheet, baseMonthIndex, buildPlExcelRows, isEnglish, trees2025, trees2026]);

  useEffect(() => {
    window.addEventListener('dashboard:export-pl-excel', handleExportExcel);
    return () => window.removeEventListener('dashboard:export-pl-excel', handleExportExcel);
  }, [handleExportExcel]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b border-slate-200 bg-white/80 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-sm">
              {years.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`inline-flex h-10 min-w-[76px] items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors ${
                    selectedYear === year
                      ? 'border border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.12)]'
                      : 'border border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white'
                  }`}
                >
                  {isEnglish ? year : `${year}년`}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-1 shadow-sm">
              <label className="text-sm font-semibold text-slate-700">{isEnglish ? 'Base Month' : '기준월'}</label>
              <select
                value={baseMonthIndex}
                onChange={(e) => setBaseMonthIndex(Number(e.target.value))}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-colors hover:bg-slate-50"
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
              onClick={handleExportExcel}
              className="px-4 py-2 rounded font-medium border border-blue-300 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {isEnglish ? 'Excel' : '엑셀'}
            </button>
            <button
              onClick={handleExportBaseMonthJson}
              className="px-4 py-2 rounded font-medium border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              {isEnglish ? 'Base Month JSON' : '당월 json'}
            </button>
            <button
              onClick={handleExportFullJson}
              className="px-4 py-2 rounded font-medium border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              {isEnglish ? 'Full JSON' : '전체 json'}
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm">
          <button
            onClick={handleToggleAll}
            className={`inline-flex h-10 min-w-[112px] items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors ${
              !isExpandedAll
                ? 'border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.12)]'
                : 'border-transparent bg-slate-700 text-white hover:bg-slate-800'
            }`}
          >
            {isExpandedAll ? (isEnglish ? 'Collapse ▲' : '접기 ▲') : (isEnglish ? 'Expand ▼' : '펼치기 ▼')}
          </button>

          <button
            onClick={() => setShowMonthly((prev) => !prev)}
            className={`inline-flex h-10 min-w-[142px] items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors ${
              showMonthly
                ? 'border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.12)]'
                : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isEnglish ? `Mo. ${showMonthly ? 'Hide ◀' : 'Show ▶'}` : `월별 데이터 ${showMonthly ? '접기 ◀' : '펼치기 ▶'}`}
          </button>

          <button
            onClick={() => setShowYTD((prev) => !prev)}
            className={`inline-flex h-10 min-w-[116px] items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors ${
              showYTD
                ? 'border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.12)]'
                : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
            }`}
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
            className={`inline-flex h-10 min-w-[122px] items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors ${
              showAnnualOnly
                ? 'border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.12)]'
                : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
            }`}
          >
            {showAnnualOnly ? (isEnglish ? 'Show Full View' : '전체 보기') : (isEnglish ? 'Annual Only' : '연간만 보기')}
          </button>
          </div>

          <a
            href="https://hmdstoretrend.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-blue-300 bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            {isEnglish ? '2026 Store Trend View' : '2026년 매장별 추세보기'}
          </a>

          <div className="ml-auto flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <span className="font-medium text-gray-600">{isEnglish ? 'Operating Scenario' : '영업상황 Scenario'}</span>

            <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-900">
              <span className="text-sm font-semibold">{isEnglish ? 'Upside' : '상향'}</span>
              <span className="min-w-[42px] text-center text-[15px] font-bold leading-none">{goodScenarioPercent}%</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-emerald-300 bg-transparent text-[12px] font-bold text-emerald-800 hover:bg-white/80 disabled:opacity-40"
                  onClick={() => handleGoodScenarioChange(Math.max(110, goodScenarioPercent - 10))}
                  disabled={goodScenarioPercent <= 110}
                >
                  -
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-emerald-300 bg-transparent text-[12px] font-bold text-emerald-800 hover:bg-white/80 disabled:opacity-40"
                  onClick={() => handleGoodScenarioChange(Math.min(150, goodScenarioPercent + 10))}
                  disabled={goodScenarioPercent >= 150}
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900">
              <span className="text-sm font-semibold">{isEnglish ? 'Downside' : '하향'}</span>
              <span className="min-w-[42px] text-center text-[15px] font-bold leading-none">{badScenarioPercent}%</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-amber-300 bg-transparent text-[12px] font-bold text-amber-800 hover:bg-white/80 disabled:opacity-40"
                  onClick={() => handleBadScenarioChange(Math.max(70, badScenarioPercent - 10))}
                  disabled={badScenarioPercent <= 70}
                >
                  -
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-amber-300 bg-transparent text-[12px] font-bold text-amber-800 hover:bg-white/80 disabled:opacity-40"
                  onClick={() => handleBadScenarioChange(Math.min(90, badScenarioPercent + 10))}
                  disabled={badScenarioPercent >= 90}
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              className={`inline-flex h-8 items-center justify-center rounded border px-3 text-sm font-medium transition-colors ${
                isScenarioAdjusted
                  ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  : 'border-transparent bg-transparent text-transparent pointer-events-none'
              }`}
              onClick={() => {
                handleGoodScenarioChange(DEFAULT_GOOD_PERCENT);
                handleBadScenarioChange(DEFAULT_BAD_PERCENT);
              }}
              aria-hidden={!isScenarioAdjusted}
              tabIndex={isScenarioAdjusted ? 0 : -1}
            >
              {isEnglish ? 'Reset' : '되돌리기'}
            </button>
          </div>

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
            detailGoodScenarioPercent={detailGoodScenarioPercent}
            detailBadScenarioPercent={detailBadScenarioPercent}
            defaultGoodScenarioPercent={DEFAULT_GOOD_PERCENT}
            defaultBadScenarioPercent={DEFAULT_BAD_PERCENT}
            onDetailGoodScenarioChange={handleDetailGoodScenarioChange}
            onDetailBadScenarioChange={handleDetailBadScenarioChange}
            isExpandedAll={isExpandedAll}
            onToggleNode={handleToggleNode}
            expandedNodes={expandedNodes}
          />
        )}
      </div>
    </div>
  );
}
