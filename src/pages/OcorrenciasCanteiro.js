// src/pages/OcorrenciasCanteiro.js — chamados rápidos do canteiro (cross-obra, qualquer perfil)
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { addComAuditoria, updateComAuditoria } from "../services/auditoria";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import { useToast } from "../hooks/useToast";
import { useConfirm } from "../hooks/useConfirm";
import { enviarNotificacao } from "../hooks/useNotificacoes";
import { isCampo, isGestorOuAdm } from "../constants/departamentos";

const TIPOS = [
  { value:"FALTA DE MATERIAL",  icon:"📦", cor:"var(--afine-yellow-dk)" },
  { value:"EQUIPAMENTO",        icon:"🔧", cor:"#6366F1" },
  { value:"SEGURANÇA",          icon:"⚠️", cor:"var(--vermelho)" },
  { value:"NÃO-CONFORMIDADE",   icon:"❌", cor:"#EF4444" },
  { value:"ATRASO",             icon:"⏰", cor:"#F97316" },
  { value:"ACIDENTE",           icon:"🚨", cor:"#DC2626" },
  { value:"OUTRO",              icon:"📝", cor:"var(--cinza-med)" },
];

const STATUS_COR = {
  "ABERTA":        "var(--vermelho)",
  "EM TRATAMENTO": "var(--afine-yellow-dk)",
  "CONCLUÍDA":     "var(--verde)",
  "CANCELADA":     "var(--cinza-med)",
};

const STATUS_BADGE = {
  "ABERTA":        "badge-red",
  "EM TRATAMENTO": "badge-amber",
  "CONCLUÍDA":     "badge-green",
  "CANCELADA":     "badge-gray",
};

