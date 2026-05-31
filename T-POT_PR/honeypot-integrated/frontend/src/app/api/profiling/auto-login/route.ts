import { NextRequest, NextResponse } from "next/server";

const PROFILING = process.env.PROFILING_URL ?? "http://honeypot-profiling:8080";
const FASTAPI   = process.env.FASTAPI_INTERNAL_URL ?? "http://honeypot-backend:8000";

export async function POST(req: NextRequest) {
  const fastApiToken = req.headers.get("x-fastapi-token");
  if (!fastApiToken) return NextResponse.json({ error: "토큰 없음" }, { status: 401 });

  // FastAPI에서 현재 유저명 조회
  const meRes = await fetch(`${FASTAPI}/api/users/me`, {
    headers: { Authorization: `Bearer ${fastApiToken}` },
  });
  if (!meRes.ok) return NextResponse.json({ error: "인증 실패" }, { status: 401 });

  const me = await meRes.json() as { username: string };
  const email = `${me.username}@honeypot.local`;

  // Spring Boot 자동 로그인
  const loginRes = await fetch(`${PROFILING}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "honeypot-internal" }),
  });

  if (!loginRes.ok) return NextResponse.json({ error: "Spring Boot 로그인 실패" }, { status: 502 });
  const data = await loginRes.json() as { token: string };
  return NextResponse.json({ token: data.token, email });
}
