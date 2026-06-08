'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import PLTable from '@/components/PLTable';
import { calcRateColsFromNumerDenom, type Months } from '@/PL/src/pl/calc';
import { buildScenarioTreeSet, type ScenarioFactorMap, type ScenarioMonthlyFactorMap } from '@/PL/src/pl/scenario';
import type { Node } from '@/PL/src/pl/tree';
import type { MonthKey, Source, Year } from '@/PL/src/pl/types';
import { translateFinanceLabel } from '@/lib/translate-finance-label';

type DetailSource = Exclude<Source, 'Total'>;

const DETAIL_SOURCES: DetailSource[] = ['HK_MLB', 'HK_Discovery', 'TW_MLB', 'TW_Discovery'];
const ALL_SOURCES: Source[] = ['Total', ...DETAIL_SOURCES];
const MONTH_KEYS: MonthKey[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'];

type ScenarioFactorId = 'typhoon' | 'rain' | 'fw' | 'china_economy' | 'fx' | 'tourism' | 'taiwan_politics' | 'new_stores';
type ScenarioDirection = 'positive' | 'negative' | 'none';

type ScenarioFactor = {
  id: ScenarioFactorId;
  titleKo: string;
  titleEn: string;
  subtitleKo?: string;
  subtitleEn?: string;
  positiveLabelKo: string;
  positiveLabelEn: string;
  negativeLabelKo: string;
  negativeLabelEn: string;
  impactPercent: number;
  months: MonthKey[];
  sources?: DetailSource[];
};

const HKMC_SOURCES: DetailSource[] = ['HK_MLB', 'HK_Discovery'];
const TAIWAN_SOURCES: DetailSource[] = ['TW_MLB', 'TW_Discovery'];

const PL_SCENARIO_FACTORS: ScenarioFactor[] = [
  {
    id: 'typhoon',
    titleKo: '태풍 빈도',
    titleEn: 'Typhoon',
    positiveLabelKo: '태풍빈도 감소',
    positiveLabelEn: 'Lower',
    negativeLabelKo: '태풍빈도 증가',
    negativeLabelEn: 'Stronger',
    impactPercent: 10,
    months: ['m7', 'm8', 'm9', 'm10'],
  },
  {
    id: 'rain',
    titleKo: '폭우 빈도',
    titleEn: 'Rainfall',
    positiveLabelKo: '폭우 빈도 감소',
    positiveLabelEn: 'Lower',
    negativeLabelKo: '폭우 빈도 증가',
    negativeLabelEn: 'Heavier',
    impactPercent: 5,
    months: ['m6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'],
  },
  {
    id: 'fw',
    titleKo: '26FW 판매',
    titleEn: '26FW',
    positiveLabelKo: '26FW 판매 호조',
    positiveLabelEn: 'Strong',
    negativeLabelKo: '26FW 판매 저조',
    negativeLabelEn: 'Weak',
    impactPercent: 10,
    months: ['m8', 'm9', 'm10', 'm11', 'm12'],
  },
  {
    id: 'china_economy',
    titleKo: '중국경기',
    titleEn: 'China',
    positiveLabelKo: '중국경기 호황',
    positiveLabelEn: 'Boom',
    negativeLabelKo: '중국경기 불황',
    negativeLabelEn: 'Slowdown',
    impactPercent: 5,
    months: ['m6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'],
    sources: HKMC_SOURCES,
  },
  {
    id: 'fx',
    titleKo: '환율효과',
    titleEn: 'FX',
    subtitleKo: 'CNY 대비 HKD',
    subtitleEn: 'HKD / CNY',
    positiveLabelKo: 'HKD 약세',
    positiveLabelEn: 'HKD weak',
    negativeLabelKo: 'HKD 강세',
    negativeLabelEn: 'HKD strong',
    impactPercent: 3,
    months: ['m6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'],
    sources: HKMC_SOURCES,
  },
  {
    id: 'tourism',
    titleKo: '중국관광객',
    titleEn: 'Tourists',
    positiveLabelKo: '중국관광객 회복',
    positiveLabelEn: 'Recovery',
    negativeLabelKo: '중국관광객 둔화',
    negativeLabelEn: 'Slowdown',
    impactPercent: 5,
    months: ['m6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'],
    sources: HKMC_SOURCES,
  },
  {
    id: 'taiwan_politics',
    titleKo: '대만정세',
    titleEn: 'Taiwan Politics',
    positiveLabelKo: '대만정세 안정',
    positiveLabelEn: 'Stable',
    negativeLabelKo: '대만정세 불안',
    negativeLabelEn: 'Unstable',
    impactPercent: 5,
    months: ['m6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'],
    sources: TAIWAN_SOURCES,
  },
  {
    id: 'new_stores',
    titleKo: '신규매장',
    titleEn: 'New stores',
    positiveLabelKo: '신규매장 효과 상회',
    positiveLabelEn: 'New stores outperform',
    negativeLabelKo: '신규매장 효과 부진',
    negativeLabelEn: 'New stores underperform',
    impactPercent: 10,
    months: ['m6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'],
  },
];

const ACTIVE_PL_SCENARIO_FACTORS = PL_SCENARIO_FACTORS.filter((factor) => factor.id !== 'new_stores');
const SCENARIO_FACTOR_GROUPS: Array<{
  titleKo: string;
  titleEn: string;
  ids: ScenarioFactorId[];
  className: string;
}> = [
  {
    titleKo: '날씨 영향',
    titleEn: 'Weather',
    ids: ['typhoon', 'rain'],
    className: 'border-sky-100 bg-sky-50/45',
  },
  {
    titleKo: '판매 수요',
    titleEn: 'Demand',
    ids: ['fw', 'china_economy', 'tourism'],
    className: 'border-emerald-100 bg-emerald-50/40',
  },
  {
    titleKo: '외부 변수',
    titleEn: 'External',
    ids: ['fx', 'taiwan_politics'],
    className: 'border-violet-100 bg-violet-50/35',
  },
];

const SCENARIO_SWITCH_LABELS: Record<ScenarioFactorId, Record<Exclude<ScenarioDirection, 'none'>, { ko: string; en: string }>> = {
  typhoon: {
    positive: { ko: '감소', en: 'Lower' },
    negative: { ko: '증가', en: 'Stronger' },
  },
  rain: {
    positive: { ko: '감소', en: 'Lower' },
    negative: { ko: '증가', en: 'Heavier' },
  },
  fw: {
    positive: { ko: '호조', en: 'Strong' },
    negative: { ko: '저조', en: 'Weak' },
  },
  china_economy: {
    positive: { ko: '호황', en: 'Boom' },
    negative: { ko: '불황', en: 'Slowdown' },
  },
  fx: {
    positive: { ko: 'HKD 약세', en: 'HKD weak' },
    negative: { ko: 'HKD 강세', en: 'HKD strong' },
  },
  tourism: {
    positive: { ko: '회복', en: 'Recovery' },
    negative: { ko: '둔화', en: 'Slowdown' },
  },
  taiwan_politics: {
    positive: { ko: '안정', en: 'Stable' },
    negative: { ko: '불안', en: 'Unstable' },
  },
  new_stores: {
    positive: { ko: '상회', en: 'Outperform' },
    negative: { ko: '부진', en: 'Underperform' },
  },
};

function getScenarioSwitchLabel(id: ScenarioFactorId, direction: Exclude<ScenarioDirection, 'none'>, isEnglish: boolean) {
  const label = SCENARIO_SWITCH_LABELS[id][direction];
  return isEnglish ? label.en : label.ko;
}

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
  const [scenarioDirections, setScenarioDirections] = useState<Record<ScenarioFactorId, ScenarioDirection>>({
    typhoon: 'none',
    rain: 'none',
    fw: 'none',
    china_economy: 'none',
    fx: 'none',
    tourism: 'none',
    taiwan_politics: 'none',
    new_stores: 'none',
  });
  const [isScenarioPanelOpen, setIsScenarioPanelOpen] = useState<boolean>(false);
  const scenarioPanelRef = useRef<HTMLDivElement | null>(null);
  const [selectedYear, setSelectedYear] = useState<Year>(2026);
  const [baseMonthIndex, setBaseMonthIndex] = useState<number>(5);
  const [isExpandedAll, setIsExpandedAll] = useState<boolean>(false);
  const [showMonthly, setShowMonthly] = useState<boolean>(false);
  const [showYTD, setShowYTD] = useState<boolean>(true);
  const [showAnnualOnly, setShowAnnualOnly] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [trees2025, setTrees2025] = useState<TreeMap>(EMPTY_TREE_MAP);
  const [trees2026, setTrees2026] = useState<TreeMap>(EMPTY_TREE_MAP);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [rawUpdateMsg, setRawUpdateMsg] = useState<string | null>(null);

  const reloadTrees = useCallback(async () => {
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

      const next2025: TreeMap = { ...EMPTY_TREE_MAP };
      const next2026: TreeMap = { ...EMPTY_TREE_MAP };

      responses.forEach(({ year, source, tree }) => {
        if (year === 2025) next2025[source] = tree;
        if (year === 2026) next2026[source] = tree;
      });

      setTrees2025(next2025);
      setTrees2026(next2026);
    } catch (err) {
      console.error('PL load failed:', err);
      setError(isEnglish ? 'Failed to load P/L data.' : '손익 데이터를 불러오지 못했습니다.');
      setTrees2025({ ...EMPTY_TREE_MAP });
      setTrees2026({ ...EMPTY_TREE_MAP });
    } finally {
      setLoading(false);
    }
  }, [isEnglish]);

  useEffect(() => {
    void reloadTrees();
  }, [reloadTrees]);

  // "Rawdata update" — Raw pl-data.json 을 다시 읽어 CSV 재생성 후 PL 트리 새로고침
  const handleRawdataUpdate = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRawUpdateMsg(null);
    try {
      const res = await fetch('/api/fs/pl/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      await reloadTrees();
      const when = new Date().toLocaleTimeString(isEnglish ? 'en-US' : 'ko-KR');
      const srcLabel = data.source ?? (data.pulledFrom ? 'external' : 'local');
      setRawUpdateMsg(
        isEnglish
          ? `Updated from ${srcLabel} · ${data.files?.length ?? 0} files · ${when}`
          : `Raw 반영 완료 (${srcLabel}) · ${data.files?.length ?? 0}개 파일 · ${when}`,
      );
    } catch (err) {
      console.error('Rawdata update failed:', err);
      setRawUpdateMsg(
        isEnglish
          ? `Update failed: ${(err as Error).message}`
          : `업데이트 실패: ${(err as Error).message}`,
      );
    } finally {
      setRefreshing(false);
    }
  }, [isEnglish, refreshing, reloadTrees]);

  useEffect(() => {
    if (!isScenarioPanelOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!scenarioPanelRef.current) return;
      const target = event.target;
      if (target instanceof globalThis.Node && scenarioPanelRef.current.contains(target)) return;
      setIsScenarioPanelOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsScenarioPanelOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isScenarioPanelOpen]);

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
  const scenarioMonthlyFactors = useMemo<ScenarioMonthlyFactorMap>(() => {
    const buildSourceFactors = (source: DetailSource) => Object.fromEntries(
      MONTH_KEYS.map((monthKey) => {
        const totalImpact = ACTIVE_PL_SCENARIO_FACTORS
          .filter((factor) => factor.months.includes(monthKey) && (!factor.sources || factor.sources.includes(source)))
          .reduce((sum, factor) => {
            const direction = scenarioDirections[factor.id];
            if (direction === 'positive') return sum + factor.impactPercent;
            if (direction === 'negative') return sum - factor.impactPercent;
            return sum;
          }, 0);

        return [monthKey, Math.max(0, 1 + totalImpact / 100)];
      })
    ) as Record<MonthKey, number>;

    return {
      HK_MLB: buildSourceFactors('HK_MLB'),
      HK_Discovery: buildSourceFactors('HK_Discovery'),
      TW_MLB: buildSourceFactors('TW_MLB'),
      TW_Discovery: buildSourceFactors('TW_Discovery'),
    };
  }, [scenarioDirections]);
  const scenarioMonthlyImpactLabel = useMemo(() => {
    const activeMonths = MONTH_KEYS
      .map((monthKey, index) => {
        const factor = scenarioMonthlyFactors.HK_MLB[monthKey] ?? 1;
        if (factor === 1) return null;
        const pct = Math.round((factor - 1) * 1000) / 10;
        const monthLabel = isEnglish ? monthNamesEn[index] : `${index + 1}월`;
        return `${monthLabel} ${pct >= 0 ? '+' : '△'}${Math.abs(pct).toFixed(1)}%`;
      })
      .filter(Boolean);

    return activeMonths.length > 0 ? activeMonths.join(' · ') : (isEnglish ? 'No adjustment' : '변동 없음');
  }, [isEnglish, monthNamesEn, scenarioMonthlyFactors]);
  const annualScenarioTrees = useMemo(
    () =>
      selectedYear === 2026
        ? buildScenarioTreeSet({
            HK_MLB: trees2026.HK_MLB,
            HK_Discovery: trees2026.HK_Discovery,
            TW_MLB: trees2026.TW_MLB,
            TW_Discovery: trees2026.TW_Discovery,
          },
          scenarioMonthlyFactors,
          scenarioMonthlyFactors)
        : null,
    [scenarioMonthlyFactors, selectedYear, trees2026]
  );
  const currentSellOutYoYPercent = useMemo(() => {
    const ratio = buildPlResultSnapshot(trees2026.Total, trees2025.Total).sellOut.yoyRatioVs2025;
    return ratio === null ? null : ratio * 100;
  }, [trees2025.Total, trees2026.Total]);
  const scenarioSellOutYoYPercent = useMemo(() => {
    if (!annualScenarioTrees) return currentSellOutYoYPercent;
    const ratio = buildPlResultSnapshot(annualScenarioTrees.total.good, trees2025.Total).sellOut.yoyRatioVs2025;
    return ratio === null ? null : ratio * 100;
  }, [annualScenarioTrees, currentSellOutYoYPercent, trees2025.Total]);
  const scenarioTone: 'good' | 'bad' | 'neutral' =
    currentSellOutYoYPercent === null || scenarioSellOutYoYPercent === null
      ? 'neutral'
      : scenarioSellOutYoYPercent > currentSellOutYoYPercent + 0.05
        ? 'good'
        : scenarioSellOutYoYPercent < currentSellOutYoYPercent - 0.05
          ? 'bad'
          : 'neutral';
  const scenarioKey = `scenario_${scenarioSellOutYoYPercent === null ? 'base' : scenarioSellOutYoYPercent.toFixed(1)}pct`;
  const goodScenarioPercent = Math.round(scenarioSellOutYoYPercent ?? currentSellOutYoYPercent ?? 100);
  const badScenarioPercent = goodScenarioPercent;
  const detailGoodScenarioPercent: ScenarioFactorMap = {
    HK_MLB: goodScenarioPercent,
    HK_Discovery: goodScenarioPercent,
    TW_MLB: goodScenarioPercent,
    TW_Discovery: goodScenarioPercent,
  };
  const detailBadScenarioPercent = detailGoodScenarioPercent;
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
        [scenarioKey]: {
          Total: buildPlResultSnapshot(annualScenarioTrees.total.good, trees2025.Total),
          HK_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.HK_MLB.good, trees2025.HK_MLB),
          HK_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.HK_Discovery.good, trees2025.HK_Discovery),
          TW_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.TW_MLB.good, trees2025.TW_MLB),
          TW_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.TW_Discovery.good, trees2025.TW_Discovery),
        },
      },
    };
  }, [annualScenarioTrees, scenarioKey, selectedYear, trees2025, trees2026]);

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
        [scenarioKey]: {
          Total: buildPlResultSnapshot(annualScenarioTrees.total.good, trees2025.Total, baseMonthKey),
          HK_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.HK_MLB.good, trees2025.HK_MLB, baseMonthKey),
          HK_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.HK_Discovery.good, trees2025.HK_Discovery, baseMonthKey),
          TW_MLB: buildPlResultSnapshot(annualScenarioTrees.detail.TW_MLB.good, trees2025.TW_MLB, baseMonthKey),
          TW_Discovery: buildPlResultSnapshot(annualScenarioTrees.detail.TW_Discovery.good, trees2025.TW_Discovery, baseMonthKey),
        },
      },
    };
  }, [annualScenarioTrees, baseMonthIndex, baseMonthKey, scenarioKey, selectedYear, trees2025, trees2026]);

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
        [scenarioKey]: {
          Total: annualScenarioTrees.total.good,
          HK_MLB: annualScenarioTrees.detail.HK_MLB.good,
          HK_Discovery: annualScenarioTrees.detail.HK_Discovery.good,
          TW_MLB: annualScenarioTrees.detail.TW_MLB.good,
          TW_Discovery: annualScenarioTrees.detail.TW_Discovery.good,
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
          [scenarioKey]: {
            Total: getOperatingMarginSnapshot(annualScenarioTrees.total.good),
            HK_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_MLB.good),
            HK_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_Discovery.good),
            TW_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_MLB.good),
            TW_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_Discovery.good),
          },
        },
      },
      scenarioControls: {
        scenarioDirections,
        scenarioMonthlyFactors,
        currentSellOutYoYPercent,
        scenarioSellOutYoYPercent,
      },
      resultSummary: annualResultSummary,
    };
  }, [annualResultSummary, annualScenarioTrees, baseMonthIndex, currentSellOutYoYPercent, scenarioDirections, scenarioKey, scenarioMonthlyFactors, scenarioSellOutYoYPercent, selectedYear, trees2026]);
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
        [scenarioKey]: {
          Total: buildBaseMonthTree(annualScenarioTrees.total.good, baseMonthKey),
          HK_MLB: buildBaseMonthTree(annualScenarioTrees.detail.HK_MLB.good, baseMonthKey),
          HK_Discovery: buildBaseMonthTree(annualScenarioTrees.detail.HK_Discovery.good, baseMonthKey),
          TW_MLB: buildBaseMonthTree(annualScenarioTrees.detail.TW_MLB.good, baseMonthKey),
          TW_Discovery: buildBaseMonthTree(annualScenarioTrees.detail.TW_Discovery.good, baseMonthKey),
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
          [scenarioKey]: {
            Total: getOperatingMarginSnapshot(annualScenarioTrees.total.good).monthly[baseMonthKey] ?? 0,
            HK_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_MLB.good).monthly[baseMonthKey] ?? 0,
            HK_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.HK_Discovery.good).monthly[baseMonthKey] ?? 0,
            TW_MLB: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_MLB.good).monthly[baseMonthKey] ?? 0,
            TW_Discovery: getOperatingMarginSnapshot(annualScenarioTrees.detail.TW_Discovery.good).monthly[baseMonthKey] ?? 0,
          },
        },
      };
      payload.scenarioControls = {
        scenarioDirections,
        scenarioMonthlyFactors,
        currentSellOutYoYPercent,
        scenarioSellOutYoYPercent,
      };
      payload.resultSummary = baseMonthResultSummary;
    }

    return payload;
  }, [annualScenarioTrees, baseMonthIndex, baseMonthKey, baseMonthResultSummary, currentSellOutYoYPercent, scenarioDirections, scenarioKey, scenarioMonthlyFactors, scenarioSellOutYoYPercent, selectedYear, trees2026]);
  const resetScenarioDirections = () => {
    setScenarioDirections({
      typhoon: 'none',
      rain: 'none',
      fw: 'none',
      china_economy: 'none',
      fx: 'none',
      tourism: 'none',
      taiwan_politics: 'none',
      new_stores: 'none',
    });
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

    const accountKey = isEnglish ? 'Account' : '계정과목';
    const levelKey = isEnglish ? 'Level' : '레벨';
    const prevTotalKey = isEnglish ? '25 Total' : '25년 합계';
    const rollingKey = isEnglish ? '26 Annual' : '26년 연간';
    const yoyKey = isEnglish ? '26 Annual YoY' : '26년 연간 YoY';
    const scenarioColumnKey = isEnglish
      ? `Scenario ${scenarioSellOutYoYPercent === null ? '-' : scenarioSellOutYoYPercent.toFixed(1)}%`
      : `시나리오 ${scenarioSellOutYoYPercent === null ? '-' : scenarioSellOutYoYPercent.toFixed(1)}%`;
    const typeKey = isEnglish ? 'Type' : '유형';
    return currentRows.map((node) => {
      const months = getNodeMonths(node);
      const prevMonths = getNodeMonths(prevMap.get(node.key));
      const scenarioMonths = getNodeMonths(goodMap.get(node.key));
      const currentTotal = sumMonthValues(months);
      const previousTotal = sumMonthValues(prevMonths);
      const row: Record<string, string | number | null> = {
        [accountKey]: `${'  '.repeat(node.depth)}${isEnglish ? translateFinanceLabel(node.label, 'short') : node.label}`,
        [levelKey]: node.level,
        [typeKey]: node.hasRateRow ? (isEnglish ? 'Rate' : '비율') : (isEnglish ? 'Amount' : '금액'),
        [prevTotalKey]: previousTotal,
      };
      row[rollingKey] = currentTotal;
      row[yoyKey] = previousTotal ? `${Math.round((currentTotal / previousTotal) * 100)}%` : null;
      row[scenarioColumnKey] = sumMonthValues(scenarioMonths);

      return row;
    });
  }, [annualScenarioTrees, baseMonthIndex, isEnglish, scenarioSellOutYoYPercent]);

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

          <div className="flex items-center gap-2">
            {rawUpdateMsg && (
              <span className="max-w-[260px] truncate text-xs font-medium text-slate-500" title={rawUpdateMsg}>
                {rawUpdateMsg}
              </span>
            )}
            <button
              onClick={handleRawdataUpdate}
              disabled={refreshing}
              title={isEnglish ? 'Re-import Raw PL (pl-data.json) and rebuild P/L' : 'Raw PL(pl-data.json)을 다시 읽어 PL을 재생성'}
              className="inline-flex items-center gap-1.5 rounded font-medium border border-indigo-300 bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={refreshing ? 'animate-spin' : ''}
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v5h-5" />
              </svg>
              {refreshing
                ? (isEnglish ? 'Updating…' : '업데이트 중…')
                : (isEnglish ? 'Rawdata update' : 'Rawdata 업데이트')}
            </button>
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

          <div ref={scenarioPanelRef} className="relative ml-auto flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setIsScenarioPanelOpen((prev) => !prev)}
                aria-haspopup="dialog"
                aria-expanded={isScenarioPanelOpen}
                className={`group relative inline-flex min-h-[50px] min-w-[300px] items-center justify-center gap-3 overflow-hidden rounded-xl border px-5 py-2.5 text-[15px] font-semibold leading-none shadow-[0_2px_6px_rgba(15,23,42,0.14),0_14px_30px_rgba(37,99,235,0.24)] ring-1 ring-white/60 transition-all duration-200 before:absolute before:inset-0 before:bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.55)_45%,transparent_62%)] before:opacity-0 before:transition-opacity before:duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(15,23,42,0.16),0_18px_38px_rgba(37,99,235,0.28)] hover:before:opacity-100 active:translate-y-0 active:scale-[0.99] active:shadow-sm ${
                  scenarioTone === 'good'
                    ? 'border-emerald-500 bg-[linear-gradient(135deg,#10b981_0%,#059669_55%,#047857_100%)] text-white hover:border-emerald-400'
                    : scenarioTone === 'bad'
                      ? 'border-rose-500 bg-[linear-gradient(135deg,#f43f5e_0%,#e11d48_55%,#be123c_100%)] text-white hover:border-rose-400'
                      : 'border-blue-500 bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_52%,#4338ca_100%)] text-white hover:border-blue-400'
                }`}
              >
                <span className="relative z-10">{isEnglish ? 'Operating Scenario' : '영업상황 Scenario'}</span>
                <span className="relative z-10 rounded-full bg-amber-300 px-2.5 py-1 text-[16px] font-bold leading-none text-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.34),0_2px_8px_rgba(251,191,36,0.32)] transition-colors group-hover:bg-yellow-300">
                  {scenarioSellOutYoYPercent === null ? '-' : `${scenarioSellOutYoYPercent.toFixed(1)}%`}
                </span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className={`relative z-10 h-4 w-4 text-white/90 transition-transform duration-200 group-hover:text-white ${isScenarioPanelOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 7l5 5 5-5" />
                </svg>
              </button>
            </div>

            {isScenarioPanelOpen && (
              <div className="absolute right-[calc(100%+12px)] top-0 z-30 w-[640px] rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold text-slate-900">{isEnglish ? 'Scenario Switches' : '시나리오 스위치'}</div>
                      <button
                        type="button"
                        onClick={resetScenarioDirections}
                        className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                      >
                        {isEnglish ? 'Reset' : '되돌리기'}
                      </button>
                    </div>
                    <div className="mt-1 w-[480px] overflow-visible whitespace-nowrap text-xs text-slate-500">{scenarioMonthlyImpactLabel}</div>
                  </div>
                  <div className="min-w-[122px] whitespace-nowrap text-right text-xs text-slate-500">
                    <div>{isEnglish ? 'Scenario YoY' : '시나리오 YoY'} {scenarioSellOutYoYPercent === null ? '-' : `${scenarioSellOutYoYPercent.toFixed(1)}%`}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {SCENARIO_FACTOR_GROUPS.map((group) => {
                    const factors = group.ids
                      .map((id) => ACTIVE_PL_SCENARIO_FACTORS.find((factor) => factor.id === id))
                      .filter((factor): factor is ScenarioFactor => Boolean(factor));

                    return (
                      <div key={group.titleEn} className={`rounded-2xl border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${group.className}`}>
                        <div className="mb-2 inline-flex items-center rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-700 shadow-sm">
                          {isEnglish ? group.titleEn : group.titleKo}
                        </div>
                        <div className="space-y-2">
                          {factors.map((factor) => {
                            const activeDirection = scenarioDirections[factor.id];
                            const monthRange = `${factor.months[0].replace('m', '')}~${factor.months[factor.months.length - 1].replace('m', '')}${isEnglish ? 'M' : '월'}`;
                            const options: Array<{ direction: ScenarioDirection; label: string; tone: string }> = [
                              {
                                direction: 'positive',
                                label: `${getScenarioSwitchLabel(factor.id, 'positive', isEnglish)} (+${factor.impactPercent}%)`,
                                tone: 'emerald',
                              },
                              {
                                direction: 'none',
                                label: isEnglish ? 'Neutral' : '선택안함',
                                tone: 'slate',
                              },
                              {
                                direction: 'negative',
                                label: `${getScenarioSwitchLabel(factor.id, 'negative', isEnglish)} (△${factor.impactPercent}%)`,
                                tone: 'rose',
                              },
                            ];

                            return (
                              <div key={factor.id} className="grid grid-cols-[110px_1fr] items-center gap-3 rounded-xl border border-white/80 bg-white/78 p-2 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                                <div className="border-l-[3px] border-slate-400 pl-2">
                                  <div className="text-[13px] font-extrabold leading-tight text-slate-950">{isEnglish ? factor.titleEn : factor.titleKo}</div>
                                  {Boolean(isEnglish ? factor.subtitleEn : factor.subtitleKo) && (
                                    <div className="text-xs font-semibold text-slate-500">{isEnglish ? factor.subtitleEn : factor.subtitleKo}</div>
                                  )}
                                  <div className="text-xs text-slate-500">{monthRange}</div>
                                </div>
                                <div className="grid h-11 grid-cols-3 gap-1 rounded-xl bg-white p-1 shadow-inner">
                                  {options.map((option) => {
                                    const active = activeDirection === option.direction;
                                    const activeClass =
                                      option.tone === 'emerald'
                                        ? 'border-emerald-500 bg-emerald-500 text-white'
                                        : option.tone === 'rose'
                                          ? 'border-rose-500 bg-rose-500 text-white'
                                          : 'border-slate-700 bg-slate-700 text-white';

                                    return (
                                      <button
                                        key={option.direction}
                                        type="button"
                                        onClick={() =>
                                          setScenarioDirections((prev) => ({
                                            ...prev,
                                            [factor.id]: option.direction,
                                          }))
                                        }
                                        className={`box-border flex h-9 min-w-0 items-center justify-center rounded-lg border px-2 text-center text-xs font-bold leading-tight transition-colors ${
                                          active ? activeClass : 'border-transparent bg-transparent text-slate-600 hover:border-transparent hover:bg-slate-100'
                                        }`}
                                      >
                                        <span className="block w-full truncate">{option.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
            currentYoYPercent={currentSellOutYoYPercent}
            scenarioYoYPercent={scenarioSellOutYoYPercent}
            scenarioTone={scenarioTone}
            isExpandedAll={isExpandedAll}
            onToggleNode={handleToggleNode}
            expandedNodes={expandedNodes}
          />
        )}
      </div>
    </div>
  );
}
