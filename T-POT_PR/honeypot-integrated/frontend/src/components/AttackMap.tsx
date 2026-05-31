"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldData from "world-atlas/countries-110m.json";

const 국가좌표: Record<string, [number, number]> = {
  "중국":       [104.19,  35.86],
  "러시아":     [37.62,   55.76],
  "미국":       [-98.58,  39.83],
  "북한":       [127.51,  40.34],
  "일본":       [138.25,  36.20],
  "독일":       [10.45,   51.17],
  "영국":       [-3.44,   55.38],
  "프랑스":     [2.21,    46.23],
  "브라질":     [-51.93, -14.24],
  "인도":       [78.96,   20.59],
  "이란":       [53.69,   32.43],
  "우크라이나": [31.17,   48.38],
  "캐나다":     [-96.80,  56.13],
  "호주":       [133.77, -25.27],
  "한국":       [127.77,  35.91],
};

const 국가ID: Record<string, number> = {
  "중국": 156, "러시아": 643, "미국": 840, "북한": 408, "일본": 392,
  "독일": 276, "영국": 826, "프랑스": 250, "브라질": 76, "인도": 356,
  "이란": 364, "우크라이나": 804, "캐나다": 124, "호주": 36, "한국": 410,
};

const KOREA_ID = 410;
const 타겟좌표: [number, number] = [126.978, 37.566];

const 위험색상: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e",
};
const 위험라벨: Record<string, string> = {
  CRITICAL: "치명", HIGH: "높음", MEDIUM: "보통", LOW: "낮음",
};

export interface 공격항목 {
  국가: string;
  ip: string;
  공격유형: string;
  위험등급: string;
}

interface Props {
  공격: 공격항목 | null;
  허니팟ID?: string;
}

