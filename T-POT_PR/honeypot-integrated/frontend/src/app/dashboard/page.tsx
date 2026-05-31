"use client";

// 대시보드 (static/index.html → Next.js Client Component)
// D3.js 는 npm 패키지로 사용 (CDN → import)

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as d3 from "d3";
import type { 공격로그입력 } from "@/types/input";
import AttackMap, { type 공격항목 } from "@/components/AttackMap";
import { getToken, logout, listScenarios, runScenario, runAllScenarios, getBatchStatus, cancelBatch, type ScenarioStatus, type BatchStatus } from "@/lib/api-client";
import type { 공격유형코드, 위험등급코드 } from "@/types/input";

// ── 시나리오 메타데이터 (백엔드 9종 매핑) ────────────────────────────────────

interface 시나리오메타타입 {
  아이콘: string;
  설명: string;
  위험등급: 위험등급코드;
  위험점수: number;
  위험한글: string;
  공격유형: 공격유형코드;
  행위시퀀스: string[];
  OWASP분류?: string;
  MITRE전술?: string;
  공격자국가: string;
}

const 시나리오메타: Record<string, 시나리오메타타입> = {
  "01": { 아이콘: "🔵", 설명: "정상 사용자 트래픽 시뮬레이션", 위험등급: "LOW", 위험점수: 15, 위험한글: "낮음", 공격유형: "UNKNOWN", 행위시퀀스: ["정상접속", "서비스이용", "세션종료"], 공격자국가: "한국" },
  "02": { 아이콘: "🔍", 설명: "네트워크 포트 스캔 및 서비스 탐지", 위험등급: "LOW", 위험점수: 32, 위험한글: "낮음", 공격유형: "PORT_SCAN", 행위시퀀스: ["포트스캔", "서비스탐지", "배너수집"], OWASP분류: "A06-VulnerableComponents", MITRE전술: "T1046", 공격자국가: "중국" },
  "03": { 아이콘: "🔨", 설명: "SSH/FTP 무차별 대입 공격 시도", 위험등급: "MEDIUM", 위험점수: 62, 위험한글: "보통", 공격유형: "BRUTE_FORCE", 행위시퀀스: ["포트스캔", "로그인시도", "무차별대입", "패스워드크래킹"], OWASP분류: "A07-AuthFailures", MITRE전술: "T1110", 공격자국가: "러시아" },
  "04": { 아이콘: "💉", 설명: "웹 취약점 SQL 인젝션/XSS 공격", 위험등급: "HIGH", 위험점수: 78, 위험한글: "높음", 공격유형: "SQL_INJECTION", 행위시퀀스: ["웹탐색", "취약점스캔", "SQL인젝션", "XSS시도"], OWASP분류: "A03-Injection", MITRE전술: "T1190", 공격자국가: "중국" },
  "05": { 아이콘: "🕵️", 설명: "침투 성공 후 내부 명령어 실행", 위험등급: "HIGH", 위험점수: 85, 위험한글: "높음", 공격유형: "COMMAND_INJECTION", 행위시퀀스: ["로그인성공", "내부탐색", "권한상승", "명령실행", "데이터수집"], OWASP분류: "A01-BrokenAccessControl", MITRE전술: "T1059", 공격자국가: "북한" },
  "06": { 아이콘: "🐚", 설명: "리버스 셸 연결 및 원격 제어", 위험등급: "CRITICAL", 위험점수: 93, 위험한글: "치명", 공격유형: "RCE", 행위시퀀스: ["취약점탐색", "익스플로잇", "리버스셸연결", "지속성확보", "측면이동"], OWASP분류: "A06-VulnerableComponents", MITRE전술: "T1203", 공격자국가: "북한" },
  "07": { 아이콘: "🦠", 설명: "악성 파일 업로드 및 원격 실행", 위험등급: "CRITICAL", 위험점수: 91, 위험한글: "치명", 공격유형: "RCE", 행위시퀀스: ["파일업로드", "악성코드실행", "백도어설치", "데이터탈취"], OWASP분류: "A04-InsecureDesign", MITRE전술: "T1105", 공격자국가: "러시아" },
  "08": { 아이콘: "🔑", 설명: "유출 크리덴셜을 이용한 스터핑 공격", 위험등급: "HIGH", 위험점수: 72, 위험한글: "높음", 공격유형: "BRUTE_FORCE", 행위시퀀스: ["크리덴셜수집", "로그인시도", "계정탈취", "세션하이재킹"], OWASP분류: "A07-AuthFailures", MITRE전술: "T1110.004", 공격자국가: "이란" },
  "09": { 아이콘: "⚙️", 설명: "산업제어시스템 SCADA 프로토콜 공격", 위험등급: "HIGH", 위험점수: 76, 위험한글: "높음", 공격유형: "PORT_SCAN", 행위시퀀스: ["ICS탐지", "프로토콜스캔", "SCADA접근시도", "PLC조작시도"], OWASP분류: "A05-SecurityMisconfiguration", MITRE전술: "T1046", 공격자국가: "중국" },
};

