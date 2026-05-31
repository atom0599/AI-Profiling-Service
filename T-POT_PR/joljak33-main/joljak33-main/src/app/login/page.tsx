"use client";

// 로그인 페이지 (static/login.html → Next.js)

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ACCOUNTS: Record<string, { password: string; role: string; name: string }> = {
  admin: { password: "admin123", role: "admin", name: "관리자" },
  user1: { password: "user1234", role: "user", name: "일반 사용자" },
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shake, setShake] = useState(false);

  function quickLogin(id: string, pw: string) {
    setUsername(id);
    setPassword(pw);
    handleLogin(id, pw);
  }

  function handleLogin(u = username, p = password) {
    setError("");
    setSuccess("");
    setLoading(true);

    setTimeout(() => {
      const account = ACCOUNTS[u.trim()];
      if (!account || account.password !== p) {
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
        setLoading(false);
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }
      if (account.role === "admin") {
        setSuccess(`관리자 ${account.name}님, 환영합니다! 대시보드로 이동 중...`);
        setTimeout(() => router.push("/dashboard"), 1200);
      } else {
        setSuccess(`${account.name}님, 환영합니다! 이동 중...`);
        setTimeout(() => router.push("/"), 1200);
      }
      setLoading(false);
    }, 800);
  }

  return (
    <>
      <style>{`
        body { background: #0f172a; color: white; display: flex; min-height: 100vh; }
        .left-panel {
          width: 480px; flex-shrink: 0;
          background: linear-gradient(160deg, #0f172a 0%, #0d1a35 60%, #0f172a 100%);
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex; flex-direction: column; padding: 48px 52px;
          position: relative; overflow: hidden;
        }
        .left-panel::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(99,102,241,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.07) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .left-panel::after {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse 100% 70% at 30% 60%, rgba(99,102,241,0.1) 0%, transparent 70%);
        }
        .left-content { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; }
        .logo-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: auto; }
        .logo-icon {
          width: 40px; height: 40px; border-radius: 11px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; box-shadow: 0 0 20px rgba(99,102,241,0.4);
        }
        .logo-name { font-size: 1.15rem; font-weight: 800; }
        .logo-name span { color: #a5b4fc; }
        .honeypot-visual { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; }
        .hp-diagram { position: relative; width: 280px; height: 280px; }
        .hp-center {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 80px; height: 80px; border-radius: 20px;
          background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(99,102,241,0.15));
          border: 2px solid rgba(99,102,241,0.5);
          display: flex; align-items: center; justify-content: center; font-size: 2rem;
          box-shadow: 0 0 40px rgba(99,102,241,0.3);
          animation: centerPulse 3s ease-in-out infinite;
        }
        @keyframes centerPulse { 0%,100%{box-shadow: 0 0 30px rgba(99,102,241,0.3)} 50%{box-shadow: 0 0 60px rgba(99,102,241,0.5)} }
        .hp-ring {
          position: absolute; top: 50%; left: 50%;
          border-radius: 50%; border: 1px solid rgba(99,102,241,0.2);
          animation: ringExpand 3s ease-out infinite; transform: translate(-50%, -50%);
        }
        .hp-ring:nth-child(1) { width: 130px; height: 130px; animation-delay: 0s; }
        .hp-ring:nth-child(2) { width: 190px; height: 190px; animation-delay: 1s; }
        .hp-ring:nth-child(3) { width: 260px; height: 260px; animation-delay: 2s; }
        @keyframes ringExpand { 0%{opacity:0.8;transform:translate(-50%,-50%) scale(0.85)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1)} }
        .hp-attacker {
          position: absolute; width: 36px; height: 36px; border-radius: 10px;
          background: rgba(239,68,68,0.2); border: 1.5px solid rgba(239,68,68,0.4);
          display: flex; align-items: center; justify-content: center; font-size: 1rem;
        }
        .hp-attacker:nth-child(5) { top: 10px; left: 50%; transform: translateX(-50%); }
        .hp-attacker:nth-child(6) { top: 50%; right: 5px; transform: translateY(-50%); }
        .hp-attacker:nth-child(7) { bottom: 10px; left: 50%; transform: translateX(-50%); }
        .hp-attacker:nth-child(8) { top: 50%; left: 5px; transform: translateY(-50%); }
        .left-text { margin-top: 32px; }
        .left-title { font-size: 1.3rem; font-weight: 800; line-height: 1.4; margin-bottom: 10px; }
        .left-title span { color: #a5b4fc; }
        .left-desc { font-size: 0.85rem; color: rgba(255,255,255,0.45); line-height: 1.75; }
        .feature-bullets { margin-top: 24px; display: flex; flex-direction: column; gap: 10px; }
        .bullet { display: flex; align-items: flex-start; gap: 10px; }
        .bullet-dot {
          width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
          background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.25);
          display: flex; align-items: center; justify-content: center; font-size: 0.7rem; margin-top: 1px;
        }
        .bullet-text { font-size: 0.82rem; color: rgba(255,255,255,0.55); line-height: 1.5; }

        .right-panel {
          flex: 1; display: flex; align-items: center; justify-content: center;
          background: #f0f4f8; padding: 48px 32px;
        }
        .form-card { width: 100%; max-width: 420px; }
        .form-header { margin-bottom: 32px; }
        .form-back {
          display: inline-flex; align-items: center; gap: 6px;
          color: #64748b; text-decoration: none; font-size: 0.82rem;
          margin-bottom: 20px; transition: color 0.2s;
        }
        .form-back:hover { color: #1e293b; }
        .form-title { font-size: 1.7rem; font-weight: 900; color: #1a1a2e; line-height: 1.2; }
        .form-sub { font-size: 0.88rem; color: #64748b; margin-top: 6px; }
        .form-sub a { color: #6366f1; text-decoration: none; font-weight: 600; }
        .form-sub a:hover { text-decoration: underline; }
        .form-group { margin-bottom: 18px; }
        .form-label { display: block; font-size: 0.82rem; font-weight: 600; color: #374151; margin-bottom: 7px; }
        .form-input-wrap { position: relative; }
        .form-input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 1rem; pointer-events: none; color: #94a3b8; }
        .form-input {
          width: 100%; padding: 12px 16px 12px 42px;
          border: 1.5px solid #e2e8f0; border-radius: 10px;
          background: white; color: #1a1a2e; font-size: 0.92rem; font-family: inherit;
          transition: all 0.2s; outline: none;
        }
        .form-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .form-input::placeholder { color: #cbd5e1; }
        .pw-toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 1rem; padding: 4px;
        }
        .admin-chip {
          display: flex; align-items: center; gap: 8px;
          background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.2);
          border-radius: 8px; padding: 10px 14px; margin-bottom: 20px;
        }
        .admin-chip-text { font-size: 0.78rem; color: #475569; line-height: 1.4; }
        .admin-chip-text strong { color: #6366f1; font-weight: 700; }
        .form-error {
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;
          color: #b91c1c; font-size: 0.82rem; display: flex; align-items: center; gap: 8px;
        }
        .form-success {
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;
          color: #15803d; font-size: 0.82rem; display: flex; align-items: center; gap: 8px;
        }
        .btn-submit {
          width: 100%; padding: 13px; border-radius: 10px; border: none;
          background: #0f172a; color: white; font-size: 0.95rem; font-weight: 700;
          cursor: pointer; font-family: inherit; transition: all 0.25s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-submit:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,23,42,0.25); }
        .btn-submit:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .spinner {
          width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        .divider {
          display: flex; align-items: center; gap: 12px;
          margin: 20px 0; color: #94a3b8; font-size: 0.8rem;
        }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
        .demo-accounts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .demo-btn {
          padding: 9px 12px; border-radius: 8px; border: 1.5px solid #e2e8f0;
          background: white; color: #374151; font-size: 0.78rem; font-weight: 600;
          cursor: pointer; font-family: inherit; text-align: left; transition: all 0.2s;
        }
        .demo-btn:hover { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,0.04); }
        .demo-btn.admin-btn { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.04); }
        .demo-btn-role { display: block; font-size: 0.68rem; color: #94a3b8; font-weight: 400; margin-top: 2px; }
        .demo-btn.admin-btn .demo-btn-role { color: #6366f1; }
        .remember-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
        .checkbox-wrap { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .checkbox-label { font-size: 0.82rem; color: #475569; }
        .forgot-link { font-size: 0.82rem; color: #6366f1; text-decoration: none; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        .shake { animation: shake 0.4s ease; }
        @media (max-width: 900px) { .left-panel { display: none; } .right-panel { background: white; } }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* LEFT BRANDING PANEL */}
        <div className="left-panel">
          <div className="left-content">
            <div className="logo-wrap">
              <div className="logo-icon">🍯</div>
              <span className="logo-name">정사<span>평</span></span>
            </div>
            <div className="honeypot-visual">
              <div className="hp-diagram">
                <div className="hp-ring" />
                <div className="hp-ring" />
                <div className="hp-ring" />
                <div className="hp-center">🍯</div>
                <div className="hp-attacker">💻</div>
                <div className="hp-attacker">🖥️</div>
                <div className="hp-attacker">💻</div>
                <div className="hp-attacker">🖥️</div>
              </div>
            </div>
            <div className="left-text">
              <div className="left-title">공격자를 <span>유인</span>하고<br />AI로 <span>분석</span>합니다</div>
              <div className="left-desc">허니팟에 수집된 사이버 공격 데이터를 대규모 언어 모델이 실시간으로 분석하여 위협 인텔리전스를 제공합니다.</div>
              <div className="feature-bullets">
                <div className="bullet"><div className="bullet-dot">🧠</div><div className="bullet-text">LLM 실시간 스트리밍 분석</div></div>
                <div className="bullet"><div className="bullet-dot">📊</div><div className="bullet-text">D3.js 공격 흐름 시각화</div></div>
                <div className="bullet"><div className="bullet-dot">🛡️</div><div className="bullet-text">MITRE ATT&amp;CK 기반 대응 권고</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="right-panel">
          <div className={`form-card ${shake ? "shake" : ""}`}>
            <div className="form-header">
              <Link href="/" className="form-back">← 홈으로 돌아가기</Link>
              <h1 className="form-title">다시 오셨군요! 👋</h1>
              <p className="form-sub">계정이 없으신가요? <Link href="/signup">무료 회원가입</Link></p>
            </div>

            <div className="admin-chip">
              <span>ℹ️</span>
              <span className="admin-chip-text">
                관리자 계정: <strong>admin</strong> / <strong>admin123</strong>으로 로그인하면 분석 대시보드로 이동합니다
              </span>
            </div>

            {error && (
              <div className="form-error"><span>⚠️</span> <span>{error}</span></div>
            )}
            {success && (
              <div className="form-success"><span>✓</span> <span>{success}</span></div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              <div className="form-group">
                <label className="form-label">아이디</label>
                <div className="form-input-wrap">
                  <span className="form-input-icon">👤</span>
                  <input
                    type="text" className="form-input" placeholder="아이디를 입력하세요"
                    value={username} onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username" required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">비밀번호</label>
                <div className="form-input-wrap">
                  <span className="form-input-icon">🔒</span>
                  <input
                    type={showPw ? "text" : "password"} className="form-input"
                    placeholder="비밀번호를 입력하세요"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password" required
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
              <div className="remember-row">
                <label className="checkbox-wrap">
                  <input type="checkbox" style={{ display: "none" }} />
                  <span className="checkbox-label">로그인 상태 유지</span>
                </label>
                <a href="#" className="forgot-link">비밀번호 찾기</a>
              </div>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading && <div className="spinner" />}
                <span>{loading ? "확인 중..." : "로그인"}</span>
              </button>
            </form>

            <div className="divider">또는 빠른 로그인</div>
            <div className="demo-accounts">
              <button className="demo-btn admin-btn" onClick={() => quickLogin("admin", "admin123")}>
                🛡️ 관리자 계정
                <span className="demo-btn-role">admin / admin123</span>
              </button>
              <button className="demo-btn" onClick={() => quickLogin("user1", "user1234")}>
                👤 일반 사용자
                <span className="demo-btn-role">user1 / user1234</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
