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
};

const 타겟좌표: [number, number] = [126.978, 37.566];

const 위험색상: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH:     "#ef4444",
  MEDIUM:   "#f97316",
  LOW:      "#eab308",
};

const 위험라벨: Record<string, string> = {
  CRITICAL: "치명",
  HIGH:     "높음",
  MEDIUM:   "보통",
  LOW:      "낮음",
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

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width",  W)
      .attr("height", H);
    svg.selectAll("*").remove();

    const src좌표 = 공격 ? (국가좌표[공격.국가] ?? null) : null;

    // 발원지가 있으면 발원지↔타겟 중간으로 중심 이동, 없으면 기본 뷰
    let projection: d3.GeoProjection;
    if (src좌표) {
      const midLng = (src좌표[0] + 타겟좌표[0]) / 2;
      const midLat = (src좌표[1] + 타겟좌표[1]) / 2;
      projection = d3.geoNaturalEarth1()
        .scale(W / 5.8)
        .center([midLng, midLat])
        .translate([W / 2, H / 2]);
    } else {
      projection = d3.geoNaturalEarth1()
        .scale(W / 6.4)
        .translate([W / 2, H / 2.1]);
    }

    const geoPath = d3.geoPath().projection(projection);

    // 배경
    svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#f8fafc").attr("rx", 10);

    // 나라
    const topo = worldData as unknown as Topology;
    const countries = feature(topo, topo.objects.countries as GeometryCollection);
    const g = svg.append("g");

    g.selectAll("path.country")
      .data(countries.features)
      .join("path")
      .classed("country", true)
      .attr("d", geoPath)
      .attr("fill", "#9ca3af")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.5);

    // 격자선
    g.append("path")
      .datum(d3.geoGraticule()())
      .attr("d", geoPath)
      .attr("fill", "none")
      .attr("stroke", "#d1d5db")
      .attr("stroke-width", 0.25);

    // ─ 허니팟 위치 ────────────────────────────────────────
    const 타겟px = projection(타겟좌표);
    if (타겟px) {
      (function 펄스() {
        g.append("circle")
          .attr("cx", 타겟px[0]).attr("cy", 타겟px[1])
          .attr("r", 7).attr("fill", "none")
          .attr("stroke", "#6366f1").attr("stroke-width", 2).attr("opacity", 0.9)
          .transition().duration(1400).ease(d3.easeQuadOut)
          .attr("r", 24).attr("opacity", 0)
          .remove().on("end", 펄스);
      })();

      g.append("circle")
        .attr("cx", 타겟px[0]).attr("cy", 타겟px[1]).attr("r", 7)
        .attr("fill", "#6366f1").attr("stroke", "white").attr("stroke-width", 2)
        .style("filter", "drop-shadow(0 0 6px #6366f1aa)");

      g.append("text")
        .attr("x", 타겟px[0]).attr("y", 타겟px[1] - 13)
        .attr("text-anchor", "middle").attr("font-size", "12px").attr("font-weight", "800")
        .attr("fill", "#6366f1").attr("stroke", "white").attr("stroke-width", 3).attr("paint-order", "stroke")
        .text("🍯 허니팟 (서울)");
    }

    // ─ 공격 호 (선택된 시나리오만) ───────────────────────
    if (공격 && src좌표) {
      const srcPx = projection(src좌표);
      if (!srcPx || !타겟px) return;

      const color = 위험색상[공격.위험등급] ?? "#ef4444";
      const interpolate = d3.geoInterpolate(src좌표, 타겟좌표);

      const points = d3.range(0, 1.01, 0.015)
        .map((t) => projection(interpolate(t)))
        .filter((p): p is [number, number] => p !== null);

      if (points.length < 2) return;

      // 그림자 효과용 두꺼운 선
      g.append("path")
        .attr("d", `M ${points.map((p) => p.join(",")).join(" L ")}`)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 5)
        .attr("opacity", 0.15);

      // 메인 선
      const arcEl = g.append("path")
        .attr("d", `M ${points.map((p) => p.join(",")).join(" L ")}`)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2.5)
        .attr("opacity", 0.85)
        .style("filter", `drop-shadow(0 0 4px ${color}88)`);

      const 길이 = (arcEl.node() as SVGPathElement).getTotalLength();
      arcEl
        .attr("stroke-dasharray", 길이)
        .attr("stroke-dashoffset", 길이)
        .transition().duration(1200).ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

      // 이동 탄환
      const dot = g.append("circle")
        .attr("r", 6).attr("fill", color).attr("opacity", 0)
        .style("filter", `drop-shadow(0 0 6px ${color})`);

      function animateBullet() {
        dot.attr("cx", srcPx![0]).attr("cy", srcPx![1]).attr("opacity", 1)
          .transition().delay(1200).duration(2000).ease(d3.easeLinear)
          .attrTween("cx", () => (t) => String(projection(interpolate(t))?.[0] ?? srcPx![0]))
          .attrTween("cy", () => (t) => String(projection(interpolate(t))?.[1] ?? srcPx![1]))
          .attr("opacity", 0.2)
          .on("end", () => setTimeout(animateBullet, 600));
      }
      animateBullet();

      // 발원지 점
      g.append("circle")
        .attr("cx", srcPx[0]).attr("cy", srcPx[1]).attr("r", 8)
        .attr("fill", color).attr("stroke", "white").attr("stroke-width", 2.5)
        .style("filter", `drop-shadow(0 0 6px ${color}88)`);

      // 발원지 라벨
      g.append("text")
        .attr("x", srcPx[0]).attr("y", srcPx[1] - 15)
        .attr("text-anchor", "middle").attr("font-size", "13px").attr("font-weight", "800")
        .attr("fill", color).attr("stroke", "white").attr("stroke-width", 3).attr("paint-order", "stroke")
        .text(공격.국가);

      g.append("text")
        .attr("x", srcPx[0]).attr("y", srcPx[1] + 22)
        .attr("text-anchor", "middle").attr("font-size", "11px").attr("font-weight", "600")
        .attr("fill", color).attr("stroke", "white").attr("stroke-width", 3).attr("paint-order", "stroke")
        .text(공격.ip);
    }

    // 빈 상태 안내
    if (!공격) {
      svg.append("text")
        .attr("x", W / 2).attr("y", H / 2 + 30)
        .attr("text-anchor", "middle").attr("font-size", "13px")
        .attr("fill", "#94a3b8").attr("font-weight", "600")
        .text("← 왼쪽에서 공격 시나리오를 선택하면 발원지가 표시됩니다");
    }
  }, [공격]);

  const color = 공격 ? (위험색상[공격.위험등급] ?? "#ef4444") : null;

  return (
    <div style={{ width: "100%" }}>
      {/* 지도 SVG */}
      <div ref={wrapRef} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <svg ref={svgRef} style={{ width: "100%", display: "block" }} />
      </div>

      {/* 정보 카드 (시나리오 선택 시) */}
      {공격 && color && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          {/* 공격자 정보 */}
          <div style={{
            background: `${color}10`, border: `1.5px solid ${color}40`,
            borderRadius: 10, padding: "10px 14px",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", marginBottom: 6 }}>🚨 공격 발원지</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <span style={{ fontSize: "1rem", fontWeight: 800, color }}>{공격.국가}</span>
              <span style={{
                fontSize: "0.68rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: color, color: "white", marginLeft: "auto",
              }}>{위험라벨[공격.위험등급] ?? 공격.위험등급}</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 5, fontFamily: "monospace" }}>IP: {공격.ip}</div>
            <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 3 }}>공격: {공격.공격유형}</div>
          </div>

          {/* 타겟 정보 */}
          <div style={{
            background: "#eef2ff", border: "1.5px solid #c7d2fe",
            borderRadius: 10, padding: "10px 14px",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", marginBottom: 6 }}>🍯 공격 대상 (허니팟)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
              <span style={{ fontSize: "1rem", fontWeight: 800, color: "#6366f1" }}>대한민국 · 서울</span>
            </div>
            <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 5 }}>위치: 37.57°N, 126.98°E</div>
            {허니팟ID && (
              <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: 3 }}>ID: {허니팟ID}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