function 시나리오에서로그생성(sc: ScenarioStatus): 공격로그입력 {
  const meta = 시나리오메타[sc.id];
  const num = parseInt(sc.id, 10) || 1;
  return {
    사건ID: `INC-2026-${sc.id.padStart(3, "0")}`,
    허니팟ID: `hp-user1-${sc.id}`,
    발생시각: sc.started_at ?? new Date().toISOString(),
    공격자IP: `172.16.${num}.${100 + num}`,
    공격자국가: meta?.공격자국가,
    공격자포트: 30000 + num * 100,
    공격유형: meta?.공격유형 ?? "UNKNOWN",
    위험점수: meta?.위험점수 ?? 50,
    탐지신뢰도: 0.87,
    위험등급: meta?.위험등급 ?? "MEDIUM",
    OWASP분류: meta?.OWASP분류,
    MITRE전술: meta?.MITRE전술,
    페이로드: sc.output ? sc.output.slice(0, 500) : `시나리오 ${sc.id}: ${sc.name}`,
    대상URI: "/honeypot",
    HTTP메서드: "POST",
    사용자에이전트: "kali-attacker/1.0 (Kali Linux)",
    행위시퀀스: meta?.행위시퀀스 ?? ["공격시도"],
    요청횟수: 50 + num * 30,
    세션지속시간: 60 + num * 20,
  };
}

