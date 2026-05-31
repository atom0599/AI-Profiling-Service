// 랜딩 페이지 (static/landing.html → Next.js page)
// landing.html 의 CSS + HTML 구조를 그대로 인라인으로 옮김

import Link from "next/link";

export default function LandingPage() {
  return (
    <>
      <style>{`
        body { background: #0f172a; color: white; min-height: 100vh; }

        /* ── NAV ── */
        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px; height: 64px;
          background: rgba(15,23,42,0.85); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .nav-logo { display: flex; align-items: center; gap: 10px; }
        .nav-logo-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; box-shadow: 0 0 16px rgba(99,102,241,0.4);
        }
        .nav-logo-name { font-size: 1.1rem; font-weight: 800; }
        .nav-logo-name span { color: #a5b4fc; }
        .nav-links { display: flex; align-items: center; gap: 8px; }
        .nav-link {
          padding: 7px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
          text-decoration: none; color: rgba(255,255,255,0.7); transition: all 0.2s;
        }
        .nav-link:hover { color: white; background: rgba(255,255,255,0.08); }
        .nav-btn {
          padding: 8px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 700;
          text-decoration: none; background: #6366f1; color: white;
          transition: all 0.2s; margin-left: 4px;
        }
        .nav-btn:hover { background: #4f46e5; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,0.4); }

        /* ── HERO ── */
        .hero {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          text-align: center; padding: 80px 24px 60px;
          position: relative; overflow: hidden;
          background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.12) 0%, transparent 70%);
        }
        .hero::before {
          content: ''; position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .hero-content { position: relative; z-index: 1; max-width: 820px; }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3);
          border-radius: 20px; padding: 6px 16px; font-size: 0.78rem; font-weight: 600;
          color: #a5b4fc; margin-bottom: 28px;
        }
        .hero-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: pulse 1.5s infinite; }
        .hero-title { font-size: clamp(2.4rem, 6vw, 4rem); font-weight: 900; line-height: 1.15; margin-bottom: 20px; }
        .hero-title span { background: linear-gradient(135deg, #6366f1, #a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero-desc { font-size: 1.1rem; color: rgba(255,255,255,0.55); line-height: 1.8; margin-bottom: 40px; max-width: 600px; margin-left: auto; margin-right: auto; }
        .hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .btn-primary {
          padding: 14px 32px; border-radius: 10px; font-size: 0.95rem; font-weight: 700;
          text-decoration: none; background: #6366f1; color: white; transition: all 0.25s;
        }
        .btn-primary:hover { background: #4f46e5; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
        .btn-secondary {
          padding: 14px 32px; border-radius: 10px; font-size: 0.95rem; font-weight: 700;
          text-decoration: none; background: rgba(255,255,255,0.07); color: white;
          border: 1px solid rgba(255,255,255,0.12); transition: all 0.25s;
        }
        .btn-secondary:hover { background: rgba(255,255,255,0.12); transform: translateY(-2px); }

        /* ── FEATURES ── */
        .features {
          padding: 100px 48px;
          background: linear-gradient(180deg, #0f172a 0%, #0d1929 100%);
        }
        .section-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6366f1; margin-bottom: 12px; text-align: center; }
        .section-title { font-size: clamp(1.6rem, 3vw, 2.4rem); font-weight: 800; text-align: center; margin-bottom: 16px; }
        .section-sub { font-size: 0.95rem; color: rgba(255,255,255,0.45); text-align: center; max-width: 500px; margin: 0 auto 56px; line-height: 1.75; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; max-width: 1100px; margin: 0 auto; }
        .feature-card {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
          border-radius: 16px; padding: 28px; transition: all 0.3s;
        }
        .feature-card:hover { border-color: rgba(99,102,241,0.3); background: rgba(99,102,241,0.05); transform: translateY(-3px); }
        .feature-icon {
          width: 48px; height: 48px; border-radius: 13px; margin-bottom: 18px;
          display: flex; align-items: center; justify-content: center; font-size: 1.4rem;
        }
        .feature-icon.i { background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.3); }
        .feature-icon.y { background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.25); }
        .feature-icon.g { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.25); }
        .feature-icon.r { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.25); }
        .feature-icon.b { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.25); }
        .feature-icon.p { background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.25); }
        .feature-title { font-size: 1rem; font-weight: 800; margin-bottom: 10px; }
        .feature-desc { font-size: 0.82rem; color: rgba(255,255,255,0.45); line-height: 1.75; }

        /* ── CTA ── */
        .cta-section {
          padding: 100px 48px; text-align: center;
          background: linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(15,23,42,1) 100%);
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .cta-title { font-size: clamp(1.8rem, 3.5vw, 2.8rem); font-weight: 900; margin-bottom: 16px; }
        .cta-title span { color: #a5b4fc; }
        .cta-desc { font-size: 0.95rem; color: rgba(255,255,255,0.45); margin-bottom: 36px; }

        /* ── FOOTER ── */
        footer {
          padding: 32px 48px; border-top: 1px solid rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: space-between;
          font-size: 0.8rem; color: rgba(255,255,255,0.25);
        }

        @media (max-width: 768px) {
          nav { padding: 0 20px; }
          .nav-links .nav-link { display: none; }
          .features { padding: 60px 20px; }
          .cta-section { padding: 60px 20px; }
          footer { flex-direction: column; gap: 8px; text-align: center; padding: 24px 20px; }
        }
      `}</style>

      {/* NAV */}
      <nav>
        <div className="nav-logo">
          <div className="nav-logo-icon">🍯</div>
          <span className="nav-logo-name">정사<span>평</span></span>
        </div>
        <div className="nav-links">
          <Link href="#features" className="nav-link">기능</Link>
          <Link href="/login" className="nav-link">로그인</Link>
          <Link href="/signup" className="nav-btn">무료 시작</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <div className="hero-badge-dot" />
            AI 기반 실시간 위협 분석
          </div>
          <h1 className="hero-title">
            허니팟 공격을<br />
            <span>AI가 즉시 분석</span>합니다
          </h1>
          <p className="hero-desc">
            수집된 사이버 공격 데이터를 대규모 언어 모델이 실시간 스트리밍으로 분석하여
            사건 요약, 공격 의도, 숙련도, 대응 권고를 자동 생성합니다.
          </p>
          <div className="hero-btns">
            <Link href="/login" className="btn-primary">대시보드 바로가기 →</Link>
            <Link href="/signup" className="btn-secondary">무료 회원가입</Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features" id="features">
        <div className="section-label">핵심 기능</div>
        <h2 className="section-title">강력한 AI 보안 분석</h2>
        <p className="section-sub">Llama 3.1 기반 LLM이 허니팟 공격 로그를 다각도로 분석합니다</p>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon i">🧠</div>
            <div className="feature-title">LLM 실시간 스트리밍</div>
            <div className="feature-desc">Ollama + Llama 3.1이 토큰 단위로 분석 결과를 스트리밍하여 실시간 추론 과정을 확인할 수 있습니다.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon y">📊</div>
            <div className="feature-title">D3.js 공격 시각화</div>
            <div className="feature-desc">공격 흐름 네트워크 그래프, 보안 건강 점수 게이지, 위협 레이더 차트로 직관적으로 파악합니다.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon g">🛡️</div>
            <div className="feature-title">5단계 자동 분석</div>
            <div className="feature-desc">사건 요약 → 공격 의도 → 숙련도 → 대응 권고 → 리포트 서술까지 5단계 분석을 자동 수행합니다.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon r">🎯</div>
            <div className="feature-title">MITRE ATT&CK 매핑</div>
            <div className="feature-desc">MITRE ATT&CK 및 OWASP Top 10 프레임워크 기반으로 공격을 분류하고 대응 방안을 제시합니다.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon b">📋</div>
            <div className="feature-title">PDF 리포트 자동 생성</div>
            <div className="feature-desc">분석 결과와 시각화 차트를 포함한 전문 인시던트 리포트를 PDF로 즉시 다운로드합니다.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon p">🔗</div>
            <div className="feature-title">Spring 연동 API</div>
            <div className="feature-desc">RESTful API로 기존 보안 시스템과 연동하거나 단건 분석 결과를 프로그래밍으로 활용합니다.</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2 className="cta-title">지금 바로 <span>무료로</span> 시작하세요</h2>
        <p className="cta-desc">계정을 만들고 AI 공격 분석 대시보드를 경험해보세요.</p>
        <div className="hero-btns">
          <Link href="/signup" className="btn-primary">무료 회원가입 →</Link>
          <Link href="/login" className="btn-secondary">로그인</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <span>🍯 정사평 — 허니팟 기반 사이버 공격 분석 시스템</span>
        <span>Powered by Llama 3.1 · Built with Next.js</span>
      </footer>
    </>
  );
}
