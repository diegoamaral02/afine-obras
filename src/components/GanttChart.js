// src/components/GanttChart.js — Gantt em SVG puro, sem bibliotecas externas
import React, { useState, useRef, useCallback } from "react";

const LABEL_COL  = 200;   // largura da coluna de rótulos (px no viewBox)
const ROW_H      = 40;    // altura de cada linha de etapa
const HEADER_H   = 48;    // altura do cabeçalho de datas
const BAR_H      = 22;    // altura da barra dentro do row
const BAR_RADIUS = 4;
const MIN_SVG_W  = 700;   // largura mínima útil do viewBox

const COR_STATUS = {
  "NÃO INICIADA": "#9CA3AF",
  "EM ANDAMENTO":  "#185FA5",
  "CONCLUÍDA":     "#2A6B3F",
  "ATRASADA":      "#BD3838",
};
const TEXTO_STATUS = {
  "NÃO INICIADA": "#6B7280",
  "EM ANDAMENTO":  "#1D4ED8",
  "CONCLUÍDA":     "#166534",
  "ATRASADA":      "#991B1B",
};

function parseDateUTC(str) {
  // "YYYY-MM-DD" → Date meia-noite UTC (evita problema de fuso)
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtDia(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}
function fmtMes(d) {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function buildTicks(inicio, fim) {
  const diffDias = (fim - inicio) / 86400000;
  const ticks = [];

  if (diffDias <= 60) {
    // Por semana
    let cur = new Date(inicio.getTime());
    // Alinha na segunda-feira mais próxima
    const dow = cur.getUTCDay(); // 0=dom
    const offset = dow === 0 ? 0 : (1 - dow + 7) % 7;
    cur = new Date(cur.getTime() + offset * 86400000);
    while (cur <= fim) {
      ticks.push({ date: new Date(cur.getTime()), label: fmtDia(cur) });
      cur = new Date(cur.getTime() + 7 * 86400000);
    }
  } else {
    // Por mês
    let cur = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1));
    while (cur <= fim) {
      ticks.push({ date: new Date(cur.getTime()), label: fmtMes(cur) });
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }
  }
  return ticks;
}

function pct(date, inicio, totalMs) {
  return Math.max(0, Math.min(1, (date - inicio) / totalMs));
}

