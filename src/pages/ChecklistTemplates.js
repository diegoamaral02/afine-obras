// src/pages/ChecklistTemplates.js — Templates de checklist por tipo de serviço
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, setDoc, doc } from "firebase/firestore";
import { deleteComAuditoria } from "../services/auditoria";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { isGestorOuAdm } from "../constants/departamentos";

function toId(tipoServico) {
  return (tipoServico || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ── Modal de criação/edição de template ───────────────────────────────────────
function TemplateModal({ template, onClose, addToast }) {
  const isNovo = !template?.id;
  const [tipoServico, setTipoServico] = useState(template?.tipoServico || "");
  const [itens, setItens] = useState(
    template?.itens
      ? template.itens.map(it => ({ ...it }))
      : []
  );
  const [saving, setSaving] = useState(false);

  function addItem() {
    setItens(p => [...p, { id: Date.now().toString(), texto: "", obrigatorio: false }]);
  }

  function removeItem(idx) {
    setItens(p => p.filter((_, i) => i !== idx));
  }

  function updateItem(idx, field, value) {
    setItens(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  async function save() {
    const ts = tipoServico.trim();
    if (!ts) { alert("Informe o tipo de serviço."); return; }
    const itensValidos = itens.filter(it => it.texto.trim());
    if (itensValidos.length === 0) { alert("Adicione ao menos um item ao checklist."); return; }

    const id = toId(ts);
    if (!id) { alert("Nome de tipo inválido."); return; }

    setSaving(true);
    try {
      await setDoc(doc(db, "checklist_templates", id), {
        id,
        tipoServico: ts,
        itens: itensValidos.map(it => ({ id: it.id, texto: it.texto.trim(), obrigatorio: !!it.obrigatorio })),
        updatedAt: new Date().toISOString(),
      });
      addToast(isNovo ? "Template criado!" : "Template atualizado!");
      onClose();
    } catch (err) {
      addToast("Erro: " + err.message, "error");
    }
    setSaving(false);
  }

  return (
    <Modal
      title={isNovo ? "Novo template de checklist" : `Editar template — ${template.tipoServico}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar template"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Tipo de serviço */}
        <div className="form-group">
          <label className="required">Tipo de serviço</label>
          <input
            value={tipoServico}
            onChange={e => setTipoServico(e.target.value)}
            placeholder="Ex: Elétrica, Hidráulica, Climatização, Cabeamento, Pintura, Civil"
            disabled={!isNovo}
            style={{ opacity: !isNovo ? 0.6 : 1 }}
          />
          {tipoServico.trim() && (
            <span style={{ fontSize: 11, color: "#7A7A7A", marginTop: 2 }}>
              ID: <code>{toId(tipoServico)}</code>
            </span>
          )}
        </div>

        {/* Itens do checklist */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7A7A7A", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            Itens do checklist
          </div>

          {itens.length === 0 && (
            <div style={{ fontSize: 12, color: "#aaa", padding: "10px 0" }}>
              Nenhum item ainda. Clique em "＋ Adicionar item" para começar.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
            {itens.map((item, idx) => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 7,
                background: item.obrigatorio ? "rgba(189,56,56,.06)" : "var(--cinza-lt)",
                border: `1px solid ${item.obrigatorio ? "rgba(189,56,56,.2)" : "var(--border)"}`,
              }}>
                {/* Número */}
                <span style={{ fontSize: 11, color: "#aaa", minWidth: 18, textAlign: "right" }}>{idx + 1}.</span>

                {/* Texto */}
                <input
                  value={item.texto}
                  onChange={e => updateItem(idx, "texto", e.target.value)}
                  placeholder="Descreva o item..."
                  style={{ flex: 1, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12 }}
                />

                {/* Obrigatório */}
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", color: item.obrigatorio ? "var(--vermelho)" : "#7A7A7A", fontWeight: item.obrigatorio ? 700 : 400 }}>
                  <input
                    type="checkbox"
                    checked={item.obrigatorio}
                    onChange={e => updateItem(idx, "obrigatorio", e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: "var(--vermelho)" }}
                  />
                  Obrigatório
                </label>

                {/* Remover */}
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", fontSize: 16, lineHeight: 1, padding: 2, flexShrink: 0 }}
                  title="Remover item"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="btn btn-sm"
            style={{ marginTop: 10, width: "100%", borderStyle: "dashed", color: "var(--afine-yellow-dk)", borderColor: "var(--afine-yellow-dk)", background: "var(--afine-yellow-lt)" }}
          >
            ＋ Adicionar item
          </button>
        </div>

        {/* Legenda */}
        <div style={{ fontSize: 11, color: "#7A7A7A", background: "var(--cinza-lt)", borderRadius: 6, padding: "8px 12px" }}>
          Itens marcados como <strong style={{ color: "var(--vermelho)" }}>Obrigatório</strong> bloqueiam o avanço no modal de manutenção enquanto não forem marcados.
        </div>
      </div>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ChecklistTemplates() {
  const { userProfile, currentUser } = useAuth();
  const { toasts, addToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { template: obj|null }
  const [confirmDel, setConfirmDel] = useState(null); // template a excluir

  const isGestor = isGestorOuAdm(userProfile);

  useEffect(() => {
    return onSnapshot(collection(db, "checklist_templates"), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.tipoServico || "").localeCompare(b.tipoServico || ""));
      setTemplates(data);
      setLoading(false);
    });
  }, []);

  async function excluir(tmpl) {
    try {
      await deleteComAuditoria("checklist_templates", tmpl.id, currentUser?.uid, userProfile?.nome, { tipoServico: tmpl.tipoServico });
      addToast(`Template "${tmpl.tipoServico}" excluído.`);
    } catch (err) {
      addToast("Erro ao excluir: " + err.message, "error");
    }
    setConfirmDel(null);
  }

  return (
    <div>
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Templates de Checklist</div>
          <div style={{ fontSize: 12, color: "#7A7A7A" }}>
            {templates.length} template{templates.length !== 1 ? "s" : ""} cadastrado{templates.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ template: null })}>
          ＋ Novo template
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12 }}>
        Templates são aplicados automaticamente no modal de manutenção com base no <strong>tipo de serviço</strong>.
        O ID do template deve corresponder ao tipo digitado (ex: "corretiva", "preventiva" ou um nome customizado).
      </div>

      {loading && <div className="spinner" />}

      {!loading && templates.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>Nenhum template cadastrado ainda</p>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {templates.map(tmpl => {
            const obrigatorios = (tmpl.itens || []).filter(it => it.obrigatorio).length;
            return (
              <div key={tmpl.id} className="card" style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                {/* Ícone / ID */}
                <div style={{
                  width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                  background: "var(--afine-yellow-lt)", border: "1px solid rgba(245,196,0,.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>
                  📋
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--afine-black)" }}>
                    {tmpl.tipoServico}
                  </div>
                  <div style={{ fontSize: 11, color: "#7A7A7A", marginTop: 2 }}>
                    ID: <code style={{ background: "var(--cinza-lt)", padding: "1px 5px", borderRadius: 3 }}>{tmpl.id}</code>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge badge-blue" style={{ fontSize: 11 }}>
                      {(tmpl.itens || []).length} itens
                    </span>
                    {obrigatorios > 0 && (
                      <span className="badge badge-red" style={{ fontSize: 11 }}>
                        {obrigatorios} obrigatório{obrigatorios !== 1 ? "s" : ""}
                      </span>
                    )}
                    {tmpl.updatedAt && (
                      <span style={{ fontSize: 10, color: "#aaa" }}>
                        Atualizado: {new Date(tmpl.updatedAt).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>

                  {/* Preview dos itens */}
                  {(tmpl.itens || []).length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
                      {(tmpl.itens || []).slice(0, 5).map((item, i) => (
                        <div key={item.id || i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}>
                          <span style={{ width: 16, height: 16, borderRadius: 3, border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, flexShrink: 0 }}>
                            ☐
                          </span>
                          {item.texto}
                          {item.obrigatorio && (
                            <span style={{ color: "var(--vermelho)", fontSize: 11, fontWeight: 700 }}>*</span>
                          )}
                        </div>
                      ))}
                      {(tmpl.itens || []).length > 5 && (
                        <div style={{ fontSize: 11, color: "#aaa", paddingLeft: 22 }}>
                          + {(tmpl.itens || []).length - 5} item{(tmpl.itens || []).length - 5 !== 1 ? "s" : ""} não exibido{(tmpl.itens || []).length - 5 !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-sm btn-icon" onClick={() => setModal({ template: tmpl })} title="Editar">
                    ✏️
                  </button>
                  {isGestor && (
                    <button
                      className="btn btn-sm btn-icon"
                      onClick={() => setConfirmDel(tmpl)}
                      title="Excluir"
                      style={{ color: "var(--vermelho)" }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação/edição */}
      {modal && (
        <TemplateModal
          template={modal.template}
          onClose={() => setModal(null)}
          addToast={addToast}
        />
      )}

      {/* Confirmação de exclusão */}
      {confirmDel && (
        <div
          onClick={() => setConfirmDel(null)}
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,10,10,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "min(420px,94vw)", boxShadow: "0 24px 64px rgba(0,0,0,.28)", overflow: "hidden" }}>
            <div style={{ background: "#1A1A1A", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🗑️</span>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--vermelho)" }}>Excluir template</div>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 13 }}>
                Deseja excluir o template <strong>"{confirmDel.tipoServico}"</strong>?<br />
                <span style={{ color: "var(--vermelho)", fontSize: 12 }}>Esta ação é irreversível.</span>
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setConfirmDel(null)}>Cancelar</button>
                <button className="btn btn-danger" onClick={() => excluir(confirmDel)}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
