// src/components/charts/BarChart.js — SVG puro, zero dependências externas
import React, { useMemo, useState } from "react";

const MAX_BARS = 12;

function agrupar(dados) {
  if (!dados || dados.length <= MAX_BARS) return dados || [];
  const top = dados.slice(0, MAX_BARS - 1);
  const resto = dados.slice(MAX_BARS - 1).reduce((s, d) => s + (d.valor ?? 0), 0);
  return [...top, { label: "Outros", valor: resto }];
}

export default function BarChart({
  dados = [],
  titulo = "",
  corBarra = "#F5C400",
  formatarY = v => String(v),
  horizontal = false,
}) {
  const [tooltip, setTooltip] = useState(null);

  const lista = useMemo(() => agrupar(dados), [dados]);

  if (!lista || lista.length === 0) {
    return (
      <div style={{ padding: "12px 0" }}>
        {titulo && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "#46464C" }}>{titulo}</div>}
        <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center",
          background: "#F3F2EF", borderRadius: 8, color: "#75757D", fontSize: 13 }}>
          Sem dados para exibir
        </div>
      </div>
    );
  }

  const max = Math.max(...lista.map(d => d.valor ?? 0), 1);

  if (horizontal) return <HBarChart lista={lista} max={max} titulo={titulo} corBarra={corBarra} formatarY={formatarY} tooltip={tooltip} setTooltip={setTooltip} />;
  return <VBarChart lista={lista} max={max} titulo={titulo} corBarra={corBarra} formatarY={formatarY} tooltip={tooltip} setTooltip={setTooltip} />;
}

// ── Vertical ────────────────────────────────────────────────────────────────
function VBarChart({ lista, max, titulo, corBarra, formatarY, tooltip, setTooltip }) {
  const W = 600;
  const PAD = { top: 28, right: 16, bottom: 60, left: 56 };
  const H = 260;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const n = lista.length;
  const gap = 0.25;
  const barW = (innerW / n) * (1 - gap);
  const slotW = innerW / n;

  return (
    <div style={{ padding: "4px 0" }}>
      {titulo && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#46464C" }}>{titulo}</div>}
      <div style={{ position: "relative", width: "100%" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }} role="img" aria-label={titulo}>
          {/* Y gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = PAD.top + innerH - pct * innerH;
            const v = pct * max;
            return (
              <g key={i}>
                <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#E2DFD8" strokeWidth={1} strokeDasharray={pct === 0 ? "0" : "4 3"} />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#75757D" fontFamily="inherit">{formatarY(v)}</text>
              </g>
            );
          })}

          {/* Barras */}
          {lista.map((d, i) => {
            const val = d.valor ?? 0;
            const bh = (val / max) * innerH;
            const x = PAD.left + i * slotW + (slotW - barW) / 2;
            const y = PAD.top + innerH - bh;
            const isHov = tooltip === d;
            return (
              <g key={i} onMouseEnter={() => setTooltip(d)} onMouseLeave={() => setTooltip(null)} style={{ cursor: "pointer" }}>
                <rect x={x} y={y} width={barW} height={Math.max(bh, 2)} rx={3} ry={3}
                  fill={corBarra} opacity={isHov ? 1 : 0.82} style={{ transition: "opacity .15s" }} />
                {/* Valor acima */}
                {bh > 12 || val > 0 ? (
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#46464C" fontFamily="inherit" fontWeight={600}>
                    {formatarY(val)}
                  </text>
                ) : null}
                {/* Label eixo X */}
                <text
                  x={x + barW / 2}
                  y={PAD.top + innerH + 14}
                  textAnchor={n > 6 ? "end" : "middle"}
                  fontSize={10} fill="#75757D" fontFamily="inherit"
                  transform={n > 6 ? `rotate(-38, ${x + barW / 2}, ${PAD.top + innerH + 14})` : undefined}
                >
                  {d.label.length > 10 ? d.label.slice(0, 10) + "…" : d.label}
                </text>
                <title>{`${d.label}: ${formatarY(val)}`}</title>
              </g>
            );
          })}

          {/* Eixos */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="#D6D3CB" strokeWidth={1} />
          <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke="#D6D3CB" strokeWidth={1} />
        </svg>

        {tooltip && (
          <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
            background: "#1A1A1A", color: "#fff", padding: "5px 10px", borderRadius: 6,
            fontSize: 12, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,.18)" }}>
            <strong>{tooltip.label}</strong>: {formatarY(tooltip.valor ?? 0)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Horizontal ──────────────────────────────────────────────────────────────
function HBarChart({ lista, max, titulo, corBarra, formatarY, tooltip, setTooltip }) {
  const rowH = 32;
  const PAD = { top: 8, right: 100, bottom: 16, left: 120 };
  const W = 600;
  const innerW = W - PAD.left - PAD.right;
  const H = PAD.top + lista.length * rowH + PAD.bottom;

  return (
    <div style={{ padding: "4px 0" }}>
      {titulo && <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#46464C" }}>{titulo}</div>}
      <div style={{ position: "relative", width: "100%" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }} role="img" aria-label={titulo}>
          {lista.map((d, i) => {
            const val = d.valor ?? 0;
            const bw = (val / max) * innerW;
            const y = PAD.top + i * rowH;
            const isHov = tooltip === d;
            return (
              <g key={i} onMouseEnter={() => setTooltip(d)} onMouseLeave={() => setTooltip(null)} style={{ cursor: "pointer" }}>
                {/* Label */}
                <text x={PAD.left - 6} y={y + rowH / 2 + 1} textAnchor="end" fontSize={11} fill="#46464C" fontFamily="inherit" dominantBaseline="middle">
                  {d.label.length > 16 ? d.label.slice(0, 16) + "…" : d.label}
                </text>
                {/* Fundo track */}
                <rect x={PAD.left} y={y + 6} width={innerW} height={rowH - 12} rx={3} fill="#F3F2EF" />
                {/* Barra */}
                <rect x={PAD.left} y={y + 6} width={Math.max(bw, 2)} height={rowH - 12} rx={3}
                  fill={corBarra} opacity={isHov ? 1 : 0.82} style={{ transition: "opacity .15s" }} />
                {/* Valor */}
                <text x={PAD.left + bw + 6} y={y + rowH / 2 + 1} fontSize={10} fill="#46464C" fontFamily="inherit" fontWeight={600} dominantBaseline="middle">
                  {formatarY(val)}
                </text>
                <title>{`${d.label}: ${formatarY(val)}`}</title>
              </g>
            );
          })}
        </svg>

        {tooltip && (
          <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
            background: "#1A1A1A", color: "#fff", padding: "5px 10px", borderRadius: 6,
            fontSize: 12, pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,.18)" }}>
            <strong>{tooltip.label}</strong>: {formatarY(tooltip.valor ?? 0)}
          </div>
        )}
      </div>
    </div>
  );
}
