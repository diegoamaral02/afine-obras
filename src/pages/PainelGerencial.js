// src/pages/PainelGerencial.js — v3: drag & drop + drill-down + comparativo multi-obra
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useFinanceiroKPIs } from "../hooks/useFinanceiroKPIs";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = v => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

// ── Gráfico de barras (SVG puro) ──────────────────────────────────────────────
function MiniBarChart({ dados, cor = "#F5C800", altura = 80 }) {
  const max = useMemo(() => Math.max(...(dados || []).map(d => d.valor || 0), 1), [dados]);
  if (!dados || dados.length === 0) return <EmptyChart altura={altura} />;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: altura, padding: "0 4px" }}>
      {dados.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ width: "100%", background: cor, borderRadius: "3px 3px 0 0",
            height: `${Math.max(4, (d.valor / max) * altura * 0.85)}px`, opacity: .85 + i * .01 }} />
          <span style={{ fontSize: 9, color: "#7A7A7A", whiteSpace: "nowrap" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ altura = 80 }) {
  return <div style={{ height: altura, display: "flex", alignItems: "center", justifyContent: "center", color: "#7A7A7A", fontSize: 12, background: "var(--cinza-lt)", borderRadius: 6 }}>Sem dados ainda</div>;
}

function Gauge({ pct = 0, cor = "#F5C800", label = "" }) {
  const r = 36, cx = 44, cy = 44, circ = 2 * Math.PI * r;
  const dash = useMemo(() => (pct / 100) * circ, [pct, circ]);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E0DED8" strokeWidth={8} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={cor} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transformOrigin: "44px 44px", transform: "rotate(-90deg)", transition: "stroke-dasharray .6s ease" }} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight={700} fill="#1A1A1A">{pct}%</text>
      </svg>
      <div style={{ fontSize: 11, color: "#7A7A7A", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── KPICard — clicável para drill-down ────────────────────────────────────────
function KPICard({ label, valor, sub, cor = "#1A1A1A", icon, trend, onClick }) {
  const trendPos = trend > 0;
  return (
    <div
      onClick={onClick}
      style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden", cursor: onClick ? "pointer" : "default", transition: "box-shadow .15s" }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ position: "absolute", top: 12, right: 14, fontSize: 22, opacity: .1 }}>{icon}</div>
      <div style={{ fontSize: 10, color: "#7A7A7A", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: cor, marginBottom: 4, lineHeight: 1 }}>{valor}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {trend != null && <span style={{ fontSize: 11, fontWeight: 600, color: trendPos ? "var(--verde)" : "var(--vermelho)" }}>{trendPos ? "↑" : "↓"}{Math.abs(trend)}%</span>}
        {sub && <span style={{ fontSize: 11, color: "#7A7A7A" }}>{sub}</span>}
      </div>
      {onClick && <div style={{ position: "absolute", bottom: 6, right: 10, fontSize: 9, color: "#C0C0C0" }}>ver detalhe →</div>}
    </div>
  );
}

function KPISkeleton() {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
      {[60, 100, 40].map((w, i) => (
        <div key={i} style={{ height: i === 1 ? 24 : 12, background: "var(--cinza-lt)", borderRadius: 4, marginBottom: 8, width: `${w}%`, animation: "pulse 1.5s ease-in-out infinite" }} />
      ))}
    </div>
  );
}

// ── Modal de drill-down ───────────────────────────────────────────────────────
function DrillModal({ titulo, colunas, linhas, onFechar }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 700, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{titulo}</div>
          <button onClick={onFechar} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#7A7A7A" }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "12px 20px" }}>
          {linhas.length === 0
            ? <div style={{ color: "#7A7A7A", textAlign: "center", padding: 32 }}>Sem registros</div>
            : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {colunas.map(c => (
                      <th key={c.key} style={{ textAlign: c.right ? "right" : "left", padding: "6px 8px", borderBottom: "2px solid var(--border)", color: "#7A7A7A", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--cinza-lt)" }}>
                      {colunas.map(c => (
                        <td key={c.key} style={{ padding: "7px 8px", textAlign: c.right ? "right" : "left", color: c.cor ? c.cor(row) : "#1A1A1A" }}>{c.render ? c.render(row) : row[c.key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      </div>
    </div>
  );
}

// ── Widget draggable ──────────────────────────────────────────────────────────
function DraggableCard({ id, index, onDragStart, onDrop, children }) {
  const [over, setOver] = useState(false);
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(index); }}
      style={{ outline: over ? "2px dashed var(--afine-yellow-dk)" : "none", borderRadius: 12, transition: "outline .1s" }}
    >
      {children}
    </div>
  );
}

// ── Seção comparativa multi-obra ──────────────────────────────────────────────
function ComparativoObras({ obras, lancs }) {
  const [selecionadas, setSelecionadas] = useState([]);
  const [periodo, setPeriodo] = useState("6");

  const toggle = id => setSelecionadas(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const hoje = new Date();
  const corte = new Date(hoje);
  corte.setMonth(corte.getMonth() - Number(periodo));
  const corteISO = corte.toISOString().split("T")[0];

  const dados = useMemo(() => {
    return selecionadas.map(id => {
      const obra = obras.find(o => o.id === id);
      const lancsObra = lancs.filter(l => l.obraId === id && l.data >= corteISO);
      const rec = lancsObra.filter(l => l.tipo === "RECEITA" && l.status === "PAGO").reduce((s, l) => s + (l.valor || 0), 0);
      const pag = lancsObra.filter(l => l.tipo === "DESPESA" && l.status === "PAGO").reduce((s, l) => s + (l.valor || 0), 0);
      const aRec = lancsObra.filter(l => l.tipo === "RECEITA" && l.status !== "PAGO").reduce((s, l) => s + (l.valor || 0), 0);
      const aPag = lancsObra.filter(l => l.tipo === "DESPESA" && l.status !== "PAGO").reduce((s, l) => s + (l.valor || 0), 0);
      return { id, nome: obra?.nome || id, prog: obra?.progresso || 0, rec, pag, saldo: rec - pag, aRec, aPag };
    });
  }, [selecionadas, lancs, corteISO, obras]);

  const obrasAtivas = obras.filter(o => o.status === "EM ANDAMENTO");

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>📐 Comparativo multi-obra</div>
          <div style={{ fontSize: 11, color: "#7A7A7A" }}>Selecione obras para comparar lado a lado</div>
        </div>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)}
          style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
          <option value="3">Últimos 3 meses</option>
          <option value="6">Últimos 6 meses</option>
          <option value="12">Últimos 12 meses</option>
        </select>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {obrasAtivas.map(o => (
          <button key={o.id} onClick={() => toggle(o.id)}
            style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, border: "1px solid var(--border)", cursor: "pointer", fontWeight: selecionadas.includes(o.id) ? 700 : 400, background: selecionadas.includes(o.id) ? "var(--afine-yellow-dk)" : "#fff", color: selecionadas.includes(o.id) ? "#fff" : "#1A1A1A" }}>
            {o.nome?.slice(0, 20)}
          </button>
        ))}
        {obrasAtivas.length === 0 && <span style={{ fontSize: 12, color: "#7A7A7A" }}>Nenhuma obra ativa</span>}
      </div>

      {dados.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Obra", "Progresso", "Recebido", "Pago", "Saldo", "A receber", "A pagar"].map(h => (
                  <th key={h} style={{ padding: "6px 10px", borderBottom: "2px solid var(--border)", textAlign: h === "Obra" ? "left" : "right", fontSize: 11, color: "#7A7A7A", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.map(d => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--cinza-lt)" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{d.nome?.slice(0, 24)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <div style={{ width: 60, height: 6, background: "var(--cinza-lt)", borderRadius: 3 }}>
                        <div style={{ width: `${d.prog}%`, height: "100%", background: "var(--afine-yellow-dk)", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11 }}>{d.prog}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--verde)", fontWeight: 600 }}>{fmt(d.rec)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "var(--vermelho)" }}>{fmt(d.pag)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: d.saldo >= 0 ? "var(--verde)" : "var(--vermelho)" }}>{fmt(d.saldo)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#7A7A7A" }}>{fmt(d.aRec)}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#7A7A7A" }}>{fmt(d.aPag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selecionadas.length === 0 && obrasAtivas.length > 0 && (
        <div style={{ textAlign: "center", color: "#7A7A7A", padding: "24px 0", fontSize: 13 }}>
          Clique nas obras acima para comparar
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_ORDER = ["obras", "fluxo", "compras", "saude"];
const STORAGE_KEY   = "painel-widget-order";

export default function PainelGerencial() {
  const [obras,   setObras]   = useState([]);
  const [lancs,   setLancs]   = useState([]);
  const [manuts,  setManuts]  = useState([]);
  const [compras, setCompras] = useState([]);
  const [ops,     setOps]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [drill,   setDrill]   = useState(null); // { titulo, colunas, linhas }
  const [ordem,   setOrdem]   = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_ORDER; }
    catch { return DEFAULT_ORDER; }
  });
  const dragIdx = useRef(null);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, "obras"), limit(100)), snap => {
      setObras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const u2 = onSnapshot(query(collection(db, "financeiro"), limit(500)), snap =>
      setLancs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(query(collection(db, "manutencoes"), where("status", "in", ["ABERTA", "EM ANDAMENTO"]), limit(100)), snap =>
      setManuts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(query(collection(db, "compras"), limit(200)), snap =>
      setCompras(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u5 = onSnapshot(query(collection(db, "oportunidades"), limit(200)), snap =>
      setOps(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  const hoje = new Date().toISOString().split("T")[0];
  const kpis = useFinanceiroKPIs(lancs);

  const obrasStats = useMemo(() => {
    const em3dias = new Date(); em3dias.setDate(em3dias.getDate() + 3);
    const em3ISO  = em3dias.toISOString().split("T")[0];
    return {
      ativas:    obras.filter(o => o.status === "EM ANDAMENTO"),
      concluidas:obras.filter(o => o.status === "CONCLUÍDA"),
      atrasadas: obras.filter(o => o.status === "EM ANDAMENTO" && o.termino && o.termino <= em3ISO && (o.progresso || 0) < 100),
      progMedio: obras.filter(o => o.status === "EM ANDAMENTO").length > 0
        ? Math.round(obras.filter(o => o.status === "EM ANDAMENTO").reduce((s, o) => s + (o.progresso || 0), 0) / obras.filter(o => o.status === "EM ANDAMENTO").length)
        : 0,
    };
  }, [obras, hoje]);

  const manutsAtrasadas = useMemo(() => {
    const em3dias = new Date(); em3dias.setDate(em3dias.getDate() + 3);
    const em3ISO  = em3dias.toISOString().split("T")[0];
    return manuts.filter(m => ["ABERTA", "EM ANDAMENTO"].includes(m.status) && m.dataPrevista && m.dataPrevista <= em3ISO);
  }, [manuts, hoje]);

  const comprasStats = useMemo(() => ({
    abertas:     compras.filter(c => ["SOLICITAÇÃO", "COTAÇÃO"].includes(c.status)).length,
    comprometido:compras.filter(c => ["APROVADA", "ORDEM DE COMPRA"].includes(c.status)).reduce((s, c) => s + (c.valorAprovado || 0), 0),
    porEtapa:    ["SOLICITAÇÃO", "COTAÇÃO", "APROVADA", "ORDEM DE COMPRA", "RECEBIDO", "NF VINCULADA"]
      .map(e => ({ label: e.slice(0, 5), valor: compras.filter(c => c.status === e).length })),
  }), [compras]);

  const comercialStats = useMemo(() => ({
    pipeline: ops.filter(o => o.coluna !== "PERDIDO").reduce((s, o) => s + (o.valor || 0), 0),
    txConv:   ops.length > 0 ? Math.round(ops.filter(o => o.coluna === "CONTRATO").length / ops.length * 100) : 0,
    contratos:ops.filter(o => o.coluna === "CONTRATO").length,
  }), [ops]);

  // ── Drag & Drop handlers ──────────────────────────────────────────────────
  const handleDragStart = useCallback(i => { dragIdx.current = i; }, []);
  const handleDrop = useCallback(i => {
    if (dragIdx.current === null || dragIdx.current === i) return;
    setOrdem(prev => {
      const next = [...prev];
      const [removed] = next.splice(dragIdx.current, 1);
      next.splice(i, 0, removed);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    dragIdx.current = null;
  }, []);

  // ── Drill-down helpers ────────────────────────────────────────────────────
  const drillReceitas = useCallback(() => {
    const linhas = lancs.filter(l => l.tipo === "RECEITA" && l.status !== "PAGO")
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    setDrill({
      titulo: "💰 A Receber — detalhe",
      colunas: [
        { key: "descricao", label: "Descrição" },
        { key: "obra", label: "Obra" },
        { key: "data", label: "Vencimento", render: r => fmtDate(r.data) },
        { key: "valor", label: "Valor", right: true, render: r => fmt(r.valor), cor: () => "var(--verde)" },
      ],
      linhas,
    });
  }, [lancs]);

  const drillDespesas = useCallback(() => {
    const linhas = lancs.filter(l => l.tipo === "DESPESA" && l.status !== "PAGO")
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    setDrill({
      titulo: "📤 A Pagar — detalhe",
      colunas: [
        { key: "descricao", label: "Descrição" },
        { key: "obra", label: "Obra" },
        { key: "data", label: "Vencimento", render: r => fmtDate(r.data) },
        { key: "valor", label: "Valor", right: true, render: r => fmt(r.valor), cor: () => "var(--vermelho)" },
      ],
      linhas,
    });
  }, [lancs]);

  const drillVencidos = useCallback(() => {
    const linhas = lancs.filter(l => l.status !== "PAGO" && l.data && l.data < hoje)
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    setDrill({
      titulo: "⚠️ Vencidos — detalhe",
      colunas: [
        { key: "descricao", label: "Descrição" },
        { key: "tipo", label: "Tipo" },
        { key: "data", label: "Vencimento", render: r => fmtDate(r.data), cor: () => "var(--vermelho)" },
        { key: "valor", label: "Valor", right: true, render: r => fmt(r.valor) },
      ],
      linhas,
    });
  }, [lancs, hoje]);

  const drillObras = useCallback(() => {
    setDrill({
      titulo: "🏗️ Obras ativas — detalhe",
      colunas: [
        { key: "nome", label: "Obra" },
        { key: "cliente", label: "Cliente" },
        { key: "termino", label: "Término", render: r => fmtDate(r.termino) },
        { key: "progresso", label: "Progresso", right: true, render: r => `${r.progresso || 0}%` },
      ],
      linhas: obrasStats.ativas,
    });
  }, [obrasStats]);

  // ── Widgets ───────────────────────────────────────────────────────────────
  const widgets = {
    obras: (
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>🏗️ Avanço físico por obra</div>
            <div style={{ fontSize: 11, color: "#7A7A7A" }}>{obrasStats.ativas.length} em andamento</div>
          </div>
          <Gauge pct={obrasStats.progMedio} cor="#F5C800" label="Média" />
        </div>
        {obrasStats.ativas.length === 0
          ? <EmptyChart altura={80} />
          : obrasStats.ativas.slice(0, 5).map(o => {
              const atrasada = o.termino && o.termino < hoje && (o.progresso || 0) < 100;
              return (
                <div key={o.id} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                    <span style={{ fontWeight: 500, color: atrasada ? "var(--vermelho)" : "#1A1A1A" }}>{o.nome?.slice(0, 22)}{atrasada ? " ⚠️" : ""}</span>
                    <span style={{ fontWeight: 700 }}>{o.progresso || 0}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 5 }}>
                    <div className="progress-fill" style={{ width: `${o.progresso || 0}%`, background: o.progresso >= 100 ? "var(--verde)" : atrasada ? "var(--vermelho)" : "var(--afine-yellow-dk)" }} />
                  </div>
                </div>
              );
            })
        }
        <div style={{ fontSize: 10, color: "#C0C0C0", marginTop: 8, cursor: "move" }}>⠿ arrastar</div>
      </div>
    ),
    fluxo: (
      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>💰 Fluxo de caixa projetado</div>
          <div style={{ fontSize: 11, color: "#7A7A7A" }}>Próximos 6 meses</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
          {kpis.fluxo6m.map((m, i) => {
            const maxVal = Math.max(...kpis.fluxo6m.map(x => Math.abs(x.valor)), 1);
            const h = Math.abs(m.valor) / maxVal * 80;
            const pos = m.valor >= 0;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 100 }}>
                {pos && <div style={{ width: "100%", height: h, background: "var(--verde)", borderRadius: "4px 4px 0 0", opacity: .85 }} />}
                <div style={{ width: "100%", height: 1, background: "#E0DED8" }} />
                {!pos && <div style={{ width: "100%", height: h, background: "var(--vermelho)", borderRadius: "0 0 4px 4px", opacity: .85 }} />}
                <div style={{ fontSize: 9, color: "#7A7A7A", marginTop: 3 }}>{m.label}</div>
                <div style={{ fontSize: 8, fontWeight: 700, color: pos ? "var(--verde)" : "var(--vermelho)" }}>{pos ? "+" : ""}{Math.round(m.valor / 1000)}k</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: "#C0C0C0", marginTop: 8, cursor: "move" }}>⠿ arrastar</div>
      </div>
    ),
    compras: (
      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>🛒 Compras por estágio</div>
          <div style={{ fontSize: 11, color: "#7A7A7A" }}>{comprasStats.abertas} aguardando · {fmt(comprasStats.comprometido)} comprometido</div>
        </div>
        <MiniBarChart dados={comprasStats.porEtapa} cor="#C9A200" altura={90} />
        <div style={{ fontSize: 10, color: "#C0C0C0", marginTop: 8, cursor: "move" }}>⠿ arrastar</div>
      </div>
    ),
    saude: (
      <div className="card">
        <div style={{ marginBottom: 14 }}><div style={{ fontWeight: 600, fontSize: 14 }}>📊 Saúde financeira</div></div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 12 }}>
          <Gauge pct={kpis.totalRec > 0 && (kpis.totalRec + kpis.totalPag) > 0 ? Math.min(100, Math.round(kpis.totalRec / (kpis.totalRec + kpis.totalPag) * 100)) : 0} cor="var(--verde)" label="Receber" />
          <Gauge pct={kpis.totalPag > 0 && (kpis.totalRec + kpis.totalPag) > 0 ? Math.min(100, Math.round(kpis.totalPag / (kpis.totalRec + kpis.totalPag) * 100)) : 0} cor="var(--vermelho)" label="Pagar" />
          <Gauge pct={comercialStats.txConv} cor="var(--afine-yellow-dk)" label="Conversão" />
        </div>
        <div style={{ fontSize: 12, color: "#7A7A7A" }}>
          Manutenções abertas: <strong style={{ color: "var(--vermelho)" }}>{manuts.length}</strong>
          &nbsp;·&nbsp;Pipeline: <strong style={{ color: "var(--afine-yellow-dk)" }}>{fmt(comercialStats.pipeline)}</strong>
        </div>
        <div style={{ fontSize: 10, color: "#C0C0C0", marginTop: 8, cursor: "move" }}>⠿ arrastar</div>
      </div>
    ),
  };

  if (loading) return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ height: 24, background: "var(--cinza-lt)", borderRadius: 6, width: 200, marginBottom: 8 }} />
        <div style={{ height: 14, background: "var(--cinza-lt)", borderRadius: 6, width: 300 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginBottom: 20 }}>
        {Array(8).fill(0).map((_, i) => <KPISkeleton key={i} />)}
      </div>
    </div>
  );

  return (
    <div>
      {drill && (
        <DrillModal
          titulo={drill.titulo}
          colunas={drill.colunas}
          linhas={drill.linhas}
          onFechar={() => setDrill(null)}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div className="panel-title" style={{ fontSize: 20 }}>Painel Gerencial</div>
          <div style={{ fontSize: 12, color: "#7A7A7A" }}>{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <span style={{ fontSize: 11, background: "var(--verde-lt)", color: "var(--verde)", padding: "4px 10px", borderRadius: 20, fontWeight: 600 }}>● Online</span>
      </div>

      {/* KPIs — clicáveis para drill-down */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 20 }}>
        <KPICard label="A receber"       valor={fmt(kpis.totalRec)}           icon="💰" cor="var(--verde)"                   sub="em aberto" onClick={drillReceitas} />
        <KPICard label="A pagar"         valor={fmt(kpis.totalPag)}           icon="📤" cor="var(--vermelho)"                sub="em aberto" onClick={drillDespesas} />
        <KPICard label="Saldo projetado" valor={fmt(kpis.saldo)}              icon="🏦" cor={kpis.saldo >= 0 ? "var(--verde)" : "var(--vermelho)"} />
        <KPICard label="Vencidos"        valor={`${kpis.vencidosCount} lanç`} icon="⚠️" cor={kpis.vencidosCount > 0 ? "var(--vermelho)" : "var(--verde)"} sub={kpis.vencidosCount > 0 ? "atenção" : "ok"} onClick={drillVencidos} />
        <KPICard label="Obras ativas"    valor={obrasStats.ativas.length}     icon="🏗️" sub={`${obrasStats.atrasadas.length} atrasada(s)`} cor={obrasStats.atrasadas.length > 0 ? "var(--vermelho)" : "#1A1A1A"} onClick={drillObras} />
        <KPICard label="Prog. médio"     valor={`${obrasStats.progMedio}%`}   icon="📊" cor="var(--afine-yellow-dk)" />
        <KPICard label="Pipeline"        valor={fmt(comercialStats.pipeline)} icon="📈" cor="var(--afine-yellow-dk)" />
        <KPICard label="Conversão"       valor={`${comercialStats.txConv}%`}  icon="🎯" sub={`${comercialStats.contratos} contratos`} />
      </div>

      {kpis.vencidosCount > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          ⚠️ <strong>{kpis.vencidosCount} lançamento(s) vencido(s)</strong> — acesse Financeiro para regularizar.
        </div>
      )}

      {/* Widgets — drag & drop, 2 colunas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {ordem.map((id, i) => (
          <DraggableCard key={id} id={id} index={i} onDragStart={handleDragStart} onDrop={handleDrop}>
            {widgets[id]}
          </DraggableCard>
        ))}
      </div>

      {/* Comparativo multi-obra */}
      <ComparativoObras obras={obras} lancs={lancs} />

      {/* Alertas — Obras atrasadas */}
      {obrasStats.atrasadas.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--vermelho)", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>🚨 Obras com desvio de prazo</div>
          {obrasStats.atrasadas.map(o => {
            const atrasada = o.termino < hoje;
            return (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{o.nome}</div>
                  <div style={{ fontSize: 11, color: "#7A7A7A" }}>{o.cliente} · {o.progresso || 0}% concluído</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: atrasada ? "var(--vermelho)" : "var(--afine-yellow-dk)", fontWeight: 600 }}>
                    Término: {fmtDate(o.termino)}
                  </div>
                  {atrasada
                    ? <span className="badge badge-red">ATRASADA</span>
                    : <span className="badge badge-amber">⚠ A VENCER</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alertas — Manutenções atrasadas */}
      {manutsAtrasadas.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--vermelho)" }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>🔧 Manutenções com desvio de prazo</div>
          {manutsAtrasadas.map(m => {
            const atrasada = m.dataPrevista < hoje;
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{m.titulo || m.nome || "–"}</div>
                  <div style={{ fontSize: 11, color: "#7A7A7A" }}>
                    {m.cliente}{m.agencia && ` · ${m.agencia}`}{m.cidade && ` · ${m.cidade}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: atrasada ? "var(--vermelho)" : "var(--afine-yellow-dk)", fontWeight: 600 }}>
                    Previsto: {fmtDate(m.dataPrevista)}
                  </div>
                  {atrasada
                    ? <span className="badge badge-red">ATRASADA</span>
                    : <span className="badge badge-amber">⚠ A VENCER</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
