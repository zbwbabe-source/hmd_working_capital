'use client';

import { useState, useEffect } from 'react';

interface EditableAnalysisProps {
  year: number;
  initialContent: {
    keyInsights: string[];
    cfAnalysis: any;
    wcAnalysis: any;
    riskFactors: string[];
    actionItems: string[];
  } | null;
  onSave?: () => void;
}

export default function EditableAnalysis({ year, initialContent, onSave }: EditableAnalysisProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState<string>('');
  const [savedCustomContent, setSavedCustomContent] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 초기 로드 시 저장된 내용 불러오기
  useEffect(() => {
    const loadSavedContent = async () => {
      try {
        const response = await fetch(`/api/analysis?year=${year}`);
        const result = await response.json();
        if (result.success && result.data) {
          setSavedCustomContent(result.data);
        }
      } catch (error) {
        console.error('Failed to load saved content:', error);
      }
    };
    
    loadSavedContent();
  }, [year]);

  // 편집 모드 시작
  const handleEdit = () => {
    if (savedCustomContent) {
      setEditedContent(savedCustomContent);
    } else if (initialContent) {
      // 기본 분석 내용을 텍스트로 변환
      const defaultText = generateDefaultText(initialContent);
      setEditedContent(defaultText);
    }
    setIsEditing(true);
  };

  // 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year,
          content: editedContent,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSavedCustomContent(editedContent);
        setIsEditing(false);
        onSave?.();
      } else {
        alert('저장에 실패했습니다: ' + result.error);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 취소
  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent('');
  };

  // 기본 분석 내용을 텍스트로 변환
  const generateDefaultText = (content: any): string => {
    let text = '';
    
    if (content.keyInsights && content.keyInsights.length > 0) {
      text += '## 핵심 인사이트\n\n';
      content.keyInsights.forEach((insight: string) => {
        text += `• ${insight}\n\n`;
      });
    }

    if (content.cfAnalysis?.categories?.length > 0) {
      text += `## ${year}년 현금흐름표\n\n`;
      content.cfAnalysis.categories.forEach((cat: any) => {
        text += `**${cat.account}**\n`;
        text += `연간: ${Math.round(cat.annualTotal).toLocaleString('ko-KR')} K HKD\n`;
        if (cat.yoyAbsolute !== null) {
          text += `전년 대비: ${Math.round(cat.yoyAbsolute).toLocaleString('ko-KR')} K HKD\n`;
        }
        text += '\n';
      });
    }

    if (content.wcAnalysis?.categories?.length > 0) {
      text += `## ${year}년 운전자본표\n\n`;
      content.wcAnalysis.categories.forEach((cat: any) => {
        text += `**${cat.account}**\n`;
        text += `연간: ${Math.round(cat.annualTotal).toLocaleString('ko-KR')} K HKD\n`;
        if (cat.yoyAbsolute !== null) {
          text += `전년 대비: ${Math.round(cat.yoyAbsolute).toLocaleString('ko-KR')} K HKD\n`;
        }
        text += '\n';
      });
      
      if (content.wcAnalysis.arInsight) {
        text += `**매출채권:** ${content.wcAnalysis.arInsight}\n\n`;
      }
      if (content.wcAnalysis.inventoryInsight) {
        text += `**재고자산:** ${content.wcAnalysis.inventoryInsight}\n\n`;
      }
      if (content.wcAnalysis.apInsight) {
        text += `**매입채무:** ${content.wcAnalysis.apInsight}\n\n`;
      }
    }

    if (content.riskFactors && content.riskFactors.length > 0) {
      text += '## 리스크 요인\n\n';
      content.riskFactors.forEach((risk: string) => {
        text += `• ${risk}\n\n`;
      });
    }

    if (content.actionItems && content.actionItems.length > 0) {
      text += '## 관리 포인트\n\n';
      content.actionItems.forEach((action: string) => {
        text += `• ${action}\n\n`;
      });
    }

    return text;
  };

  // 렌더링할 내용 결정
  const displayContent = savedCustomContent || (initialContent ? generateDefaultText(initialContent) : '');

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 pb-3 border-b-2 border-gray-300">설명과 분석</h3>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium rounded bg-gray-300 text-gray-700 hover:bg-gray-400 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:bg-blue-300"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full h-[calc(100vh-300px)] p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder="분석 내용을 입력하세요..."
        />
        <p className="text-xs text-gray-500">
          Markdown 형식을 사용할 수 있습니다. (## 제목, **굵게**, • 목록 등)
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 pb-3 border-b-2 border-gray-300">
        <h3 className="text-xl font-bold text-gray-900">설명과 분석</h3>
        <button
          onClick={handleEdit}
          className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          편집
        </button>
      </div>
      <div className="prose prose-sm max-w-none">
        {displayContent.split('\n').map((line, idx) => {
          if (line.startsWith('## ')) {
            return (
              <h4 key={idx} className="text-base font-semibold text-gray-800 mt-4 mb-3 flex items-center">
                <span className="w-1.5 h-5 bg-blue-600 mr-2.5 rounded"></span>
                {line.replace('## ', '')}
              </h4>
            );
          } else if (line.startsWith('**') && line.endsWith('**')) {
            return (
              <p key={idx} className="font-semibold text-gray-900 mb-1 mt-3">
                {line.replace(/\*\*/g, '')}
              </p>
            );
          } else if (line.startsWith('• ')) {
            return (
              <p key={idx} className="text-base text-gray-700 leading-relaxed pl-4 border-l-3 border-blue-200 mb-3">
                {line.replace('• ', '')}
              </p>
            );
          } else if (line.trim()) {
            return (
              <p key={idx} className="text-sm text-gray-700 mb-2">
                {line}
              </p>
            );
          }
          return null;
        })}
      </div>
      {!displayContent && (
        <p className="text-sm text-gray-500">
          데이터를 불러오는 중이거나 표시할 분석 내용이 없습니다.
        </p>
      )}
    </div>
  );
}
