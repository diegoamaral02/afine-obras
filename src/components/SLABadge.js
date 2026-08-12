// src/components/SLABadge.js
import React from "react";
import { formatarTempoSLA } from "../utils/sla";

const STATUS_CONFIG = {
  no_prazo: { bg: "#E4F3EC", fg: "#195A2C", bar: "#2A6B3F", label: "No prazo" },
  em_risco: { bg: "#FCEDC4", fg: "#7A5400", bar: "#E07B00", label: "Em risco" },
  vencido:  { bg: "#FDEAEA", fg: "#A32D2D", bar: "#B83232", label: "Vencido"  },
  cumprido: { bg: "#F3F2EF", fg: "#46464C", bar: "#8B8980", label: "Cumprido" },
};

export default function SLABadge({ sla }) {
  if (!sla) return null;

  const cfg = STATUS_CONFIG[sla.status] || STATUS_CONFIG.no_prazo;
  const texto = formatarTempoSLA(sla.horasRestantes);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 8px",
          borderRadius: 999, background: cfg.bg, color: cfg.fg,
          letterSpacing: ".03em",
        }}>
          {sla.status === "cumprido" ? "✓ " : ""}{cfg.label}
        </span>
        <span style={{ fontSize: 10, color: cfg.fg, fontWeight: 600, whiteSpace: "nowrap" }}>
          {texto}
        </span>
      </div>
      <div style={{ height: 4, background: "#E7E5DF", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${sla.percentual}%`,
          background: cfg.bar,
          borderRadius: 999,
          transition: "width .3s",
        }} />
      </div>
    </div>
  );
}
