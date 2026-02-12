'use client';

import React, { useState, useEffect } from 'react';
import PLTable from '@/components/PLTable';
import type { Node } from '@/PL/src/pl/tree';
import { applyRateRecalc } from '@/PL/src/pl/rateRecalc';

type Year = 2024 | 2025 | 2026;
type Brand = 'Total' | 'MLB' | 'Discovery' | 'KIDS' | 'DUVETICA' | 'SUPRA';

export default function PLPage() {
  // 상태 관리
  const [selectedYear, setSelectedYear] = useState<Year>(2026);
  const [baseMonthIndex, setBaseMonthIndex] = useState<number>(1); // 기본 1월
  const [selectedBrand, setSelectedBrand] = useState<Brand>('Total');
  
  const [isExpandedAll, setIsExpandedAll] = useState<boolean>(false);
  const [showMonthly, setShowMonthly] = useState<boolean>(false);
  const [showYTD, setShowYTD] = useState<boolean>(false); // YTD 초기값 숨김
  
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // 데이터 상태 - 항상 2025/2026 두 세트만 저장
  const [tree2025, setTree2025] = useState<Node[]>([]);
  const [tree2026, setTree2026] = useState<Node[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드 - 항상 2025, 2026 둘 다 로드
  const loadData = async (brand: Brand) => {
    setLoading(true);
    setError(null);

    try {
      console.log("[LOAD] brand", brand);

      // 2025 데이터 로드
      const response2025 = await fetch(`/api/fs/pl?year=2025&brand=${brand}`);
      const data2025 = await response2025.json();

      // 2026 데이터 로드
      const response2026 = await fetch(`/api/fs/pl?year=2026&brand=${brand}`);
      const data2026 = await response2026.json();

      let prevTree2025 = data2025.tree || [];
      let currTree2026 = data2026.tree || [];

      console.log("[LOAD] rows2025", prevTree2025.length, "rows2026", currTree2026.length);

      // 비율 재계산 적용
      if (prevTree2025.length > 0 || currTree2026.length > 0) {
        const recalcResult = applyRateRecalc(prevTree2025, currTree2026);
        prevTree2025 = recalcResult.prevTree;
        currTree2026 = recalcResult.currTree;
      }

      // 검증 로그
      console.log("[TREE] root labels 2025", prevTree2025.map(r => r.label).slice(0, 5));
      console.log("[TREE] root labels 2026", currTree2026.map(r => r.label).slice(0, 5));

      // 첫 루트 rollup 샘플
      const p0 = prevTree2025[0];
      const c0 = currTree2026[0];
      console.log("[SAMPLE] 2025 first root", p0?.label, p0?.rollup?.m1, p0?.rollup?.m2, p0?.rollup?.m3);
      console.log("[SAMPLE] 2026 first root", c0?.label, c0?.rollup?.m1, c0?.rollup?.m2, c0?.rollup?.m3);

      setTree2025(prevTree2025);
      setTree2026(currTree2026);
    } catch (err) {
      console.error('P/L 데이터 로드 오류:', err);
      setError('데이터를 불러올 수 없습니다.');
      setTree2025([]);
      setTree2026([]);
    } finally {
      setLoading(false);
    }
  };

  // 브랜드 변경 시에만 데이터 로드
  useEffect(() => {
    loadData(selectedBrand);
  }, [selectedBrand]);

  // 화면 표시용 prev/curr 매핑
  const displayPrevTree = selectedYear === 2026 ? tree2025 : null;
  const displayCurrTree = selectedYear === 2026 ? tree2026 : selectedYear === 2025 ? tree2025 : null;

  // 디버깅용 로그
  useEffect(() => {
    console.log("[DISPLAY] selectedYear", selectedYear,
      "displayPrev?", !!displayPrevTree, "displayCurr?", !!displayCurrTree
    );
  }, [selectedYear, displayPrevTree, displayCurrTree]);

  // 노드 토글
  const handleToggleNode = (nodeKey: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeKey)) {
        newSet.delete(nodeKey);
      } else {
        newSet.add(nodeKey);
      }
      return newSet;
    });
  };

  // 전체 펼치기/접기
  const handleToggleAll = () => {
    if (isExpandedAll) {
      setExpandedNodes(new Set());
    }
    setIsExpandedAll(!isExpandedAll);
  };

  const years: Year[] = [2025, 2026];
  const brands: Brand[] = ['Total', 'MLB', 'Discovery'];
  const brandLabels: Record<Brand, string> = {
    Total: '합계',
    MLB: 'MLB',
    KIDS: 'KIDS',
    Discovery: 'Discovery',
    DUVETICA: 'DUVETICA',
    SUPRA: 'SUPRA'
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 컨트롤바 */}
      <div className="bg-white border-b border-gray-300 px-6 py-4">
        <div className="flex items-center gap-6">
          {/* 연도 버튼 그룹 */}
          <div className="flex gap-2">
            {years.map(year => (
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

          {/* 기준월 드롭다운 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">기준월:</label>
            <select
              value={baseMonthIndex}
              onChange={(e) => setBaseMonthIndex(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded bg-white text-sm"
            >
              {months.map(month => (
                <option key={month} value={month}>{month}월</option>
              ))}
            </select>
          </div>

          {/* 브랜드 버튼 그룹 */}
          <div className="flex gap-2 ml-auto">
            {brands.map(brand => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                  selectedBrand === brand
                    ? 'bg-teal-500 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                }`}
              >
                {brandLabels[brand]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2차 컨트롤 (테이블 위) */}
      <div className="bg-gray-100 border-b border-gray-300 px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleAll}
            className="px-4 py-2 bg-gray-700 text-white rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            {isExpandedAll ? '접기 ▲' : '펼치기 ▼'}
          </button>

          <button
            onClick={() => setShowMonthly(!showMonthly)}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            월별 데이터 {showMonthly ? '접기 ◀' : '펼치기 ▶'}
          </button>

          <button
            onClick={() => setShowYTD(!showYTD)}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            {showYTD ? 'YTD 숨기기 (현재 전체보기)' : 'YTD 보기 (현재 전체보기)'}
          </button>

          <span className="text-xs text-gray-500 ml-2">
            (비교 컬럼은 항상 표시됩니다)
          </span>
        </div>
      </div>

      {/* 테이블 영역 */}
      <div className="p-6">
        {loading && (
          <div className="text-center py-12 text-gray-600">
            로딩 중...
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && !displayPrevTree && !displayCurrTree && (
          <div className="text-center py-12 text-gray-600">
            선택한 연도의 데이터가 없습니다.
          </div>
        )}

        {!loading && !error && (displayPrevTree || displayCurrTree) && (
          <PLTable
            prevTree={displayPrevTree || []}
            currTree={displayCurrTree || []}
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
