// src/pages/Contratos.js — Gestão de Contratos
import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { addComAuditoria, updateComAuditoria, deleteComAuditoria } from "../services/auditoria";
import { isCampo, isGestorOuAdm } from "../constants/departamentos";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtBRL(v) {
  if (v === undefined || v === null || v === "") return "–";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtData(s) {
  if (!s) return "–";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function addDias(isoDate, dias) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function vencendoEm30(contrato) {
  if (contrato.status !== "ATIVO") return false;
  const hj = hoje();
  const limite = addDias(hj, 30);
  return contrato.dataFim >= hj && contrato.dataFim <= limite;
}

const STATUS_BADGE = {
  ATIVO: "badge-green",
  "EM_RENOVAÇÃO": "badge-amber",
  SUSPENSO: "badge-red",
  ENCERRADO: "badge-gray",
};

const STATUS_LABEL = {
  ATIVO: "Ativo",
  "EM_RENOVAÇÃO": "Em Renovação",
  SUSPENSO: "Suspenso",
  ENCERRADO: "Encerrado",
};

// ─── Modal de criação/edição ─────────────────────────────────────────────────

const FORM_VAZIO = {
  numero: "", clienteId: "", clienteNome: "",
  objeto: "", tipoServico: "OBRAS", modalidade: "PREÇO_FIXO",
  valorContratado: "", dataInicio: "", dataFim: "",
  status: "ATIVO", aditivos: [], obs: "",
};

const ADITIVO_VAZIO = { id: "", data: "", valor: "", motivo: "" };

function ContratoModal({ contrato, clientes, onClose, addToast, currentUser, userProfile }) {
  const [form, setForm] = useState(() => {
    if (!contrato) return { ...FORM_VAZIO };
    return {
      numero: contrato.numero || "",
      clienteId: contrato.clienteId || "",
      clienteNome: contrato.clienteNome || "",
      objeto: contrato.objeto || "",
      tipoServico: contrato.tipoServico || "OBRAS",
      modalidade: contrato.modalidade || "PREÇO_FIXO",
      valorContratado: contrato.valorContratado !== undefined ? String(contrato.valorContratado) : "",
      dataInicio: contrato.dataInicio || "",
      dataFim: contrato.dataFim || "",
      status: contrato.status || "ATIVO",
      aditivos: contrato.aditivos ? contrato.aditivos.map(a => ({ ...a })) : [],
      obs: contrato.obs || "",
    };
  });
  const [novoAditivo, setNovoAditivo] = useState({ ...ADITIVO_VAZIO });
  const [saving, setSaving] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  function handleCliente(clienteId) {
    const cl = clientes.find(c => c.id === clienteId);
    setForm(p => ({
      ...p,
      clienteId,
      clienteNome: cl ? (cl.razaoSocial || cl.nomeFantasia || "") : "",
    }));
  }

  function addAditivo() {
    if (!novoAditivo.data || !novoAditivo.valor || !novoAditivo.motivo) {
      addToast("Preencha data, valor e motivo do aditivo.", "error");
      return;
    }
    const id = `ad_${Date.now()}`;
    setForm(p => ({
      ...p,
      aditivos: [...p.aditivos, { ...novoAditivo, id, valor: Number(novoAditivo.valor) }],
    }));
    setNovoAditivo({ ...ADITIVO_VAZIO });
  }

  function removeAditivo(id) {
    setForm(p => ({ ...p, aditivos: p.aditivos.filter(a => a.id !== id) }));
  }

  const somaAditivos = form.aditivos.reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const valorBase = Number(form.valorContratado) || 0;
  const valorTotal = valorBase + somaAditivos;

  async function save() {
    if (!form.numero) { addToast("Informe o número do contrato.", "error"); return; }
    if (!form.clienteId) { addToast("Selecione o cliente.", "error"); return; }
    if (!form.objeto) { addToast("Informe o objeto do contrato.", "error"); return; }
    if (!form.dataInicio || !form.dataFim) { addToast("Informe as datas de vigência.", "error"); return; }

    setSaving(true);
    const payload = {
      ...form,
      valorContratado: Number(form.valorContratado) || 0,
    };
    const uid = currentUser?.uid || "";
    const nome = userProfile?.nome || userProfile?.email || "";

    try {
      if (contrato?.id) {
        await updateComAuditoria("contratos", contrato.id, payload, uid, nome);
        addToast("Contrato atualizado com sucesso!");
      } else {
        await addComAuditoria("contratos", payload, uid, nome);
        addToast("Contrato criado com sucesso!");
      }
      onClose();
    } catch (err) {
      addToast("Erro ao salvar: " + err.message, "error");
    }
    setSaving(false);
  }

  return (
    <Modal
      title={contrato?.id ? "Editar contrato" : "Novo contrato"}
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

        {/* Identificação */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A7A7A", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Identificação
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="required">Número / Código</label>
            <input value={form.numero} onChange={e => set("numero", e.target.value)} placeholder="Ex: CT-2024-001" />
          </div>
          <div className="form-group">
            <label className="required">Cliente</label>
            <select value={form.clienteId} onChange={e => handleCliente(e.target.value)}>
              <option value="">Selecione...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.razaoSocial || c.nomeFantasia}</option>
              ))}
            </select>
          </div>
          <div className="form-group span-2">
            <label className="required">Objeto</label>
            <input value={form.objeto} onChange={e => set("objeto", e.target.value)} placeholder="Descrição do objeto contratado" />
          </div>
        </div>

        {/* Classificação */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A7A7A", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Classificação
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Tipo de serviço</label>
            <select value={form.tipoServico} onChange={e => set("tipoServico", e.target.value)}>
              <option value="OBRAS">Obras</option>
              <option value="MANUTENÇÃO">Manutenção</option>
              <option value="MISTO">Misto</option>
            </select>
          </div>
          <div className="form-group">
            <label>Modalidade</label>
            <select value={form.modalidade} onChange={e => set("modalidade", e.target.value)}>
              <option value="PREÇO_FIXO">Preço Fixo</option>
              <option value="MEDIÇÃO">Medição</option>
              <option value="RECORRENTE_MENSAL">Recorrente Mensal</option>
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)}>
              <option value="ATIVO">Ativo</option>
              <option value="EM_RENOVAÇÃO">Em Renovação</option>
              <option value="SUSPENSO">Suspenso</option>
              <option value="ENCERRADO">Encerrado</option>
            </select>
          </div>
        </div>

        {/* Valores e vigência */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A7A7A", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Valores e vigência
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="required">Valor contratado (R$)</label>
            <input type="number" min="0" step="0.01" value={form.valorContratado}
              onChange={e => set("valorContratado", e.target.value)} placeholder="0,00" />
          </div>
          <div className="form-group">
            <label className="required">Data de início</label>
            <input type="date" value={form.dataInicio} onChange={e => set("dataInicio", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="required">Data de término</label>
            <input type="date" value={form.dataFim} onChange={e => set("dataFim", e.target.value)} />
          </div>
        </div>

        {/* Aditivos */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7A7A7A", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Aditivos contratuais
        </div>

        {form.aditivos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {form.aditivos.map(a => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "var(--afine-bg, #F8F8F6)", borderRadius: 6,
                padding: "8px 12px", fontSize: 12,
              }}>
                <span style={{ color: "#7A7A7A", minWidth: 80 }}>{fmtData(a.data)}</span>
                <span style={{ fontWeight: 600, minWidth: 100 }}>R$ {fmtBRL(a.valor)}</span>
                <span style={{ flex: 1, color: "#4A4A4A" }}>{a.motivo}</span>
                <button className="btn btn-sm" style={{ padding: "2px 8px", fontSize: 11 }}
                  onClick={() => removeAditivo(a.id)}>Remover</button>
              </div>
            ))}
          </div>
        )}

        {/* Formulário inline novo aditivo */}
        <div style={{
          border: "1px dashed var(--border, #E0E0E0)", borderRadius: 8,
          padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ fontSize: 11, color: "#7A7A7A", fontWeight: 600 }}>Adicionar aditivo</div>
          <div className="form-grid cols-3" style={{ gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Data</label>
              <input type="date" value={novoAditivo.data}
                onChange={e => setNovoAditivo(p => ({ ...p, data: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Valor (R$)</label>
              <input type="number" min="0" step="0.01" value={novoAditivo.valor}
                placeholder="0,00"
                onChange={e => setNovoAditivo(p => ({ ...p, valor: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Motivo</label>
              <input value={novoAditivo.motivo} placeholder="Ex: Reajuste INCC"
                onChange={e => setNovoAditivo(p => ({ ...p, motivo: e.target.value }))} />
            </div>
          </div>
          <div>
            <button className="btn btn-sm" onClick={addAditivo}>+ Adicionar aditivo</button>
          </div>
        </div>

        {/* Valor total em destaque */}
        <div style={{
          background: "#FAFAF6", border: "1px solid #E8E4C8",
          borderRadius: 8, padding: "12px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, color: "#7A7A7A", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Valor total do contrato
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>
            R$ {fmtBRL(valorTotal)}
          </span>
        </div>
        {somaAditivos > 0 && (
          <div style={{ fontSize: 11, color: "#7A7A7A", textAlign: "right", marginTop: -8 }}>
            Base R$ {fmtBRL(valorBase)} + Aditivos R$ {fmtBRL(somaAditivos)}
          </div>
        )}

        {/* Observações */}
        <div className="form-group">
          <label>Observações</label>
          <textarea value={form.obs} onChange={e => set("obs", e.target.value)} rows={2} />
        </div>
      </div>
    </Modal>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

const STATUS_FILTROS = ["TODOS", "ATIVO", "EM_RENOVAÇÃO", "SUSPENSO", "ENCERRADO"];

export default function Contratos() {
  const { userProfile, currentUser } = useAuth();
  const { toasts, addToast } = useToast();

  const [contratos, setContratos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [modal, setModal] = useState(null); // null | { contrato }

  const canEdit = !isCampo(userProfile);
  const canDelete = isGestorOuAdm(userProfile);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "contratos"), snap => {
      setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(collection(db, "clientes"), snap => {
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // ─── KPIs ───────────────────────────────────────────────────────────────────
  const hj = hoje();
  const hj30 = addDias(hj, 30);
  const ativos = contratos.filter(c => c.status === "ATIVO");
  const totalContratado = ativos.reduce((s, c) => s + (Number(c.valorContratado) || 0), 0);
  const qtdAtivos = ativos.length;
  const vencendo30 = contratos.filter(c =>
    c.status === "ATIVO" && c.dataFim >= hj && c.dataFim <= hj30
  ).length;
  const encerrados = contratos.filter(c => c.status === "ENCERRADO").length;

  // ─── Filtros ─────────────────────────────────────────────────────────────────
  const filtered = contratos.filter(c => {
    const matchStatus = filtroStatus === "TODOS" || c.status === filtroStatus;
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (c.numero || "").toLowerCase().includes(q) ||
      (c.clienteNome || "").toLowerCase().includes(q) ||
      (c.objeto || "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ─── Exclusão ────────────────────────────────────────────────────────────────
  async function handleDelete(c) {
    if (!window.confirm(`Excluir o contrato "${c.numero}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteComAuditoria("contratos", c.id, currentUser?.uid || "", userProfile?.nome || "", c);
      addToast("Contrato excluído.");
    } catch (err) {
      addToast("Erro ao excluir: " + err.message, "error");
    }
  }

  return (
    <div>
      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      {/* Cabeçalho */}
      <div className="panel-header">
        <div>
          <div className="panel-title">Gestão de Contratos</div>
          <div style={{ fontSize: 12, color: "#7A7A7A" }}>
            {qtdAtivos} ativo{qtdAtivos !== 1 ? "s" : ""} · {contratos.length} total
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setModal({ contrato: null })}>
            + Novo contrato
          </button>
        )}
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total contratado (ativos)</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>R$ {fmtBRL(totalContratado)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Contratos ativos</div>
          <div className="kpi-value">{qtdAtivos}</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: vencendo30 > 0 ? "#E8A000" : undefined }}>
          <div className="kpi-label">Vencendo em 30 dias</div>
          <div className="kpi-value" style={{ color: vencendo30 > 0 ? "#C87000" : undefined }}>
            {vencendo30}
          </div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: "#9A9A9A" }}>
          <div className="kpi-label">Encerrados</div>
          <div className="kpi-value" style={{ color: "#7A7A7A" }}>{encerrados}</div>
        </div>
      </div>

      {/* Busca */}
      <div className="search-bar">
        🔍
        <input
          placeholder="Buscar por número, cliente ou objeto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filtros de status */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUS_FILTROS.map(s => (
          <button
            key={s}
            className={`btn btn-sm${filtroStatus === s ? " btn-primary" : ""}`}
            onClick={() => setFiltroStatus(s)}
          >
            {s === "TODOS" ? "Todos" : (STATUS_LABEL[s] || s)}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {loading && <div className="spinner" />}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <p>Nenhum contrato encontrado</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Objeto</th>
                <th>Tipo</th>
                <th>Vigência</th>
                <th>Valor contratado</th>
                <th>Status</th>
                {(canEdit || canDelete) && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const alerta = vencendoEm30(c);
                return (
                  <tr key={c.id} style={alerta ? { background: "#FFFBEA" } : undefined}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.numero}</div>
                      <div style={{ fontSize: 10, color: "#7A7A7A" }}>{c.modalidade?.replace("_", " ")}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>{c.clienteNome || "–"}</td>
                    <td style={{ fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.objeto || "–"}
                    </td>
                    <td>
                      <span className="badge badge-gray" style={{ fontSize: 10 }}>
                        {c.tipoServico || "–"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmtData(c.dataInicio)} → {fmtData(c.dataFim)}
                      {alerta && (
                        <div style={{ fontSize: 10, color: "#C87000", fontWeight: 600 }}>
                          ⚠ Vence em breve
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                      R$ {fmtBRL(c.valorContratado)}
                      {c.aditivos && c.aditivos.length > 0 && (
                        <div style={{ fontSize: 10, color: "#7A7A7A" }}>
                          +{c.aditivos.length} aditivo{c.aditivos.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[c.status] || "badge-gray"}`}>
                        {STATUS_LABEL[c.status] || c.status}
                      </span>
                    </td>
                    {(canEdit || canDelete) && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        {canEdit && (
                          <button className="btn btn-sm btn-icon" onClick={() => setModal({ contrato: c })}
                            title="Editar">✏️</button>
                        )}
                        {canDelete && (
                          <button className="btn btn-sm btn-icon" onClick={() => handleDelete(c)}
                            title="Excluir" style={{ marginLeft: 4 }}>🗑️</button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <ContratoModal
          contrato={modal.contrato}
          clientes={clientes}
          onClose={() => setModal(null)}
          addToast={addToast}
          currentUser={currentUser}
          userProfile={userProfile}
        />
      )}
    </div>
  );
}
