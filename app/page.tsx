'use client';

import { useState, useEffect, useMemo } from 'react';
import Tabs from '@/components/Tabs';
import YearTabs from '@/components/YearTabs';
import FinancialTable from '@/components/FinancialTable';
import CreditStatus from '@/components/CreditStatus';
import { TableRow, CreditData, TabType } from '@/lib/types';
import {
  analyzeCashFlowData,
  analyzeWorkingCapitalData,
  generateCashFlowInsights,
  generateCFOQA,
} from '@/lib/analysis';
import { formatNumber } from '@/lib/utils';

export default function Home() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [wcYear, setWcYear] = useState<number>(2026);
  const [workingCapitalMonthsCollapsed, setWorkingCapitalMonthsCollapsed] = useState<boolean>(false);
  const [wcAllRowsCollapsed, setWcAllRowsCollapsed] = useState<boolean>(true);
  const [wcStatementAllRowsCollapsed, setWcStatementAllRowsCollapsed] = useState<boolean>(true);
  const [workingCapitalData, setWorkingCapitalData] = useState<TableRow[] | null>(null);
  const [wcStatementData, setWcStatementData] = useState<TableRow[] | null>(null);
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cfoQAExpanded, setCfoQAExpanded] = useState<boolean>(false);

  const tabs = ['연간 자금계획', '여신사용현황'];
  const tabTypes: TabType[] = ['WORKING_CAPITAL', 'CREDIT'];

  // 데이터 로딩
  const loadData = async (type: TabType, year?: number) => {
    setLoading(true);
    setError(null);

    try {
      let url = '';
      if (type === 'CREDIT') {
        url = `/api/fs/credit`;
      } else if (type === 'WORKING_CAPITAL') {
        url = `/api/fs/working-capital?year=${year}`;
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

      if (type === 'WORKING_CAPITAL') {
        setWorkingCapitalData(result.rows);
      } else if (type === 'WORKING_CAPITAL_STATEMENT') {
        setWcStatementData(result.rows);
      } else if (type === 'CREDIT') {
        setCreditData(result);
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
      if (!workingCapitalData) loadData('WORKING_CAPITAL', wcYear);
      if (!wcStatementData) loadData('WORKING_CAPITAL_STATEMENT', wcYear);
    } else if (activeTab === 1 && !creditData) {
      loadData('CREDIT');
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 0) {
      loadData('WORKING_CAPITAL', wcYear);
      loadData('WORKING_CAPITAL_STATEMENT', wcYear);
    }
  }, [wcYear]);

  // 월 컬럼 (1월~12월)
  const monthColumns = ['계정과목', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  // 분석 결과 계산 (useMemo로 캐싱)
  const analysisResults = useMemo(() => {
    if (!workingCapitalData && !wcStatementData) {
      return null;
    }

    const cfAnalysis = analyzeCashFlowData(workingCapitalData, wcYear);
    const wcAnalysis = analyzeWorkingCapitalData(wcStatementData, wcYear);
    const insights = generateCashFlowInsights(workingCapitalData, wcStatementData, wcYear);
    const cfoQA = generateCFOQA(workingCapitalData, wcStatementData, wcYear);

    return { cfAnalysis, wcAnalysis, insights, cfoQA };
  }, [workingCapitalData, wcStatementData, wcYear]);

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
                <YearTabs years={[2025, 2026]} activeYear={wcYear} onChange={setWcYear} />
                <button
                  onClick={() => setWorkingCapitalMonthsCollapsed(!workingCapitalMonthsCollapsed)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors shadow-sm"
                >
                  {workingCapitalMonthsCollapsed ? '월별 데이터 펼치기 ▶' : '월별 데이터 접기 ◀'}
                </button>
              </div>
            </div>
            {loading && <div className="p-6 text-center">로딩 중...</div>}
            {error && <div className="p-6 text-center text-red-500">{error}</div>}
            {(workingCapitalData || wcStatementData) && !loading && (
              <div className="px-6 pt-6 pb-6">
                {workingCapitalMonthsCollapsed ? (
                  <div className="flex gap-6 items-start">
                    <div className="flex-shrink-0">
                      {workingCapitalData && (
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
                            data={workingCapitalData} 
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
                            columns={[...monthColumns, `${wcYear}년(합계)`, 'YoY']} 
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
                    <aside className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-white p-6 shadow-sm overflow-y-auto max-h-[calc(100vh-200px)]">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b">설명과 분석</h3>
                      
                      {analysisResults ? (
                        <div className="space-y-6">
                          {/* 핵심 인사이트 */}
                          <section>
                            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                              <span className="w-1 h-4 bg-blue-600 mr-2"></span>
                              핵심 인사이트
                            </h4>
                            <ul className="space-y-2">
                              {analysisResults.insights.keyInsights.map((insight, idx) => (
                                <li key={idx} className="text-sm text-gray-700 leading-relaxed pl-3 border-l-2 border-blue-200">
                                  {insight}
                                </li>
                              ))}
                            </ul>
                          </section>

                          {/* 현금흐름표 상세 */}
                          {analysisResults.cfAnalysis.categories.length > 0 && (
                            <section>
                              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                <span className="w-1 h-4 bg-green-600 mr-2"></span>
                                {wcYear}년 현금흐름표
                              </h4>
                              <div className="space-y-2">
                                {analysisResults.cfAnalysis.categories.map((cat, idx) => (
                                  <div key={idx} className="text-sm">
                                    <div className="font-medium text-gray-800">
                                      {cat.account}
                                    </div>
                                    <div className="text-gray-600 pl-3">
                                      연간 {formatNumber(cat.annualTotal, false, false)}천위안
                                      {cat.yoyAbsolute !== null && (
                                        <span className={cat.yoyAbsolute > 0 ? 'text-blue-600' : 'text-red-600'}>
                                          {' '}(전년 대비 {formatNumber(Math.abs(cat.yoyAbsolute), false, false)}천위안
                                          {cat.yoyPercent !== null && `, ${cat.yoyPercent > 0 ? '+' : ''}${cat.yoyPercent.toFixed(1)}%`})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}

                          {/* 운전자본표 상세 */}
                          {analysisResults.wcAnalysis.categories.length > 0 && (
                            <section>
                              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                <span className="w-1 h-4 bg-purple-600 mr-2"></span>
                                {wcYear}년 운전자본표
                              </h4>
                              <div className="space-y-3">
                                {analysisResults.wcAnalysis.categories.map((cat, idx) => (
                                  <div key={idx} className="text-sm">
                                    <div className="font-medium text-gray-800">
                                      {cat.account}
                                    </div>
                                    <div className="text-gray-600 pl-3">
                                      연간 {formatNumber(cat.annualTotal, false, false)}천위안
                                      {cat.yoyAbsolute !== null && (
                                        <span className={cat.yoyAbsolute < 0 ? 'text-blue-600' : 'text-red-600'}>
                                          {' '}(전년 대비 {formatNumber(Math.abs(cat.yoyAbsolute), false, false)}천위안
                                          {cat.yoyPercent !== null && `, ${cat.yoyPercent > 0 ? '+' : ''}${cat.yoyPercent.toFixed(1)}%`})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                
                                {/* 항목별 인사이트 */}
                                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                                  {analysisResults.wcAnalysis.arInsight && (
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                      <span className="font-medium">매출채권:</span> {analysisResults.wcAnalysis.arInsight}
                                    </p>
                                  )}
                                  {analysisResults.wcAnalysis.inventoryInsight && (
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                      <span className="font-medium">재고자산:</span> {analysisResults.wcAnalysis.inventoryInsight}
                                    </p>
                                  )}
                                  {analysisResults.wcAnalysis.apInsight && (
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                      <span className="font-medium">매입채무:</span> {analysisResults.wcAnalysis.apInsight}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </section>
                          )}

                          {/* 리스크 요인 */}
                          {analysisResults.insights.riskFactors.length > 0 && (
                            <section>
                              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                <span className="w-1 h-4 bg-yellow-600 mr-2"></span>
                                리스크 요인
                              </h4>
                              <ul className="space-y-2">
                                {analysisResults.insights.riskFactors.map((risk, idx) => (
                                  <li key={idx} className="text-sm text-gray-700 leading-relaxed pl-3 border-l-2 border-yellow-200">
                                    {risk}
                                  </li>
                                ))}
                              </ul>
                            </section>
                          )}

                          {/* 관리 포인트 */}
                          {analysisResults.insights.actionItems.length > 0 && (
                            <section>
                              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                                <span className="w-1 h-4 bg-orange-600 mr-2"></span>
                                관리 포인트
                              </h4>
                              <ul className="space-y-2">
                                {analysisResults.insights.actionItems.map((action, idx) => (
                                  <li key={idx} className="text-sm text-gray-700 leading-relaxed pl-3 border-l-2 border-orange-200">
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            </section>
                          )}

                          {/* CFO 주요 질문 (접기/펼치기) */}
                          <section>
                            <button
                              onClick={() => setCfoQAExpanded(!cfoQAExpanded)}
                              className="w-full text-left text-sm font-bold text-gray-700 mb-3 flex items-center justify-between hover:text-gray-900 transition-colors"
                            >
                              <span className="flex items-center">
                                <span className="w-1 h-4 bg-red-600 mr-2"></span>
                                CFO 주요 질문
                              </span>
                              <span className="text-xs text-gray-500">
                                {cfoQAExpanded ? '▲ 접기' : '▼ 펼치기'}
                              </span>
                            </button>
                            
                            {cfoQAExpanded && (
                              <div className="space-y-4 pl-3 border-l-2 border-red-200">
                                {analysisResults.cfoQA.map((qa, idx) => (
                                  <div key={idx}>
                                    <div className="text-sm font-medium text-gray-800 mb-1">
                                      Q{idx + 1}. {qa.question}
                                    </div>
                                    <div className="text-sm text-gray-600 leading-relaxed pl-4">
                                      {qa.answer}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          데이터를 불러오는 중이거나 표시할 분석 내용이 없습니다.
                        </p>
                      )}
                    </aside>
                  </div>
                ) : (
                  <>
                    {workingCapitalData && (
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
                          data={workingCapitalData} 
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
                          columns={[...monthColumns, `${wcYear}년(합계)`, 'YoY']} 
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

        {/* 여신사용현황 */}
        {activeTab === 1 && (
          <div>
            <div className="bg-gray-100 border-b border-gray-300 px-6 py-3">
              <span className="text-sm font-medium text-gray-700">2025년 12월말 기준</span>
            </div>
            {loading && <div className="p-6 text-center">로딩 중...</div>}
            {error && <div className="p-6 text-center text-red-500">{error}</div>}
            {creditData && !loading && (
              <div className="p-6">
                <CreditStatus data={creditData} />
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

