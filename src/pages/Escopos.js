// src/pages/Escopos.js
import React, { useEffect, useState } from "react";
import {
  collection, onSnapshot, query, where,
  addDoc, updateDoc, doc, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, pctColor, fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import OSScanner from "../components/OSScanner";
import { useToast } from "../hooks/useToast";

const MIN_PHOTOS = 15;

const STATUS_LIST = ["NÃO INICIADO", "EM ANDAMENTO", "CONCLUÍDO", "PARALISADO"];

function EscopoModal({ escopo, obraId, onClose, addToast }) {
  const { userProfile } = useAuth();
  const isGestor = userProfile?.perfil === "gestor";
  const isCampo  = userProfile?.perfil === "campo";

  const [form, setForm] = useState({
    cod:        escopo?.cod        || "",
    descricao:  escopo?.descricao  || "",
    tipo:       escopo?.tipo       || "reforma",
    responsavel:escopo?.responsavel|| "",
    inicio:     escopo?.inicio     || "",
    fim:        escopo?.fim        || "",
    pct:        escopo?.pct        || 0,
    status:     escopo?.status     || "NÃO INICIADO",
    obs:        escopo?.obs        || "",
  });
  const [fotos, setFotos] = useState(escopo?.fotos || []);
  const [osFile, setOsFile] = useState(escopo?.osFile || null);
  const [saving, setSaving] = useState(false);

  const isManu    = form.tipo === "manutenção";
  const fotasOk   = fotos.length >= MIN_PHOTOS;
  const osOk      = !isManu || !!osFile;
  const canSave   = fotasOk && osOk;

  // Campo só pode marcar como concluído se requisitos forem atendidos
  const statusOptions = isCampo
    ? (canSave ? STATUS_LIST : STATUS_LIST.filter(s => s !== "CONCLUÍDO"))
    : STATUS_LIST;

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  async function save() {
    if (form.status === "CONCLUÍDO" && !canSave) {
      alert(
        isManu
          ? "Para concluir: envie no mínimo 15 fotos e a OS assinada."
          : "Para concluir: envie no mínimo 15 fotos do serviço."
      );
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      pct: parseInt(form.pct) || 0,
      obraId,
      fotos,
      osFile: osFile || null,
      updatedAt: serverTimestamp(),
    };
    try {
      if (escopo?.id) {
        await updateDoc(doc(db, "escopos", escopo.id), payload);
        addToast("Escopo atualizado com sucesso!");
      } else {
        payload.createdAt = serverTimestamp();
        await addDoc(collection(db, "escopos"), payload);
        addToast("Escopo criado com sucesso!");
      }
      onClose();
    } catch (err) {
      addToast("Erro ao salvar: " + err.message, "error");
    }
    setSaving(false);
  }

  return (
    <Modal
      title={escopo?.id ? "Editar escopo" : "Novo escopo"}
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
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Dados básicos — só gestor/encarregado editam */}
        {!isCampo && (
          <div className="form-grid">
            <div className="form-group">
              <label className="required">Código</label>
              <input value={form.cod} onChange={e => set("cod", e.target.value)} placeholder="03.01" />
            </div>
            <div className="form-group">
              <label className="required">Tipo</label>
              <select value={form.tipo} onChange={e => set("tipo", e.target.value)}>
                <option value="reforma">Reforma</option>
                <option value="manutenção">Manutenção</option>
                <option value="instalação">Instalação</option>
              </select>
            </div>
            <div className="form-group span-2">
              <label className="required">Descrição do serviço</label>
              <input value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Ex: Instalação elétrica – infraestrutura" />
            </div>
            <div className="form-group">
              <label>Responsável</label>
              <input value={form.responsavel} onChange={e => set("responsavel", e.target.value)} />
            </div>
            <div className="form-group">
              <label>% Concluído</label>
              <input type="number" min="0" max="100" value={form.pct} onChange={e => set("pct", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Início planejado</label>
              <input type="date" value={form.inicio} onChange={e => set("inicio", e.target.value)} />
            </div>
            <div className="form-group">
              <label>Fim planejado</label>
              <input type="date" value={form.fim} onChange={e => set("fim", e.target.value)} />
            </div>
          </div>
        )}

        {/* Status — todos editam */}
        <div className="form-group">
          <label className="required">Status</label>
          <select value={form.status} onChange={e => set("status", e.target.value)}>
            {statusOptions.map(s => <option key={s}>{s}</option>)}
          </select>
          {isCampo && !canSave && (
            <span style={{ fontSize: 11, color: "var(--vermelho)", marginTop: 3 }}>
              Para marcar como CONCLUÍDO: envie {MIN_PHOTOS} fotos{isManu ? " e a OS assinada" : ""}.
            </span>
          )}
        </div>

        {/* Observação */}
        <div className="form-group">
          <label>Observações</label>
          <textarea value={form.obs} onChange={e => set("obs", e.target.value)} placeholder="Alguma observação sobre a execução..." />
        </div>

        <div className="divider" />

        {/* Upload de fotos – obrigatório 15 */}
        <PhotoUploader
          obraId={obraId}
          escopoId={escopo?.id || "novo"}
          fotos={fotos}
          onChange={setFotos}
        />

        {/* OS – obrigatório para manutenção */}
        {isManu && (
          <>
            <div className="divider" />
            <OSScanner
              obraId={obraId}
              escopoId={escopo?.id || "novo"}
              osFile={osFile}
              onChange={setOsFile}
            />
          </>
        )}

        {/* Resumo de validação */}
        {form.status === "CONCLUÍDO" && !canSave && (
          <div className="alert alert-danger">
            <strong>Não é possível concluir:</strong><br />
            {!fotasOk && `• Envie no mínimo ${MIN_PHOTOS} fotos (você tem ${fotos.length})\n`}
            {isManu && !osOk && "• Anexe a OS assinada e carimbada pelo gerente"}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Escopos({ obraAtual }) {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [escopos, setEscopos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filtro,  setFiltro]  = useState("todos");
  const [modal,   setModal]   = useState(null); // null | { escopo }

  const isGestor = userProfile?.perfil === "gestor";
  const canAdd   = isGestor || userProfile?.perfil === "encarregado";

  useEffect(() => {
    if (!obraAtual) return;
    const q = query(collection(db, "escopos"), where("obraId", "==", obraAtual));
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.cod || "").localeCompare(b.cod || ""));
      setEscopos(data);
      setLoading(false);
    });
    return unsub;
  }, [obraAtual]);

  const filtered = escopos.filter(e => {
    const q = search.toLowerCase();
    const matchQ = !q || e.descricao?.toLowerCase().includes(q) || e.cod?.includes(q) || e.responsavel?.toLowerCase().includes(q);
    const matchF = filtro === "todos" || e.status === filtro;
    return matchQ && matchF;
  });

  const counts = {};
  STATUS_LIST.forEach(s => { counts[s] = escopos.filter(e => e.status === s).length; });

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra no menu lateral.</div>;

  return (
    <div>
      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Escopos da obra</div>
          <div style={{ fontSize: 12, color: "var(--cinza-med)", marginTop: 2 }}>
            {escopos.length} serviços · {counts["CONCLUÍDO"] || 0} concluídos
          </div>
        </div>
        {canAdd && (
          <button className="btn btn-primary" onClick={() => setModal({ escopo: null })}>
            + Novo escopo
          </button>
        )}
      </div>

      {/* Chips de filtro */}
      <div className="chip-row">
        {["todos", ...STATUS_LIST].map(s => (
          <button
            key={s}
            className={`chip ${filtro === s ? "active" : ""}`}
            onClick={() => setFiltro(s)}
          >
            {s === "todos" ? "Todos" : s} {s !== "todos" ? `(${counts[s] || 0})` : `(${escopos.length})`}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="search-bar">
        🔍 <input placeholder="Buscar por descrição, código ou responsável..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading && <div className="spinner" />}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>Nenhum escopo encontrado</p>
        </div>
      )}

      {/* Tabela */}
      {!loading && filtered.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cód.</th><th>Serviço</th><th>Tipo</th><th>Responsável</th>
                <th>Datas</th><th>Progresso</th><th>Status</th>
                <th>Fotos</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const pct = parseInt(e.pct) || 0;
                const fotosOk = (e.fotos?.length || 0) >= MIN_PHOTOS;
                return (
                  <tr key={e.id}>
                    <td style={{ fontSize: 12, color: "var(--cinza-med)", fontWeight: 600 }}>{e.cod}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{e.descricao}</div>
                      {e.obs && <div style={{ fontSize: 11, color: "var(--cinza-med)" }}>{e.obs.slice(0, 60)}{e.obs.length > 60 ? "…" : ""}</div>}
                    </td>
                    <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{e.tipo || "–"}</span></td>
                    <td style={{ fontSize: 12 }}>{e.responsavel || "–"}</td>
                    <td style={{ fontSize: 11, color: "var(--cinza-med)" }}>
                      {fmtDate(e.inicio)} → {fmtDate(e.fim)}
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <div className="progress-bar" style={{ marginBottom: 3 }}>
                        <div className={`progress-fill ${pctColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: 11 }}>{pct}%</span>
                    </td>
                    <td><span className={`badge ${statusBadge(e.status)}`}>{e.status}</span></td>
                    <td>
                      <span style={{ fontSize: 11, color: fotosOk ? "var(--verde)" : "var(--vermelho)", fontWeight: 600 }}>
                        {e.fotos?.length || 0} / {MIN_PHOTOS}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-icon" onClick={() => setModal({ escopo: e })} title="Editar">
                        ✏️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <EscopoModal
          escopo={modal.escopo}
          obraId={obraAtual}
          onClose={() => setModal(null)}
          addToast={addToast}
        />
      )}
    </div>
  );
}
