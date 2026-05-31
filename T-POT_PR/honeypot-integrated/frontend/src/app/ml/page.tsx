"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, logout } from "@/lib/api-client";

const API = (path: string) =>
  fetch(`http://127.0.0.1:8000${path}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
  });

const API_POST = (path: string, body?: unknown) =>
  fetch(`http://127.0.0.1:8000${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken() ?? ""}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

interface MLStatus {
  binary_loaded: boolean;
  multi_loaded:  boolean;
  training:      boolean;
  llm_threshold: number;
  metrics: {
    binary_acc?: number;
    multi_acc?:  number;
    trained_at?: string;
    n_samples?:  number;
  };
  train_log: string[];
}

interface PrepareResult {
  ok: boolean;
  n_rows?: number;
  n_attack?: number;
  n_normal?: number;
  label_counts?: Record<string, number>;
  error?: string;
}

const CLASS_COLOR: Record<string, string> = {
  Etc:          "#64748b",
  Recon:        "#3b82f6",
  "Brute Force":"#f59e0b",
  Intrusion:    "#ef4444",
  Malware:      "#dc2626",
};

export default function MLPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"status" | "train" | "upload" | "test">("status");
  const [status, setStatus] = useState<MLStatus | null>(null);

  // 학습 탭
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepResult, setPrepResult] = useState<PrepareResult | null>(null);
  const [trainLoading, setTrainLoading] = useState(false);
  const [trainLog, setTrainLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // 업로드 탭
  const [uploadType, setUploadType] = useState<"binary" | "multi">("binary");
  const [uploadMsg, setUploadMsg] = useState("");

  // 테스트 탭
  const [testInput, setTestInput] = useState({ attack_type: "브루트포스", payload: "" });
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await API("/api/ml/status");
      if (res.ok) setStatus(await res.json() as MLStatus);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    fetchStatus();
  }, [router, fetchStatus]);

  // 학습 중 로그 폴링
  useEffect(() => {
    if (!trainLoading) return;
    const t = setInterval(async () => {
      try {
        const res = await API("/api/ml/train/log");
        if (res.ok) {
          const data = await res.json() as { log: string[]; training: boolean };
          setTrainLog(data.log);
          if (!data.training) {
            setTrainLoading(false);
            fetchStatus();
          }
        }
      } catch { /* ignore */ }
    }, 1500);
    return () => clearInterval(t);
  }, [trainLoading, fetchStatus]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [trainLog]);

  const handlePrepare = async () => {
    setPrepLoading(true);
    setPrepResult(null);
    try {
      // 1단계: 로그 파싱 → dataset.csv 생성
      const genRes = await API_POST("/api/dataset/generate");
      if (!genRes.ok) {
        const d = await genRes.json() as { detail: string };
        setPrepResult({ ok: false, error: `데이터셋 생성 실패: ${d.detail}` });
        return;
      }
      // 2단계: feature engineering → dataset_ml.csv 생성
      const res = await API("/api/ml/prepare/run");
      const data = await res.json() as PrepareResult;
      setPrepResult(data);
    } catch (e) {
      setPrepResult({ ok: false, error: String(e) });
    } finally {
      setPrepLoading(false);
    }
  };

  const handleTrain = async () => {
    setTrainLoading(true);
    setTrainLog([]);
    try {
      const res = await API_POST("/api/ml/train");
      if (!res.ok) {
        const d = await res.json() as { detail: string };
        setTrainLog([`오류: ${d.detail}`]);
        setTrainLoading(false);
      }
    } catch (e) {
      setTrainLog([`오류: ${String(e)}`]);
      setTrainLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg("업로드 중...");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/ml/upload/${uploadType}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        body: form,
      });
      if (res.ok) {
        setUploadMsg(`✓ ${uploadType} 모델 업로드 완료`);
        fetchStatus();
      } else {
        const d = await res.json() as { detail: string };
        setUploadMsg(`✗ ${d.detail}`);
      }
    } catch {
      setUploadMsg("✗ 업로드 실패");
    }
    e.target.value = "";
  };

  const handleTest = async () => {
    try {
      const res = await API_POST("/api/ml/classify", testInput);
      if (res.ok) setTestResult(await res.json() as Record<string, unknown>);
    } catch { /* ignore */ }
  };

  const ATTACK_TYPES = [
    "정상 트래픽", "포트 스캔", "브루트포스", "웹 공격",
    "침투 후 명령어", "리버스 셸", "멀웨어 업로드", "크리덴셜 스터핑", "ICS/SCADA 공격",
  ];

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
        .body{max-width:1100px;margin:0 auto;padding:24px}

        .tabs{display:flex;gap:6px;margin-bottom:20px}
        .tab{padding:7px 16px;border-radius:8px;font-size:0.82rem;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#64748b;cursor:pointer;transition:all 0.18s}
        .tab.active{color:#a5b4fc;background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.35)}

        .card{background:#0d1117;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px 22px;margin-bottom:14px}
        .card-title{font-size:0.82rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}

        .stat{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px}
        .stat-label{font-size:0.72rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:8px}
        .stat-value{font-size:1.5rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:4px}
        .stat-sub{font-size:0.72rem;color:#64748b}
        .chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:0.73rem;font-weight:700}
        .chip.ok{background:rgba(34,197,94,0.12);color:#4ade80;border:1px solid rgba(34,197,94,0.25)}
        .chip.no{background:rgba(100,116,139,0.12);color:#64748b;border:1px solid rgba(100,116,139,0.2)}

        /* 학습 단계 */
        .step-row{display:flex;gap:14px;margin-bottom:14px}
        .step-box{flex:1;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px}
        .step-box.active{border-color:rgba(99,102,241,0.35);background:rgba(99,102,241,0.05)}
        .step-num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(99,102,241,0.2);color:#a5b4fc;font-size:0.75rem;font-weight:800;margin-bottom:10px}
        .step-title{font-size:0.88rem;font-weight:700;color:#e2e8f0;margin-bottom:4px}
        .step-desc{font-size:0.77rem;color:#64748b;line-height:1.6;margin-bottom:14px}
        .prep-result{background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.18);border-radius:8px;padding:12px 14px;margin-top:10px}
        .prep-result.err{background:rgba(239,68,68,0.06);border-color:rgba(239,68,68,0.2)}
        .prep-stat-row{display:flex;gap:16px;margin-top:8px;flex-wrap:wrap}
        .prep-stat{text-align:center}
        .prep-stat-val{font-size:1.1rem;font-weight:800;color:#4ade80}
        .prep-stat-lbl{font-size:0.68rem;color:#64748b;margin-top:2px}
        .label-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
        .label-chip{padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:700;background:rgba(255,255,255,0.06);color:#94a3b8}

        .log-box{font-family:'SF Mono','Fira Code',monospace;font-size:0.74rem;color:#67e8f9;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px;height:200px;overflow-y:auto;line-height:1.7;white-space:pre-wrap}
        .log-empty{color:#475569;font-style:italic}

        .btn-primary{padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;font-size:0.86rem;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
        .btn-primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(79,70,229,0.4)}
        .btn-primary:disabled{opacity:0.45;cursor:not-allowed;transform:none;box-shadow:none}
        .btn-green{padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#16a34a,#15803d);color:white;font-size:0.86rem;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 16px rgba(22,163,74,0.3)}
        .btn-green:hover:not(:disabled){transform:translateY(-1px)}
        .btn-green:disabled{opacity:0.45;cursor:not-allowed;transform:none}

        .upload-zone{border:2px dashed rgba(255,255,255,0.1);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all 0.18s;position:relative}
        .upload-zone:hover{border-color:rgba(99,102,241,0.4);background:rgba(99,102,241,0.04)}
        .upload-zone input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer}
        .upload-icon{font-size:2rem;margin-bottom:8px}
        .upload-label{font-size:0.85rem;color:#64748b}
        .upload-msg{margin-top:10px;font-size:0.82rem;text-align:center;padding:8px;border-radius:8px}
        .upload-msg.ok{background:rgba(34,197,94,0.1);color:#4ade80;border:1px solid rgba(34,197,94,0.2)}
        .upload-msg.err{background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2)}

        .field{margin-bottom:12px}
        .field label{font-size:0.76rem;color:#94a3b8;font-weight:600;display:block;margin-bottom:5px}
        .field select,.field textarea{width:100%;padding:9px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;font-size:0.86rem;outline:none;transition:border-color 0.18s;resize:vertical}
        .field select:focus,.field textarea:focus{border-color:rgba(99,102,241,0.5)}
        .result-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}
        .result-item{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px}
        .result-label{font-size:0.68rem;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px}
        .result-value{font-size:1rem;font-weight:700;color:#e2e8f0}
        .result-sub{font-size:0.71rem;color:#475569;margin-top:2px}
        .spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.1);border-top-color:#a5b4fc;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:6px}
        @keyframes spin{to{transform:rotate(360deg)}}
        .progress-bar{width:100%;height:6px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;margin-top:8px}
        .progress-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#4f46e5,#7c3aed);transition:width 0.3s}
        .type-sel{display:flex;gap:8px;margin-bottom:16px}
        .type-btn{flex:1;padding:9px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#64748b;font-size:0.82rem;font-weight:600;cursor:pointer;text-align:center;transition:all 0.18s}
        .type-btn.active{border-color:rgba(99,102,241,0.4);background:rgba(99,102,241,0.12);color:#a5b4fc}
        .divider-arrow{display:flex;align-items:center;justify-content:center;color:#475569;font-size:1.3rem;flex-shrink:0;padding-top:32px}
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
              <Link href="/profiling" className="nav-link">📋 공격 이력</Link>
              <Link href="/ml" className="nav-link active">🤖 ML 분류</Link>
            </nav>
            <button className="logout-btn" onClick={() => { logout(); router.push("/login"); }}>로그아웃</button>
          </div>
        </header>

        <div className="body">
          <div className="tabs">
            {(["status","train","upload","test"] as const).map((t) => (
              <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                { t === "status" ? "📊 모델 현황" : t === "train" ? "🏋️ 모델 학습" : t === "upload" ? "📦 모델 업로드" : "🧪 분류 테스트" }
              </button>
            ))}
          </div>

          {/* ── 모델 현황 ── */}
          {tab === "status" && (
            <>
              <div className="grid3">
                <div className="stat">
                  <div className="stat-label">이진분류 모델</div>
                  <div style={{ marginBottom: 6 }}>
                    <span className={`chip ${status?.binary_loaded ? "ok" : "no"}`}>
                      {status?.binary_loaded ? "● 로드됨" : "○ 미로드"}
                    </span>
                  </div>
                  <div className="stat-value" style={{ color: "#4ade80", fontSize: "1.2rem" }}>
                    {status?.metrics.binary_acc != null ? `${status.metrics.binary_acc}%` : "—"}
                  </div>
                  <div className="stat-sub">정확도 (테스트셋 20%)</div>
                </div>
                <div className="stat">
                  <div className="stat-label">다중분류 모델</div>
                  <div style={{ marginBottom: 6 }}>
                    <span className={`chip ${status?.multi_loaded ? "ok" : "no"}`}>
                      {status?.multi_loaded ? "● 로드됨" : "○ 미로드"}
                    </span>
                  </div>
                  <div className="stat-value" style={{ color: "#4ade80", fontSize: "1.2rem" }}>
                    {status?.metrics.multi_acc != null ? `${status.metrics.multi_acc}%` : "—"}
                  </div>
                  <div className="stat-sub">정확도 (테스트셋 20%)</div>
                </div>
                <div className="stat">
                  <div className="stat-label">LLM 분석 임계값</div>
                  <div className="stat-value" style={{ color: "#f59e0b" }}>
                    {status?.llm_threshold ?? 70}점
                  </div>
                  <div className="stat-sub">MITRE ATT&CK 점수 이상만 LLM</div>
                </div>
              </div>

              <div className="card">
                <div className="card-title">파이프라인 흐름</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: "0.82rem" }}>
                  {[
                    { icon: "⚔️", label: "시나리오 완료" },
                    { icon: "→" },
                    { icon: "🤖", label: "ML 이진분류", sub: "정상/악성" },
                    { icon: "→" },
                    { icon: "🎯", label: "다중분류", sub: "공격 유형" },
                    { icon: "→" },
                    { icon: "📊", label: "MITRE 점수 산출" },
                    { icon: "→" },
                    { icon: "🧠", label: `점수 ≥ ${status?.llm_threshold ?? 70}`, sub: "LLM 심층 분석" },
                  ].map((item, i) => (
                    "label" in item ? (
                      <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "7px 12px", textAlign: "center" }}>
                        <div>{item.icon} {item.label}</div>
                        {"sub" in item && <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: 2 }}>{item.sub}</div>}
                      </div>
                    ) : (
                      <span key={i} style={{ color: "#475569" }}>{item.icon}</span>
                    )
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-title">MITRE ATT&CK 점수 기준</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { name: "정상 트래픽", score: 0, tcode: "—" },
                    { name: "포트 스캔", score: 32, tcode: "T1046" },
                    { name: "브루트포스 / 크리덴셜 스터핑", score: 65, tcode: "T1110" },
                    { name: "ICS/SCADA 공격", score: 76, tcode: "T1046" },
                    { name: "웹 공격 (SQLi/XSS)", score: 78, tcode: "T1190" },
                    { name: "침투 후 명령어 실행", score: 85, tcode: "T1059" },
                    { name: "멀웨어 업로드", score: 92, tcode: "T1105" },
                    { name: "리버스 셸", score: 95, tcode: "T1203" },
                  ].map((row) => (
                    <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.8rem" }}>
                      <span style={{ width: 200, color: "#94a3b8", flexShrink: 0 }}>{row.name}</span>
                      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${row.score}%`, height: "100%", borderRadius: 3, background: row.score >= 70 ? "#ef4444" : row.score >= 40 ? "#f59e0b" : "#22c55e" }} />
                      </div>
                      <span style={{ width: 30, textAlign: "right", color: row.score >= 70 ? "#f87171" : row.score >= 40 ? "#fbbf24" : "#4ade80", fontWeight: 700 }}>{row.score}</span>
                      <span style={{ width: 55, fontSize: "0.68rem", color: "#475569" }}>{row.tcode}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── 모델 학습 ── */}
          {tab === "train" && (
            <>
              <div className="step-row">
                {/* Step 1: 데이터셋 준비 */}
                <div className={`step-box ${!prepResult?.ok ? "active" : ""}`}>
                  <div className="step-num">1</div>
                  <div className="step-title">데이터셋 준비</div>
                  <div className="step-desc">
                    허니팟 로그를 파싱해
                    <code style={{ color: "#67e8f9", fontSize: "0.76rem", margin: "0 3px" }}>dataset.csv</code>를 만들고,
                    레이블 부여 → 피처 엔지니어링 →
                    <code style={{ color: "#67e8f9", fontSize: "0.76rem", margin: "0 3px" }}>dataset_ml.csv</code>까지 한 번에 생성합니다.
                  </div>
                  <button
                    className="btn-green"
                    onClick={() => { void handlePrepare(); }}
                    disabled={prepLoading}
                  >
                    {prepLoading ? <><span className="spinner" />생성 중...</> : "⚙️ 데이터셋 생성 & 준비"}
                  </button>

                  {prepResult && (
                    <div className={`prep-result ${prepResult.ok ? "" : "err"}`}>
                      {prepResult.ok ? (
                        <>
                          <div style={{ fontSize: "0.82rem", color: "#4ade80", fontWeight: 700 }}>✓ dataset_ml.csv 생성 완료</div>
                          <div className="prep-stat-row">
                            <div className="prep-stat">
                              <div className="prep-stat-val">{prepResult.n_rows?.toLocaleString()}</div>
                              <div className="prep-stat-lbl">전체 행</div>
                            </div>
                            <div className="prep-stat">
                              <div className="prep-stat-val" style={{ color: "#f87171" }}>{prepResult.n_attack?.toLocaleString()}</div>
                              <div className="prep-stat-lbl">공격</div>
                            </div>
                            <div className="prep-stat">
                              <div className="prep-stat-val" style={{ color: "#60a5fa" }}>{prepResult.n_normal?.toLocaleString()}</div>
                              <div className="prep-stat-lbl">정상</div>
                            </div>
                          </div>
                          {prepResult.label_counts && (
                            <div className="label-chips">
                              {Object.entries(prepResult.label_counts).map(([k, v]) => (
                                <span key={k} className="label-chip" style={{ color: CLASS_COLOR[k] ?? "#94a3b8" }}>
                                  {k}: {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: "0.82rem", color: "#f87171" }}>✗ {prepResult.error}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="divider-arrow">→</div>

                {/* Step 2: 모델 학습 */}
                <div className={`step-box ${prepResult?.ok ? "active" : ""}`}>
                  <div className="step-num">2</div>
                  <div className="step-title">RandomForest 모델 학습</div>
                  <div className="step-desc">
                    <code style={{ color: "#67e8f9", fontSize: "0.76rem" }}>dataset_ml.csv</code>로
                    이진분류(정상/악성) + 다중분류(공격 유형) 모델을 동시에 학습합니다.<br />
                    학습 완료 시 <strong style={{ color: "#94a3b8" }}>.pkl 파일</strong>로 저장되어 즉시 적용됩니다.
                  </div>
                  <button
                    className="btn-primary"
                    onClick={() => { void handleTrain(); }}
                    disabled={trainLoading || status?.training}
                  >
                    {trainLoading || status?.training ? <><span className="spinner" />학습 중...</> : "🏋️ 학습 시작"}
                  </button>

                  {status?.metrics.trained_at && (
                    <div style={{ marginTop: 10, fontSize: "0.74rem", color: "#475569" }}>
                      마지막 학습: {new Date(status.metrics.trained_at).toLocaleString("ko-KR")}
                      {status.metrics.n_samples != null && ` · ${status.metrics.n_samples.toLocaleString()}개 샘플`}
                    </div>
                  )}
                </div>
              </div>

              {/* 학습 로그 */}
              <div className="card">
                <div className="card-title">학습 로그</div>
                <div className="log-box" ref={logRef}>
                  {trainLog.length === 0
                    ? <span className="log-empty">학습 시작 후 로그가 여기에 표시됩니다</span>
                    : trainLog.map((l, i) => <div key={i}>{l}</div>)
                  }
                </div>
              </div>
            </>
          )}

          {/* ── 모델 업로드 ── */}
          {tab === "upload" && (
            <div className="card">
              <div className="card-title">외부 학습 모델 업로드 (.pkl)</div>
              <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 16, lineHeight: 1.7 }}>
                외부에서 scikit-learn으로 학습한 모델을 <strong style={{ color: "#94a3b8" }}>joblib.dump()</strong>로 저장한 뒤 업로드하세요.<br />
                피처 순서: <span style={{ color: "#67e8f9", fontSize: "0.76rem" }}>hour · is_night · day_of_week · dst_port · protocol · source_honeypot · event_type · login_success · duration · login_attempts · cmd_length · special_char_cnt · pipe_count · has_wget · has_curl · has_reverse_shell</span>
              </div>
              <div className="type-sel">
                <div className={`type-btn ${uploadType === "binary" ? "active" : ""}`} onClick={() => setUploadType("binary")}>
                  🔵 이진분류 모델<br />
                  <span style={{ fontSize: "0.7rem", color: "#64748b" }}>정상(0) / 악성(1) · binary_model.pkl</span>
                </div>
                <div className={`type-btn ${uploadType === "multi" ? "active" : ""}`} onClick={() => setUploadType("multi")}>
                  🎯 다중분류 모델<br />
                  <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Etc / Recon / Brute Force / Intrusion / Malware · multi_model.pkl</span>
                </div>
              </div>
              <div className="upload-zone">
                <input type="file" accept=".pkl" onChange={(e) => { void handleUpload(e); }} />
                <div className="upload-icon">📦</div>
                <div className="upload-label">{uploadType === "binary" ? "binary_model.pkl" : "multi_model.pkl"} 파일을 드래그하거나 클릭해서 선택</div>
              </div>
              {uploadMsg && (
                <div className={`upload-msg ${uploadMsg.startsWith("✓") ? "ok" : "err"}`}>{uploadMsg}</div>
              )}
            </div>
          )}

          {/* ── 분류 테스트 ── */}
          {tab === "test" && (
            <div className="grid2">
              <div className="card">
                <div className="card-title">입력</div>
                <div className="field">
                  <label>공격 유형</label>
                  <select value={testInput.attack_type} onChange={(e) => setTestInput((p) => ({ ...p, attack_type: e.target.value }))}>
                    {ATTACK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Payload (선택)</label>
                  <textarea rows={5} value={testInput.payload} onChange={(e) => setTestInput((p) => ({ ...p, payload: e.target.value }))} placeholder="시나리오 출력 일부를 붙여넣으세요..." />
                </div>
                <button className="btn-primary" onClick={() => { void handleTest(); }}>분류 실행</button>
              </div>
              <div className="card">
                <div className="card-title">분류 결과</div>
                {!testResult ? (
                  <div style={{ color: "#475569", fontSize: "0.85rem", padding: "20px 0" }}>왼쪽에서 분류를 실행하세요</div>
                ) : (
                  <div className="result-grid">
                    <div className="result-item">
                      <div className="result-label">악성 여부</div>
                      <div className="result-value" style={{ color: testResult.is_attack ? "#f87171" : "#4ade80" }}>
                        {testResult.is_attack ? "🔴 악성" : "🟢 정상"}
                      </div>
                      <div className="result-sub">신뢰도 {String(testResult.binary_conf)}%</div>
                    </div>
                    <div className="result-item">
                      <div className="result-label">공격 유형</div>
                      <div className="result-value" style={{ color: CLASS_COLOR[String(testResult.attack_class)] ?? "#e2e8f0", fontSize: "0.95rem" }}>
                        {String(testResult.attack_class)}
                      </div>
                      <div className="result-sub">신뢰도 {String(testResult.multi_conf)}%</div>
                    </div>
                    <div className="result-item">
                      <div className="result-label">MITRE 점수</div>
                      <div className="result-value" style={{ color: Number(testResult.mitre_score) >= 70 ? "#f87171" : Number(testResult.mitre_score) >= 40 ? "#fbbf24" : "#4ade80" }}>
                        {String(testResult.mitre_score)}점
                      </div>
                      <div className="result-sub">100점 만점</div>
                    </div>
                    <div className="result-item">
                      <div className="result-label">LLM 분석</div>
                      <div className="result-value" style={{ fontSize: "0.9rem" }}>
                        {testResult.needs_llm ? "✅ 필요" : "⏭️ 생략"}
                      </div>
                      <div className="result-sub">모델: {String(testResult.model_used)}</div>
                    </div>
                    <div className="result-item" style={{ gridColumn: "1/-1" }}>
                      <div className="result-label">위험도 바</div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{
                          width: `${Number(testResult.mitre_score)}%`,
                          background: Number(testResult.mitre_score) >= 70 ? "#ef4444" : Number(testResult.mitre_score) >= 40 ? "#f59e0b" : "#22c55e"
                        }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
