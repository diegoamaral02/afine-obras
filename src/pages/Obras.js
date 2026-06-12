// src/pages/Obras.js
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

function ObraModal({ obra, onClose, addToast }) {
  const [form, setForm] = useState({
    nome:         obra?.nome         || "",
    cliente:      obra?.cliente      || "",
    gerenciadora: obra?.gerenciadora || "",
    responsavel:  obra?.responsavel  || "",
    endereco:     obra?.endereco     || "",
    contrato:     obra?.contrato     || "",
    area:         obra?.area         || "",
    inicio:       obra?.inicio       || "",
    termino:      obra?.termino      || "",
    status:       obra?.status       || "EM ANDAMENTO",
    progresso:    obra?.progresso    || 0,
  });
  const [saving, setSaving] = useState(false);
  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.nome || !form.cliente) { alert("Nome e cliente são obrigatórios."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = {
      nome:         form.nome,
      cliente:      form.cliente,
      gerenciadora: form.gerenciadora,
      responsavel:  form.responsavel,
      endereco:     form.endereco,
      contrato:     form.contrato,
      area:         form.area,
      inicio:       form.inicio,
      termino:      form.termino,
      status:       form.status,
      progresso:    Number(form.progresso) || 0,
      updatedAt:    agora,
    };
    try {
      if (obra?.id) {
        await updateDoc(doc(db, "obras", obra.id), payload);
        addToast("Obra atualizada!");
      } else {
        payload.createdAt = agora;
        await addDoc(collection(db, "obras"), payload);
        addToast("Obra criada!");
      }
      onClose();
    } catch (err) {
      addToast("Erro ao salvar: " + err.message, "error");
    }
    setSaving(false);
  }

  return (
    <Modal title={obra?.id ? "Editar obra" : "Nova obra"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></>}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div className="form-grid">
          <div className="form-group span-2"><label className="required">Nome da obra / projeto</label><input value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="AG-0500 · São Paulo Centro" /></div>
          <div className="form-group"><label className="required">Cliente</label><input value={form.cliente} onChange={e => set("cliente", e.target.value)} placeholder="Bradesco, Itaú..." /></div>
          <div className="form-group"><label>Gerenciadora</label><input value={form.gerenciadora} onChange={e => set("gerenciadora", e.target.value)} /></div>
          <div className="form-group span-2"><label>Endereço</label><input value={form.endereco} onChange={e => set("endereco", e.target.value)} /></div>
          <div className="form-group"><label>Responsável técnico</label><input value={form.responsavel} onChange={e => set("responsavel", e.target.value)} /></div>
          <div className="form-group"><label>Contrato Nº</label><input value={form.contrato} onChange={e => set("contrato", e.target.value)} /></div>
          <div className="form-group"><label>Área (m²)</label><input type="number" value={form.area} onChange={e => set("area", e.target.value)} /></div>
          <div className="form-group"><label>Progresso (%)</label><input type="number" min="0" max="100" value={form.progresso} onChange={e => set("progresso", e.target.value)} /></div>
          <div className="form-group"><label>Data de início</label><input type="date" value={form.inicio} onChange={e => set("inicio", e.target.value)} /></div>
          <div className="form-group"><label>Data de término</label><input type="date" value={form.termino} onChange={e => set("termino", e.target.value)} /></div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)}>
              {["EM ANDAMENTO","CONCLUÍDA","PARALISADA","PLANEJAMENTO"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Obras({ onObraSelect }) {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [obras,   setObras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [modal,   setModal]   = useState(null);
  const isGestor = userProfile?.perfil === "gestor";

  useEffect(() => {
    return onSnapshot(collection(db, "obras"), snap => {
      setObras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const filtered = obras.filter(o =>
    !search ||
    o.nome?.toLowerCase().includes(search.toLowerCase()) ||
    o.cliente?.toLowerCase().includes(search.toLowerCase()) ||
    o.contrato?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="toast-container">{toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Todas as obras</div>
          <div style={{ fontSize:12, color:"var(--cinza-med)" }}>{obras.length} obras cadastradas</div>
        </div>
        {isGestor && <button className="btn btn-primary" onClick={() => setModal({ obra: null })}>+ Nova obra</button>}
      </div>
      <div className="search-bar">🔍 <input placeholder="Buscar por nome, cliente ou contrato..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      {loading && <div className="spinner" />}
      {!loading && filtered.length === 0 && <div className="empty-state"><div className="empty-icon">🏗️</div><p>Nenhuma obra encontrada</p></div>}
      {!loading && filtered.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Obra</th><th>Cliente</th><th>Responsável</th><th>Início</th><th>Término</th><th>Progresso</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td><div style={{ fontWeight:600 }}>{o.nome}</div><div style={{ fontSize:11, color:"var(--cinza-med)" }}>{o.contrato}</div></td>
                  <td style={{ fontSize:12 }}>{o.cliente}</td>
                  <td style={{ fontSize:12 }}>{o.responsavel || "–"}</td>
                  <td style={{ fontSize:12 }}>{fmtDate(o.inicio)}</td>
                  <td style={{ fontSize:12 }}>{fmtDate(o.termino)}</td>
                  <td style={{ minWidth:100 }}>
                    <div className="progress-bar" style={{ marginBottom:3 }}><div className={`progress-fill ${o.progresso >= 100 ? "green" : "blue"}`} style={{ width:`${o.progresso||0}%` }}/></div>
                    <span style={{ fontSize:11 }}>{o.progresso||0}%</span>
                  </td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                  <td style={{ display:"flex", gap:6 }}>
                    <button className="btn btn-sm" onClick={() => onObraSelect(o.id)}>🔀</button>
                    {isGestor && <button className="btn btn-sm btn-icon" onClick={() => setModal({ obra: o })}>✏️</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <ObraModal obra={modal.obra} onClose={() => setModal(null)} addToast={addToast} />}
    </div>
  );
}