"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getToken, logout,
  getMyContainers, listScenarios, runScenario, getHistory,
  generateDataset, getDatasetStatus,
  createLogSocket, controlContainer,
  type ContainerStatus, type ScenarioStatus, type ScenarioRun, type DatasetStatus,
} from "@/lib/api-client";

// ── 상태 배지 ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    running:   { bg: "#dcfce7", color: "#166534", label: "실행중" },
    exited:    { bg: "#fee2e2", color: "#991b1b", label: "중지됨" },
    not_found: { bg: "#f1f5f9", color: "#64748b", label: "없음" },
  };
  const s = map[status] ?? { bg: "#fef9c3", color: "#92400e", label: status };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

// ── 컨테이너 패널 ─────────────────────────────────────────────────────────────

function ContainerPanel({ containers, onRefresh }: { containers: ContainerStatus[]; onRefresh?: () => void }) {
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [openLog, setOpenLog] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [ctrlErr, setCtrlErr] = useState<string>("");

  const openLogStream = (name: string) => {
    if (wsRef.current) wsRef.current.close();
    setLogs((p) => ({ ...p, [name]: [] }));
    setOpenLog(openLog === name ? null : name);
    if (openLog === name) return;
    wsRef.current = createLogSocket(name, (line) => {
      setLogs((p) => ({ ...p, [name]: [...(p[name] ?? []).slice(-199), line] }));
    });
  };

  const handleControl = async (name: string, action: "start" | "stop" | "restart") => {
    setCtrlErr("");
    setRefreshing(name);
    try {
      await controlContainer(name, action);
      setTimeout(() => onRefresh?.(), 1000);
    } catch (e) {
      setCtrlErr((e as Error).message);
    } finally {
      setRefreshing(null);
    }
  };

  const ICON: Record<string, string> = {
    cowrie: "🐚", heralding: "🔐", opencanary: "🐤", snare: "🕷️",
    tanner: "🔬", dionaea: "🧬", mailoney: "📧", conpot: "⚙️",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ctrlErr && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", color: "#b91c1c", fontSize: "0.82rem" }}>
          {ctrlErr}
        </div>
      )}
      {containers.map((c) => (
        <div key={c.name} style={{ border: "1.5px solid #e8ecf0", borderRadius: 12, overflow: "hidden", background: "white" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.3rem" }}>{ICON[c.honeypot] ?? "🍯"}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>{c.honeypot}</div>
                <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#94a3b8" }}>{c.name}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge status={c.status} />
              {refreshing === c.name && <span style={{ fontSize: "0.72rem", color: "#6366f1" }}>처리중...</span>}
              {["start", "stop", "restart"].map((a) => (
                <button key={a} onClick={() => handleControl(c.name, a as "start" | "stop" | "restart")}
                  disabled={!!refreshing}
                  style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#374151", fontSize: "0.74rem", fontWeight: 600, cursor: refreshing ? "not-allowed" : "pointer", opacity: refreshing ? 0.6 : 1 }}>
                  {a === "start" ? "시작" : a === "stop" ? "중지" : "재시작"}
                </button>
              ))}
              <button onClick={() => openLogStream(c.name)}
                style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", fontSize: "0.74rem", fontWeight: 600, cursor: "pointer" }}>
                {openLog === c.name ? "로그닫기" : "로그"}
              </button>
            </div>
          </div>
          {openLog === c.name && (
            <div style={{ background: "#020817", padding: "12px 16px", maxHeight: 180, overflowY: "auto", fontFamily: "monospace", fontSize: "0.76rem", color: "#a5f3fc", lineHeight: 1.6 }}>
              {(logs[c.name] ?? []).length === 0
                ? <span style={{ color: "#475569" }}>로그 대기중...</span>
                : (logs[c.name] ?? []).map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 시나리오 패널 ─────────────────────────────────────────────────────────────

function ScenarioPanel({ scenarios, onRun }: { scenarios: ScenarioStatus[]; onRun: (id: string) => Promise<void> }) {
  const [running, setRunning] = useState<string | null>(null);

  const handle = async (id: string) => {
    setRunning(id);
    try { await onRun(id); } finally { setRunning(null); }
  };

  const stateMap: Record<string, { color: string; label: string }> = {
    done:    { color: "#166534", label: "완료" },
    running: { color: "#92400e", label: "실행중" },
    failed:  { color: "#991b1b", label: "실패" },
    idle:    { color: "#64748b", label: "대기" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {scenarios.map((sc) => {
        const st = stateMap[sc.state] ?? { color: "#64748b", label: sc.state };
        return (
          <div key={sc.id} style={{ border: "1.5px solid #e8ecf0", borderRadius: 12, padding: "14px 16px", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b", marginBottom: 4 }}>
                {sc.name}
                <span style={{ marginLeft: 8, fontSize: "0.7rem", fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: 6, padding: "1px 7px" }}>{sc.label}</span>
              </div>
              <span style={{ fontSize: "0.74rem", fontWeight: 600, color: st.color }}>● {st.label}</span>
              {sc.finished_at && (
                <span style={{ marginLeft: 10, fontSize: "0.7rem", color: "#94a3b8" }}>{new Date(sc.finished_at).toLocaleString()}</span>
              )}
            </div>
            <button onClick={() => handle(sc.id)} disabled={sc.state === "running" || running === sc.id}
              style={{ padding: "8px 20px", borderRadius: 9, border: "none", background: sc.state === "running" ? "#e2e8f0" : "#0f172a", color: sc.state === "running" ? "#94a3b8" : "white", fontSize: "0.82rem", fontWeight: 700, cursor: sc.state === "running" ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
              {running === sc.id ? "실행중..." : "실행"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── 히스토리 패널 ─────────────────────────────────────────────────────────────

function HistoryPanel({ runs }: { runs: ScenarioRun[] }) {
  return (
    <div style={{ background: "white", borderRadius: 12, border: "1.5px solid #e8ecf0", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e8ecf0" }}>
            {["시나리오", "라벨", "상태", "완료 시각"].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontWeight: 700, color: "#64748b", fontSize: "0.76rem" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={r.id} style={{ borderBottom: i < runs.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <td style={{ padding: "11px 16px", fontWeight: 600, color: "#1e293b" }}>{r.scenario_name}</td>
              <td style={{ padding: "11px 16px", color: "#64748b" }}>{r.label}</td>
              <td style={{ padding: "11px 16px" }}>
                <span style={{ color: r.state === "done" ? "#166534" : "#991b1b", fontWeight: 700, fontSize: "0.78rem" }}>
                  {r.state === "done" ? "✓ 완료" : "✗ 실패"}
                </span>
              </td>
              <td style={{ padding: "11px 16px", color: "#94a3b8", fontSize: "0.76rem" }}>
                {r.finished_at ? new Date(r.finished_at).toLocaleString("ko-KR") : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function HoneypotPage() {
  const router = useRouter();
  const [containers, setContainers] = useState<ContainerStatus[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioStatus[]>([]);
  const [history, setHistory] = useState<ScenarioRun[]>([]);
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<"containers" | "scenarios" | "history" | "dataset">("containers");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    Promise.all([
      getMyContainers().then(setContainers),
      listScenarios().then(setScenarios),
      getHistory().then(setHistory),
      getDatasetStatus().then(setDatasetStatus),
    ])
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const handleRun = async (id: string) => {
    try {
      await runScenario(id);
      setScenarios(await listScenarios());
    } catch (e) { setError((e as Error).message); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateDataset();
      setDatasetStatus(await getDatasetStatus());
    } catch (e) { setError((e as Error).message); }
    finally { setGenerating(false); }
  };

  const handleDownload = async (filename: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/dataset/download?filename=${filename}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!res.ok) { setError("다운로드 실패: 파일이 없거나 권한이 없습니다."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); }
  };

  const TABS = [
    { key: "containers", label: "🍯 컨테이너", count: containers.filter(c => c.status === "running").length },
    { key: "scenarios",  label: "⚡ 시나리오",  count: scenarios.length },
    { key: "history",    label: "📋 히스토리",  count: history.length },
    { key: "dataset",    label: "📦 데이터셋",  count: null },
  ] as const;

  return (
    <>
      <style>{`
        body { background: #f0f4f8; color: #1a1a2e; min-height: 100vh; }
        header { background: #0f172a; color: white; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; height: 60px; box-shadow: 0 2px 16px rgba(0,0,0,0.4); }
        .헤더왼쪽 { display: flex; align-items: center; gap: 12px; }
        .헤더nav { display: flex; align-items: center; gap: 2px; }
        .헤더nav-링크 { padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #94a3b8; text-decoration: none; transition: all 0.2s; }
        .헤더nav-링크:hover { color: white; background: rgba(255,255,255,0.08); }
        .헤더nav-링크.활성 { color: white; background: rgba(99,102,241,0.25); }
        .로그아웃버튼 { padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #94a3b8; background: none; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: all 0.2s; }
        .로그아웃버튼:hover { color: #f87171; border-color: #f87171; }
        .메인 { max-width: 1100px; margin: 0 auto; padding: 28px 28px; }
        .페이지헤더 { margin-bottom: 24px; }
        .페이지제목 { font-size: 1.4rem; font-weight: 900; color: #1e293b; }
        .페이지부제 { font-size: 0.82rem; color: #64748b; margin-top: 4px; }
        .탭바 { display: flex; gap: 4px; margin-bottom: 20px; background: white; border-radius: 12px; padding: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .탭버튼 { flex: 1; padding: 9px 12px; border-radius: 9px; border: none; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .탭버튼:hover { color: #1e293b; background: #f8fafc; }
        .탭버튼.활성 { background: #0f172a; color: white; }
        .카운트뱃지 { background: rgba(255,255,255,0.15); border-radius: 20px; padding: 1px 7px; font-size: 0.68rem; }
        .탭버튼:not(.활성) .카운트뱃지 { background: #f1f5f9; color: #94a3b8; }
        .빈상태 { text-align: center; padding: 48px 20px; color: #94a3b8; }
        .빈상태아이콘 { font-size: 3rem; margin-bottom: 12px; }
        .빈상태제목 { font-size: 0.95rem; font-weight: 700; color: #64748b; margin-bottom: 6px; }
        .다운버튼 { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 9px; font-size: 0.82rem; font-weight: 600; text-decoration: none; transition: all 0.2s; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <header>
        <div className="헤더왼쪽">
          <span style={{ fontSize: "1.5rem" }}>🍯</span>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>
              <span style={{ color: "#fbbf24" }}>허니팟</span> 운영 관리
            </div>
            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>컨테이너 · 시나리오 · 데이터셋</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <nav className="헤더nav">
            <Link href="/dashboard" className="헤더nav-링크">📊 분석</Link>
            <Link href="/honeypot" className="헤더nav-링크 활성">🍯 허니팟</Link>
            <Link href="/profiling" className="헤더nav-링크">📋 공격 이력</Link>
            <Link href="/ml" className="헤더nav-링크">🤖 ML 분류</Link>
          </nav>
          <button className="로그아웃버튼" onClick={() => { logout(); router.push("/login"); }}>로그아웃</button>
        </div>
      </header>

      <div className="메인">
        <div className="페이지헤더">
          <div className="페이지제목">허니팟 운영 센터</div>
          <div className="페이지부제">내 허니팟 컨테이너 관리 · 공격 시나리오 실행 · 데이터셋 수집</div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#b91c1c", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚠️</span> {error}
            <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 700 }}>✕</button>
          </div>
        )}

        {/* 탭바 */}
        <div className="탭바">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`탭버튼 ${tab === t.key ? "활성" : ""}`}>
              {t.label}
              {t.count !== null && <span className="카운트뱃지">{t.count}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
            <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <div style={{ fontSize: "0.85rem" }}>불러오는 중...</div>
          </div>
        ) : (
          <>
            {/* 컨테이너 탭 */}
            {tab === "containers" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>내 허니팟 컨테이너</span>
                    <span style={{ marginLeft: 8, fontSize: "0.76rem", color: "#94a3b8" }}>
                      {containers.filter(c => c.status === "running").length} / {containers.length} 실행중
                    </span>
                  </div>
                  <button onClick={() => getMyContainers().then(setContainers)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "white", fontSize: "0.78rem", fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                    ↻ 새로고침
                  </button>
                </div>
                {containers.length === 0
                  ? <div className="빈상태"><div className="빈상태아이콘">🍯</div><div className="빈상태제목">컨테이너 없음</div><p style={{ fontSize: "0.82rem" }}>회원가입 시 허니팟이 자동 생성됩니다.</p></div>
                  : <ContainerPanel containers={containers} onRefresh={() => getMyContainers().then(setContainers)} />}
              </div>
            )}

            {/* 시나리오 탭 */}
            {tab === "scenarios" && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>공격 시나리오</span>
                  <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4 }}>Kali 컨테이너를 통해 내 허니팟에 시나리오 공격을 실행합니다.</p>
                </div>
                {scenarios.length === 0
                  ? <div className="빈상태"><div className="빈상태아이콘">⚡</div><div className="빈상태제목">시나리오 없음</div></div>
                  : <ScenarioPanel scenarios={scenarios} onRun={handleRun} />}
              </div>
            )}

            {/* 히스토리 탭 */}
            {tab === "history" && (
              <div>
                <div style={{ marginBottom: 14, fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>실행 이력</div>
                {history.length === 0
                  ? <div className="빈상태"><div className="빈상태아이콘">📋</div><div className="빈상태제목">이력 없음</div></div>
                  : <HistoryPanel runs={history} />}
              </div>
            )}

            {/* 데이터셋 탭 */}
            {tab === "dataset" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>데이터셋 관리</div>

                {datasetStatus && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {Object.entries(datasetStatus).map(([fname, info]) => (
                      <div key={fname} style={{ background: "white", border: "1.5px solid #e8ecf0", borderRadius: 12, padding: "16px 20px" }}>
                        <div style={{ fontFamily: "monospace", fontSize: "0.84rem", fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>{fname}</div>
                        {info.exists ? (
                          <>
                            <div style={{ fontSize: "0.76rem", color: "#22c55e", fontWeight: 600 }}>✓ 존재함</div>
                            <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 2 }}>{(info.size / 1024).toFixed(1)} KB</div>
                          </>
                        ) : (
                          <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>파일 없음</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={handleGenerate} disabled={generating}
                    style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: generating ? "#94a3b8" : "#0f172a", color: "white", fontSize: "0.88rem", fontWeight: 700, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                    {generating && <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
                    {generating ? "생성 중..." : "📊 데이터셋 생성"}
                  </button>
                  <button onClick={() => { void handleDownload("dataset.csv"); }} className="다운버튼"
                    style={{ background: "#eef2ff", color: "#4338ca", border: "1.5px solid #c7d2fe", cursor: "pointer" }}>
                    ⬇ CSV 다운로드
                  </button>
                  <button onClick={() => { void handleDownload("dataset_meta.json"); }} className="다운버튼"
                    style={{ background: "#f0fdf4", color: "#166534", border: "1.5px solid #bbf7d0", cursor: "pointer" }}>
                    ⬇ 메타 다운로드
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
