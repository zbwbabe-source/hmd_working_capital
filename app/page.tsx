'use client';

import { useState, useEffect, useMemo } from 'react';
import Tabs from '@/components/Tabs';
import YearTabs from '@/components/YearTabs';
import FinancialTable from '@/components/FinancialTable';
import EditableAnalysis from '@/components/EditableAnalysis';
import { TableRow, TabType } from '@/lib/types';
import {
  analyzeCashFlowData,
  analyzeWorkingCapitalData,
  generateCashFlowInsights,
  generateCFOQA,
} from '@/lib/analysis';
import { formatNumber, formatMillionYuan } from '@/lib/utils';

export default function Home() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [wcYear, setWcYear] = useState<number>(2026);
  const [workingCapitalMonthsCollapsed, setWorkingCapitalMonthsCollapsed] = useState<boolean>(true);
  const [wcAllRowsCollapsed, setWcAllRowsCollapsed] = useState<boolean>(true);
  const [wcStatementAllRowsCollapsed, setWcStatementAllRowsCollapsed] = useState<boolean>(true);
  const [cfData, setCfData] = useState<TableRow[] | null>(null);
  const [wcStatementData, setWcStatementData] = useState<TableRow[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const tabs = ['연간 자금계획'];
  const tabTypes: TabType[] = ['CF'];

  // 데이터 로딩: 현금흐름표=CF 폴더, 운전자본표=운전자본 폴더
  const loadData = async (type: TabType, year?: number) => {
    setLoading(true);
    setError(null);

    try {
      let url = '';
      if (type === 'CF') {
        url = `/api/fs/cf?year=${year}`;
      } else if (type === 'WORKING_CAPITAL_STATEMENT') {
        url = `/api/fs/working-capital-statement?year=${year}`;
      }

      if (!url) return;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        const message = result?.error || '데이터를 불러올 수 없습니다.';
        throw new Error(message);
      }

      if (type === 'CF') {
        setCfData(result.rows);
      } else if (type === 'WORKING_CAPITAL_STATEMENT') {
        setWcStatementData(result.rows);
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === 0) {
      if (!cfData) loadData('CF', wcYear);
      if (!wcStatementData) loadData('WORKING_CAPITAL_STATEMENT', wcYear);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 0) {
      loadData('CF', wcYear);
      loadData('WORKING_CAPITAL_STATEMENT', wcYear);
    }
  }, [wcYear]);

  // 월 컬럼 (1월~12월)
  const monthColumns = ['계정과목', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  // 분석 결과 계산 (useMemo로 캐싱): 현금흐름표=cfData(CF 폴더), 운전자본표=wcStatementData(운전자본 폴더)
  const analysisResults = useMemo(() => {
    if (!cfData && !wcStatementData) {
      return null;
    }

    const cfAnalysis = analyzeCashFlowData(cfData, wcYear);
    const wcAnalysis = analyzeWorkingCapitalData(wcStatementData, wcYear);
    const insights = generateCashFlowInsights(cfData, wcStatementData, wcYear);
    const cfoQA = generateCFOQA(cfData, wcStatementData, wcYear);

    return { cfAnalysis, wcAnalysis, insights, cfoQA };
  }, [cfData, wcStatementData, wcYear]);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 상단 탭 */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* 내용 - 상단 탭 높이만큼 패딩 추가 */}
      <div className="p-0 pt-16">
        {/* 연간 자금계획 - 현금흐름표 */}
        {activeTab === 0 && (
          <div>
            <div className="bg-gray-100 border-b border-gray-300">
              <div className="flex items-center gap-4 px-6 py-3">
                <YearTabs years={[2026]} activeYear={wcYear} onChange={setWcYear} />
                <button
                  onClick={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors shadow-sm"
                >
                  {workingCapitalMonthsCollapsed ? '월별 데이터 펼치기 ▶' : '월별 데이터 접기 ◀'}
                </button>
                <span className="ml-auto text-sm font-medium text-gray-600">단위: 천 HKD</span>
              </div>
            </div>
            {loading && <div className="p-6 text-center">로딩 중...</div>}
            {error && <div className="p-6 text-center text-red-500">{error}</div>}
            {(cfData || wcStatementData) && !loading && (
              <div className="px-6 pt-6 pb-6">
                {workingCapitalMonthsCollapsed ? (
                  <div className="flex gap-6 items-start">
                    <div className="flex-shrink-0">
                      {cfData && (
                        <>
                          <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-800">현금흐름표</h2>
                            <button
                              onClick={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                              className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                            >
                              {wcAllRowsCollapsed ? '펼치기 ▼' : '접기 ▲'}
                            </button>
                          </div>
                          <FinancialTable 
                            data={cfData} 
                            columns={[...monthColumns, `${wcYear}년(합계)`, 'YoY']} 
                            showTotal
                            isCashFlow={true}
                            monthsCollapsed={workingCapitalMonthsCollapsed}
                            onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                            currentYear={wcYear}
                            allRowsCollapsed={wcAllRowsCollapsed}
                            onAllRowsToggle={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                            defaultExpandedAccounts={['영업활동']}
                          />
                        </>
                      )}
                      {wcStatementData && (
                        <div className="mt-8 pt-6 border-t-2 border-gray-400">
                          <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-800">운전자본표</h2>
                            <button
                              onClick={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                              className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                            >
                              {wcStatementAllRowsCollapsed ? '펼치기 ▼' : '접기 ▲'}
                            </button>
                          </div>
                          <FinancialTable 
                            data={wcStatementData} 
                            columns={[...monthColumns, `${wcYear}년(기말)`, 'YoY']} 
                            showTotal
                            isCashFlow={true}
                            monthsCollapsed={workingCapitalMonthsCollapsed}
                            onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                            currentYear={wcYear}
                            allRowsCollapsed={wcStatementAllRowsCollapsed}
                            onAllRowsToggle={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                          />
                        </div>
                      )}
                    </div>
                    <aside className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm overflow-y-auto max-h-[calc(100vh-200px)]">
                      <EditableAnalysis
                        year={wcYear}
                        initialContent={analysisResults ? {
                          keyInsights: analysisResults.insights.keyInsights,
                          cfAnalysis: analysisResults.cfAnalysis,
                          wcAnalysis: analysisResults.wcAnalysis,
                          riskFactors: analysisResults.insights.riskFactors,
                          actionItems: analysisResults.insights.actionItems,
                        } : null}
                      />
                    </aside>
                  </div>
                ) : (
                  <>
                    {cfData && (
                      <>
                        <div className="flex items-center gap-2 mb-4">
                          <h2 className="text-lg font-bold text-gray-800">현금흐름표</h2>
                          <button
                            onClick={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                            className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                          >
                            {wcAllRowsCollapsed ? '펼치기 ▼' : '접기 ▲'}
                          </button>
                        </div>
                        <FinancialTable 
                          data={cfData} 
                          columns={[...monthColumns, `${wcYear}년(합계)`, 'YoY']} 
                          showTotal
                          isCashFlow={true}
                          monthsCollapsed={workingCapitalMonthsCollapsed}
                          onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                          currentYear={wcYear}
                          allRowsCollapsed={wcAllRowsCollapsed}
                          onAllRowsToggle={() => setWcAllRowsCollapsed(!wcAllRowsCollapsed)}
                          defaultExpandedAccounts={['영업활동']}
                        />
                      </>
                    )}
                    {wcStatementData && (
                      <div className="mt-8 pt-6 border-t-2 border-gray-400">
                        <div className="flex items-center gap-2 mb-4">
                          <h2 className="text-lg font-bold text-gray-800">운전자본표</h2>
                          <button
                            onClick={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                            className="px-4 py-2 text-sm font-medium rounded bg-gray-600 text-white hover:bg-gray-700 transition-colors"
                          >
                            {wcStatementAllRowsCollapsed ? '펼치기 ▼' : '접기 ▲'}
                          </button>
                        </div>
                        <FinancialTable 
                          data={wcStatementData} 
                          columns={[...monthColumns, `${wcYear}년(기말)`, 'YoY']} 
                          showTotal
                          isCashFlow={true}
                          monthsCollapsed={workingCapitalMonthsCollapsed}
                          onMonthsToggle={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                          currentYear={wcYear}
                          allRowsCollapsed={wcStatementAllRowsCollapsed}
                          onAllRowsToggle={() => setWcStatementAllRowsCollapsed(!wcStatementAllRowsCollapsed)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

