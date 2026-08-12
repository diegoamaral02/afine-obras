// src/pages/Garantias.js — Gestão de Garantias
import React, { useEffect, useState, useMemo } from "react";
import {
  collection, onSnapshot, writeBatch, doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { addComAuditoria, updateComAuditoria, deleteComAuditoria } from "../services/auditoria";
import { getDepartamentoEfetivo } from "../constants/departamentos";

// ─── helpers ────────────────────────────────────────────────────────────────

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function addMeses(dataStr, meses) {
  if (!dataStr || !meses) return "";
  const d = new Date(dataStr + "T00:00:00");
  d.setMonth(d.getMonth() + Number(meses));
  return d.toISOString().slice(0, 10);
}

function diasRestantes(dataFimStr) {
  if (!dataFimStr) return null;
  const fim = new Date(dataFimStr + "T00:00:00");
  const agora = new Date();
  agora.setHours(0, 0, 0, 0);
  return Math.round((fim - agora) / 86400000);
}

function pctVida(dataInicioStr, dataFimStr) {
  if (!dataInicioStr || !dataFimStr) return 0;
  const inicio = new Date(dataInicioStr + "T00:00:00").getTime();
  const fim    = new Date(dataFimStr   + "T00:00:00").getTime();
  const agora  = Date.now();
  const total  = fim - inicio;
  if (total <= 0) return 0;
  const restante = fim - agora;
  return Math.max(0, Math.min(100, Math.round((restante / total) * 100)));
}

function progressColor(pct) {
  if (pct > 50) return "green";
  if (pct > 20) return "amber";
  return "red";
}

const STATUS_BADGE = {
  ATIVA:     "badge-green",
  VENCIDA:   "badge-red",
  ACIONADA:  "badge-amber",
  ENCERRADA: "badge-gray",
};

const ORIGEM_BADGE = {
  manutencao: "badge-blue",
  obra:       "badge-purple",
};

function fmt(dateStr) {
  if (!dateStr) return "–";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ─── permissões ─────────────────────────────────────────────────────────────

function canWrite(userProfile) {
  const dep = getDepartamentoEfetivo(userProfile);
  return ["adm", "gestao", "financeiro", "comercial", "fiscal",
          "campo", "compras", "empreiteiro", "terceiro"].includes(dep);
}

function canDelete(userProfile) {
  const dep = getDepartamentoEfetivo(userProfile);
  return ["adm", "gestao"].includes(dep);
}

// ─── Modal de criação / edição ───────────────────────────────────────────────

const FORM_VAZIO = {
  origemTipo: "manutencao",
  origemId: "", origemNome: "",
  clienteId: "", clienteNome: "",
  descricaoServico: "",
  dataExecucao: hoje(),
  prazoMeses: 12,
  dataInicio: hoje(),
  dataFim: "",
  status: "ATIVA",
  obs: "",
};

function GarantiaModal({ garantia, manutencoes, obras, onClose, addToast, userProfile, currentUser }) {
  const isEdit = Boolean(garantia?.id);
  const [form, setForm] = useState(() => {
    if (isEdit) {
      return {
        origemTipo:      garantia.origemTipo      || "manutencao",
        origemId:        garantia.origemId        || "",
        origemNome:      garantia.origemNome      || "",
        clienteId:       garantia.clienteId       || "",
        clienteNome:     garantia.clienteNome     || "",
        descricaoServico:garantia.descricaoServico|| "",
        dataExecucao:    garantia.dataExecucao    || hoje(),
        prazoMeses:      garantia.prazoMeses      || 12,
        dataInicio:      garantia.dataInicio      || hoje(),
        dataFim:         garantia.dataFim         || "",
        status:          garantia.status          || "ATIVA",
        obs:             garantia.obs             || "",
      };
    }
    return { ...FORM_VAZIO };
  });
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // recalcula dataFim ao mudar dataInicio ou prazoMeses
      if (field === "dataInicio" || field === "prazoMeses") {
        next.dataFim = addMeses(
          field === "dataInicio" ? value : next.dataInicio,
          field === "prazoMeses" ? value : next.prazoMeses,
        );
      }
      return next;
    });
  }

  // lista de origens conforme tipo
  const listaOrigem = form.origemTipo === "obra" ? obras : manutencoes;

  function selecionarOrigem(id) {
    const item = listaOrigem.find(i => i.id === id);
    if (!item) { set("origemId", ""); return; }
    setForm(prev => ({
      ...prev,
      origemId:    item.id,
      origemNome:  item.titulo || item.nome || item.razaoSocial || item.id,
      clienteId:   item.clienteId   || "",
      clienteNome: item.clienteNome || "",
    }));
  }

  // status visual (não salvo automaticamente aqui)
  const statusVisual = useMemo(() => {
    if (form.status !== "ATIVA") return form.status;
    if (form.dataFim && form.dataFim < hoje()) return "VENCIDA";
    return "ATIVA";
  }, [form.status, form.dataFim]);

  async function save() {
    if (!form.origemId)        { addToast("Selecione a origem da garantia.", "error"); return; }
    if (!form.descricaoServico){ addToast("Descreva o serviço executado.", "error"); return; }
    if (!form.dataInicio)      { addToast("Informe a data de início.", "error"); return; }
    if (!form.prazoMeses)      { addToast("Informe o prazo em meses.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        prazoMeses: Number(form.prazoMeses),
        dataFim: addMeses(form.dataInicio, form.prazoMeses),
      };
      const uid  = currentUser?.uid  || "desconhecido";
      const nome = userProfile?.nome || userProfile?.email || "–";
      if (isEdit) {
        await updateComAuditoria("garantias", garantia.id, payload, uid, nome);
        addToast("Garantia atualizada!");
      } else {
        await addComAuditoria("garantias", payload, uid, nome);
        addToast("Garantia cadastrada!");
      }
      onClose();
    } catch (err) {
      addToast("Erro: " + err.message, "error");
    }
    setSaving(false);
  }

  const prazosRapidos = [3, 6, 12, 24];

  return (
    <Modal
      title={isEdit ? "Editar garantia" : "Nova garantia"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* seção origem */}
        <div style={sectionLabel}>Origem</div>
        <div className="form-grid">
          <div className="form-group">
            <label className="required">Tipo de origem</label>
            <select value={form.origemTipo} onChange={e => {
              setForm(prev => ({ ...prev, origemTipo: e.target.value, origemId: "", origemNome: "", clienteId: "", clienteNome: "" }));
            }}>
              <option value="manutencao">Manutenção</option>
              <option value="obra">Obra</option>
            </select>
          </div>
          <div className="form-group">
            <label className="required">{form.origemTipo === "obra" ? "Obra" : "Manutenção"}</label>
            <select value={form.origemId} onChange={e => selecionarOrigem(e.target.value)}>
              <option value="">Selecione...</option>
              {listaOrigem.map(i => (
                <option key={i.id} value={i.id}>
                  {i.titulo || i.nome || i.razaoSocial || i.id}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group span-2">
            <label>Cliente</label>
            <input
              value={form.clienteNome}
              onChange={e => set("clienteNome", e.target.value)}
              placeholder="Preenchido automaticamente pela origem"
            />
          </div>
        </div>

        {/* seção serviço */}
        <div style={sectionLabel}>Serviço executado</div>
        <div className="form-grid cols-1">
          <div className="form-group">
            <label className="required">Descrição do serviço</label>
            <textarea
              value={form.descricaoServico}
              onChange={e => set("descricaoServico", e.target.value)}
              rows={3}
              placeholder="Descreva o que foi executado..."
            />
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="required">Data de execução</label>
            <input type="date" value={form.dataExecucao}
              onChange={e => { set("dataExecucao", e.target.value); set("dataInicio", e.target.value); }} />
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)}>
              {["ATIVA", "VENCIDA", "ACIONADA", "ENCERRADA"].map(s =>
                <option key={s}>{s}</option>
              )}
            </select>
          </div>
        </div>

        {/* prazo */}
        <div style={sectionLabel}>Prazo de garantia</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          {prazosRapidos.map(p => (
            <button
              key={p}
              className={`btn btn-sm${Number(form.prazoMeses) === p ? " btn-primary" : ""}`}
              onClick={() => set("prazoMeses", p)}
              type="button"
            >
              {p} {p === 1 ? "mês" : "meses"}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="required">Prazo (meses)</label>
            <input
              type="number" min={1} value={form.prazoMeses}
              onChange={e => set("prazoMeses", e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="required">Data de início</label>
            <input type="date" value={form.dataInicio}
              onChange={e => set("dataInicio", e.target.value)} />
          </div>
          <div className="form-group">
            <label>Válida até (calculado)</label>
            <input type="date" value={form.dataFim} readOnly
              style={{ background: "var(--n-100)", cursor: "default" }} />
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
            {statusVisual !== form.status && (
              <div style={{ fontSize: 12, color: "#A32D2D", fontWeight: 600 }}>
                ⚠ Data vencida — status será VENCIDA ao salvar
              </div>
            )}
          </div>
        </div>

        {/* obs */}
        <div className="form-group">
          <label>Observações</label>
          <textarea value={form.obs} onChange={e => set("obs", e.target.value)} rows={2} />
        </div>
      </div>
    </Modal>
  );
}

const sectionLabel = {
  fontSize: 11, fontWeight: 700, color: "#7A7A7A",
  textTransform: "uppercase", letterSpacing: ".06em",
};

// ─── Componente principal ────────────────────────────────────────────────────

const FILTROS = [
  { key: "todas",     label: "Todas" },
  { key: "ATIVA",     label: "Ativas" },
  { key: "vencendo",  label: "Vencendo" },
  { key: "VENCIDA",   label: "Vencidas" },
  { key: "ACIONADA",  label: "Acionadas" },
  { key: "ENCERRADA", label: "Encerradas" },
];

export default function Garantias() {
  const { userProfile, currentUser } = useAuth();
  const { toasts, addToast } = useToast();

  const [garantias,   setGarantias]   = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [obras,       setObras]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filtro,      setFiltro]      = useState("todas");
  const [modal,       setModal]       = useState(null); // null | { garantia }
  const [excluindo,   setExcluindo]   = useState(null);

  const podeSalvar  = canWrite(userProfile);
  const podeExcluir = canDelete(userProfile);

  // listeners Firestore
  useEffect(() => {
    const unsubG = onSnapshot(collection(db, "garantias"), snap => {
      setGarantias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubM = onSnapshot(collection(db, "manutencoes"), snap => {
      setManutencoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubO = onSnapshot(collection(db, "obras"), snap => {
      setObras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubG(); unsubM(); unsubO(); };
  }, []);

  // atualização automática de status vencidas (batch, máx 20 por vez)
  useEffect(() => {
    if (loading || garantias.length === 0) return;
    const hj = hoje();
    const paraVencer = garantias
      .filter(g => g.status === "ATIVA" && g.dataFim && g.dataFim < hj)
      .slice(0, 20);
    if (paraVencer.length === 0) return;
    const batch = writeBatch(db);
    paraVencer.forEach(g => {
      batch.update(doc(db, "garantias", g.id), { status: "VENCIDA", updatedAt: new Date().toISOString() });
    });
    batch.commit().catch(err => console.error("batch vencidas:", err));
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // KPIs
  const hj = hoje();
  const hj30 = addMeses(hj, 0); // usaremos cálculo manual abaixo
  const em30 = (() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const kpi = useMemo(() => {
    const ativas     = garantias.filter(g => g.status === "ATIVA" && (!g.dataFim || g.dataFim >= hj));
    const vencendo   = garantias.filter(g => g.status === "ATIVA" && g.dataFim && g.dataFim >= hj && g.dataFim <= em30);
    const jaVencidas = garantias.filter(g => g.status === "ATIVA" && g.dataFim && g.dataFim < hj);
    const acionadas  = garantias.filter(g => g.status === "ACIONADA");
    return { ativas: ativas.length, vencendo: vencendo.length, jaVencidas: jaVencidas.length, acionadas: acionadas.length };
  }, [garantias, hj, em30]);

  // filtro + busca
  const visíveis = useMemo(() => {
    let list = garantias;

    // filtro de status
    if (filtro === "ATIVA") {
      list = list.filter(g => g.status === "ATIVA" && (!g.dataFim || g.dataFim >= hj));
    } else if (filtro === "vencendo") {
      list = list.filter(g => g.status === "ATIVA" && g.dataFim && g.dataFim >= hj && g.dataFim <= em30);
    } else if (filtro === "VENCIDA") {
      list = list.filter(g => g.status === "VENCIDA" || (g.status === "ATIVA" && g.dataFim && g.dataFim < hj));
    } else if (filtro === "ACIONADA" || filtro === "ENCERRADA") {
      list = list.filter(g => g.status === filtro);
    }

    // busca
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(g =>
        g.origemNome?.toLowerCase().includes(q) ||
        g.clienteNome?.toLowerCase().includes(q) ||
        g.descricaoServico?.toLowerCase().includes(q)
      );
    }

    // ordenação: vencendo antes, depois ativas, depois resto
    return [...list].sort((a, b) => {
      if (a.dataFim && b.dataFim) return a.dataFim.localeCompare(b.dataFim);
      return 0;
    });
  }, [garantias, filtro, search, hj, em30]);

  async function handleExcluir(g) {
    if (!window.confirm(`Excluir a garantia "${g.origemNome}"? Esta ação não pode ser desfeita.`)) return;
    setExcluindo(g.id);
    try {
      const uid  = currentUser?.uid  || "desconhecido";
      const nome = userProfile?.nome || userProfile?.email || "–";
      await deleteComAuditoria("garantias", g.id, uid, nome, g);
      addToast("Garantia excluída.");
    } catch (err) {
      addToast("Erro ao excluir: " + err.message, "error");
    }
    setExcluindo(null);
  }

  return (
    <div>
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      {/* cabeçalho */}
      <div className="panel-header">
        <div>
          <div className="panel-title">Gestão de Garantias</div>
          <div style={{ fontSize: 12, color: "#7A7A7A" }}>
            {garantias.filter(g => g.status === "ATIVA").length} ativas · {garantias.length} total
          </div>
        </div>
        {podeSalvar && (
          <button className="btn btn-primary" onClick={() => setModal({ garantia: null })}>
            + Nova garantia
          </button>
        )}
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Ativas</div>
          <div className="kpi-value">{kpi.ativas}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: "#B07A1A" }}>
          <div className="kpi-label" style={{ color: "#B07A1A" }}>Vencendo em 30 dias</div>
          <div className="kpi-value" style={{ color: "#B07A1A" }}>{kpi.vencendo}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: "var(--vermelho)" }}>
          <div className="kpi-label" style={{ color: "var(--vermelho)" }}>Já vencidas</div>
          <div className="kpi-value" style={{ color: "var(--vermelho)" }}>{kpi.jaVencidas}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: "#7A5400" }}>
          <div className="kpi-label">Acionadas</div>
          <div className="kpi-value">{kpi.acionadas}</div>
        </div>
      </div>

      {/* filtros rápidos */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTROS.map(f => (
          <button
            key={f.key}
            className={`btn btn-sm${filtro === f.key ? " btn-primary" : ""}`}
            onClick={() => setFiltro(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* busca */}
      <div className="search-bar">
        🔍
        <input
          placeholder="Buscar por origem, cliente ou descrição do serviço..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && <div className="spinner" />}
      {!loading && visíveis.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🛡️</div>
          <p>Nenhuma garantia encontrada</p>
        </div>
      )}

      {!loading && visíveis.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Serviço / Origem</th>
                <th>Cliente</th>
                <th>Descrição</th>
                <th>Execução</th>
                <th>Prazo</th>
                <th>Válida até</th>
                <th>Status / Vida</th>
                {(podeSalvar || podeExcluir) && <th></th>}
              </tr>
            </thead>
            <tbody>
              {visíveis.map(g => {
                const dias = diasRestantes(g.dataFim);
                const pct  = (g.status === "ATIVA" || g.status === "VENCIDA")
                  ? pctVida(g.dataInicio, g.dataFim)
                  : 0;
                const barColor = (g.status === "ENCERRADA" || g.status === "ACIONADA")
                  ? "gray"
                  : progressColor(pct);
                const statusEfetivo = (g.status === "ATIVA" && g.dataFim && g.dataFim < hj)
                  ? "VENCIDA"
                  : g.status;

                return (
                  <tr key={g.id}>
                    {/* origem */}
                    <td>
                      <div style={{ fontWeight: 600 }}>{g.origemNome || "–"}</div>
                      <span className={`badge ${ORIGEM_BADGE[g.origemTipo] || "badge-gray"}`} style={{ fontSize: 10, marginTop: 3 }}>
                        {g.origemTipo === "obra" ? "Obra" : "Manutenção"}
                      </span>
                    </td>

                    {/* cliente */}
                    <td style={{ fontSize: 12 }}>{g.clienteNome || "–"}</td>

                    {/* descrição */}
                    <td style={{ fontSize: 12, maxWidth: 220 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}
                           title={g.descricaoServico}>
                        {g.descricaoServico || "–"}
                      </div>
                    </td>

                    {/* data execução */}
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmt(g.dataExecucao)}</td>

                    {/* prazo */}
                    <td style={{ fontSize: 12 }}>{g.prazoMeses ? `${g.prazoMeses} meses` : "–"}</td>

                    {/* válida até */}
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      <div>{fmt(g.dataFim)}</div>
                      {statusEfetivo === "ATIVA" && dias !== null && (
                        <div style={{ fontSize: 10, color: dias <= 30 ? "#B07A1A" : "#7A7A7A" }}>
                          {dias > 0 ? `${dias} dias restantes` : "Vencida"}
                        </div>
                      )}
                    </td>

                    {/* status + barra */}
                    <td style={{ minWidth: 130 }}>
                      <span className={`badge ${STATUS_BADGE[statusEfetivo] || "badge-gray"}`}>
                        {statusEfetivo}
                      </span>
                      <div className="progress-bar" style={{ marginTop: 6 }}>
                        {barColor !== "gray" ? (
                          <div
                            className={`progress-fill ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        ) : (
                          <div className="progress-fill" style={{ width: "100%", background: "var(--n-300)" }} />
                        )}
                      </div>
                    </td>

                    {/* ações */}
                    {(podeSalvar || podeExcluir) && (
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {podeSalvar && (
                            <button
                              className="btn btn-sm btn-icon"
                              title="Editar"
                              onClick={() => setModal({ garantia: g })}
                            >
                              ✏️
                            </button>
                          )}
                          {podeExcluir && (
                            <button
                              className="btn btn-sm btn-icon btn-danger"
                              title="Excluir"
                              disabled={excluindo === g.id}
                              onClick={() => handleExcluir(g)}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* modal */}
      {modal !== null && (
        <GarantiaModal
          garantia={modal.garantia}
          manutencoes={manutencoes}
          obras={obras}
          onClose={() => setModal(null)}
          addToast={addToast}
          userProfile={userProfile}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
