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
  const [baseMonthIndex, setBaseMonthIndex] = useState<number>(5); // 기본 5월
  const [selectedBrand, setSelectedBrand] = useState<Brand>('Total');
  
  const [isExpandedAll, setIsExpandedAll] = useState<boolean>(false);
  const [showMonthly, setShowMonthly] = useState<boolean>(false);
  const [showYTD, setShowYTD] = useState<boolean>(true);
  
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  
  // 데이터 상태
  const [prevTree, setPrevTree] = useState<Node[]>([]);
  const [currTree, setCurrTree] = useState<Node[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 데이터 로드
  const loadData = async (year: Year, brand: Brand) => {
    setLoading(true);
    setError(null);

    try {
      const prevYear = (year - 1) as Year;

      // 전년도 데이터 로드
      const prevResponse = await fetch(`/api/fs/pl?year=${prevYear}&brand=${brand}`);
      const prevData = await prevResponse.json();

      // 당년도 데이터 로드
      const currResponse = await fetch(`/api/fs/pl?year=${year}&brand=${brand}`);
      const currData = await currResponse.json();

      let prevTreeData = prevData.tree || [];
      let currTreeData = currData.tree || [];

      // 비율 재계산 적용
      if (prevTreeData.length > 0 || currTreeData.length > 0) {
        const recalcResult = applyRateRecalc(prevTreeData, currTreeData);
        prevTreeData = recalcResult.prevTree;
        currTreeData = recalcResult.currTree;
      }

      setPrevTree(prevTreeData);
      setCurrTree(currTreeData);
    } catch (err) {
      console.error('P/L 데이터 로드 오류:', err);
      setError('데이터를 불러올 수 없습니다.');
      setPrevTree([]);
      setCurrTree([]);
    } finally {
      setLoading(false);
    }
  };

  // 초기 로드 및 연도/브랜드 변경 시 로드
  useEffect(() => {
    loadData(selectedYear, selectedBrand);
  }, [selectedYear, selectedBrand]);

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

  const years: Year[] = [2024, 2025, 2026];
  const brands: Brand[] = ['Total', 'MLB', 'KIDS', 'Discovery', 'DUVETICA', 'SUPRA'];
  const brandLabels: Record<Brand, string> = {
    Total: '법인',
    MLB: 'MLB',
    KIDS: 'KIDS',
    Discovery: 'DISCOVERY',
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

        {!loading && !error && (prevTree.length === 0 && currTree.length === 0) && (
          <div className="text-center py-12 text-gray-600">
            선택한 연도/브랜드의 데이터가 없습니다.
          </div>
        )}

        {!loading && !error && (prevTree.length > 0 || currTree.length > 0) && (
          <PLTable
            prevTree={prevTree}
            currTree={currTree}
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
