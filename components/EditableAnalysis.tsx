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

  // 섹션별로 컨텐츠 파싱
  const parseContentIntoSections = (content: string) => {
    const sections: { title: string; lines: string[] }[] = [];
    let currentSection: { title: string; lines: string[] } | null = null;
    
    content.split('\n').forEach(line => {
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.replace('## ', ''),
          lines: []
        };
      } else if (currentSection && line.trim()) {
        currentSection.lines.push(line);
      }
    });
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  };

  // 텍스트에서 중요한 부분을 강조 표시
  const highlightImportantText = (text: string) => {
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    
    // 강조할 패턴들
    const patterns = [
      // 금액 (숫자 + K/M HKD, 천 HKD 등)
      { regex: /([+△]?\d{1,3}(?:,\d{3})*(?:\.\d+)?[KM]?\s*HKD)/g, color: 'text-blue-700 font-semibold' },
      // 백분율
      { regex: /([+△]?\d+(?:\.\d+)?%)/g, color: 'text-green-700 font-semibold' },
      // Target, 개선, 증가, 감소, 플러스 전환 등 중요 단어
      { regex: /(Target|개선|증가|감소|플러스 전환|구조적|현금창출|상환|투자|재고일수)/g, color: 'text-orange-600 font-medium' },
    ];

    let processedText = text;
    const highlights: { start: number; end: number; className: string; text: string }[] = [];

    // 모든 패턴 찾기
    patterns.forEach(({ regex, color }) => {
      const matches = Array.from(text.matchAll(regex));
      matches.forEach(match => {
        if (match.index !== undefined) {
          highlights.push({
            start: match.index,
            end: match.index + match[0].length,
            className: color,
            text: match[0]
          });
        }
      });
    });

    // 위치 순으로 정렬하고 겹치는 부분 제거
    highlights.sort((a, b) => a.start - b.start);
    const filtered = highlights.filter((h, i) => {
      if (i === 0) return true;
      return h.start >= highlights[i - 1].end;
    });

    // JSX 엘리먼트 생성
    filtered.forEach((h, i) => {
      // 이전 강조 끝부터 현재 강조 시작까지의 일반 텍스트
      if (h.start > lastIndex) {
        parts.push(<span key={`text-${i}`}>{text.substring(lastIndex, h.start)}</span>);
      }
      // 강조 텍스트
      parts.push(
        <span key={`highlight-${i}`} className={h.className}>
          {h.text}
        </span>
      );
      lastIndex = h.end;
    });

    // 마지막 남은 텍스트
    if (lastIndex < text.length) {
      parts.push(<span key="text-last">{text.substring(lastIndex)}</span>);
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  const sections = parseContentIntoSections(displayContent);

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
      
      {sections.length > 0 ? (
        <div className="space-y-6">
          {sections.map((section, sectionIdx) => (
            <div 
              key={sectionIdx} 
              className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm"
            >
              <h4 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500 flex items-center">
                <span className="w-1 h-5 bg-blue-600 mr-2.5 rounded"></span>
                {section.title}
              </h4>
              <div className="space-y-2">
                {section.lines.map((line, lineIdx) => {
                  if (line.startsWith('**') && line.includes('**')) {
                    const cleanText = line.replace(/\*\*/g, '');
                    return (
                      <p key={lineIdx} className="font-semibold text-gray-900 mb-1 mt-3 text-sm">
                        {highlightImportantText(cleanText)}
                      </p>
                    );
                  } else if (line.startsWith('• ') || line.startsWith('✓ ')) {
                    const symbol = line.startsWith('✓ ') ? '✓' : '•';
                    const text = line.substring(2);
                    return (
                      <div key={lineIdx} className="flex items-start mb-3">
                        <span className="text-blue-600 mr-2 mt-0.5 flex-shrink-0">{symbol}</span>
                        <p className="text-sm text-gray-700 leading-relaxed flex-1">
                          {highlightImportantText(text)}
                        </p>
                      </div>
                    );
                  } else if (line.startsWith('→ ')) {
                    return (
                      <p key={lineIdx} className="text-sm text-gray-600 pl-6 mb-2">
                        {highlightImportantText(line)}
                      </p>
                    );
                  } else if (line.trim()) {
                    return (
                      <p key={lineIdx} className="text-sm text-gray-700 mb-2 leading-relaxed">
                        {highlightImportantText(line)}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          데이터를 불러오는 중이거나 표시할 분석 내용이 없습니다.
        </p>
      )}
    </div>
  );
}
