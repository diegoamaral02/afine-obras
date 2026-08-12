// src/components/charts/LineChart.js — SVG puro, zero dependências externas
import React, { useMemo, useState } from "react";

const PAD = { top: 20, right: 20, bottom: 56, left: 64 };

function calcTicks(min, max, count = 5) {
  if (min === max) { min = 0; max = max || 1; }
  const range = max - min;
  const raw = range / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const nice = [1, 2, 2.5, 5, 10].find(f => f * mag >= raw) * mag;
  const nMin = Math.floor(min / nice) * nice;
  const ticks = [];
  for (let i = 0; i < count + 2; i++) {
    const v = nMin + i * nice;
    if (v > max + nice) break;
    ticks.push(v);
  }
  // garante exatamente `count` ticks entre min e max
  return ticks.slice(0, count);
}

export default function LineChart({
  dados = [],
  titulo = "",
  corLinha = "#F5C400",
  formatarY = v => String(v),
  formatarX,
  altura = 260,
}) {
  const [tooltip, setTooltip] = useState(null);

  const W = 600;
  const H = altura;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const { points, ticks, yMin, yMax } = useMemo(() => {
    if (!dados || dados.length === 0) return { points: [], ticks: [], yMin: 0, yMax: 1 };
    const valores = dados.map(d => d.valor ?? 0);
    const rawMin = Math.min(...valores);
    const rawMax = Math.max(...valores);
    const tks = calcTicks(Math.min(0, rawMin), rawMax, 5);
    const yMin = tks[0];
    const yMax = tks[tks.length - 1];
    const xStep = dados.length > 1 ? innerW / (dados.length - 1) : innerW / 2;
    const pts = dados.map((d, i) => ({
      x: PAD.left + (dados.length > 1 ? i * xStep : innerW / 2),
      y: PAD.top + innerH - ((d.valor - yMin) / (yMax - yMin)) * innerH,
      label: d.label,
      valor: d.valor ?? 0,
    }));
    return { points: pts, ticks: tks, yMin, yMax };
  }, [dados, innerW, innerH]);

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");
  const areaPoints = points.length > 0
    ? `${points[0].x},${PAD.top + innerH} ${polylinePoints} ${points[points.length - 1].x},${PAD.top + innerH}`
    : "";

  const rotateX = dados.length > 6;

  if (!dados || dados.length === 0) {
    return (
      <div style={{ padding: "12px 0" }}>
        {titulo && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "#46464C" }}>{titulo}</div>}
        <div style={{ height: altura * 0.6, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#F3F2EF", borderRadius: 8, color: "#75757D", fontSize: 13 }}>
          Sem dados para exibir
        </div>
      </div>
    );
  }

  const areaId = `area-grad-${titulo.replace(/\s+/g, "")}`;

  return (
    <div style={{ padding: "4px 0" }}>
      {titulo && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#46464C" }}>{titulo}</div>}
      <div style={{ position: "relative", width: "100%" }}>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ overflow: "visible", display: "block" }}
          role="img"
          aria-label={titulo}
        >
          <defs>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={corLinha} stopOpacity="0.22" />
              <stop offset="100%" stopColor={corLinha} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Gridlines + eixo Y */}
          {ticks.map((tick, i) => {
            const yPos = PAD.top + innerH - ((tick - yMin) / (yMax - yMin)) * innerH;
            return (
              <g key={i}>
                <line
                  x1={PAD.left} y1={yPos} x2={PAD.left + innerW} y2={yPos}
                  stroke="#E2DFD8" strokeWidth={1} strokeDasharray={i === 0 ? "0" : "4 3"}
                />
                <text x={PAD.left - 8} y={yPos + 4} textAnchor="end"
                  fontSize={10} fill="#75757D" fontFamily="inherit">
                  {formatarY(tick)}
                </text>
              </g>
            );
          })}

          {/* Área preenchida */}
          {areaPoints && (
            <polygon points={areaPoints} fill={`url(#${areaId})`} />
          )}

          {/* Linha */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={corLinha}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Pontos + tooltips */}
          {points.map((p, i) => (
            <g key={i}
              onMouseEnter={() => setTooltip(p)}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
              <circle
                cx={p.x} cy={p.y} r={tooltip === p ? 5 : 3.5}
                fill={corLinha} stroke="#fff" strokeWidth={2}
                style={{ transition: "r .15s" }}
              />
              <title>{`${p.label}: ${formatarY(p.valor)}`}</title>
            </g>
          ))}

          {/* Rótulos eixo X */}
          {points.map((p, i) => {
            const lbl = formatarX ? formatarX(p.label, i) : p.label;
            return (
              <text
                key={i}
                x={p.x}
                y={PAD.top + innerH + (rotateX ? 14 : 18)}
                textAnchor={rotateX ? "end" : "middle"}
                fontSize={10}
                fill="#75757D"
                fontFamily="inherit"
                transform={rotateX ? `rotate(-40, ${p.x}, ${PAD.top + innerH + 14})` : undefined}
              >
                {lbl}
              </text>
            );
          })}

          {/* Eixo base */}
          <line
            x1={PAD.left} y1={PAD.top + innerH}
            x2={PAD.left + innerW} y2={PAD.top + innerH}
            stroke="#D6D3CB" strokeWidth={1}
          />
          <line
            x1={PAD.left} y1={PAD.top}
            x2={PAD.left} y2={PAD.top + innerH}
            stroke="#D6D3CB" strokeWidth={1}
          />
        </svg>

        {/* Tooltip flutuante */}
        {tooltip && (
          <div style={{
            position: "absolute",
            top: 8, left: "50%", transform: "translateX(-50%)",
            background: "#1A1A1A", color: "#fff",
            padding: "5px 10px", borderRadius: 6, fontSize: 12,
            pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,.18)",
          }}>
            <strong>{tooltip.label}</strong>: {formatarY(tooltip.valor)}
          </div>
        )}
      </div>
    </div>
  );
}
