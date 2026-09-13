// src/components/LancamentoReceberModal.js
// Modal de lançamento a receber aberto automaticamente ao finalizar demandas/obras/manutenções
import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import Modal from "./Modal";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";

const CATS_RECEBER = [
  "Medição / BM","Saldo contratual","Adiantamento","Reembolso","Outros",
];

function hoje() { return new Date().toISOString().slice(0,10); }

export default function LancamentoReceberModal({ dados, onClose, onSalvo }) {
  // dados: { descricao, valor, obraId, obraNome, competencia, vencimento, categoria, obs, origem }
  const { userProfile, currentUser } = useAuth();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    tipo:        "RECEBER",
    descricao:   dados?.descricao   || "",
    categoria:   dados?.categoria   || "Medição / BM",
    obraId:      dados?.obraId      || "",
    obraNome:    dados?.obraNome    || "",
    valor:       dados?.valor       || "",
    vencimento:  dados?.vencimento  || "",
    competencia: dados?.competencia || hoje().slice(0,7),
    status:      "ABERTO",
    obs:         dados?.obs         || "",
    origem:      dados?.origem      || "",  // "gerenciamento" | "obra" | "manutencao"
    autorNome:   userProfile?.nome  || "",
  });
  const [saving, setSaving] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function salvar() {
    if (!form.descricao || !form.valor) {
      addToast("Informe descrição e valor.", "error"); return;
    }
    if (!form.vencimento) {
      addToast("Informe a data de vencimento.", "error"); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        valor: Number(String(form.valor).replace(",",".")),
        valorPago: 0,
        createdAt: new Date().toISOString(),
        updatedAt:  new Date().toISOString(),
        autorNome:  userProfile?.nome || "",
        autorId:    currentUser?.uid  || "",
      };
      await addDoc(collection(db, "financeiro"), payload);
      addToast("✓ Lançamento a receber criado no Financeiro!");
      onSalvo?.();
      onClose();
    } catch(e) { addToast("Erro: " + e.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal
      title="💰 Lançamento a Receber"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>
            {saving ? "Salvando..." : "Criar lançamento"}
          </button>
        </>
      }
    >
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {dados?.origem && (
          <div style={{ background:"#e8f5e9", borderRadius:8, padding:"8px 14px", fontSize:12, color:"#2D6A1F", fontWeight:500 }}>
            Gerado automaticamente ao finalizar: <strong>{dados.origem}</strong>
          </div>
        )}

        <div className="form-group" style={{ margin:0 }}>
          <label className="required">Descrição</label>
          <input value={form.descricao} onChange={e=>set("descricao",e.target.value)}
            placeholder="Ex: Medição BM-03 — AG 0442" />
        </div>

        <div className="form-grid">
          <div className="form-group" style={{ margin:0 }}>
            <label className="required">Valor (R$)</label>
            <input type="number" value={form.valor} onChange={e=>set("valor",e.target.value)}
              placeholder="0,00" min="0" step="0.01" />
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label className="required">Vencimento</label>
            <input type="date" value={form.vencimento} onChange={e=>set("vencimento",e.target.value)} />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group" style={{ margin:0 }}>
            <label>Categoria</label>
            <select value={form.categoria} onChange={e=>set("categoria",e.target.value)}>
              {CATS_RECEBER.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label>Competência</label>
            <input type="month" value={form.competencia} onChange={e=>set("competencia",e.target.value)} />
          </div>
        </div>

        {form.obraNome && (
          <div className="form-group" style={{ margin:0 }}>
            <label>Obra vinculada</label>
            <input value={form.obraNome} readOnly
              style={{ background:"var(--cinza-lt)", color:"var(--cinza-med)" }} />
          </div>
        )}

        <div className="form-group" style={{ margin:0 }}>
          <label>Observações</label>
          <input value={form.obs} onChange={e=>set("obs",e.target.value)}
            placeholder="Informações adicionais" />
        </div>
      </div>
    </Modal>
  );
}
