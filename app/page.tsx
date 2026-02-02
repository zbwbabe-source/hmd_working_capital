'use client';

import { useState, useEffect } from 'react';
import Tabs from '@/components/Tabs';
import YearTabs from '@/components/YearTabs';
import FinancialTable from '@/components/FinancialTable';
import CreditStatus from '@/components/CreditStatus';
import { TableRow, CreditData, TabType } from '@/lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [cfYear, setCfYear] = useState<number>(2026);
  const [cfMonthsCollapsed, setCfMonthsCollapsed] = useState<boolean>(false); // 현금흐름표 월별 접기 (기본값: 펼침)
  const [cfData, setCfData] = useState<TableRow[] | null>(null);
  const [workingCapitalData, setWorkingCapitalData] = useState<TableRow[] | null>(null);
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const tabs = ['연간 자금계획', '여신사용현황'];
  const tabTypes: TabType[] = ['CF', 'CREDIT'];

  // 데이터 로딩
  const loadData = async (type: TabType, year?: number) => {
    setLoading(true);
    setError(null);

    try {
      let url = '';
      if (type === 'CF') {
        url = `/api/fs/cf?year=${year}`;
      } else if (type === 'CREDIT') {
        url = `/api/fs/credit`;
      } else if (type === 'WORKING_CAPITAL') {
        url = `/api/fs/working-capital?year=${year}`;
      }

      if (!url) return;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('데이터를 불러올 수 없습니다.');
      }

      const result = await response.json();

      if (type === 'CF') {
        setCfData(result.rows);
      } else if (type === 'WORKING_CAPITAL') {
        setWorkingCapitalData(result.rows);
      } else if (type === 'CREDIT') {
        setCreditData(result);
      }
    } catch (err) {
      console.error(err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    const currentType = tabTypes[activeTab];
    
    if (currentType === 'CF') {
      if (!cfData) {
        loadData('CF', cfYear);
      }
      if (!workingCapitalData) {
        loadData('WORKING_CAPITAL', cfYear);
      }
    } else if (currentType === 'CREDIT' && !creditData) {
      loadData('CREDIT');
    }
  }, [activeTab]);

  useEffect(() => {
    if (tabTypes[activeTab] === 'CF') {
      loadData('CF', cfYear);
      loadData('WORKING_CAPITAL', cfYear);
    }
  }, [cfYear]);

  // 월 컬럼 (1월~12월)
  const monthColumns = ['계정과목', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  
  // CF 컬럼 (합계 포함) - 동적으로 생성
  const cfColumns = [...monthColumns, `${cfYear}년(합계)`];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 상단 탭 */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* 내용 - 상단 탭 높이만큼 패딩 추가 */}
      <div className="p-0 pt-16">
        {/* CF - 현금흐름표 */}
        {activeTab === 0 && (
          <div>
            <div className="bg-gray-100 border-b border-gray-300">
              <div className="flex items-center gap-4 px-6 py-3">
                <YearTabs years={[2025, 2026]} activeYear={cfYear} onChange={setCfYear} />
                <button
                  onClick={() => setCfMonthsCollapsed(!cfMonthsCollapsed)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors shadow-sm"
                >
                  {cfMonthsCollapsed ? '월별 데이터 펼치기 ▶' : '월별 데이터 접기 ◀'}
                </button>
              </div>
            </div>
            {loading && <div className="p-6 text-center">로딩 중...</div>}
            {error && <div className="p-6 text-center text-red-500">{error}</div>}
            {cfData && !loading && (
              <>
                <div className="p-6">
                  <FinancialTable 
                    data={cfData} 
                    columns={cfColumns} 
                    showTotal 
                    isCashFlow={true}
                    compactLayout={true}
                    monthsCollapsed={cfMonthsCollapsed}
                    onMonthsToggle={() => setCfMonthsCollapsed(!cfMonthsCollapsed)}
                    currentYear={cfYear}
                  />
                </div>
                
                {/* 운전자본표 */}
                {workingCapitalData && (
                  <div className="px-6 pb-6">
                    <div className="mb-4 border-t-2 border-gray-400 pt-6">
                      <h2 className="text-lg font-bold text-gray-800 mb-4">운전자본표</h2>
                    </div>
                    <FinancialTable 
                      data={workingCapitalData} 
                      columns={[...monthColumns, `${cfYear}년(합계)`]} 
                      showTotal
                      isCashFlow={true}
                      monthsCollapsed={cfMonthsCollapsed}
                      onMonthsToggle={() => setCfMonthsCollapsed(!cfMonthsCollapsed)}
                      currentYear={cfYear}
                    />
                  </div>
                )}
              </>
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

