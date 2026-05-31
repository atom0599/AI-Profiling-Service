// GET /api/health — 서버 상태 확인 (FastAPI /상태 → Next.js API route)

import { NextResponse } from "next/server";
import { 분석서비스 } from "@/lib/llm-service";

export async function GET() {
  const ollama연결 = await 분석서비스.서버상태확인();
  return NextResponse.json({
    서비스상태: ollama연결 ? "정상" : "Ollama 연결 안됨",
    Ollama연결: ollama연결,
    사용모델: 분석서비스.모델,
  });
}
