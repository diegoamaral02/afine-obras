// src/pages/Equipe.js
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

function EquipeModal({ membro, obraId, onClose, addToast }) {
  const [form, setForm] = useState({
    nome:    membro?.nome    || "",
    funcao:  membro?.funcao  || "",
    empresa: membro?.empresa || "",
    tel:     membro?.tel     || "",
    cpf:     membro?.cpf     || "",
    entrada: membro?.entrada || new Date().toISOString().split("T")[0],
    status:  membro?.status  || "ATIVO",
  });
  const [saving, setSaving] = useState(false);
  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.nome) { alert("Informe o nome."); return; }
    setSaving(true);
    const payload = { ...form, obraId, updatedAt: new Date().toISOString() };
    try {
      if (membro?.id) { await updateDoc(doc(db, "equipe", membro.id), payload); addToast("Colaborador atualizado!"); }
      else { payload.createdAt = new Date().toISOString(); await addDoc(collection(db, "equipe"), payload); addToast("Colaborador adicionado!"); }
      onClose();
    } catch (err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title={membro?.id ? "Editar colaborador" : "Adicionar colaborador"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></>}>
      <div className="form-grid" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="form-grid">
          <div className="form-group"><label className="required">Nome completo</label><input value={form.nome} onChange={e => set("nome", e.target.value)} /></div>
          <div className="form-group"><label className="required">Função / Cargo</label><input value={form.funcao} onChange={e => set("funcao", e.target.value)} placeholder="Ex: Eletricista" /></div>
          <div className="form-group"><label>Empresa / Subempreiteiro</label><input value={form.empresa} onChange={e => set("empresa", e.target.value)} /></div>
          <div className="form-group"><label>Telefone</label><input value={form.tel} onChange={e => set("tel", e.target.value)} placeholder="(11) 9xxxx-xxxx" /></div>
          <div className="form-group"><label>CPF / RG</label><input value={form.cpf} onChange={e => set("cpf", e.target.value)} /></div>
          <div className="form-group"><label>Data de entrada</label><input type="date" value={form.entrada} onChange={e => set("entrada", e.target.value)} /></div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)}>
              {["ATIVO","AFASTADO","DESLIGADO","FÉRIAS"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function Equipe({ obraAtual }) {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [equipe,  setEquipe]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [modal,   setModal]   = useState(null);
  const canEdit = userProfile?.perfil === "gestor" || userProfile?.perfil === "encarregado";

  useEffect(() => {
    if (!obraAtual) return;
    const q = query(collection(db, "equipe"), where("obraId", "==", obraAtual));
    return onSnapshot(q, snap => { setEquipe(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
  }, [obraAtual]);

  const filtered = equipe.filter(m => !search || m.nome?.toLowerCase().includes(search.toLowerCase()) || m.funcao?.toLowerCase().includes(search.toLowerCase()));

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra.</div>;
  return (
    <div>
      <div className="toast-container">{toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div className="panel-title">Equipe alocada</div>
        {canEdit && <button className="btn btn-primary" onClick={() => setModal({ membro: null })}>+ Adicionar</button>}
      </div>
      <div className="search-bar">🔍 <input placeholder="Buscar por nome ou função..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      {loading && <div className="spinner" />}
      {!loading && filtered.length === 0 && <div className="empty-state"><div className="empty-icon">👷</div><p>Nenhum colaborador</p></div>}
      {!loading && filtered.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th></th><th>Nome</th><th>Função</th><th>Empresa</th><th>Telefone</th><th>Entrada</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id}>
                  <td><div style={{ width:32, height:32, borderRadius:"50%", background:"var(--azul-claro)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"var(--azul-med)" }}>{initials(m.nome)}</div></td>
                  <td><strong>{m.nome}</strong></td>
                  <td style={{ fontSize:12 }}>{m.funcao}</td>
                  <td style={{ fontSize:12, color:"var(--azul-med)" }}>{m.empresa || "–"}</td>
                  <td style={{ fontSize:12 }}>{m.tel || "–"}</td>
                  <td style={{ fontSize:12 }}>{fmtDate(m.entrada)}</td>
                  <td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></td>
                  {canEdit && <td><button className="btn btn-sm btn-icon" onClick={() => setModal({ membro: m })}>✏️</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal !== null && <EquipeModal membro={modal.membro} obraId={obraAtual} onClose={() => setModal(null)} addToast={addToast} />}
    </div>
  );
}

// ─── Materiais ────────────────────────────────────────────────────────────────
export function Materiais({ obraAtual }) {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [mats,    setMats]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [modal,   setModal]   = useState(false);
  const canEdit = userProfile?.perfil !== "campo";

  // Simple add form inside modal
  const [form, setForm] = useState({ desc:"", un:"m", prev:0, rec:0, uso:0, forn:"", data: new Date().toISOString().split("T")[0] });
  function setF(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function saveMat() {
    if (!form.desc) { alert("Informe o material."); return; }
    await addDoc(collection(db, "materiais"), { ...form, prev: +form.prev, rec: +form.rec, uso: +form.uso, obraId: obraAtual, createdAt: new Date().toISOString() });
    addToast("Material registrado!");
    setModal(false);
  }

  useEffect(() => {
    if (!obraAtual) return;
    return onSnapshot(query(collection(db, "materiais"), where("obraId", "==", obraAtual)), snap => { setMats(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
  }, [obraAtual]);

  const filtered = mats.filter(m => !search || m.desc?.toLowerCase().includes(search.toLowerCase()));

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra.</div>;
  return (
    <div>
      <div className="toast-container">{toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div className="panel-title">Controle de materiais</div>
        {canEdit && <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar entrada</button>}
      </div>
      <div className="metrics-grid">
        <div className="metric"><div className="metric-label">Itens</div><div className="metric-value blue">{mats.length}</div></div>
        <div className="metric"><div className="metric-label">Com saldo</div><div className="metric-value green">{mats.filter(m => m.rec - m.uso > 0).length}</div></div>
        <div className="metric"><div className="metric-label">Ag. entrega</div><div className="metric-value amber">{mats.filter(m => m.rec === 0 && m.prev > 0).length}</div></div>
      </div>
      <div className="search-bar">🔍 <input placeholder="Buscar material..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      {loading && <div className="spinner" />}
      {!loading && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Material</th><th>Un.</th><th>Prev.</th><th>Recebido</th><th>Usado</th><th>Saldo</th><th>Fornecedor</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map(m => {
                const saldo = m.rec - m.uso;
                const sc = saldo > 0 ? "badge-green" : saldo < 0 ? "badge-red" : m.rec === 0 ? "badge-amber" : "badge-gray";
                const sl = saldo > 0 ? "Disponível" : saldo < 0 ? "Negativo" : m.rec === 0 ? "Ag. entrega" : "Zerado";
                return (
                  <tr key={m.id}>
                    <td><strong>{m.desc}</strong></td>
                    <td style={{ fontSize:12 }}>{m.un}</td>
                    <td style={{ fontSize:12 }}>{m.prev}</td>
                    <td style={{ fontSize:12 }}>{m.rec}</td>
                    <td style={{ fontSize:12 }}>{m.uso}</td>
                    <td style={{ fontWeight:700, color: saldo > 0 ? "var(--verde)" : saldo < 0 ? "var(--vermelho)" : "var(--laranja)" }}>{saldo} {m.un}</td>
                    <td style={{ fontSize:12, color:"var(--cinza-med)" }}>{m.forn || "–"}</td>
                    <td><span className={`badge ${sc}`}>{sl}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title="Registrar material" onClose={() => setModal(false)}
          footer={<><button className="btn" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={saveMat}>Salvar</button></>}>
          <div className="form-grid">
            <div className="form-group span-2"><label className="required">Descrição</label><input value={form.desc} onChange={e => setF("desc", e.target.value)} /></div>
            <div className="form-group"><label>Unidade</label><select value={form.un} onChange={e => setF("un", e.target.value)}>{["m","m²","un","kg","saco","cx","rolo"].map(u=><option key={u}>{u}</option>)}</select></div>
            <div className="form-group"><label>Qtd. prevista</label><input type="number" value={form.prev} onChange={e => setF("prev", e.target.value)} /></div>
            <div className="form-group"><label>Qtd. recebida</label><input type="number" value={form.rec} onChange={e => setF("rec", e.target.value)} /></div>
            <div className="form-group"><label>Qtd. usada</label><input type="number" value={form.uso} onChange={e => setF("uso", e.target.value)} /></div>
            <div className="form-group"><label>Fornecedor / NF</label><input value={form.forn} onChange={e => setF("forn", e.target.value)} /></div>
            <div className="form-group"><label>Data recebimento</label><input type="date" value={form.data} onChange={e => setF("data", e.target.value)} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Ocorrências ──────────────────────────────────────────────────────────────
export function Ocorrencias({ obraAtual }) {
  const { toasts, addToast } = useToast();
  const { userProfile } = useAuth();
  const [ocorr,   setOcorr]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro,  setFiltro]  = useState("todas");
  const [modal,   setModal]   = useState(false);
  const [form, setForm] = useState({ data: new Date().toISOString().split("T")[0], tipo:"NÃO-CONFORMIDADE", descricao:"", acao:"", responsavel:"", prazo:"" });
  function setF(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.descricao) { alert("Informe a descrição."); return; }
    await addDoc(collection(db, "ocorrencias"), { ...form, obraId: obraAtual, status: "ABERTA", createdAt: new Date().toISOString() });
    addToast("Ocorrência registrada!");
    setModal(false);
  }

  useEffect(() => {
    if (!obraAtual) return;
    return onSnapshot(query(collection(db, "ocorrencias"), where("obraId", "==", obraAtual)), snap => { setOcorr(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
  }, [obraAtual]);

  const filtered = ocorr.filter(o => filtro === "todas" || o.status === filtro);

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra.</div>;
  return (
    <div>
      <div className="toast-container">{toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div className="panel-title">Ocorrências / RNC</div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar</button>
      </div>
      <div className="tabs">
        {[["todas","Todas"],["ABERTA","Abertas"],["EM TRATAMENTO","Em tratamento"],["CONCLUÍDA","Concluídas"]].map(([v,l]) => (
          <button key={v} className={`tab ${filtro===v?"active":""}`} onClick={() => setFiltro(v)}>{l} ({v==="todas"?ocorr.length:ocorr.filter(o=>o.status===v).length})</button>
        ))}
      </div>
      {loading && <div className="spinner" />}
      {!loading && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Ação corretiva</th><th>Responsável</th><th>Prazo</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td style={{ fontSize:12 }}>{fmtDate(o.data)}</td>
                  <td><span className="badge badge-amber" style={{ fontSize:10 }}>{o.tipo}</span></td>
                  <td style={{ fontSize:12, maxWidth:200 }}>{o.descricao}</td>
                  <td style={{ fontSize:12, color:"var(--azul-med)" }}>{o.acao || "–"}</td>
                  <td style={{ fontSize:12 }}>{o.responsavel || "–"}</td>
                  <td style={{ fontSize:12 }}>{fmtDate(o.prazo)}</td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title="Registrar ocorrência / RNC" onClose={() => setModal(false)}
          footer={<><button className="btn" onClick={() => setModal(false)}>Cancelar</button><button className="btn btn-primary" onClick={save}>Registrar</button></>}>
          <div className="form-grid" style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div className="form-grid">
              <div className="form-group"><label>Data</label><input type="date" value={form.data} onChange={e => setF("data", e.target.value)} /></div>
              <div className="form-group"><label>Tipo</label><select value={form.tipo} onChange={e => setF("tipo", e.target.value)}>{["NÃO-CONFORMIDADE","ACIDENTE","PARALISAÇÃO","ATRASO","FALTA DE MATERIAL","OUTRO"].map(t=><option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="form-group"><label className="required">Descrição</label><textarea value={form.descricao} onChange={e => setF("descricao", e.target.value)} /></div>
            <div className="form-group"><label>Ação corretiva</label><textarea value={form.acao} onChange={e => setF("acao", e.target.value)} /></div>
            <div className="form-grid">
              <div className="form-group"><label>Responsável</label><input value={form.responsavel} onChange={e => setF("responsavel", e.target.value)} /></div>
              <div className="form-group"><label>Prazo</label><input type="date" value={form.prazo} onChange={e => setF("prazo", e.target.value)} /></div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
