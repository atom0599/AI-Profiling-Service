"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, logout } from "@/lib/api-client";

interface AnalysisResult {
  riskScore: number;
  severity: string;
  summary: string;
  solution: string;
}

interface AttackLog {
  attackLogId: number;
  attackType: string;
  ipAddress: string;
  payload: string;
  createdAt: string;
  analysis: AnalysisResult | null;
}

type SeverityFilter = "ALL" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const SEV_COLOR: Record<string, string> = {
  LOW: "#22c55e", MEDIUM: "#f59e0b", HIGH: "#ef4444", CRITICAL: "#dc2626", UNKNOWN: "#64748b",
};
const SEV_BG: Record<string, string> = {
  LOW: "rgba(34,197,94,0.08)", MEDIUM: "rgba(245,158,11,0.08)",
  HIGH: "rgba(239,68,68,0.08)", CRITICAL: "rgba(220,38,38,0.12)", UNKNOWN: "rgba(100,116,139,0.06)",
};
const SEV_KO: Record<string, string> = {
  LOW: "낮음", MEDIUM: "보통", HIGH: "높음", CRITICAL: "치명", UNKNOWN: "미분석",
};

export default function ProfilingPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AttackLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<SeverityFilter>("ALL");
  const [sort, setSort] = useState<"time" | "risk">("time");
  const [expanded, setExpanded] = useState<number | null>(null);

  const getProfilingToken = useCallback(async (fastApiToken: string): Promise<string> => {
    // 항상 새 토큰 발급 (Spring Boot JWT 만료 1시간이므로 캐시 안 함)
    localStorage.removeItem("profiling_token");
    const res = await fetch("/api/profiling/auto-login", {
      method: "POST",
      headers: { "x-fastapi-token": fastApiToken },
    });
    if (!res.ok) throw new Error("Spring Boot 자동 로그인 실패 — 프로파일링 서비스를 확인하세요");
    const data = await res.json() as { token: string };
    return data.token;
  }, []);

  const fetchAllLogs = useCallback(async (profilingToken: string) => {
    const projRes = await fetch("/api/profiling/projects", {
      headers: { "x-profiling-token": profilingToken },
    });
    const projData = await projRes.json() as { id: number }[] | { error: string };
    if (!projRes.ok || "error" in projData) throw new Error("프로젝트 조회 실패 (토큰 만료 또는 권한 없음)");

    const projects = projData as { id: number }[];
    const allLogs: AttackLog[] = [];
    await Promise.all(
      projects.map(async (p) => {
        const logRes = await fetch(`/api/profiling/logs/${p.id}`, {
          headers: { "x-profiling-token": profilingToken },
        });
        if (logRes.ok) {
          const data = await logRes.json() as AttackLog[] | { error: string };
          if (Array.isArray(data)) allLogs.push(...data);
        }
      })
    );
    return allLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, []);

  useEffect(() => {
    const init = async () => {
      const fastApiToken = getToken();
      if (!fastApiToken) { router.push("/login"); return; }

      try {
        const profilingToken = await getProfilingToken(fastApiToken);
        const allLogs = await fetchAllLogs(profilingToken);
        setLogs(allLogs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "데이터를 불러올 수 없습니다");
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, [router, fetchAllLogs, getProfilingToken]);

  // 통계
  const total = logs.length;
  const analyzed = logs.filter((l) => l.analysis).length;
  const avgRisk = analyzed
    ? Math.round(logs.filter((l) => l.analysis).reduce((s, l) => s + (l.analysis?.riskScore ?? 0), 0) / analyzed)
    : 0;
  const sevCounts = logs.reduce<Record<string, number>>((acc, l) => {
    const s = l.analysis?.severity ?? "UNKNOWN";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const topSev = Object.entries(sevCounts).sort((a, b) => {
    const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
    return (order[b[0] as keyof typeof order] ?? 0) - (order[a[0] as keyof typeof order] ?? 0);
  })[0]?.[0] ?? "UNKNOWN";

  // 필터 + 정렬
  const filtered = logs
    .filter((l) => filter === "ALL" || (l.analysis?.severity ?? "UNKNOWN") === filter)
    .sort((a, b) => {
      if (sort === "risk") return (b.analysis?.riskScore ?? 0) - (a.analysis?.riskScore ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#07090f}
        .pg{min-height:100vh;background:#07090f;color:#cbd5e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        header{background:rgba(7,9,15,0.95);backdrop-filter:blur(12px);padding:0 28px;display:flex;align-items:center;justify-content:space-between;height:58px;border-bottom:1px solid rgba(255,255,255,0.07);position:sticky;top:0;z-index:100}
        .logo{display:flex;align-items:center;gap:10px}
        .logo-icon{font-size:1.3rem}
        .logo-title{font-size:0.97rem;font-weight:700;color:#e2e8f0;letter-spacing:-0.02em}
        .logo-sub{font-size:0.72rem;color:#64748b}
        nav{display:flex;gap:4px}
        .nav-link{padding:5px 12px;border-radius:7px;font-size:0.78rem;font-weight:600;color:#64748b;text-decoration:none;transition:all 0.18s}
        .nav-link:hover{color:#e2e8f0;background:rgba(255,255,255,0.06)}
        .nav-link.active{color:#a5b4fc;background:rgba(99,102,241,0.18)}
        .logout-btn{padding:5px 12px;border-radius:7px;font-size:0.78rem;font-weight:600;color:#64748b;background:none;border:1px solid rgba(255,255,255,0.08);cursor:pointer}

        .body{max-width:1200px;margin:0 auto;padding:24px}

        /* 통계 */
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
        .stat-card{background:#0d1117;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 20px}
        .stat-label{font-size:0.72rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px}
        .stat-value{font-size:1.8rem;font-weight:800;color:#e2e8f0;letter-spacing:-0.02em;line-height:1}
        .stat-sub{font-size:0.73rem;color:#64748b;margin-top:5px}

        /* 심각도 바 */
        .sev-bar{display:flex;height:6px;border-radius:3px;overflow:hidden;gap:2px;margin-top:10px}
        .sev-seg{height:100%;border-radius:2px;transition:width 0.5s}

        /* 필터/정렬 */
        .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
        .filter-tabs{display:flex;gap:4px}
        .filter-tab{padding:5px 12px;border-radius:20px;font-size:0.76rem;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#64748b;cursor:pointer;transition:all 0.18s}
        .filter-tab.active{color:#e2e8f0;background:rgba(99,102,241,0.18);border-color:rgba(99,102,241,0.4)}
        .sort-select{margin-left:auto;padding:5px 10px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#94a3b8;font-size:0.77rem;cursor:pointer;outline:none}
        .log-count{font-size:0.76rem;color:#64748b;background:rgba(255,255,255,0.04);padding:3px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.07)}

        /* 로그 카드 */
        .log-card{background:#0d1117;border:1px solid rgba(255,255,255,0.07);border-radius:12px;margin-bottom:10px;overflow:hidden;transition:border-color 0.18s,transform 0.15s;cursor:pointer}
        .log-card:hover{transform:translateY(-1px)}
        .log-card.open{border-color:rgba(99,102,241,0.3)}
        .log-header{display:flex;align-items:center;gap:10px;padding:14px 16px}
        .sev-stripe{width:4px;height:100%;border-radius:2px;flex-shrink:0;align-self:stretch;min-height:20px}
        .log-type{font-size:0.9rem;font-weight:700;color:#e2e8f0;flex:1}
        .sev-badge{padding:2px 9px;border-radius:20px;font-size:0.7rem;font-weight:700;flex-shrink:0}
        .risk-bar-wrap{display:flex;align-items:center;gap:6px;flex-shrink:0}
        .risk-bar-bg{width:60px;height:5px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden}
        .risk-bar-fill{height:100%;border-radius:3px;transition:width 0.4s}
        .risk-num{font-size:0.73rem;font-weight:700;width:28px;text-align:right;flex-shrink:0}
        .log-meta{font-size:0.73rem;color:#64748b;display:flex;gap:12px;padding:0 16px 8px;flex-wrap:wrap}
        .chevron{font-size:0.7rem;color:#475569;transition:transform 0.2s;flex-shrink:0}
        .chevron.open{transform:rotate(180deg)}

        /* 펼쳐진 상세 */
        .log-detail{border-top:1px solid rgba(255,255,255,0.06);padding:16px}
        .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
        .detail-section{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:12px}
        .detail-label{font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px}
        .detail-value{font-size:0.81rem;color:#94a3b8;line-height:1.65}
        .payload-box{font-family:'SF Mono','Fira Code',monospace;font-size:0.71rem;color:#67e8f9;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:6px;padding:10px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow-y:auto;grid-column:1/-1}

        /* 상태 */
        .center{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;gap:12px;color:#475569}
        .spinner{width:28px;height:28px;border:3px solid rgba(255,255,255,0.07);border-top-color:#6366f1;border-radius:50%;animation:spin 0.7s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .err-box{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:16px 20px;color:#f87171;font-size:0.85rem;text-align:center;max-width:500px;margin:40px auto;line-height:1.7}
        .empty-icon{font-size:2.5rem;margin-bottom:4px}
      `}</style>

      <div className="pg">
        <header>
          <div className="logo">
            <span className="logo-icon">🍯</span>
            <div>
              <div className="logo-title">허니팟 공격 분석 시스템</div>
              <div className="logo-sub">AI 기반 사이버 공격 자동 분석</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <nav>
              <Link href="/dashboard" className="nav-link">📊 분석</Link>
              <Link href="/honeypot" className="nav-link">🍯 허니팟</Link>
              <Link href="/profiling" className="nav-link active">📋 공격 이력</Link>
              <Link href="/ml" className="nav-link">🤖 ML 분류</Link>
            </nav>
            <button className="logout-btn" onClick={() => { logout(); router.push("/login"); }}>로그아웃</button>
          </div>
        </header>

        <div className="body">
          {loading ? (
            <div className="center">
              <div className="spinner" />
              <span style={{ fontSize: "0.85rem" }}>분석 데이터 불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="err-box">
              ⚠️ {error}<br />
              <span style={{ fontSize: "0.76rem", color: "#f87171aa", marginTop: 6, display: "block" }}>
                Spring Boot 프로파일링 서비스(:8090)가 실행 중인지 확인하세요
              </span>
            </div>
          ) : (
            <>
              {/* 통계 카드 */}
              <div className="stats">
                <div className="stat-card">
                  <div className="stat-label">총 공격 탐지</div>
                  <div className="stat-value">{total}</div>
                  <div className="stat-sub">시나리오 실행으로 수집된 공격</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">AI 분석 완료</div>
                  <div className="stat-value" style={{ color: "#4ade80" }}>{analyzed}</div>
                  <div className="stat-sub">Llama 3.1 분석 성공 {total > 0 ? `(${Math.round(analyzed / total * 100)}%)` : ""}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">평균 위험도</div>
                  <div className="stat-value" style={{ color: avgRisk >= 70 ? "#ef4444" : avgRisk >= 40 ? "#f59e0b" : "#22c55e" }}>
                    {analyzed ? avgRisk : "—"}
                  </div>
                  <div className="stat-sub">100점 기준</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">심각도 분포</div>
                  <div className="stat-value" style={{ color: SEV_COLOR[topSev] ?? "#64748b", fontSize: "1.1rem", paddingTop: 4 }}>
                    {SEV_KO[topSev] ?? "—"} {topSev !== "UNKNOWN" ? "최다" : ""}
                  </div>
                  <div className="sev-bar">
                    {["CRITICAL","HIGH","MEDIUM","LOW","UNKNOWN"].map((s) => (
                      <div key={s} className="sev-seg" style={{
                        background: SEV_COLOR[s],
                        width: total ? `${((sevCounts[s] ?? 0) / total * 100)}%` : "0%",
                        opacity: 0.8,
                      }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* 필터/정렬 툴바 */}
              <div className="toolbar">
                <div className="filter-tabs">
                  {(["ALL","CRITICAL","HIGH","MEDIUM","LOW"] as SeverityFilter[]).map((f) => (
                    <button key={f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                      {f === "ALL" ? `전체 ${total}` : `${SEV_KO[f]} ${sevCounts[f] ?? 0}`}
                    </button>
                  ))}
                </div>
                <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value as "time" | "risk")}>
                  <option value="time">최신순</option>
                  <option value="risk">위험도순</option>
                </select>
                <span className="log-count">{filtered.length}건</span>
              </div>

              {/* 로그 목록 */}
              {filtered.length === 0 ? (
                <div className="center">
                  <div className="empty-icon">🔍</div>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#64748b" }}>해당 심각도의 공격이 없습니다</span>
                  <span style={{ fontSize: "0.78rem", color: "#475569" }}>시나리오를 실행하면 공격 로그가 여기에 표시됩니다</span>
                </div>
              ) : (
                filtered.map((log) => {
                  const sev = log.analysis?.severity ?? "UNKNOWN";
                  const risk = log.analysis?.riskScore ?? 0;
                  const isOpen = expanded === log.attackLogId;
                  return (
                    <div
                      key={log.attackLogId}
                      className={`log-card ${isOpen ? "open" : ""}`}
                      onClick={() => setExpanded(isOpen ? null : log.attackLogId)}
                    >
                      <div className="log-header">
                        <div className="sev-stripe" style={{ background: SEV_COLOR[sev] ?? SEV_COLOR.UNKNOWN }} />
                        <span className="log-type">{log.attackType}</span>
                        <span className="sev-badge" style={{
                          background: `${SEV_COLOR[sev]}22`,
                          color: SEV_COLOR[sev],
                          border: `1px solid ${SEV_COLOR[sev]}44`,
                        }}>
                          {SEV_KO[sev]}
                        </span>
                        {log.analysis && (
                          <div className="risk-bar-wrap">
                            <div className="risk-bar-bg">
                              <div className="risk-bar-fill" style={{
                                width: `${risk}%`,
                                background: risk >= 70 ? "#ef4444" : risk >= 40 ? "#f59e0b" : "#22c55e",
                              }} />
                            </div>
                            <span className="risk-num" style={{ color: risk >= 70 ? "#f87171" : risk >= 40 ? "#fbbf24" : "#4ade80" }}>
                              {risk}
                            </span>
                          </div>
                        )}
                        <span className={`chevron ${isOpen ? "open" : ""}`}>▼</span>
                      </div>
                      <div className="log-meta">
                        <span>🌐 {log.ipAddress}</span>
                        <span>🕐 {new Date(log.createdAt).toLocaleString("ko-KR")}</span>
                        <span style={{ color: "#334155" }}>#{log.attackLogId}</span>
                      </div>

                      {isOpen && (
                        <div className="log-detail" onClick={(e) => e.stopPropagation()}>
                          <div className="detail-grid">
                            {log.analysis ? (
                              <>
                                <div className="detail-section">
                                  <div className="detail-label">AI 분석 요약</div>
                                  <div className="detail-value">{log.analysis.summary}</div>
                                </div>
                                <div className="detail-section">
                                  <div className="detail-label">대응 방안</div>
                                  <div className="detail-value">{log.analysis.solution}</div>
                                </div>
                              </>
                            ) : (
                              <div className="detail-section" style={{ gridColumn: "1/-1" }}>
                                <div className="detail-label">분석 상태</div>
                                <div className="detail-value" style={{ color: "#64748b" }}>AI 분석 결과가 없습니다</div>
                              </div>
                            )}
                            {log.payload && (
                              <div className="detail-section payload-box">
                                <div className="detail-label" style={{ marginBottom: 8 }}>Payload</div>
                                {log.payload}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