export default function AttackMap({ 공격, 허니팟ID }: Props) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current) return;

    const W = wrapRef.current.clientWidth || 680;
    const H = 300;
    const color   = 공격 ? (위험색상[공격.위험등급] ?? "#ef4444") : null;
    const src좌표  = 공격 ? (국가좌표[공격.국가] ?? null) : null;
    const srcID   = 공격 ? (국가ID[공격.국가] ?? -1) : -1;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", W).attr("height", H)
      .style("cursor", "grab");
    svg.selectAll("*").remove();

    const projection = d3.geoNaturalEarth1()
      .scale(W / 6.5)
      .translate([W / 2, H / 2.1]);
    const geoPath = d3.geoPath().projection(projection);

    // ── defs ─────────────────────────────────────────────
    const defs = svg.append("defs");

    const oceanGrad = defs.append("radialGradient").attr("id", "am-ocean")
      .attr("cx", "50%").attr("cy", "50%").attr("r", "70%");
    oceanGrad.append("stop").attr("offset", "0%").attr("stop-color", "#1e3a5f");
    oceanGrad.append("stop").attr("offset", "100%").attr("stop-color", "#0a1628");

    const glow = defs.append("filter").attr("id", "am-glow")
      .attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%");
    glow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    glow.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).join("feMergeNode").attr("in", (d) => d);

    if (color) {
      const ag = defs.append("filter").attr("id", "am-arc-glow")
        .attr("x", "-20%").attr("y", "-60%").attr("width", "140%").attr("height", "220%");
      ag.append("feGaussianBlur").attr("in", "SourceGraphic").attr("stdDeviation", "3").attr("result", "blur");
      const m = ag.append("feMerge");
      m.append("feMergeNode").attr("in", "blur");
      m.append("feMergeNode").attr("in", "SourceGraphic");
    }

    // ── 배경 (고정 — 줌 안 받음) ─────────────────────────
    svg.append("rect").attr("width", W).attr("height", H)
      .attr("fill", "url(#am-ocean)").attr("rx", 10);

    // mapG: 국가·격자·공격호 (줌과 함께 스케일)
    const mapG = svg.append("g");
    // markerG: 도트·라벨·펄스 (화면 고정 크기 — 위치만 업데이트)
    const markerG = svg.append("g");

    // ── 줌 설정 ──────────────────────────────────────────
    const srcPx  = src좌표 ? projection(src좌표) : null;
    const tgtPx  = projection(타겟좌표);

    // 마커 위치를 zoom transform에 맞게 갱신하는 함수
    function repositionMarkers(t: d3.ZoomTransform) {
      if (tgtPx) {
        const [sx, sy] = t.apply(tgtPx as [number, number]);
        markerG.select(".tgt-dot").attr("cx", sx).attr("cy", sy);
        markerG.select(".tgt-label").attr("x", sx).attr("y", sy - 14);
      }
      if (srcPx) {
        const [sx, sy] = t.apply(srcPx as [number, number]);
        markerG.select(".src-dot").attr("cx", sx).attr("cy", sy);
        markerG.select(".src-name").attr("x", sx).attr("y", sy - 16);
        markerG.select(".src-ip").attr("x", sx).attr("y", sy + 24);
      }
    }

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 20])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        mapG.attr("transform", event.transform.toString());
        repositionMarkers(event.transform);
        svg.style("cursor", "grabbing");
      });

    svg.call(zoom);
    svg.on("mouseup.cur", () => svg.style("cursor", "grab"));
    svg.on("dblclick.zoom", null);
    svg.on("dblclick", () =>
      svg.transition().duration(500).ease(d3.easeCubicOut)
        .call(zoom.transform, d3.zoomIdentity)
    );

    // ── 지도 콘텐츠 (mapG) ───────────────────────────────
    mapG.append("path")
      .datum(d3.geoGraticule()()).attr("d", geoPath)
      .attr("fill", "none").attr("stroke", "#1e3a5f").attr("stroke-width", 0.4);

    const topo      = worldData as unknown as Topology;
    const countries = feature(topo, topo.objects.countries as GeometryCollection);

    mapG.selectAll("path.country")
      .data(countries.features)
      .join("path")
      .classed("country", true)
      .attr("d", geoPath)
      .attr("fill", (d) => {
        const id = Number(d.id);
        if (id === KOREA_ID) return "#4f46e5";
        if (srcID > 0 && id === srcID) return color!;
        return "#1e3a5f";
      })
      .attr("fill-opacity", (d) => {
        const id = Number(d.id);
        return (id === KOREA_ID || (srcID > 0 && id === srcID)) ? 0.75 : 1;
      })
      .attr("stroke", (d) => {
        const id = Number(d.id);
        if (id === KOREA_ID) return "#818cf8";
        if (srcID > 0 && id === srcID) return color!;
        return "#2d4a70";
      })
      .attr("stroke-width", (d) => {
        const id = Number(d.id);
        return (id === KOREA_ID || (srcID > 0 && id === srcID)) ? 1.5 : 0.4;
      });

    // 공격 호 (mapG 안 — 줌하면 세밀하게 보임)
    if (공격 && src좌표 && color && srcPx && tgtPx) {
      const interpolate = d3.geoInterpolate(src좌표, 타겟좌표);
      const points = d3.range(0, 1.01, 0.012)
        .map((t) => projection(interpolate(t)))
        .filter((p): p is [number, number] => p !== null);

      if (points.length >= 2) {
        const pathD = `M ${points.map((p) => p.join(",")).join(" L ")}`;

        mapG.append("path").attr("d", pathD)
          .attr("fill", "none").attr("stroke", color)
          .attr("stroke-width", 8).attr("opacity", 0.18);

        const arcEl = mapG.append("path").attr("d", pathD)
          .attr("fill", "none").attr("stroke", color)
          .attr("stroke-width", 2.5).attr("opacity", 0.95)
          .attr("filter", "url(#am-arc-glow)");

        const 길이 = (arcEl.node() as SVGPathElement).getTotalLength();
        arcEl.attr("stroke-dasharray", 길이).attr("stroke-dashoffset", 길이)
          .transition().duration(1000).ease(d3.easeLinear)
          .attr("stroke-dashoffset", 0);

        // 이동 탄환 (mapG 안에서 arc를 따라 이동)
        const dot = mapG.append("circle").attr("r", 6)
          .attr("fill", color).attr("opacity", 0).attr("filter", "url(#am-glow)");

        function animateBullet() {
          dot.attr("cx", srcPx![0]).attr("cy", srcPx![1]).attr("opacity", 1)
            .transition().delay(1000).duration(1800).ease(d3.easeLinear)
            .attrTween("cx", () => (t) => String(projection(interpolate(t))?.[0] ?? srcPx![0]))
            .attrTween("cy", () => (t) => String(projection(interpolate(t))?.[1] ?? srcPx![1]))
            .attr("opacity", 0)
            .on("end", () => setTimeout(animateBullet, 500));
        }
        animateBullet();
      }

      // 자동 확대 (발원지↔허니팟 구간)
      const midX  = (srcPx[0] + tgtPx[0]) / 2;
      const midY  = (srcPx[1] + tgtPx[1]) / 2;
      const spanX = Math.abs(srcPx[0] - tgtPx[0]);
      const spanY = Math.abs(srcPx[1] - tgtPx[1]);
      const pad   = 90;
      const fitK  = Math.min((W - pad * 2) / Math.max(spanX, 1), (H - pad * 2) / Math.max(spanY, 1));
      const k     = Math.max(1.5, Math.min(fitK, 6));
      const tx    = W / 2 - k * midX;
      const ty    = H / 2 - k * midY;

      svg.transition().delay(400).duration(1100).ease(d3.easeCubicOut)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
    }

    // ── 마커 (markerG — 화면 크기 고정) ──────────────────

    // 허니팟 펄스 (markerG 안)
    if (tgtPx) {
      [1, 2, 3].forEach((n) => {
        (function 펄스() {
          const [sx, sy] = d3.zoomTransform(svgRef.current!).apply(tgtPx as [number, number]);
          markerG.append("circle")
            .attr("cx", sx).attr("cy", sy)
            .attr("r", 6).attr("fill", "none")
            .attr("stroke", "#818cf8").attr("stroke-width", 1.5).attr("opacity", 0.8)
            .transition().duration(2000).delay(n * 350).ease(d3.easeQuadOut)
            .attr("r", 30).attr("opacity", 0).remove().on("end", 펄스);
        })();
      });

      const [tgtSx, tgtSy] = d3.zoomIdentity.apply(tgtPx as [number, number]);
      markerG.append("circle")
        .attr("class", "tgt-dot")
        .attr("cx", tgtSx).attr("cy", tgtSy).attr("r", 9)
        .attr("fill", "#6366f1").attr("stroke", "white").attr("stroke-width", 2)
        .attr("filter", "url(#am-glow)");

      markerG.append("text")
        .attr("class", "tgt-label")
        .attr("x", tgtSx).attr("y", tgtSy - 14)
        .attr("text-anchor", "middle").attr("font-size", "12px").attr("font-weight", "800")
        .attr("fill", "#a5b4fc").attr("stroke", "#0f172a").attr("stroke-width", 3).attr("paint-order", "stroke")
        .text("🍯 허니팟 (서울)");
    }

    // 발원지 마커
    if (srcPx && color) {
      (function 발원펄스() {
        const [sx, sy] = d3.zoomTransform(svgRef.current!).apply(srcPx as [number, number]);
        markerG.append("circle")
          .attr("cx", sx).attr("cy", sy)
          .attr("r", 8).attr("fill", "none")
          .attr("stroke", color).attr("stroke-width", 2).attr("opacity", 0.7)
          .transition().duration(1600).ease(d3.easeQuadOut)
          .attr("r", 28).attr("opacity", 0).remove().on("end", 발원펄스);
      })();

      const [srcSx, srcSy] = d3.zoomIdentity.apply(srcPx as [number, number]);
      markerG.append("circle")
        .attr("class", "src-dot")
        .attr("cx", srcSx).attr("cy", srcSy).attr("r", 10)
        .attr("fill", color).attr("stroke", "white").attr("stroke-width", 2.5)
        .attr("filter", "url(#am-glow)");

      markerG.append("text")
        .attr("class", "src-name")
        .attr("x", srcSx).attr("y", srcSy - 16)
        .attr("text-anchor", "middle").attr("font-size", "13px").attr("font-weight", "800")
        .attr("fill", color).attr("stroke", "#0f172a").attr("stroke-width", 3).attr("paint-order", "stroke")
        .text(공격!.국가);

      markerG.append("text")
        .attr("class", "src-ip")
        .attr("x", srcSx).attr("y", srcSy + 24)
        .attr("text-anchor", "middle").attr("font-size", "10.5px").attr("font-weight", "600")
        .attr("fill", color).attr("stroke", "#0f172a").attr("stroke-width", 3).attr("paint-order", "stroke")
        .text(공격!.ip);
    }

    if (!공격) {
      svg.append("text")
        .attr("x", W / 2).attr("y", H / 2 + 32)
        .attr("text-anchor", "middle").attr("font-size", "13px").attr("font-weight", "600")
        .attr("fill", "#64748b")
        .text("← 왼쪽에서 공격 시나리오를 선택하면 발원지가 표시됩니다");
    }

    svg.append("text")
      .attr("x", W - 7).attr("y", H - 7)
      .attr("text-anchor", "end").attr("font-size", "9.5px")
      .attr("fill", "#334155").attr("pointer-events", "none")
      .text("스크롤 확대 · 드래그 이동 · 더블클릭 초기화");

  // 폴링으로 state만 바뀌어도 공격 객체 참조가 새로 생김 → 원시값으로 비교해 실제 공격정보 변경 시에만 재렌더
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [공격?.국가, 공격?.ip, 공격?.위험등급, 공격?.공격유형]);

  const color = 공격 ? (위험색상[공격.위험등급] ?? "#ef4444") : null;

  return (
    <div style={{ width: "100%" }}>
      <div ref={wrapRef} style={{
        borderRadius: 10, overflow: "hidden",
        border: "1px solid #1e3a5f", background: "#0a1628",
      }}>
        <svg ref={svgRef} style={{ width: "100%", display: "block" }} />
      </div>

      {공격 && color && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div style={{
            background: `${color}15`, border: `1.5px solid ${color}50`,
            borderRadius: 10, padding: "10px 14px",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", marginBottom: 6 }}>🚨 공격 발원지</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
              <span style={{ fontSize: "1rem", fontWeight: 800, color }}>{공격.국가}</span>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: color, color: "white", marginLeft: "auto" }}>
                {위험라벨[공격.위험등급] ?? 공격.위험등급}
              </span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 5, fontFamily: "monospace" }}>IP: {공격.ip}</div>
            <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 3 }}>유형: {공격.공격유형}</div>
          </div>
          <div style={{
            background: "#1e1b4b22", border: "1.5px solid #6366f150",
            borderRadius: 10, padding: "10px 14px",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", marginBottom: 6 }}>🍯 공격 대상 (허니팟)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 6px #6366f1", flexShrink: 0 }} />
              <span style={{ fontSize: "1rem", fontWeight: 800, color: "#818cf8" }}>대한민국 · 서울</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 5 }}>위치: 37.57°N, 126.98°E</div>
            {허니팟ID && <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 3 }}>ID: {허니팟ID}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
