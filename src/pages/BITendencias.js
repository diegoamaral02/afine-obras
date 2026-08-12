// src/pages/BITendencias.js — BI com gráficos SVG puro, zero libs externas
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = v =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

const fmtNum = v => Number(v || 0).toLocaleString("pt-BR");

const fmtK = v => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return fmtBRL(n);
};

/** Retorna "Jan/24" para um Date ou string ISO/YYYY-MM-DD */
function mesLabel(dateStr) {
  if (!dateStr) return null;
  const d = typeof dateStr === "string" ? new Date(dateStr.slice(0, 10) + "T12:00:00") : dateStr;
  if (isNaN(d)) return null;
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". ", "/").replace(".", "");
}

/** Chave numérica YYYYMM para ordenação */
function mesKey(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr.slice(0, 10) + "T12:00:00");
  if (isNaN(d)) return 0;
  return d.getFullYear() * 100 + d.getMonth() + 1;
}

/** Gera os últimos `n` meses como labels */
function ultimosMeses(n = 12) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: d.getFullYear() * 100 + d.getMonth() + 1,
      label: mesLabel(d.toISOString()),
    });
  }
  return out;
}

function deltaPct(atual, anterior) {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, valor, sub, delta, cor = "#1A1A1A", icon }) {
  const pos = delta == null ? null : delta >= 0;
  return (
    <div style={{
      background: "#fff", border: "1px solid #E2DFD8", borderRadius: 12,
      padding: "14px 16px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 12, right: 14, fontSize: 22, opacity: 0.10 }}>{icon}</div>
      <div style={{ fontSize: 10, color: "#75757D", marginBottom: 4, fontWeight: 500,
        textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: cor, marginBottom: 4, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{valor}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {delta != null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: pos ? "#2A6B3F" : "#BD3838" }}>
            {pos ? "↑" : "↓"}{Math.abs(delta)}%
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: "#75757D" }}>{sub}</span>}
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ h = 200 }) {
  return (
    <div style={{ height: h, background: "#F3F2EF", borderRadius: 8, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0,
        background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,.6) 50%,transparent 100%)",
        animation: "bi-shimmer 1.4s ease-in-out infinite", backgroundSize: "200% 100%" }} />
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function BITendencias() {
  const { userProfile } = useAuth();

  // Acesso restrito — adm master nunca bloqueado
  const dep = userProfile?.adm ? "gestao" : (userProfile?.departamento || userProfile?.perfil || "campo");
  const podeVer = userProfile?.adm || ["gestao","gestor","encarregado","financeiro","comercial","fiscal","compras"].includes(dep);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [dados, setDados] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [snapManuts, snapDespesas, snapObras, snapContratos] = await Promise.all([
        getDocs(collection(db, "manutencoes")),
        getDocs(collection(db, "despesas")),
        getDocs(collection(db, "obras")),
        getDocs(collection(db, "contratos")),
      ]);

      const manutencoes = snapManuts.docs.map(d => ({ id: d.id, ...d.data() }));
      const despesas    = snapDespesas.docs.map(d => ({ id: d.id, ...d.data() }));
      const obras       = snapObras.docs.map(d => ({ id: d.id, ...d.data() }));
      const contratos   = snapContratos.docs.map(d => ({ id: d.id, ...d.data() }));

      setDados({ manutencoes, despesas, obras, contratos });
    } catch (e) {
      console.error("BITendencias:", e);
      setErro("Erro ao carregar dados. Verifique a conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const bi = useMemo(() => {
    if (!dados) return null;
    const { manutencoes, despesas, obras, contratos } = dados;
    const meses = ultimosMeses(12);

    // — Volume de manutenções por mês
    const manutMap = {};
    manutencoes.forEach(m => {
      const k = mesKey(m.createdAt);
      manutMap[k] = (manutMap[k] || 0) + 1;
    });
    const manutPorMes = meses.map(m => ({ label: m.label, valor: manutMap[m.key] || 0 }));

    // — Despesas mensais
    const despMap = {};
    despesas.forEach(d => {
      const k = mesKey(d.data);
      despMap[k] = (despMap[k] || 0) + Number(d.valor || 0);
    });
    const despPorMes = meses.map(m => ({ label: m.label, valor: despMap[m.key] || 0 }));

    // — Top 8 obras por despesas vinculadas
    const obrasDespMap = {};
    despesas.forEach(d => {
      const nome = d.obraNome || d.obra || "Sem obra";
      obrasDespMap[nome] = (obrasDespMap[nome] || 0) + Number(d.valor || 0);
    });
    const topObras = Object.entries(obrasDespMap)
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    // — Distribuição de status das obras
    const statusMap = {};
    obras.forEach(o => {
      const s = o.status || "SEM STATUS";
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const statusObras = Object.entries(statusMap)
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor);

    // — Top 8 clientes por valor contratado
    const clienteMap = {};
    contratos.forEach(c => {
      const nome = c.cliente || c.clienteNome || "Sem cliente";
      clienteMap[nome] = (clienteMap[nome] || 0) + Number(c.valorContratado || 0);
    });
    const topClientes = Object.entries(clienteMap)
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    // — Contratos abertos por mês (contratos cujo período inclui o mês)
    const contratosAbertosMes = meses.map(m => {
      const ano = Math.floor(m.key / 100);
      const mes = m.key % 100;
      const inicioMes = new Date(ano, mes - 1, 1);
      const fimMes = new Date(ano, mes, 0, 23, 59, 59);
      const count = contratos.filter(c => {
        if (!c.dataInicio) return false;
        const ini = new Date(c.dataInicio.slice(0, 10) + "T12:00:00");
        const fim = c.dataFim ? new Date(c.dataFim.slice(0, 10) + "T12:00:00") : new Date("2099-01-01");
        return ini <= fimMes && fim >= inicioMes;
      }).length;
      return { label: m.label, valor: count };
    });

    // — KPIs
    const now = new Date();
    const keyAtual = now.getFullYear() * 100 + now.getMonth() + 1;
    const prevMes = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const keyAnterior = prevMes.getFullYear() * 100 + prevMes.getMonth() + 1;

    const manutAtual = manutMap[keyAtual] || 0;
    const manutAnterior = manutMap[keyAnterior] || 0;

    const despAtual = despMap[keyAtual] || 0;
    const despAnterior = despMap[keyAnterior] || 0;

    const obrasTotal = obras.length;
    const obrasConcluidas = obras.filter(o => o.status === "CONCLUÍDA" || o.status === "CONCLUIDA").length;
    const txConclusao = obrasTotal > 0 ? Math.round((obrasConcluidas / obrasTotal) * 100) : 0;

    const totalContratado = contratos.reduce((s, c) => s + Number(c.valorContratado || 0), 0);
    const ticketMedio = contratos.length > 0 ? totalContratado / contratos.length : 0;

    return {
      manutPorMes, despPorMes, topObras, statusObras,
      topClientes, contratosAbertosMes,
      kpis: {
        manutAtual, manutAnterior, deltaManut: deltaPct(manutAtual, manutAnterior),
        despAtual, despAnterior, deltaDesp: deltaPct(despAtual, despAnterior),
        txConclusao, ticketMedio,
      },
    };
  }, [dados]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!podeVer) {
    return (
      <div className="page">
        <div style={{ textAlign: "center", padding: "60px 0", color: "#75757D" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Acesso restrito</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Apenas gestores e encarregados podem visualizar este painel.</div>
        </div>
      </div>
    );
  }

  const gridChart = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))",
    gap: 16,
    marginBottom: 16,
  };

  return (
    <div className="page">
      <style>{`
        @keyframes bi-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#17171A" }}>BI & Tendências</div>
          <div style={{ fontSize: 12, color: "#75757D" }}>Análise consolidada — {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          style={{
            background: loading ? "#F3F2EF" : "#F5C400",
            color: loading ? "#75757D" : "#17171A",
            border: "none", borderRadius: 8, padding: "8px 16px",
            fontWeight: 600, fontSize: 13, cursor: loading ? "not-allowed" : "pointer",
            transition: "background .2s",
          }}
        >
          {loading ? "Carregando…" : "↻ Atualizar dados"}
        </button>
      </div>

      {erro && (
        <div style={{ background: "#FBEAEA", border: "1px solid #BD3838", borderRadius: 8, padding: "12px 16px",
          color: "#BD3838", fontSize: 13, marginBottom: 16 }}>
          ⚠️ {erro}
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 24 }}>
        {loading ? (
          [1,2,3,4].map(i => <Skeleton key={i} h={90} />)
        ) : bi ? (
          <>
            <KPICard
              label="Manutenções este mês"
              valor={fmtNum(bi.kpis.manutAtual)}
              sub={`anterior: ${fmtNum(bi.kpis.manutAnterior)}`}
              delta={bi.kpis.deltaManut}
              icon="🔧"
            />
            <KPICard
              label="Despesas este mês"
              valor={fmtK(bi.kpis.despAtual)}
              sub={`anterior: ${fmtK(bi.kpis.despAnterior)}`}
              delta={bi.kpis.deltaDesp}
              cor={bi.kpis.despAtual > bi.kpis.despAnterior ? "#BD3838" : "#2A6B3F"}
              icon="💰"
            />
            <KPICard
              label="Taxa de conclusão obras"
              valor={`${bi.kpis.txConclusao}%`}
              sub={`sobre total de obras`}
              cor={bi.kpis.txConclusao >= 70 ? "#2A6B3F" : bi.kpis.txConclusao >= 40 ? "#B8910A" : "#BD3838"}
              icon="🏗️"
            />
            <KPICard
              label="Ticket médio contrato"
              valor={fmtK(bi.kpis.ticketMedio)}
              sub="valor médio por contrato"
              cor="#B8910A"
              icon="📋"
            />
          </>
        ) : null}
      </div>

      {/* ── Seção 1: Tendências Operacionais ── */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, paddingBottom: 6, borderBottom: "2px solid #F5C400" }}>
        Tendências Operacionais
      </div>
      <div style={gridChart}>
        <div className="card">
          {loading ? <Skeleton h={240} /> : (
            <LineChart
              titulo="Volume de manutenções por mês"
              dados={bi?.manutPorMes || []}
              corLinha="#B8910A"
              formatarY={fmtNum}
              altura={240}
            />
          )}
        </div>
        <div className="card">
          {loading ? <Skeleton h={240} /> : (
            <LineChart
              titulo="Despesas mensais (R$)"
              dados={bi?.despPorMes || []}
              corLinha="#BD3838"
              formatarY={fmtK}
              altura={240}
            />
          )}
        </div>
      </div>

      {/* ── Seção 2: Desempenho de Obras ── */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, paddingBottom: 6, borderBottom: "2px solid #F5C400" }}>
        Desempenho de Obras
      </div>
      <div style={gridChart}>
        <div className="card">
          {loading ? <Skeleton h={240} /> : (
            <BarChart
              titulo="Top obras por despesas vinculadas"
              dados={bi?.topObras || []}
              corBarra="#F5C400"
              formatarY={fmtK}
            />
          )}
        </div>
        <div className="card">
          {loading ? <Skeleton h={240} /> : (
            <BarChart
              titulo="Distribuição de status das obras"
              dados={bi?.statusObras || []}
              corBarra="#17171A"
              formatarY={fmtNum}
              horizontal
            />
          )}
        </div>
      </div>

      {/* ── Seção 3: Contratos & Financeiro ── */}
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, paddingBottom: 6, borderBottom: "2px solid #F5C400" }}>
        Contratos &amp; Financeiro
      </div>
      <div style={gridChart}>
        <div className="card">
          {loading ? <Skeleton h={240} /> : (
            <BarChart
              titulo="Valor contratado por cliente (top 8)"
              dados={bi?.topClientes || []}
              corBarra="#2A6B3F"
              formatarY={fmtK}
            />
          )}
        </div>
        <div className="card">
          {loading ? <Skeleton h={240} /> : (
            <LineChart
              titulo="Contratos em aberto por mês"
              dados={bi?.contratosAbertosMes || []}
              corLinha="#2A6B3F"
              formatarY={fmtNum}
              altura={240}
            />
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "#75757D", paddingTop: 8, paddingBottom: 24 }}>
        Dados calculados no cliente · última atualização {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}
