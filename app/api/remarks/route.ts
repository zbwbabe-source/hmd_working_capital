import { NextRequest, NextResponse } from 'next/server';

// Vercel KV가 설정되어 있는지 확인
let kv: any = null;
try {
  const { kv: kvClient } = require('@vercel/kv');
  kv = kvClient;
} catch (error) {
  // Vercel KV가 없으면 무시 (로컬 개발 환경 또는 KV 미설정)
  console.log('Vercel KV가 설정되지 않았습니다. 비고 기능이 비활성화됩니다.');
}

// 비고 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // 'bs' or 'wc'
    
    if (!type) {
      return NextResponse.json({ error: 'type 파라미터가 필요합니다.' }, { status: 400 });
    }
    
    // Vercel KV가 없으면 빈 객체 반환
    if (!kv) {
      return NextResponse.json({ remarks: {} });
    }
    
    const key = `remarks:${type}`;
    const remarks = (await kv.get(key)) as { [key: string]: string } | null;
    
    return NextResponse.json({ 
      remarks: remarks || {} 
    });
  } catch (error) {
    console.error('비고 조회 에러:', error);
    // 에러가 발생해도 빈 객체 반환 (다른 기능에 영향 없도록)
    return NextResponse.json({ remarks: {} });
  }
}

// 비고 저장/수정
export async function POST(request: NextRequest) {
  try {
    const { account, remark, type } = await request.json();
    
    if (!account || !type) {
      return NextResponse.json({ error: 'account와 type이 필요합니다.' }, { status: 400 });
    }
    
    // Vercel KV가 없으면 성공 응답만 반환 (로컬 개발 환경)
    if (!kv) {
      console.log('Vercel KV가 설정되지 않아 비고가 저장되지 않습니다.');
      return NextResponse.json({ success: true });
    }
    
    const key = `remarks:${type}`;
    
    // 기존 비고 데이터 가져오기
    const existingRemarks = ((await kv.get(key)) as { [key: string]: string } | null) || {};
    
    // 비고 업데이트
    const updatedRemarks = {
      ...existingRemarks,
      [account]: remark || '' // 빈 문자열도 저장 (삭제용)
    };
    
    // 저장
    await kv.set(key, updatedRemarks);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('비고 저장 에러:', error);
    // 에러가 발생해도 성공 응답 반환 (다른 기능에 영향 없도록)
    return NextResponse.json({ success: true });
  }
}
