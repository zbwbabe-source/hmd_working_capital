'use client';

import { useEffect, useState } from 'react';
import type {
  InventoryBrandGroup,
  InventoryMatrixResponse,
  InventoryMatrixRow,
  InventoryMatrixSection,
} from '@/lib/inventory';

const BRAND_OPTIONS: InventoryBrandGroup[] = ['ALL', 'MLB', 'Discovery'];
const BRAND_LABELS: Record<InventoryBrandGroup, string> = {
  ALL: '전체',
  MLB: 'MLB',
  Discovery: 'Discovery',
};
const REGION_TITLES: Record<InventoryMatrixSection['regionGroup'], string> = {
  TOTAL: '합산 재고 (K)',
  HKMC: '홍마 재고 (K)',
  TW: '대만재고 (K)',
};

function formatMetric(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function getDisplayInbound(value: number): number {
  return value < 0 ? 0 : value;
}

function getDisplayAdjustment(value: number): number {
  return value < 0 ? value : 0;
}

function getSubtotalSourceRows(rows: InventoryMatrixRow[], categoryLabel: string): InventoryMatrixRow[] {
  if (categoryLabel === '의류합계') {
    return rows.filter((row) =>
      ['당년F', '당년S', '1년차', '2년차', '차기시즌', '과시즌'].includes(row.categoryLabel)
    );
  }

  if (categoryLabel === 'ACC합계') {
    return rows.filter((row) => ['신발', '모자', '가방', '기타'].includes(row.categoryLabel));
  }

  return [];
}

function InventoryMatrixTable({
  title,
  rows,
  showAdjustment,
}: {
  title: string;
  rows: InventoryMatrixRow[];
  showAdjustment: boolean;
}) {
  const totalRow = rows.reduce<
    InventoryMatrixRow & {
      adjustmentAmtK: number;
    }
  >(
    (acc, row) => {
      if (row.isSubtotal) return acc;

      return {
        ...acc,
        beginAmtK: acc.beginAmtK + row.beginAmtK,
        inboundAmtK: acc.inboundAmtK + getDisplayInbound(row.inboundAmtK),
        adjustmentAmtK: acc.adjustmentAmtK + getDisplayAdjustment(row.inboundAmtK),
        salesAmtK: acc.salesAmtK + row.salesAmtK,
        endingAmtK: acc.endingAmtK + row.endingAmtK,
        changeAmtK: acc.changeAmtK + row.changeAmtK,
      };
    },
    {
      categoryLabel: 'Total',
      beginAmtK: 0,
      inboundAmtK: 0,
      adjustmentAmtK: 0,
      salesAmtK: 0,
      endingAmtK: 0,
      changeAmtK: 0,
      isSubtotal: true,
      sortOrder: Number.MAX_SAFE_INTEGER,
    }
  );

  const displayRows = [
    ...rows.map((row) => {
      const subtotalSourceRows = row.isSubtotal ? getSubtotalSourceRows(rows, row.categoryLabel) : [];

      if (subtotalSourceRows.length > 0) {
        return {
          ...row,
          inboundAmtK: subtotalSourceRows.reduce((sum, item) => sum + getDisplayInbound(item.inboundAmtK), 0),
          adjustmentAmtK: subtotalSourceRows.reduce((sum, item) => sum + getDisplayAdjustment(item.inboundAmtK), 0),
        };
      }

      return {
        ...row,
        inboundAmtK: getDisplayInbound(row.inboundAmtK),
        adjustmentAmtK: getDisplayAdjustment(row.inboundAmtK),
      };
    }),
    totalRow,
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">기준: 2024-12-31 / 2025-01-01~2025-12-31 / 2025-12-31</p>
          </div>
          <div className="text-xs font-medium text-slate-500">단위: 1K HKD</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left font-semibold">
                구분
              </th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">24년말</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">입고</th>
              {showAdjustment && (
                <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">재고조정</th>
              )}
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">판매</th>
              <th className="border-b border-r border-slate-200 px-4 py-3 text-right font-semibold">25년말</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">증감</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const bgClass = row.isSubtotal ? 'bg-slate-50' : 'bg-white';
              const textClass = row.isSubtotal ? 'font-bold text-slate-900' : 'text-slate-600';
              const changeClass =
                row.changeAmtK > 0 ? 'text-red-500' : row.changeAmtK < 0 ? 'text-slate-900' : 'text-slate-500';

              return (
                <tr key={`${title}-${row.categoryLabel}`} className={bgClass}>
                  <td className={`sticky left-0 z-10 border-b border-r border-slate-200 px-4 py-2.5 ${bgClass} ${textClass}`}>
                    {row.categoryLabel}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                    {formatMetric(row.beginAmtK)}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                    {formatMetric(row.inboundAmtK)}
                  </td>
                  {showAdjustment && (
                    <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                      {formatMetric(row.adjustmentAmtK)}
                    </td>
                  )}
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                    {formatMetric(row.salesAmtK)}
                  </td>
                  <td className={`border-b border-r border-slate-200 px-4 py-2.5 text-right ${textClass}`}>
                    {formatMetric(row.endingAmtK)}
                  </td>
                  <td className={`border-b border-slate-200 px-4 py-2.5 text-right font-semibold ${changeClass}`}>
                    {formatMetric(row.changeAmtK)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [brand, setBrand] = useState<InventoryBrandGroup>('ALL');
  const [data, setData] = useState<InventoryMatrixResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdjustment, setShowAdjustment] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/fs/inventory?brand=${brand}`, { cache: 'no-store' });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || '재고 데이터를 불러오지 못했습니다.');
        }

        if (!cancelled) {
          setData(result as InventoryMatrixResponse);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Inventory load failed:', err);
          setError(err instanceof Error ? err.message : '재고 데이터를 불러오지 못했습니다.');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [brand]);

  return (
    <div className="px-6 pt-6 pb-10">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              Inventory Matrix
            </div>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">브랜드별 재고 매트릭스</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              TW 금액은 4.0279로 나누어 HKD로 환산했으며, 입고는 판매 + 기말 - 기초로 역산했습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAdjustment((prev) => !prev)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              재고조정 {showAdjustment ? '숨기기' : '펼치기'}
            </button>
            {BRAND_OPTIONS.map((option) => {
              const active = brand === option;
              return (
                <button
                  key={option}
                  onClick={() => setBrand(option)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {BRAND_LABELS[option]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
            재고 매트릭스를 불러오는 중입니다.
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center text-sm text-red-600 shadow-sm">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          data?.sections.map((section) => (
            <InventoryMatrixTable
              key={section.regionGroup}
              title={REGION_TITLES[section.regionGroup]}
              rows={section.rows}
              showAdjustment={showAdjustment}
            />
          ))}
      </div>
    </div>
  );
}