interface 선택된시나리오 {
  id: string;
  이름: string;
  state: string;
  데이터: 공격로그입력;
}

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
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  const [선택시나리오, set선택시나리오] = useState<선택된시나리오 | null>(null);
  const [backendScenarios, setBackendScenarios] = useState<ScenarioStatus[]>([]);
  const [실행중시나리오, set실행중시나리오] = useState<string | null>(null);
  const [배치상태, set배치상태] = useState<BatchStatus | null>(null);
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

  // ── 백엔드 시나리오 fetch + 배치 상태 폴링 (4초) ───────────────────────
  useEffect(() => {
    let mounted = true;
    const fetch시나리오 = async () => {
      try {
        const list = await listScenarios();
        if (mounted) setBackendScenarios(list);
      } catch { /* 인증 실패 등 무시 */ }
      try {
        const batch = await getBatchStatus();
        if (mounted) set배치상태(batch);
      } catch { /* 배치 상태 실패는 무시 */ }
    };
    fetch시나리오();
    const timer = setInterval(fetch시나리오, 4000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

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

  // ── Kill Chain 타임라인 ──────────────────────────────────────────────────
  const 네트워크그래프그리기 = useCallback((로그: 공격로그입력) => {
    if (!네트워크SVGRef.current) return;
    const svgEl = 네트워크SVGRef.current;
    const W = svgEl.getBoundingClientRect().width || 560, H = 200;
    const svg = d3.select(svgEl).attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg.selectAll("*").remove();
    if (시뮬레이션Ref.current) { 시뮬레이션Ref.current.stop(); 시뮬레이션Ref.current = null; }

    const nodes = [
      { label: 로그.공격자IP, sub: 로그.공격자국가 ?? "", type: "attacker" as const },
      ...로그.행위시퀀스.map((s) => ({ label: s, sub: "", type: "action" as const })),
      { label: "허니팟", sub: 로그.허니팟ID ?? "", type: "honeypot" as const },
    ];
    const N = nodes.length;
    const padX = 44, cy = 96;
    const step = N > 1 ? (W - padX * 2) / (N - 1) : 0;
    const xOf = (i: number) => padX + i * step;
    const rOf = (t: string) => t === "action" ? 22 : 28;
    const strokeOf = (t: string) => t === "attacker" ? "#ef4444" : t === "honeypot" ? "#6366f1" : "#94a3b8";
    const bgOf    = (t: string) => t === "attacker" ? "rgba(239,68,68,0.18)" : t === "honeypot" ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.06)";
    const txtOf   = (t: string) => t === "attacker" ? "#f87171" : t === "honeypot" ? "#a5b4fc" : "#94a3b8";

    const defs = svg.append("defs");

    // 배경 그라디언트
    const bgG = defs.append("linearGradient").attr("id", "kc-bg").attr("gradientUnits", "objectBoundingBox")
      .attr("x1", "0").attr("y1", "0").attr("x2", "1").attr("y2", "1");
    bgG.append("stop").attr("offset", "0%").attr("stop-color", "#0d1424");
    bgG.append("stop").attr("offset", "100%").attr("stop-color", "#111827");
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "url(#kc-bg)").attr("rx", 10);

    // 선 그라디언트 (빨강 → 보라 → 인디고)
    const lineG = defs.append("linearGradient").attr("id", "kc-line")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", String(xOf(0))).attr("y1", "0")
      .attr("x2", String(xOf(N - 1))).attr("y2", "0");
    lineG.append("stop").attr("offset", "0%").attr("stop-color", "#ef4444");
    lineG.append("stop").attr("offset", "50%").attr("stop-color", "#a855f7");
    lineG.append("stop").attr("offset", "100%").attr("stop-color", "#6366f1");

    // 화살표 마커
    defs.append("marker").attr("id", "kc-arrow").attr("viewBox", "0 -4 8 8")
      .attr("refX", 7).attr("refY", 0).attr("markerWidth", 5).attr("markerHeight", 5).attr("orient", "auto")
      .append("path").attr("d", "M0,-4L8,0L0,4").attr("fill", "#a855f7");

    // 글로우 필터
    const glow = defs.append("filter").attr("id", "kc-glow")
      .attr("x", "-35%").attr("y", "-35%").attr("width", "170%").attr("height", "170%");
    glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    glow.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).join("feMergeNode").attr("in", (d) => d);

    // STEP 라벨 (상단)
    nodes.forEach((node, i) => {
      if (node.type === "action") {
        svg.append("text").attr("x", xOf(i)).attr("y", 14)
          .attr("text-anchor", "middle").attr("font-size", "8.5px").attr("font-weight", "700")
          .attr("fill", "#475569").attr("letter-spacing", "0.8px").text(`STEP ${i}`);
      }
    });

    // 배경 점선 트랙
    svg.append("line")
      .attr("x1", xOf(0)).attr("y1", cy).attr("x2", xOf(N - 1)).attr("y2", cy)
      .attr("stroke", "rgba(255,255,255,0.1)").attr("stroke-width", 2).attr("stroke-dasharray", "5 5");

    // 세그먼트 연결선
    nodes.forEach((node, i) => {
      if (i >= N - 1) return;
      const x1 = xOf(i) + rOf(node.type) + 2;
      const x2 = xOf(i + 1) - rOf(nodes[i + 1].type) - 2;
      if (x2 > x1 + 4) {
        svg.append("line")
          .attr("x1", x1).attr("y1", cy).attr("x2", x2).attr("y2", cy)
          .attr("stroke", "url(#kc-line)").attr("stroke-width", 3)
          .attr("marker-end", "url(#kc-arrow)");
      }
    });

    // 노드 그리기
    nodes.forEach((node, i) => {
      const x = xOf(i);
      const R = rOf(node.type);
      const g = svg.append("g");

      g.append("circle").attr("cx", x).attr("cy", cy).attr("r", R)
        .attr("fill", bgOf(node.type)).attr("stroke", strokeOf(node.type)).attr("stroke-width", 2.5)
        .attr("filter", node.type !== "action" ? "url(#kc-glow)" : null);

      if (node.type === "action") {
        const short = node.label.length > 4 ? node.label.slice(0, 4) : node.label;
        g.append("text").attr("x", x).attr("y", cy)
          .attr("text-anchor", "middle").attr("dominant-baseline", "central")
          .attr("font-size", "9px").attr("font-weight", "800").attr("fill", "#64748b").text(short);
      } else {
        g.append("text").attr("x", x).attr("y", cy)
          .attr("text-anchor", "middle").attr("dominant-baseline", "central").attr("font-size", "15px")
          .text(node.type === "attacker" ? "⚠️" : "🍯");
      }

      const mainLabel = node.label.length > 10 ? node.label.slice(0, 10) + "…" : node.label;
      g.append("text").attr("x", x).attr("y", cy + R + 14)
        .attr("text-anchor", "middle").attr("font-size", "10px").attr("font-weight", "700")
        .attr("fill", txtOf(node.type)).text(mainLabel);

      if (node.sub) {
        g.append("text").attr("x", x).attr("y", cy + R + 27)
          .attr("text-anchor", "middle").attr("font-size", "8.5px").attr("fill", "#94a3b8")
          .text(node.sub.length > 11 ? node.sub.slice(0, 11) + "…" : node.sub);
      }
    });

    // 애니메이션 입자 (좌→우 흐름)
    function launchParticle(segIdx: number, delay: number) {
      const x1 = xOf(segIdx) + rOf(nodes[segIdx].type) + 2;
      const x2 = xOf(segIdx + 1) - rOf(nodes[segIdx + 1].type) - 2;
      if (x2 <= x1) return;
      setTimeout(() => {
        if (!svgEl.isConnected) return;
        const p = svg.append("circle")
          .attr("cx", x1).attr("cy", cy).attr("r", 5).attr("fill", "#ef4444").attr("opacity", 0.9)
          .style("filter", "drop-shadow(0 0 5px #ef4444)");
        p.transition().duration(600 + (x2 - x1) * 1.2).ease(d3.easeLinear)
          .attr("cx", x2).attr("fill", "#6366f1").attr("opacity", 0.15)
          .on("end", () => { if (p.node()) p.remove(); launchParticle(segIdx, 800 + Math.random() * 600); });
      }, delay);
    }
    for (let i = 0; i < N - 1; i++) launchParticle(i, i * 220);
  }, []);

  // ── 시나리오 선택 ────────────────────────────────────────────────────────
  function 시나리오선택(sc: ScenarioStatus) {
    const 데이터 = 시나리오에서로그생성(sc);
    set선택시나리오({ id: sc.id, 이름: sc.name, state: sc.state, 데이터 });
    setShowEmpty(false);
    setShowGauge(true);
    setShowGraph(true);
    setTimeout(() => {
      게이지그리기(데이터.위험점수);
      네트워크그래프그리기(데이터);
    }, 50);
  }

  // ── 시나리오 실행 ─────────────────────────────────────────────────────────
  async function handleRunScenario(id: string) {
    set실행중시나리오(id);
    try {
      await runScenario(id);
    } catch { /* ignore */ }
    setTimeout(() => set실행중시나리오(null), 2000);
  }

  // ── 일괄 순차 실행 ───────────────────────────────────────────────────────
  async function handle일괄실행() {
    try {
      await runAllScenarios();
      const batch = await getBatchStatus();
      set배치상태(batch);
    } catch { /* ignore */ }
  }

  async function handle배치취소() {
    try {
      await cancelBatch();
      const batch = await getBatchStatus();
      set배치상태(batch);
    } catch { /* ignore */ }
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
        .attr("fill", p === 100 ? "rgba(255,255,255,0.03)" : "none").attr("stroke", "rgba(255,255,255,0.1)").attr("stroke-width", p === 100 ? 1.5 : 1);
    });
    d3.range(N).forEach((i) => {
      const [x, y] = 값to좌표(i, 100);
      g.append("line").attr("x1", cx).attr("y1", cy).attr("x2", x).attr("y2", y).attr("stroke", "rgba(255,255,255,0.08)").attr("stroke-width", 1);
    });
    const pts = 데이터목록.map((d, i) => 값to좌표(i, d.값));
    g.append("polygon").attr("points", pts.map((d) => d.join(",")).join(" ")).attr("fill", "rgba(99,102,241,0.15)").attr("stroke", "#6366f1").attr("stroke-width", 2);
    pts.forEach(([x, y]) => {
      g.append("circle").attr("cx", x).attr("cy", y).attr("r", 4).attr("fill", "#6366f1").attr("stroke", "#1e293b").attr("stroke-width", 1.5);
    });
    데이터목록.forEach((d, i) => {
      const [x, y] = 값to좌표(i, 118);
      const 정렬 = x < cx - 5 ? "end" : x > cx + 5 ? "start" : "middle";
      g.append("text").attr("x", x).attr("y", y).attr("text-anchor", 정렬).attr("dominant-baseline", "middle").attr("font-size", "11px").attr("font-weight", "700").attr("fill", "#cbd5e1").text(d.축);
      g.append("text").attr("x", x).attr("y", y + 13).attr("text-anchor", 정렬).attr("dominant-baseline", "middle").attr("font-size", "10px").attr("fill", "#818cf8").attr("font-weight", "800").text(Math.round(d.값));
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
      g.append("rect").attr("x", 0).attr("y", y).attr("width", 바영역W).attr("height", 바높이).attr("rx", 6).attr("fill", "rgba(255,255,255,0.05)");
      g.append("rect").attr("x", 0).attr("y", y).attr("width", 0).attr("height", 바높이).attr("rx", 6).attr("fill", d.색).attr("opacity", 0.75)
        .transition().duration(800).delay(i * 100).ease(d3.easeCubicOut).attr("width", barW);
      g.append("text").attr("x", -8).attr("y", y + 바높이 / 2).attr("text-anchor", "end").attr("dominant-baseline", "middle").attr("font-size", "11px").attr("font-weight", "600").attr("fill", "#94a3b8").text(d.항목);
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
        *, *::before, *::after { box-sizing: border-box; }
        body { background: #07090f; color: #cbd5e1; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes 깜빡 { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        /* ── 헤더 ── */
        header { background: rgba(7,9,15,0.95); backdrop-filter: blur(12px); color: white; padding: 0 28px; display: flex; align-items: center; justify-content: space-between; height: 58px; border-bottom: 1px solid rgba(255,255,255,0.07); position: sticky; top: 0; z-index: 100; }
        .헤더왼쪽 { display: flex; align-items: center; gap: 12px; }
        .헤더로고 { font-size: 1.4rem; }
        .헤더제목 { font-size: 1rem; font-weight: 700; color: #f1f5f9; letter-spacing: -0.01em; }
        .헤더제목 span { color: #fbbf24; }
        .헤더부제 { font-size: 0.69rem; color: #475569; margin-top: 2px; letter-spacing: 0.02em; }
        .헤더오른쪽 { display: flex; align-items: center; gap: 8px; }
        .헤더nav { display: flex; align-items: center; gap: 2px; }
        .헤더nav-링크 { padding: 5px 12px; border-radius: 7px; font-size: 0.78rem; font-weight: 600; color: #64748b; text-decoration: none; transition: all 0.18s; }
        .헤더nav-링크:hover { color: #e2e8f0; background: rgba(255,255,255,0.06); }
        .헤더nav-링크.활성 { color: #a5b4fc; background: rgba(99,102,241,0.18); }
        .로그아웃버튼 { padding: 5px 12px; border-radius: 7px; font-size: 0.78rem; font-weight: 600; color: #64748b; background: none; border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.18s; }
        .로그아웃버튼:hover { color: #f87171; border-color: rgba(248,113,113,0.4); }
        .서버상태칩 { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 4px 11px; font-size: 0.75rem; color: #64748b; }

        /* ── 레이아웃 ── */
        .레이아웃 { display: grid; grid-template-columns: 360px 1fr; gap: 18px; padding: 20px 24px; max-width: 1480px; margin: 0 auto; }

        /* ── 카드 ── */
        .카드 { background: #0d1117; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 18px 20px; animation: slideIn 0.25s ease; }

        /* ── 섹션 헤더 ── */
        .섹션헤더 { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .섹션번호 { width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; font-size: 0.68rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .섹션제목 { font-size: 0.85rem; font-weight: 700; color: #e2e8f0; }
        .섹션설명 { font-size: 0.72rem; color: #475569; margin-left: auto; }

        /* ── 왼쪽 패널 ── */
        .왼쪽패널 { display: flex; flex-direction: column; gap: 12px; max-height: calc(100vh - 78px); overflow-y: auto; padding-right: 2px; }

        /* ── 시나리오 버튼 ── */
        .시나리오버튼 { width: 100%; text-align: left; padding: 11px 13px; border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; background: rgba(255,255,255,0.025); cursor: pointer; transition: all 0.18s; display: block; }
        .시나리오버튼:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.07); transform: translateX(2px); }
        .시나리오버튼.선택됨 { border-color: rgba(99,102,241,0.6); background: rgba(99,102,241,0.12); box-shadow: 0 0 0 3px rgba(99,102,241,0.1), inset 0 0 0 1px rgba(99,102,241,0.3); }
        .시나리오헤더행 { display: flex; align-items: center; gap: 7px; margin-bottom: 3px; }
        .시나리오아이콘 { font-size: 1rem; flex-shrink: 0; }
        .시나리오이름 { font-weight: 700; font-size: 0.84rem; color: #e2e8f0; flex: 1; }
        .시나리오설명 { font-size: 0.73rem; color: #475569; display: block; padding-left: 26px; }

        /* ── 배지 ── */
        .위험배지 { font-size: 0.64rem; font-weight: 700; padding: 2px 7px; border-radius: 20px; white-space: nowrap; letter-spacing: 0.02em; }
        .위험배지.낮음 { background: rgba(59,130,246,0.18); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
        .위험배지.보통 { background: rgba(234,179,8,0.18); color: #fbbf24; border: 1px solid rgba(234,179,8,0.25); }
        .위험배지.높음 { background: rgba(239,68,68,0.18); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
        .위험배지.치명 { background: rgba(239,68,68,0.28); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); }
        .상태칩 { font-size: 0.63rem; font-weight: 700; padding: 1px 6px; border-radius: 9px; white-space: nowrap; flex-shrink: 0; }
        .상태칩.idle { background: rgba(255,255,255,0.07); color: #475569; }
        .상태칩.running { background: rgba(251,191,36,0.18); color: #fbbf24; animation: pulse 1.5s infinite; border: 1px solid rgba(251,191,36,0.3); }
        .상태칩.done { background: rgba(34,197,94,0.18); color: #4ade80; border: 1px solid rgba(34,197,94,0.25); }
        .상태칩.failed { background: rgba(239,68,68,0.18); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }

        /* ── 실행 버튼 ── */
        .시나리오실행버튼 { flex-shrink: 0; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #94a3b8; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.18s; }
        .시나리오실행버튼:hover:not(:disabled) { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.5); color: #a5b4fc; }
        .시나리오실행버튼:disabled { opacity: 0.4; cursor: not-allowed; }

        /* ── 게이지 ── */
        .게이지카드제목 { font-size: 0.85rem; font-weight: 700; color: #e2e8f0; margin-bottom: 8px; }
        .게이지레이블 { text-align: center; font-size: 0.74rem; color: #475569; margin-top: 4px; }

        /* ── 분석/PDF 버튼 ── */
        #분석시작버튼 { width: 100%; padding: 14px; border-radius: 11px; border: none; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; font-size: 0.92rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; letter-spacing: -0.01em; box-shadow: 0 4px 20px rgba(79,70,229,0.35); }
        #분석시작버튼:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(79,70,229,0.45); }
        #분석시작버튼:disabled { background: rgba(255,255,255,0.06); color: #475569; cursor: not-allowed; transform: none; box-shadow: none; }
        #PDF버튼 { width: 100%; padding: 11px; border-radius: 10px; border: 1px solid rgba(99,102,241,0.3); background: rgba(99,102,241,0.12); color: #a5b4fc; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 7px; }
        #PDF버튼:hover { background: rgba(99,102,241,0.22); box-shadow: 0 4px 14px rgba(99,102,241,0.2); }
        .일괄실행버튼 { width: 100%; padding: 11px; border-radius: 10px; border: 1px solid rgba(34,197,94,0.3); background: rgba(34,197,94,0.08); color: #4ade80; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 7px; }
        .일괄실행버튼:hover:not(:disabled) { background: rgba(34,197,94,0.16); box-shadow: 0 4px 14px rgba(34,197,94,0.15); }
        .일괄실행버튼:disabled { opacity: 0.4; cursor: not-allowed; }
        .배치취소버튼 { width: 100%; padding: 9px; border-radius: 10px; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #f87171; font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .배치취소버튼:hover { background: rgba(239,68,68,0.15); }
        .배치진행박스 { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
        .배치진행라벨 { font-size: 0.78rem; color: #94a3b8; display: flex; justify-content: space-between; }
        .배치진행바배경 { width: 100%; height: 6px; background: rgba(255,255,255,0.07); border-radius: 3px; overflow: hidden; }
        .배치진행바 { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #22c55e, #4ade80); transition: width 0.4s ease; }

        /* ── 오른쪽 패널 ── */
        .오른쪽패널 { display: flex; flex-direction: column; gap: 14px; }
        .그래프카드헤더 { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .그래프카드헤더 .제목 { font-size: 0.85rem; font-weight: 700; color: #e2e8f0; }
        #네트워크SVG { width: 100%; height: 200px; border-radius: 10px; }
        .그래프범례 { display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
        .범례항목 { display: flex; align-items: center; gap: 5px; font-size: 0.72rem; color: #475569; }
        .범례점 { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

        /* ── 분석 단계 ── */
        .단계목록 { display: flex; gap: 6px; flex-wrap: wrap; }
        .단계칩 { padding: 4px 11px; border-radius: 20px; font-size: 0.73rem; font-weight: 600; background: rgba(255,255,255,0.05); color: #475569; transition: all 0.3s; border: 1px solid transparent; }
        .단계칩.진행중 { background: rgba(251,191,36,0.12); color: #fbbf24; border-color: rgba(251,191,36,0.3); animation: pulse 1.5s infinite; }
        .단계칩.완료 { background: rgba(34,197,94,0.12); color: #4ade80; border-color: rgba(34,197,94,0.25); }

        /* ── 스트리밍 ── */
        .스트리밍헤더 { background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.07); border-radius: 13px 13px 0 0; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; }
        .스트리밍헤더왼쪽 { display: flex; align-items: center; gap: 8px; }
        .스트리밍점 { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e80; animation: pulse 1.5s infinite; }
        .스트리밍제목 { color: #64748b; font-size: 0.76rem; font-family: monospace; }
        .스트리밍배지 { background: rgba(99,102,241,0.18); color: #818cf8; font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 9px; border: 1px solid rgba(99,102,241,0.25); }
        .스트리밍본문 { background: #020817; border-radius: 0 0 13px 13px; padding: 14px 16px; max-height: 220px; overflow-y: auto; }
        #스트리밍텍스트 { font-family: "SF Mono","Fira Code",monospace; font-size: 0.77rem; color: #67e8f9; line-height: 1.75; white-space: pre-wrap; word-break: break-all; }
        .커서 { display: inline-block; width: 6px; height: 13px; background: #67e8f9; animation: 깜빡 0.8s infinite; vertical-align: text-bottom; border-radius: 1px; }

        /* ── 결과 카드 ── */
        .결과카드헤더 { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .결과카드제목 { font-size: 0.95rem; font-weight: 800; color: #e2e8f0; }
        .결과카드부제 { font-size: 0.72rem; color: #475569; margin-left: auto; }
        .요약카드 { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; }
        .요약텍스트 { font-size: 0.89rem; line-height: 1.8; color: #cbd5e1; margin-bottom: 14px; }
        .포인트목록 { list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .포인트목록 li { display: flex; align-items: flex-start; gap: 8px; font-size: 0.82rem; color: #94a3b8; line-height: 1.6; }
        .포인트목록 li::before { content: "▸"; color: #6366f1; flex-shrink: 0; margin-top: 2px; font-size: 0.72rem; }
        .공격명배지 { display: inline-flex; align-items: center; gap: 5px; margin-top: 12px; background: rgba(99,102,241,0.15); color: #a5b4fc; padding: 4px 12px; border-radius: 20px; font-size: 0.76rem; font-weight: 700; border: 1px solid rgba(99,102,241,0.25); }
        .결과그리드 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .분석칩카드 { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 14px; }
        .분석칩섹션제목 { font-size: 0.73rem; font-weight: 700; color: #475569; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        .큰배지 { font-size: 0.82rem; font-weight: 800; padding: 5px 13px; border-radius: 8px; display: inline-block; margin-bottom: 10px; }
        .큰배지.정보수집,.큰배지.취약점탐색 { background: rgba(59,130,246,0.18); color: #60a5fa; border: 1px solid rgba(59,130,246,0.25); }
        .큰배지.침투시도,.큰배지.데이터탈취 { background: rgba(239,68,68,0.18); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
        .큰배지.서비스방해 { background: rgba(234,88,12,0.18); color: #fb923c; border: 1px solid rgba(234,88,12,0.25); }
        .큰배지.불명 { background: rgba(255,255,255,0.06); color: #64748b; }
        .큰배지.초보 { background: rgba(34,197,94,0.18); color: #4ade80; border: 1px solid rgba(34,197,94,0.25); }
        .큰배지.중급 { background: rgba(234,179,8,0.18); color: #fbbf24; border: 1px solid rgba(234,179,8,0.25); }
        .큰배지.고급 { background: rgba(239,68,68,0.18); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
        .신뢰도바컨테이너 { margin: 10px 0 8px; }
        .신뢰도바컨테이너 .라벨 { font-size: 0.72rem; color: #475569; margin-bottom: 5px; display: flex; justify-content: space-between; font-weight: 500; }
        .신뢰도바 { height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
        .신뢰도바 .채움 { height: 100%; background: linear-gradient(90deg,#6366f1,#8b5cf6); border-radius: 3px; transition: width 0.9s cubic-bezier(0.4,0,0.2,1); }
        .근거설명 { font-size: 0.79rem; color: #64748b; line-height: 1.7; margin-top: 6px; }
        .권고카드 { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; }
        .우선순위행 { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 0.79rem; color: #475569; font-weight: 500; }
        .권고섹션제목 { font-size: 0.73rem; font-weight: 700; margin-bottom: 7px; }
        .권고섹션제목.즉각 { color: #f87171; }
        .권고섹션제목.장기 { color: #60a5fa; }
        .권고목록 { list-style: none; display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
        .권고목록 li { font-size: 0.8rem; color: #94a3b8; padding: 8px 11px; border-radius: 8px; line-height: 1.6; }
        .권고목록.즉각 li { background: rgba(239,68,68,0.08); border-left: 2px solid rgba(248,113,113,0.5); }
        .권고목록.장기 li { background: rgba(59,130,246,0.08); border-left: 2px solid rgba(96,165,250,0.4); }
        .우선순위배지 { font-size: 0.71rem; font-weight: 700; padding: 2px 9px; border-radius: 20px; }
        .우선순위배지.즉시 { background: rgba(239,68,68,0.18); color: #f87171; }
        .우선순위배지.시간 { background: rgba(234,179,8,0.18); color: #fbbf24; }
        .우선순위배지.주 { background: rgba(59,130,246,0.18); color: #60a5fa; }
        .리포트서술박스 { background: rgba(99,102,241,0.07); border-left: 3px solid rgba(99,102,241,0.6); padding: 16px; border-radius: 0 10px 10px 0; font-size: 0.86rem; line-height: 1.85; color: #94a3b8; }
        .결과구분선 { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 16px 0; }

        /* ── 빈 상태 ── */
        .빈상태 { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 52px 20px; color: #475569; text-align: center; min-height: 300px; }
        .빈상태아이콘 { font-size: 3.2rem; margin-bottom: 18px; opacity: 0.5; }
        .빈상태제목 { font-size: 0.96rem; font-weight: 700; color: #64748b; margin-bottom: 8px; }
        .빈상태설명 { font-size: 0.8rem; line-height: 1.75; color: #475569; }
        .빈상태힌트 { margin-top: 22px; display: flex; flex-direction: column; gap: 7px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 18px; text-align: left; width: 100%; max-width: 300px; }
        .힌트행 { display: flex; align-items: center; gap: 8px; font-size: 0.77rem; color: #475569; }
        .힌트번호 { width: 17px; height: 17px; border-radius: 50%; background: rgba(99,102,241,0.2); color: #818cf8; font-size: 0.62rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .오류박스 { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; padding: 14px 16px; color: #f87171; font-size: 0.83rem; line-height: 1.6; }
      `}</style>

      <header>
        <div className="헤더왼쪽">
          <span className="헤더로고">🍯</span>
          <div>
            <div className="헤더제목"><span>허니팟</span> 공격 분석 시스템</div>
            <div className="헤더부제">AI 기반 사이버 공격 자동 분석 · Powered by Llama 3.1</div>
          </div>
        </div>
        <div className="헤더오른쪽">
          <div className="서버상태칩">
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: 서버상태.연결됨 ? "#22c55e" : "#ef4444", boxShadow: 서버상태.연결됨 ? "0 0 6px #22c55e80" : undefined, flexShrink: 0, transition: "all 0.3s" }} />
            <span>{서버상태.연결됨 ? `AI 연결됨 · ${서버상태.모델}` : "서버 연결 안됨"}</span>
          </div>
          <nav className="헤더nav">
            <Link href="/dashboard" className="헤더nav-링크 활성">📊 분석</Link>
            <Link href="/honeypot" className="헤더nav-링크">🍯 허니팟</Link>
            <Link href="/profiling" className="헤더nav-링크">📋 공격 이력</Link>
            <Link href="/ml" className="헤더nav-링크">🤖 ML 분류</Link>
          </nav>
          <button className="로그아웃버튼" onClick={() => { logout(); router.push("/login"); }}>로그아웃</button>
        </div>
      </header>

      <div className="레이아웃">
        {/* ── 왼쪽 패널 ── */}
        <div className="왼쪽패널">
          <div className="카드">
            <div className="섹션헤더">
              <div className="섹션번호">1</div>
              <span className="섹션제목">공격 시나리오 선택</span>
              <span className="섹션설명">9가지 실전 공격</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {backendScenarios.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: "0.8rem", textAlign: "center", padding: "20px 0" }}>시나리오 불러오는 중...</div>
              ) : backendScenarios.map((sc) => {
                const meta = 시나리오메타[sc.id];
                const isSelected = 선택시나리오?.id === sc.id;
                const isRunning = sc.state === "running";
                const 위험한글 = meta?.위험한글 ?? "보통";
                return (
                  <div key={sc.id} className={`시나리오버튼 ${isSelected ? "선택됨" : ""}`} onClick={() => 시나리오선택(sc)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && 시나리오선택(sc)}>
                    <div className="시나리오헤더행">
                      <span className="시나리오아이콘">{meta?.아이콘 ?? "⚡"}</span>
                      <span className="시나리오이름">{sc.name}</span>
                      <span className={`위험배지 ${위험한글}`}>{위험한글}</span>
                      <span className={`상태칩 ${sc.state}`}>{sc.state === "running" ? "실행중" : sc.state === "done" ? "완료" : sc.state === "failed" ? "실패" : "대기"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 28, marginTop: 2 }}>
                      <span className="시나리오설명" style={{ flex: 1 }}>{meta?.설명 ?? sc.label}</span>
                      <button
                        className="시나리오실행버튼"
                        onClick={(e) => { e.stopPropagation(); void handleRunScenario(sc.id); }}
                        disabled={isRunning || 실행중시나리오 === sc.id}
                        title="시나리오 실행"
                      >
                        {isRunning || 실행중시나리오 === sc.id ? "⏳" : "▶"}
                      </button>
                    </div>
                  </div>
                );
              })}
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

          {/* ── 일괄 순차 실행 ── */}
          {배치상태?.running ? (
            <div className="배치진행박스">
              <div className="배치진행라벨">
                <span>⏳ 순차 실행 중 — {배치상태.current ? `시나리오 ${배치상태.current}` : "준비 중..."}</span>
                <span>{배치상태.done.length +배치상태.failed.length}/{배치상태.ids.length}</span>
              </div>
              <div className="배치진행바배경">
                <div className="배치진행바" style={{ width: `${배치상태.ids.length ? ((배치상태.done.length + 배치상태.failed.length) / 배치상태.ids.length) * 100 : 0}%` }} />
              </div>
              {배치상태.failed.length > 0 && (
                <div style={{ fontSize: "0.72rem", color: "#f87171" }}>실패: {배치상태.failed.join(", ")}</div>
              )}
              <button className="배치취소버튼" onClick={handle배치취소}>✕ 취소</button>
            </div>
          ) : (
            <button className="일괄실행버튼" onClick={handle일괄실행} disabled={분석중}>
              <span>▶▶</span><span>전체 시나리오 순차 실행</span>
            </button>
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
                <div className="범례항목"><div className="범례점" style={{ background: "#fee2e2", border: "2px solid #ef4444" }} />공격자</div>
                <div className="범례항목"><div className="범례점" style={{ background: "#f8fafc", border: "2px solid #94a3b8" }} />공격 단계</div>
                <div className="범례항목"><div className="범례점" style={{ background: "#eef2ff", border: "2px solid #6366f1" }} />허니팟</div>
                <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#94a3b8" }}>● 빨강→인디고: 실시간 공격 흐름</div>
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
