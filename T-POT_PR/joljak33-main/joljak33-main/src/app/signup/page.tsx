"use client";

// 회원가입 페이지 (static/signup.html → Next.js)

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const RESERVED_USERNAMES = ["admin", "root", "system", "administrator"];

type Step = 1 | 2 | 3;

function calcStep(name: string, email: string, username: string, pw: string, pwc: string): Step {
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const usernameOk = /^[a-zA-Z0-9_]{4,20}$/.test(username) && !RESERVED_USERNAMES.includes(username.toLowerCase());
  const pwScore = calcPwScore(pw);
  const step1Done = name.trim().length > 0 && emailOk && usernameOk;
  const step2Done = step1Done && pwScore >= 3 && pw === pwc;
  if (step2Done) return 3;
  if (step1Done) return 2;
  return 1;
}

function calcPwScore(val: string): number {
  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  return score;
}

const PW_LEVELS = [
  { label: "매우 약함", color: "#ef4444", width: "20%" },
  { label: "약함", color: "#f97316", width: "40%" },
  { label: "보통", color: "#eab308", width: "60%" },
  { label: "강함", color: "#22c55e", width: "80%" },
  { label: "매우 강함", color: "#06b6d4", width: "100%" },
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [pwc, setPwc] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPwc, setShowPwc] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const currentStep = calcStep(name, email, username, pw, pwc);
  const pwScore = calcPwScore(pw);
  const pwLevel = PW_LEVELS[Math.min(pwScore, 4)];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !username.trim() || !pw || !pwc) {
      setError("모든 필수 항목을 입력해주세요.");
      return;
    }
    if (pw !== pwc) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (!terms) { setError("이용약관에 동의해주세요."); return; }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    }, 1200);
  }

  const emailOk = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailErr = email && !emailOk;
  const usernameOk = username && /^[a-zA-Z0-9_]{4,20}$/.test(username) && !RESERVED_USERNAMES.includes(username.toLowerCase());
  const usernameErr = username && !usernameOk;

  return (
    <>
      <style>{`
        body { background: #0f172a; color: white; display: flex; min-height: 100vh; }
        .left-panel {
          width: 420px; flex-shrink: 0;
          background: linear-gradient(160deg, #0a101e 0%, #0d1a35 60%, #0f172a 100%);
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column; padding: 48px 44px;
          position: relative; overflow: hidden;
        }
        .left-panel::before {
          content: ''; position: absolute; inset: 0;
          background-image: linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .left-panel::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 100% 60% at 20% 40%, rgba(99,102,241,0.1) 0%, transparent 70%); }
        .left-content { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; gap: 32px; }
        .logo-wrap { display: flex; align-items: center; gap: 10px; }
        .logo-icon { width: 40px; height: 40px; border-radius: 11px; background: linear-gradient(135deg, #6366f1, #818cf8); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; box-shadow: 0 0 20px rgba(99,102,241,0.4); }
        .logo-name { font-size: 1.15rem; font-weight: 800; }
        .logo-name span { color: #a5b4fc; }
        .benefits-header { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.35); margin-bottom: 16px; }
        .benefit-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 10px; }
        .benefit-icon { width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
        .benefit-icon.i { background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.3); }
        .benefit-icon.y { background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.25); }
        .benefit-icon.g { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.25); }
        .benefit-icon.r { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.25); }
        .benefit-title { font-size: 0.85rem; font-weight: 700; margin-bottom: 3px; }
        .benefit-desc { font-size: 0.75rem; color: rgba(255,255,255,0.4); line-height: 1.5; }
        .security-badge { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 8px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2); margin-top: auto; }
        .security-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; animation: pulse 1.5s infinite; }
        .security-text { font-size: 0.77rem; color: rgba(255,255,255,0.5); }
        .security-text strong { color: #86efac; }

        .right-panel { flex: 1; display: flex; align-items: center; justify-content: center; background: #f0f4f8; padding: 40px 32px; overflow-y: auto; }
        .form-card { width: 100%; max-width: 460px; }
        .form-back { display: inline-flex; align-items: center; gap: 6px; color: #64748b; text-decoration: none; font-size: 0.82rem; margin-bottom: 20px; }
        .form-back:hover { color: #1e293b; }
        .form-title { font-size: 1.7rem; font-weight: 900; color: #1a1a2e; line-height: 1.2; }
        .form-sub { font-size: 0.88rem; color: #64748b; margin-top: 6px; }
        .form-sub a { color: #6366f1; text-decoration: none; font-weight: 600; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .form-group { margin-bottom: 16px; }
        .form-label { display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; font-weight: 600; color: #374151; margin-bottom: 7px; }
        .label-required { color: #ef4444; font-size: 0.7rem; }
        .label-optional { font-size: 0.7rem; color: #94a3b8; font-weight: 400; }
        .form-input-wrap { position: relative; }
        .form-input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 0.95rem; pointer-events: none; color: #94a3b8; }
        .form-input {
          width: 100%; padding: 11px 16px 11px 40px;
          border: 1.5px solid #e2e8f0; border-radius: 10px;
          background: white; color: #1a1a2e; font-size: 0.9rem;
          font-family: inherit; transition: all 0.2s; outline: none;
        }
        .form-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .form-input::placeholder { color: #cbd5e1; }
        .form-input.valid { border-color: #22c55e; }
        .form-input.invalid { border-color: #ef4444; }
        .form-hint { font-size: 0.72rem; color: #94a3b8; margin-top: 5px; }
        .form-hint.ok { color: #22c55e; }
        .form-hint.error { color: #ef4444; }
        .pw-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 0.95rem; padding: 4px; }
        .pw-strength { margin-top: 8px; }
        .pw-strength-bar { height: 4px; border-radius: 2px; background: #e2e8f0; overflow: hidden; margin-bottom: 5px; }
        .pw-strength-fill { height: 100%; border-radius: 2px; transition: all 0.3s; }
        .pw-strength-text { font-size: 0.72rem; }
        .step-row { display: flex; align-items: center; gap: 0; margin-bottom: 28px; }
        .step-dot { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 800; flex-shrink: 0; transition: all 0.3s; }
        .step-dot.active { background: #6366f1; color: white; box-shadow: 0 0 12px rgba(99,102,241,0.4); }
        .step-dot.done { background: #22c55e; color: white; }
        .step-dot.pending { background: #e2e8f0; color: #94a3b8; }
        .step-line { flex: 1; height: 2px; background: #e2e8f0; }
        .step-line.done { background: #22c55e; }
        .terms-check { margin-bottom: 20px; }
        .checkbox-wrap { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; margin-bottom: 8px; }
        .checkbox-label { font-size: 0.81rem; color: #475569; line-height: 1.5; }
        .checkbox-label a { color: #6366f1; text-decoration: none; }
        .btn-submit {
          width: 100%; padding: 13px; border-radius: 10px; border: none;
          background: #0f172a; color: white; font-size: 0.95rem; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: all 0.25s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-submit:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,23,42,0.25); }
        .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .form-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; color: #b91c1c; font-size: 0.82rem; display: flex; align-items: center; gap: 8px; }
        .form-success { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-bottom: 16px; color: #15803d; font-size: 0.85rem; display: flex; flex-direction: column; gap: 6px; }
        @media (max-width: 900px) { .left-panel { display: none; } .right-panel { background: white; } .form-row { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* LEFT PANEL */}
        <div className="left-panel">
          <div className="left-content">
            <div className="logo-wrap">
              <div className="logo-icon">🍯</div>
              <span className="logo-name">정사<span>평</span></span>
            </div>
            <div>
              <div className="benefits-header">정사평 가입 혜택</div>
              {[
                { icon: "🧠", cls: "i", title: "AI 공격 분석", desc: "LLM이 실시간으로 허니팟 공격 로그를 분석하고 위협 인텔리전스를 제공합니다" },
                { icon: "📊", cls: "y", title: "실시간 시각화", desc: "D3.js 기반 인터랙티브 차트로 공격 패턴과 위협 수준을 직관적으로 파악합니다" },
                { icon: "🛡️", cls: "g", title: "대응 자동화", desc: "MITRE ATT&CK 프레임워크 기반 즉각 대응 조치와 장기 보안 강화 방안을 자동 생성합니다" },
                { icon: "📋", cls: "r", title: "리포트 자동화", desc: "인시던트 리포트를 PDF로 자동 생성하여 보안 팀과 공유할 수 있습니다" },
              ].map((b) => (
                <div key={b.title} className="benefit-item">
                  <div className={`benefit-icon ${b.cls}`}>{b.icon}</div>
                  <div>
                    <div className="benefit-title">{b.title}</div>
                    <div className="benefit-desc">{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="security-badge">
              <div className="security-dot" />
              <div className="security-text"><strong>안전한 가입</strong> — 개인정보는 보호됩니다</div>
            </div>
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="right-panel">
          <div className="form-card">
            <div style={{ marginBottom: "28px" }}>
              <Link href="/" className="form-back">← 홈으로 돌아가기</Link>
              <h1 className="form-title">계정을 만들어보세요 🚀</h1>
              <p className="form-sub">이미 계정이 있으신가요? <Link href="/login">로그인</Link></p>
            </div>

            {/* Step indicator */}
            <div className="step-row">
              <div className={`step-dot ${currentStep > 1 ? "done" : "active"}`}>{currentStep > 1 ? "✓" : "1"}</div>
              <div className={`step-line ${currentStep > 1 ? "done" : ""}`} />
              <div className={`step-dot ${currentStep > 2 ? "done" : currentStep === 2 ? "active" : "pending"}`}>{currentStep > 2 ? "✓" : "2"}</div>
              <div className={`step-line ${currentStep > 2 ? "done" : ""}`} />
              <div className={`step-dot ${currentStep === 3 ? "active" : "pending"}`}>✓</div>
            </div>

            {error && <div className="form-error"><span>⚠️</span> <span>{error}</span></div>}
            {success && (
              <div className="form-success">
                <strong>🎉 회원가입이 완료되었습니다!</strong>
                <span>로그인 페이지로 이동 중...</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">이름 <span className="label-required">*</span></label>
                  <div className="form-input-wrap">
                    <span className="form-input-icon">✏️</span>
                    <input type="text" className={`form-input ${name.trim() ? "valid" : ""}`} placeholder="홍길동"
                      value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">소속 <span className="label-optional">선택</span></label>
                  <div className="form-input-wrap">
                    <span className="form-input-icon">🏫</span>
                    <input type="text" className="form-input" placeholder="소속 기관/학교"
                      value={org} onChange={(e) => setOrg(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">이메일 <span className="label-required">*</span></label>
                <div className="form-input-wrap">
                  <span className="form-input-icon">📧</span>
                  <input type="email" className={`form-input ${emailOk ? "valid" : emailErr ? "invalid" : ""}`}
                    placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                {emailOk && <div className="form-hint ok">✓ 유효한 이메일 형식입니다</div>}
                {emailErr && <div className="form-hint error">올바른 이메일 형식을 입력해주세요</div>}
              </div>

              <div className="form-group">
                <label className="form-label">아이디 <span className="label-required">*</span></label>
                <div className="form-input-wrap">
                  <span className="form-input-icon">👤</span>
                  <input type="text" className={`form-input ${usernameOk ? "valid" : usernameErr ? "invalid" : ""}`}
                    placeholder="영문, 숫자 4~20자" value={username} onChange={(e) => setUsername(e.target.value)}
                    minLength={4} maxLength={20} required />
                  {usernameOk && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#22c55e", fontSize: "0.85rem" }}>✓</span>}
                </div>
                {usernameOk && <div className="form-hint ok">✓ 사용 가능한 아이디입니다</div>}
                {usernameErr && <div className="form-hint error">{RESERVED_USERNAMES.includes(username.toLowerCase()) ? "사용할 수 없는 아이디입니다" : "영문, 숫자, 밑줄(_)만 사용 가능 (4~20자)"}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">비밀번호 <span className="label-required">*</span></label>
                <div className="form-input-wrap">
                  <span className="form-input-icon">🔒</span>
                  <input type={showPw ? "text" : "password"} className={`form-input ${pw && pwScore >= 3 ? "valid" : pw && pwScore < 3 ? "invalid" : ""}`}
                    placeholder="영문+숫자+특수문자 8자 이상" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁"}</button>
                </div>
                {pw && (
                  <div className="pw-strength">
                    <div className="pw-strength-bar">
                      <div className="pw-strength-fill" style={{ width: pwLevel.width, background: pwLevel.color }} />
                    </div>
                    <div className="pw-strength-text" style={{ color: pwLevel.color }}>비밀번호 강도: {pwLevel.label}</div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">비밀번호 확인 <span className="label-required">*</span></label>
                <div className="form-input-wrap">
                  <span className="form-input-icon">🔒</span>
                  <input type={showPwc ? "text" : "password"} className={`form-input ${pwc && pwc === pw ? "valid" : pwc && pwc !== pw ? "invalid" : ""}`}
                    placeholder="비밀번호를 다시 입력하세요" value={pwc} onChange={(e) => setPwc(e.target.value)} required />
                  <button type="button" className="pw-toggle" onClick={() => setShowPwc(!showPwc)}>{showPwc ? "🙈" : "👁"}</button>
                </div>
                {pwc && pwc === pw && <div className="form-hint ok">✓ 비밀번호가 일치합니다</div>}
                {pwc && pwc !== pw && <div className="form-hint error">비밀번호가 일치하지 않습니다</div>}
              </div>

              <div className="terms-check">
                <label className="checkbox-wrap">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} style={{ display: "none" }} />
                  <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${terms ? "#6366f1" : "#d1d5db"}`, background: terms ? "#6366f1" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.2s", fontSize: "0.68rem", color: "white", fontWeight: 800 }}>
                    {terms ? "✓" : ""}
                  </span>
                  <span className="checkbox-label">
                    <a href="#">이용약관</a> 및 <a href="#">개인정보처리방침</a>에 동의합니다 <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                </label>
                <label className="checkbox-wrap">
                  <input type="checkbox" style={{ display: "none" }} />
                  <span style={{ width: 18, height: 18, borderRadius: 5, border: "1.5px solid #d1d5db", background: "white", flexShrink: 0, marginTop: 1 }} />
                  <span className="checkbox-label">보안 업데이트 및 뉴스레터 수신에 동의합니다 <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>(선택)</span></span>
                </label>
              </div>

              <button type="submit" className="btn-submit" disabled={loading}>
                {loading && <div className="spinner" />}
                <span>{loading ? "처리 중..." : success ? "완료!" : "✦ 회원가입 완료"}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