export default function GanttChart({ etapas = [], dataInicioObra, dataFimObra, onEtapaClick }) {
  const [tooltip, setTooltip] = useState(null); // { x, y, etapa }
  const svgRef = useRef(null);

  const inicio = parseDateUTC(dataInicioObra);
  const fim    = parseDateUTC(dataFimObra);
  const hoje   = new Date(Date.UTC(
    new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()
  ));

  if (!inicio || !fim || fim <= inicio) {
    return (
      <div style={{ padding: 24, color: "#7A7A7A", fontSize: 13, textAlign: "center",
        background: "#F3F2EF", borderRadius: 8, border: "1px dashed #D6D3CB" }}>
        Defina as datas de início e término da obra para visualizar o cronograma.
      </div>
    );
  }

  const totalMs = fim - inicio;
  const ticks   = buildTicks(inicio, fim);

  const TIMELINE_W = MIN_SVG_W - LABEL_COL;
  const svgH       = HEADER_H + Math.max(1, etapas.length) * ROW_H + 8;
  const viewBox    = `0 0 ${MIN_SVG_W} ${svgH}`;

  // Posição X de uma data na área de timeline
  function xOf(date) {
    return LABEL_COL + pct(date, inicio, totalMs) * TIMELINE_W;
  }

  const hojeX = xOf(hoje);
  const hojeVis = hoje >= inicio && hoje <= fim;

  const handleBarMouseMove = useCallback((e, etapa) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = MIN_SVG_W / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top)  * scale;
    setTooltip({ x, y, etapa });
  }, []);

  const handleBarMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        width="100%"
        style={{ display: "block", minWidth: MIN_SVG_W, fontFamily: "inherit" }}
        aria-label="Gráfico de Gantt do cronograma da obra"
      >
        {/* ── Fundo ── */}
        <rect x="0" y="0" width={MIN_SVG_W} height={svgH} fill="#FAFAF8" rx="8"/>

        {/* ── Separador coluna rótulo / timeline ── */}
        <line x1={LABEL_COL} y1={0} x2={LABEL_COL} y2={svgH} stroke="#E2DFD8" strokeWidth="1"/>

        {/* ── Cabeçalho ── */}
        <rect x="0" y="0" width={MIN_SVG_W} height={HEADER_H} fill="#17171A" rx="8"/>
        <rect x="0" y={HEADER_H - 8} width={MIN_SVG_W} height={8} fill="#17171A"/>

        <text x={LABEL_COL / 2} y={HEADER_H / 2 + 5} textAnchor="middle"
          fill="rgba(255,255,255,.6)" fontSize="11" fontWeight="700" letterSpacing="0.05em">
          ETAPA
        </text>

        {/* Ticks de tempo */}
        {ticks.map((tick, i) => {
          const tx = xOf(tick.date);
          if (tx < LABEL_COL || tx > MIN_SVG_W) return null;
          return (
            <g key={i}>
              <line x1={tx} y1={HEADER_H} x2={tx} y2={svgH}
                stroke="#E2DFD8" strokeWidth="0.5" strokeDasharray="3,3"/>
              <text x={tx + 4} y={HEADER_H / 2 + 5}
                fill="rgba(255,255,255,.75)" fontSize="10" fontWeight="600">
                {tick.label}
              </text>
            </g>
          );
        })}

        {/* ── Linhas de etapa ── */}
        {etapas.length === 0 ? (
          <text x={MIN_SVG_W / 2} y={HEADER_H + ROW_H / 2 + 5}
            textAnchor="middle" fill="#9CA3AF" fontSize="13">
            Nenhuma etapa cadastrada
          </text>
        ) : etapas.map((etapa, i) => {
          const y0    = HEADER_H + i * ROW_H;
          const barY  = y0 + (ROW_H - BAR_H) / 2;
          const dI    = parseDateUTC(etapa.dataInicio);
          const dF    = parseDateUTC(etapa.dataFim);
          const cor   = etapa.cor || COR_STATUS[etapa.status] || "#9CA3AF";
          const corTx = TEXTO_STATUS[etapa.status] || "#4A4A4A";

          const barX  = dI ? xOf(dI) : LABEL_COL;
          const barW  = dI && dF ? Math.max(4, xOf(dF) - xOf(dI)) : 0;

          const rowBg = i % 2 === 0 ? "#FAFAF8" : "#F3F2EF";

          return (
            <g key={etapa.id || i}>
              {/* fundo da linha */}
              <rect x="0" y={y0} width={MIN_SVG_W} height={ROW_H} fill={rowBg}/>
              <line x1="0" y1={y0 + ROW_H} x2={MIN_SVG_W} y2={y0 + ROW_H}
                stroke="#E2DFD8" strokeWidth="0.5"/>

              {/* rótulo */}
              <text x={8} y={y0 + ROW_H / 2 + 5} fill="#17171A" fontSize="12" fontWeight="600">
                {etapa.nome.length > 22 ? etapa.nome.slice(0, 21) + "…" : etapa.nome}
              </text>
              {etapa.status && (
                <text x={8} y={y0 + ROW_H / 2 + 18} fill={corTx} fontSize="9" fontWeight="700">
                  {etapa.status.replace("_", " ")}
                </text>
              )}

              {/* barra */}
              {dI && dF && (
                <rect
                  x={barX} y={barY} width={barW} height={BAR_H}
                  rx={BAR_RADIUS} fill={cor} opacity="0.92"
                  style={{ cursor: onEtapaClick ? "pointer" : "default" }}
                  onClick={() => onEtapaClick && onEtapaClick(etapa)}
                  onMouseMove={e => handleBarMouseMove(e, etapa)}
                  onMouseLeave={handleBarMouseLeave}
                />
              )}

              {/* % dentro da barra se couber */}
              {dI && dF && barW > 50 && (
                <text x={barX + barW / 2} y={barY + BAR_H / 2 + 4}
                  textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700"
                  style={{ pointerEvents: "none" }}>
                  {etapa.nome.length > 12 ? etapa.nome.slice(0, 11) + "…" : etapa.nome}
                </text>
              )}
            </g>
          );
        })}

        {/* ── Linha de hoje ── */}
        {hojeVis && (
          <g>
            <line x1={hojeX} y1={HEADER_H} x2={hojeX} y2={svgH}
              stroke="#BD3838" strokeWidth="1.5" strokeDasharray="5,3"/>
            <rect x={hojeX - 16} y={HEADER_H - 18} width={32} height={16}
              rx="4" fill="#BD3838"/>
            <text x={hojeX} y={HEADER_H - 7} textAnchor="middle"
              fill="#fff" fontSize="9" fontWeight="800">HOJE</text>
          </g>
        )}

        {/* ── Tooltip ── */}
        {tooltip && (() => {
          const e   = tooltip.etapa;
          const tx  = Math.min(tooltip.x + 12, MIN_SVG_W - 180);
          const ty  = Math.min(tooltip.y - 10, svgH - 90);
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={tx} y={ty} width={170} height={78} rx="6"
                fill="#17171A" opacity="0.95"/>
              <text x={tx + 10} y={ty + 18} fill="#F5C400" fontSize="11" fontWeight="700">{e.nome}</text>
              <text x={tx + 10} y={ty + 34} fill="rgba(255,255,255,.75)" fontSize="10">
                {e.dataInicio ? `Início: ${e.dataInicio.split("-").reverse().join("/")}` : "Sem data início"}
              </text>
              <text x={tx + 10} y={ty + 48} fill="rgba(255,255,255,.75)" fontSize="10">
                {e.dataFim   ? `Fim: ${e.dataFim.split("-").reverse().join("/")}` : "Sem data fim"}
              </text>
              <text x={tx + 10} y={ty + 62} fill="rgba(255,255,255,.75)" fontSize="10">
                Status: {(e.status||"—").replace("_"," ")}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
