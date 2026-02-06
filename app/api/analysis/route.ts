import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

// GET: 저장된 분석 내용 불러오기
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') || '2026';
    
    const key = `analysis:${year}`;
    const savedAnalysis = await kv.get(key);
    
    return NextResponse.json({ 
      success: true, 
      data: savedAnalysis 
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}

// POST: 분석 내용 저장하기
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, content } = body;
    
    if (!year || !content) {
      return NextResponse.json(
        { success: false, error: 'Year and content are required' },
        { status: 400 }
      );
    }
    
    const key = `analysis:${year}`;
    await kv.set(key, content);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Analysis saved successfully' 
    });
  } catch (error) {
    console.error('Error saving analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save analysis' },
      { status: 500 }
    );
  }
}
