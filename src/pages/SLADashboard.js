// src/pages/SLADashboard.js — dashboard de conformidade de SLA
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase";
import { calcularSLA } from "../utils/sla";
import { SLA_DEFAULTS } from "../utils/sla";
import SLABadge from "../components/SLABadge";

const FILTROS = [
  { valor: "todos",    label: "Todos" },
  { valor: "no_prazo", label: "No prazo" },
  { valor: "em_risco", label: "Em risco" },
  { valor: "vencido",  label: "Vencido" },
  { valor: "cumprido", label: "Cumprido" },
];

const URGENCIA_ORDEM = { "EMERGÊNCIA": 0, "URGENTE": 1, "NORMAL": 2, "PROGRAMADA": 3 };
const STATUS_ORDEM   = { vencido: 0, em_risco: 1, no_prazo: 2, cumprido: 3 };

const STATUS_BADGE = {
  no_prazo: "badge-green",
  em_risco: "badge-amber",
  vencido:  "badge-red",
  cumprido: "badge-gray",
};

const STATUS_LABEL = {
  no_prazo: "No prazo",
  em_risco: "Em risco",
  vencido:  "Vencido",
  cumprido: "Cumprido",
};

export default function SLADashboard() {
  const [manutencoes, setManutencoes] = useState([]);
  const [regras, setRegras] = useState(SLA_DEFAULTS);
  const [filtro, setFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);

  // Carrega regras SLA
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sla_config", "manutencao"), snap => {
      if (snap.exists() && snap.data().regras?.length) {
        setRegras(snap.data().regras);
      }
    });
    return unsub;
  }, []);

  // Carrega manutenções
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "manutencoes"), snap => {
      setManutencoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  // Calcula SLA para cada manutenção que tenha urgencia configurada
  const comSLA = manutencoes
    .map(m => ({ ...m, sla: calcularSLA(m, regras) }))
    .filter(m => m.sla !== null);

  // KPIs
  const total     = comSLA.length;
  const noPrazo   = comSLA.filter(m => m.sla.status === "no_prazo").length;
  const emRisco   = comSLA.filter(m => m.sla.status === "em_risco").length;
  const vencido   = comSLA.filter(m => m.sla.status === "vencido").length;
  const cumprido  = comSLA.filter(m => m.sla.status === "cumprido").length;

  // Filtro e ordenação
  const filtrados = comSLA
    .filter(m => filtro === "todos" || m.sla.status === filtro)
    .sort((a, b) => {
      const sOrd = (STATUS_ORDEM[a.sla.status] ?? 9) - (STATUS_ORDEM[b.sla.status] ?? 9);
      if (sOrd !== 0) return sOrd;
      return (URGENCIA_ORDEM[a.urgencia] ?? 9) - (URGENCIA_ORDEM[b.urgencia] ?? 9);
    });

  const URGENCIA_BADGE = {
    "EMERGÊNCIA": "badge-red",
    "URGENTE":    "badge-amber",
    "NORMAL":     "badge-blue",
    "PROGRAMADA": "badge-green",
  };

  function fmtData(val) {
    if (!val) return "–";
    const d = new Date(val);
    return isNaN(d) ? "–" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  return (
    <div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Dashboard de SLA</div>
          <div style={{ fontSize: 12, color: "#7A7A7A" }}>
            Conformidade de prazos — {total} manutenç{total === 1 ? "ão" : "ões"} com SLA configurado
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="metrics-grid" style={{ marginBottom: 20 }}>
        <div className="metric">
          <div className="metric-label">Total com SLA</div>
          <div className="metric-value">{total}</div>
        </div>
        <div className="metric">
          <div className="metric-label">No prazo</div>
          <div className="metric-value green">{noPrazo}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Em risco</div>
          <div className="metric-value amber">{emRisco}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Vencido</div>
          <div className="metric-value red">{vencido}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Cumprido</div>
          <div className="metric-value gray">{cumprido}</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {FILTROS.map(f => (
          <button
            key={f.valor}
            className={`btn btn-sm${filtro === f.valor ? " btn-primary" : ""}`}
            onClick={() => setFiltro(f.valor)}
          >
            {f.label}
            {f.valor !== "todos" && (
              <span style={{
                marginLeft: 4, fontSize: 10, fontWeight: 700,
                background: "rgba(0,0,0,.12)", borderRadius: 999,
                padding: "1px 6px",
              }}>
                {f.valor === "no_prazo" ? noPrazo
                  : f.valor === "em_risco" ? emRisco
                  : f.valor === "vencido"  ? vencido
                  : cumprido}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="spinner" />}

      {!loading && filtrados.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">⏱️</div>
          <p>Nenhuma manutenção encontrada para este filtro</p>
          <span style={{ fontSize: 12, color: "#7A7A7A" }}>
            Verifique se as manutenções possuem o campo "urgencia" preenchido.
          </span>
        </div>
      )}

      {!loading && filtrados.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Manutenção</th>
                <th>Cliente / Agência</th>
                <th>Urgência</th>
                <th>Status</th>
                <th>Abertura</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.titulo || "–"}</div>
                    {m.tipo && (
                      <div style={{ fontSize: 11, color: "#7A7A7A" }}>{m.tipo}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <div>{m.clienteNome || "–"}</div>
                    {m.agenciaNome && (
                      <div style={{ fontSize: 11, color: "#7A7A7A" }}>{m.agenciaNome}</div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${URGENCIA_BADGE[m.urgencia] || "badge-gray"}`}>
                      {m.urgencia || "–"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[m.sla.status] || "badge-gray"}`}>
                      {m.sla.status === "cumprido" ? "✓ " : ""}
                      {STATUS_LABEL[m.sla.status] || m.sla.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{fmtData(m.createdAt || m.dataAbertura)}</td>
                  <td style={{ minWidth: 160 }}>
                    <SLABadge sla={m.sla} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