// ── Modal de criação / edição ────────────────────────────────────────────────
function OcorrModal({ ocorr, obras, gestores, onClose, addToast }) {
  const { currentUser, userProfile } = useAuth();
  const isCampoUser = isCampo(userProfile);

  const [form, setForm] = useState({
    data:       ocorr?.data       || new Date().toISOString().split("T")[0],
    tipo:       ocorr?.tipo       || "FALTA DE MATERIAL",
    descricao:  ocorr?.descricao  || "",
    obraId:     ocorr?.obraId     || "",
    obraNome:   ocorr?.obraNome   || "",
    responsavelId:   ocorr?.responsavelId   || "",
    responsavelNome: ocorr?.responsavelNome || "",
    prazo:      ocorr?.prazo      || "",
    status:     ocorr?.status     || "ABERTA",
    acao:       ocorr?.acao       || "",
    prioridade: ocorr?.prioridade || "NORMAL",
  });
  const [fotos, setFotos] = useState(ocorr?.fotos || []);
  const [saving, setSaving] = useState(false);
  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  function handleObra(id) {
    const o = obras.find(x => x.id === id);
    set("obraId", id);
    set("obraNome", o?.nome || "");
  }

  function handleResponsavel(id) {
    const g = gestores.find(x => x.id === id || x.uid === id);
    set("responsavelId", id);
    set("responsavelNome", g?.nome || g?.displayName || "");
  }

  async function save() {
    if (!form.descricao) { addToast("Descreva a ocorrência.", "error"); return; }
    if (!form.obraId)    { addToast("Selecione a obra.", "error"); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = {
      ...form,
      fotos,
      autorId:   currentUser?.uid,
      autorNome: userProfile?.nome || currentUser?.email || "–",
      updatedAt: agora,
    };
    try {
      if (ocorr?.id) {
        await updateComAuditoria("ocorrencias", ocorr.id, payload, currentUser?.uid, userProfile?.nome);
        addToast("Ocorrência atualizada!");
      } else {
        payload.createdAt = agora;
        await addComAuditoria("ocorrencias", payload, currentUser?.uid, userProfile?.nome);
        addToast("Ocorrência registrada!");
        // Notifica o responsável (se definido) e gestores
        if (form.responsavelId) {
          await enviarNotificacao(form.responsavelId, {
            titulo: `⚠️ Nova ocorrência: ${form.tipo}`,
            corpo: `${form.obraNome} — ${form.descricao.slice(0, 80)}`,
            tipo: "warning",
            link: "/ocorrencias",
          });
        }
      }
      onClose();
    } catch (err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  const tipoObj = TIPOS.find(t => t.value === form.tipo);

  return (
    <Modal
      title={ocorr?.id ? "✏️ Editar ocorrência" : "⚡ Nova ocorrência de canteiro"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Salvando..." : ocorr?.id ? "Salvar" : "Registrar"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Tipo — pills visuais */}
        <div>
          <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 600 }}>Tipo de ocorrência</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TIPOS.map(t => (
              <button key={t.value} type="button"
                onClick={() => set("tipo", t.value)}
                style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", border: "2px solid",
                  borderColor: form.tipo === t.value ? t.cor : "var(--border)",
                  background: form.tipo === t.value ? t.cor + "22" : "transparent",
                  color: form.tipo === t.value ? t.cor : "var(--cinza-med)",
                  transition: "all .15s",
                }}>
                {t.icon} {t.value}
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          {/* Obra */}
          <div className="form-group">
            <label className="required">Obra</label>
            <select value={form.obraId} onChange={e => handleObra(e.target.value)}>
              <option value="">Selecione...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>

          {/* Prioridade */}
          <div className="form-group">
            <label>Prioridade</label>
            <select value={form.prioridade} onChange={e => set("prioridade", e.target.value)}>
              {["NORMAL", "ALTA", "CRÍTICA"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {/* Descrição */}
          <div className="form-group span-2">
            <label className="required">Descrição do problema</label>
            <textarea value={form.descricao} onChange={e => set("descricao", e.target.value)}
              rows={3} placeholder="Descreva o que aconteceu com clareza..."/>
          </div>

          {/* Responsável */}
          <div className="form-group">
            <label>Responsável por resolver</label>
            <select value={form.responsavelId} onChange={e => handleResponsavel(e.target.value)}>
              <option value="">Nenhum definido</option>
              {gestores.map(g => <option key={g.id || g.uid} value={g.id || g.uid}>{g.nome || g.displayName}</option>)}
            </select>
          </div>

          {/* Prazo */}
          <div className="form-group">
            <label>Prazo para resolução</label>
            <input type="date" value={form.prazo} onChange={e => set("prazo", e.target.value)}/>
          </div>

          {/* Status — só gestor/encarregado edita */}
          {!isCampoUser && (
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}>
                {["ABERTA", "EM TRATAMENTO", "CONCLUÍDA", "CANCELADA"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Ação corretiva */}
          {!isCampoUser && (
            <div className="form-group span-2">
              <label>Ação corretiva tomada</label>
              <textarea value={form.acao} onChange={e => set("acao", e.target.value)}
                rows={2} placeholder="Descreva o que foi feito para resolver..."/>
            </div>
          )}
        </div>

        {/* Fotos */}
        <div className="divider"/>
        <PhotoUploader fotos={fotos} onChange={setFotos} minFotos={0}/>
      </div>
    </Modal>
  );
}

// ── Card de ocorrência ────────────────────────────────────────────────────────
function OcorrCard({ o, onEdit }) {
  const tipoObj = TIPOS.find(t => t.value === o.tipo) || TIPOS[TIPOS.length - 1];
  const diasRestantes = o.prazo
    ? Math.ceil((new Date(o.prazo) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const prazoVencido = diasRestantes !== null && diasRestantes < 0 && o.status !== "CONCLUÍDA";

  return (
    <div className="card" style={{
      borderLeft: `4px solid ${STATUS_COR[o.status] || "var(--border)"}`,
      padding: "14px 16px",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
              background: tipoObj.cor + "22", color: tipoObj.cor,
            }}>
              {tipoObj.icon} {o.tipo}
            </span>
            <span className={`badge ${STATUS_BADGE[o.status] || "badge-gray"}`}>{o.status}</span>
            {o.prioridade === "CRÍTICA" && <span className="badge badge-red" style={{ fontSize: 10 }}>🚨 CRÍTICA</span>}
            {o.prioridade === "ALTA" && <span className="badge badge-amber" style={{ fontSize: 10 }}>⬆ ALTA</span>}
          </div>

          {/* Descrição */}
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{o.descricao}</div>

          {/* Meta */}
          <div style={{ fontSize: 11, color: "var(--cinza-med)", display: "flex", flexWrap: "wrap", gap: 10 }}>
            {o.obraNome && <span>🏗️ {o.obraNome}</span>}
            {o.responsavelNome && <span>👤 {o.responsavelNome}</span>}
            {o.autorNome && <span>📝 {o.autorNome}</span>}
            {o.prazo && (
              <span style={{ color: prazoVencido ? "var(--vermelho)" : "inherit", fontWeight: prazoVencido ? 700 : 400 }}>
                {prazoVencido ? "⚠️ Prazo vencido" : `📅 ${fmtDate(o.prazo)}`}
                {diasRestantes !== null && !prazoVencido && o.status !== "CONCLUÍDA" && ` (${diasRestantes}d)`}
              </span>
            )}
            <span>{fmtDate(o.data)}</span>
          </div>

          {/* Ação corretiva */}
          {o.acao && (
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--verde)", fontStyle: "italic" }}>
              ✅ {o.acao}
            </div>
          )}

          {/* Fotos */}
          {o.fotos?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {o.fotos.slice(0, 5).map((f, i) => (
                <img key={i} src={f.base64} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}/>
              ))}
              {o.fotos.length > 5 && (
                <div style={{ width: 52, height: 52, borderRadius: 6, background: "var(--cinza-lt)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                  +{o.fotos.length - 5}
                </div>
              )}
            </div>
          )}
        </div>

        <button className="btn btn-sm btn-icon" onClick={onEdit} title="Editar">✏️</button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function OcorrenciasCanteiro() {
  const { userProfile, currentUser } = useAuth();
  const { toasts, addToast } = useToast();
  const { confirm, confirmModal } = useConfirm();
  const isCampoUser = isCampo(userProfile);

  const [ocorr,    setOcorr]    = useState([]);
  const [obras,    setObras]    = useState([]);
  const [gestores, setGestores] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null); // null | { ocorr }
  const [filtroStatus, setFiltroStatus] = useState("abertas");
  const [filtroObra,   setFiltroObra]   = useState("");
  const [filtroTipo,   setFiltroTipo]   = useState("");
  const [search,       setSearch]       = useState("");

  // Carrega ocorrências (todas — cross-obra)
  useEffect(() => {
    return onSnapshot(
      query(collection(db, "ocorrencias"), orderBy("createdAt", "desc")),
      snap => { setOcorr(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
  }, []);

  // Carrega obras em andamento
  useEffect(() => {
    return onSnapshot(collection(db, "obras"), snap => {
      setObras(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.status !== "CONCLUÍDA" && o.status !== "CANCELADA"));
    });
  }, []);

  // Carrega usuários (gestores/encarregados) para atribuição de responsável
  useEffect(() => {
    return onSnapshot(collection(db, "usuarios"), snap => {
      setGestores(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => !isCampo(u)));
    });
  }, []);

  // Filtros
  const filtradas = useMemo(() => {
    return ocorr.filter(o => {
      if (filtroStatus === "abertas"  && !["ABERTA","EM TRATAMENTO"].includes(o.status)) return false;
      if (filtroStatus === "concluidas" && o.status !== "CONCLUÍDA") return false;
      if (filtroStatus === "vencidas") {
        const dias = o.prazo ? Math.ceil((new Date(o.prazo) - new Date()) / 86400000) : null;
        if (!(dias !== null && dias < 0 && o.status !== "CONCLUÍDA")) return false;
      }
      if (filtroObra && o.obraId !== filtroObra) return false;
      if (filtroTipo && o.tipo !== filtroTipo) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!o.descricao?.toLowerCase().includes(s) && !o.obraNome?.toLowerCase().includes(s) && !o.responsavelNome?.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [ocorr, filtroStatus, filtroObra, filtroTipo, search]);

  // KPIs
  const abertas     = ocorr.filter(o => o.status === "ABERTA").length;
  const emTratam    = ocorr.filter(o => o.status === "EM TRATAMENTO").length;
  const vencidas    = ocorr.filter(o => {
    const d = o.prazo ? Math.ceil((new Date(o.prazo) - new Date()) / 86400000) : null;
    return d !== null && d < 0 && o.status !== "CONCLUÍDA";
  }).length;
  const concluidas  = ocorr.filter(o => o.status === "CONCLUÍDA").length;
  const taxaResoluc = ocorr.length > 0 ? Math.round((concluidas / ocorr.length) * 100) : 0;

  return (
    <>
      {confirmModal}
      <div className="toast-container">{toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-title">⚡ Ocorrências de Canteiro</div>
          <div style={{ fontSize: 12, color: "var(--cinza-med)" }}>Chamados rápidos — qualquer problema no canteiro</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ ocorr: null })}>
          + Nova ocorrência
        </button>
      </div>

      {/* KPIs */}
      <div className="metrics-grid" style={{ marginBottom: 20 }}>
        <div className="metric">
          <div className="metric-label">Abertas</div>
          <div className="metric-value red">{abertas}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Em tratamento</div>
          <div className="metric-value amber">{emTratam}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Com prazo vencido</div>
          <div className="metric-value red">{vencidas}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Concluídas</div>
          <div className="metric-value green">{concluidas}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Taxa de resolução</div>
          <div className="metric-value">{taxaResoluc}%</div>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { value: "abertas",   label: `Abertas (${abertas + emTratam})` },
          { value: "vencidas",  label: `⚠️ Vencidas (${vencidas})` },
          { value: "concluidas",label: `Concluídas (${concluidas})` },
          { value: "todas",     label: "Todas" },
        ].map(f => (
          <button key={f.value} className={`btn btn-sm${filtroStatus === f.value ? " btn-primary" : ""}`}
            onClick={() => setFiltroStatus(f.value)}>
            {f.label}
          </button>
        ))}

        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)}
          style={{ marginLeft: "auto", fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--branco)" }}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          style={{ fontSize: 12, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--branco)" }}>
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.value}</option>)}
        </select>
      </div>

      {/* Busca */}
      <div className="search-bar" style={{ marginBottom: 14 }}>
        🔍<input placeholder="Buscar por descrição, obra ou responsável..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* Lista */}
      {loading && <div className="spinner"/>}
      {!loading && filtradas.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <p>Nenhuma ocorrência encontrada</p>
          <span style={{ fontSize: 12, color: "var(--cinza-med)" }}>
            {filtroStatus === "abertas" ? "Canteiro sem ocorrências abertas — tudo em ordem!" : "Tente outro filtro"}
          </span>
        </div>
      )}
      {!loading && filtradas.map(o => (
        <OcorrCard key={o.id} o={o} onEdit={() => setModal({ ocorr: o })}/>
      ))}

      {modal && (
        <OcorrModal
          ocorr={modal.ocorr}
          obras={obras}
          gestores={gestores}
          onClose={() => setModal(null)}
          addToast={addToast}
        />
      )}
    </>
  );
}
