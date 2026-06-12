// src/pages/Diario.js
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, addDoc, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

function RDOModal({ obraId, onClose, addToast }) {
  const { currentUser, userProfile } = useAuth();
  const [form, setForm] = useState({
    data:       new Date().toISOString().split("T")[0],
    clima:      "Ensolarado",
    atividades: "",
    equipe:     "",
    materiais:  "",
    obs:        "",
  });
  const [saving, setSaving] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.atividades.trim()) { alert("Descreva as atividades do dia."); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "rdos"), {
        ...form,
        obraId,
        autor:     currentUser.email,
        autorNome: userProfile?.nome || currentUser.email,
        createdAt: new Date().toISOString(),
      });
      addToast("RDO registrado com sucesso!");
      onClose();
    } catch (err) {
      addToast("Erro: " + err.message, "error");
    }
    setSaving(false);
  }

  return (
    <Modal
      title="Novo Registro Diário de Obra (RDO)"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar RDO"}</button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="form-grid">
          <div className="form-group">
            <label className="required">Data</label>
            <input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
          </div>
          <div className="form-group">
            <label>Condição climática</label>
            <select value={form.clima} onChange={e => set("clima", e.target.value)}>
              {["Ensolarado","Parcialmente nublado","Nublado","Chuva fraca","Chuva forte"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="required">Atividades executadas no dia</label>
          <textarea value={form.atividades} onChange={e => set("atividades", e.target.value)} placeholder="Descreva detalhadamente o que foi realizado..." rows={4} />
        </div>
        <div className="form-group">
          <label>Equipe presente</label>
          <input value={form.equipe} onChange={e => set("equipe", e.target.value)} placeholder="Ex: Carlos (Encarregado), João (Pedreiro), Roberto (Elétrica)" />
        </div>
        <div className="form-group">
          <label>Materiais recebidos</label>
          <input value={form.materiais} onChange={e => set("materiais", e.target.value)} placeholder="Ex: 2 rolos cabo Cat.6, 20 sacos de cimento" />
        </div>
        <div className="form-group">
          <label>Ocorrências / observações</label>
          <textarea value={form.obs} onChange={e => set("obs", e.target.value)} placeholder="Registre desvios, problemas ou observações relevantes..." rows={3} />
        </div>
      </div>
    </Modal>
  );
}

export default function Diario({ obraAtual }) {
  const { toasts, addToast } = useToast();
  const [rdos,    setRdos]   = useState([]);
  const [loading, setLoading]= useState(true);
  const [modal,   setModal]  = useState(false);

  useEffect(() => {
    if (!obraAtual) return;
    const q = query(
      collection(db, "rdos"),
      where("obraId", "==", obraAtual),
      orderBy("data", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setRdos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [obraAtual]);

  const climaEmoji = { "Ensolarado":"☀️", "Parcialmente nublado":"⛅", "Nublado":"☁️", "Chuva fraca":"🌧️", "Chuva forte":"⛈️" };

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra no menu lateral.</div>;

  return (
    <div>
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Diário de obra</div>
          <div style={{ fontSize: 12, color: "var(--cinza-med)" }}>{rdos.length} registros</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Novo RDO</button>
      </div>

      {loading && <div className="spinner" />}

      {!loading && rdos.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📓</div>
          <p>Nenhum RDO registrado. Clique em "Novo RDO" para começar.</p>
        </div>
      )}

      {rdos.map(r => (
        <div key={r.id} className="rdo-card">
          <div className="rdo-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>{climaEmoji[r.clima] || "🌤️"}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{fmtDate(r.data)}</div>
                <div style={{ fontSize: 11, color: "var(--cinza-med)" }}>{r.clima}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--cinza-med)" }}>{r.autorNome}</div>
                <div style={{ fontSize: 10, color: "#bbb" }}>{r.autor}</div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong style={{ color: "#333" }}>Atividades:</strong>
            <p style={{ marginTop: 3, color: "#444", lineHeight: 1.5 }}>{r.atividades}</p>
          </div>

          {r.equipe && (
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              <strong>👷 Equipe:</strong> {r.equipe}
            </div>
          )}
          {r.materiais && (
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              <strong>📦 Materiais:</strong> {r.materiais}
            </div>
          )}
          {r.obs && (
            <div className="alert alert-warning" style={{ marginTop: 8, fontSize: 12 }}>
              ⚠️ {r.obs}
            </div>
          )}
        </div>
      ))}

      {modal && <RDOModal obraId={obraAtual} onClose={() => setModal(false)} addToast={addToast} />}
    </div>
  );
}
