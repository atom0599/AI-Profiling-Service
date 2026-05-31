import { NextRequest, NextResponse } from "next/server";

const PROFILING = process.env.PROFILING_URL ?? "http://honeypot-profiling:8080";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-profiling-token");
  if (!token) return NextResponse.json({ error: "토큰 없음" }, { status: 401 });

  const res = await fetch(`${PROFILING}/api/projects/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  try {
    const data: unknown = JSON.parse(text);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Spring Boot 응답 오류", status: res.status }, { status: res.status });
  }
}
