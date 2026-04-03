import { buildTree, type Node } from './tree';
import type { MonthKey, Row, Source } from './types';

type DetailSource = Exclude<Source, 'Total'>;
type ScenarioKey = 'good' | 'bad';

export type ScenarioTreeSet = {
  total: Record<ScenarioKey, Node[]>;
  detail: Record<DetailSource, Record<ScenarioKey, Node[]>>;
};

export type ScenarioFactorMap = Record<DetailSource, number>;

const DETAIL_SOURCES: DetailSource[] = ['HK_MLB', 'HK_Discovery', 'TW_MLB', 'TW_Discovery'];
const MONTH_KEYS: MonthKey[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'];

function cloneRows(nodes: Node[]): Row[] {
  const rows: Row[] = [];

  const visit = (items: Node[]) => {
    items.forEach((node) => {
      if (node.rows) {
        node.rows.forEach((row) => {
          rows.push({
            ...row,
            months: { ...row.months },
          });
        });
      }
      if (node.children) visit(node.children);
    });
  };

  visit(nodes);
  return rows;
}

function sumMonths(rows: Row[], predicate: (row: Row) => boolean): Record<MonthKey, number> {
  const totals = Object.fromEntries(MONTH_KEYS.map((monthKey) => [monthKey, 0])) as Record<MonthKey, number>;

  rows.forEach((row) => {
    if (!predicate(row)) return;
    MONTH_KEYS.forEach((monthKey) => {
      totals[monthKey] += row.months[monthKey] || 0;
    });
  });

  return totals;
}

function applyFactor(row: Row, factor: number) {
  MONTH_KEYS.forEach((monthKey) => {
    row.months[monthKey] = (row.months[monthKey] || 0) * factor;
  });
}

function overwriteMonths(row: Row | undefined, values: Record<MonthKey, number>) {
  if (!row) return;
  MONTH_KEYS.forEach((monthKey) => {
    row.months[monthKey] = values[monthKey] || 0;
  });
}

function subtractMonths(left: Record<MonthKey, number>, right: Record<MonthKey, number>): Record<MonthKey, number> {
  const result = {} as Record<MonthKey, number>;
  MONTH_KEYS.forEach((monthKey) => {
    result[monthKey] = (left[monthKey] || 0) - (right[monthKey] || 0);
  });
  return result;
}

function findSingleRow(rows: Row[], lvl1: string, lvl2: string): Row | undefined {
  return rows.find((row) => row.lvl1 === lvl1 && row.lvl2 === lvl2);
}

function buildScenarioRows(rows: Row[], factor: number): Row[] {
  const cloned = rows.map((row) => ({
    ...row,
    months: { ...row.months },
  }));

  cloned.forEach((row) => {
    if (row.isRateRow) return;
    if (row.lvl1 === '실판매출' || row.lvl1 === 'TAG매출' || row.lvl1 === '매출원가') {
      applyFactor(row, factor);
      return;
    }

    if (row.lvl1 === '온라인 직접비' && row.lvl2 === '지급수수료') {
      applyFactor(row, factor);
    }
  });

  const source = cloned[0]?.source;
  const adjustedTagSales = sumMonths(cloned, (row) => row.lvl1 === 'TAG매출');

  cloned.forEach((row) => {
    if (row.isRateRow) return;
    if (row.lvl1 !== '오프라인 직접비' || row.lvl2 !== '매장임차료') return;

    if (source === 'TW_MLB' || source === 'TW_Discovery') {
      applyFactor(row, factor);
      return;
    }

    MONTH_KEYS.forEach((monthKey) => {
      const current = row.months[monthKey] || 0;
      const adjustedRent = Math.max(current, adjustedTagSales[monthKey] * 0.2);
      row.months[monthKey] = adjustedRent;
    });
  });

  const adjustedSellOut = sumMonths(cloned, (row) => row.lvl1 === '실판매출');
  const adjustedCogs = sumMonths(cloned, (row) => row.lvl1 === '매출원가');
  const adjustedOfflineDirect = sumMonths(
    cloned,
    (row) => row.lvl1 === '오프라인 직접비' && row.lvl2 !== '직접비+영업비 계'
  );
  const adjustedOnlineDirect = sumMonths(
    cloned,
    (row) => row.lvl1 === '온라인 직접비' && row.lvl2 !== '직접비+영업비 계'
  );
  const adjustedOfficeExpense = sumMonths(cloned, (row) => row.lvl1 === '영업비');
  const adjustedGrossProfit = subtractMonths(adjustedSellOut, adjustedCogs);
  const adjustedDirectAndOpex = {} as Record<MonthKey, number>;
  MONTH_KEYS.forEach((monthKey) => {
    adjustedDirectAndOpex[monthKey] =
      (adjustedOfflineDirect[monthKey] || 0) +
      (adjustedOnlineDirect[monthKey] || 0) +
      (adjustedOfficeExpense[monthKey] || 0);
  });
  const adjustedOperatingProfit = subtractMonths(adjustedGrossProfit, adjustedDirectAndOpex);

  overwriteMonths(findSingleRow(cloned, '매출총이익', '매출총이익합계'), adjustedGrossProfit);
  overwriteMonths(findSingleRow(cloned, '직접비+영업비', '직접비+영업비 계'), adjustedDirectAndOpex);
  overwriteMonths(findSingleRow(cloned, '영업이익', '영업이익 계'), adjustedOperatingProfit);

  const cogsRateRow = findSingleRow(cloned, 'Tag대비 원가율', 'Tag대비 원가율합계');
  if (cogsRateRow) {
    MONTH_KEYS.forEach((monthKey) => {
      const tag = adjustedTagSales[monthKey] || 0;
      const cogs = adjustedCogs[monthKey] || 0;
      cogsRateRow.months[monthKey] = tag === 0 ? 0 : (cogs / tag) * 100;
    });
  }

  return cloned;
}

export function buildScenarioTreeSet(
  detailTrees: Record<DetailSource, Node[]>,
  goodFactors: ScenarioFactorMap,
  badFactors: ScenarioFactorMap
): ScenarioTreeSet {
  const detailRowsBySource = Object.fromEntries(
    DETAIL_SOURCES.map((source) => [source, cloneRows(detailTrees[source])])
  ) as Record<DetailSource, Row[]>;

  const detail = Object.fromEntries(
    DETAIL_SOURCES.map((source) => [
      source,
      {
        good: buildTree(buildScenarioRows(detailRowsBySource[source], goodFactors[source] ?? 1.2)),
        bad: buildTree(buildScenarioRows(detailRowsBySource[source], badFactors[source] ?? 0.8)),
      },
    ])
  ) as Record<DetailSource, Record<ScenarioKey, Node[]>>;

  const totalGoodRows = DETAIL_SOURCES.flatMap((source) => cloneRows(detail[source].good));
  const totalBadRows = DETAIL_SOURCES.flatMap((source) => cloneRows(detail[source].bad));

  return {
    total: {
      good: buildTree(totalGoodRows),
      bad: buildTree(totalBadRows),
    },
    detail,
  };
}
