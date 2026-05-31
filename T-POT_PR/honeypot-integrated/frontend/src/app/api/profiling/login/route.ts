import { NextRequest, NextResponse } from "next/server";

const PROFILING = process.env.PROFILING_URL ?? "http://honeypot-profiling:8080";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${PROFILING}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
