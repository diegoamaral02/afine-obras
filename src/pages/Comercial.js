// src/pages/Comercial.js — CRM + Funil de vendas + Kanban
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import KanbanBoard from "../components/KanbanBoard";
import { useToast } from "../hooks/useToast";
import { fmtDate } from "../utils/helpers";

const COLUNAS_FUNIL = [
  { id:"PROSPECTO",       titulo:"Prospecto",       cor:"#4A4A4A", icone:"👁️" },
  { id:"NEGOCIACAO",      titulo:"Negociação",      cor:"#185FA5", icone:"🤝" },
  { id:"PROPOSTA",        titulo:"Proposta enviada", cor:"#C9A200", icone:"📄" },
  { id:"CONTRATO",        titulo:"Contrato fechado", cor:"#2D6A1F", icone:"✅" },
  { id:"PERDIDO",         titulo:"Perdido",          cor:"#B83232", icone:"❌" },
];

function OportunidadeModal({ op, onClose, addToast }) {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    titulo: op?.titulo||"",
    cliente: op?.cliente||"",
    contato: op?.contato||"",
    valor: op?.valor||"",
    prazo: op?.prazo||"",
    coluna: op?.coluna||"PROSPECTO",
    responsavel: op?.responsavel||userProfile?.nome||"",
    tags: op?.tags||[],
    obs: op?.obs||"",
  });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  function addTag() {
    if(!tagInput.trim()) return;
    set("tags",[...form.tags,tagInput.trim()]);
    setTagInput("");
  }

  async function save() {
    if(!form.titulo||!form.cliente) { alert("Título e cliente são obrigatórios."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = { ...form, valor: Number(form.valor)||0, updatedAt: agora };
    try {
      if(op?.id) { await updateDoc(doc(db,"oportunidades",op.id),payload); addToast("Atualizado!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"oportunidades"),payload); addToast("Oportunidade criada!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title={op?.id?"Editar oportunidade":"Nova oportunidade"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="form-grid">
          <div className="form-group span-2"><label className="required">Título / Projeto</label>
            <input value={form.titulo} onChange={e=>set("titulo",e.target.value)} placeholder="Ex: Reforma AG Cravinhos — Bradesco"/>
          </div>
          <div className="form-group"><label className="required">Cliente</label>
            <input value={form.cliente} onChange={e=>set("cliente",e.target.value)}/>
          </div>
          <div className="form-group"><label>Contato</label>
            <input value={form.contato} onChange={e=>set("contato",e.target.value)}/>
          </div>
          <div className="form-group"><label>Valor estimado (R$)</label>
            <input type="number" value={form.valor} onChange={e=>set("valor",e.target.value)}/>
          </div>
          <div className="form-group"><label>Prazo esperado</label>
            <input type="date" value={form.prazo} onChange={e=>set("prazo",e.target.value)}/>
          </div>
          <div className="form-group"><label>Estágio</label>
            <select value={form.coluna} onChange={e=>set("coluna",e.target.value)}>
              {COLUNAS_FUNIL.map(c=><option key={c.id} value={c.id}>{c.titulo}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Responsável</label>
            <input value={form.responsavel} onChange={e=>set("responsavel",e.target.value)}/>
          </div>
        </div>
        <div className="form-group">
          <label>Etiquetas</label>
          <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
            {form.tags.map((t,i)=>(
              <span key={i} style={{background:"var(--afine-yellow-lt)",color:"var(--afine-yellow-dk)",fontSize:11,padding:"2px 8px",borderRadius:10,display:"flex",alignItems:"center",gap:4}}>
                {t}
                <button onClick={()=>set("tags",form.tags.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,padding:0}}>×</button>
              </span>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} placeholder="Adicionar etiqueta..." style={{flex:1}}/>
            <button className="btn btn-sm" onClick={addTag}>+ Add</button>
          </div>
        </div>
        <div className="form-group"><label>Observações</label>
          <textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/>
        </div>
      </div>
    </Modal>
  );
}

export default function Comercial({ subpagina = "funil" }) {
  const { toasts, addToast } = useToast();
  const [ops,     setOps]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);

  useEffect(()=>{
    return onSnapshot(collection(db,"oportunidades"),snap=>{
      setOps(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
  },[]);

  async function handleMover(cardId, novaColuna) {
    await updateDoc(doc(db,"oportunidades",cardId),{ coluna: novaColuna, updatedAt: new Date().toISOString() });
  }

  // KPIs do funil
  const totalPipeline = ops.filter(o=>o.coluna!=="PERDIDO").reduce((s,o)=>s+(o.valor||0),0);
  const contratos     = ops.filter(o=>o.coluna==="CONTRATO").reduce((s,o)=>s+(o.valor||0),0);
  const txConversao   = ops.length>0 ? Math.round(ops.filter(o=>o.coluna==="CONTRATO").length/ops.length*100) : 0;

  if(subpagina === "clientes") return <ClientesPage addToast={addToast} toasts={toasts}/>;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Comercial — Funil de Vendas</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{ops.length} oportunidades no pipeline</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal({op:null})}>+ Nova oportunidade</button>
      </div>

      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="metric"><div className="metric-label">Pipeline total</div><div className="metric-value green" style={{fontSize:18}}>R$ {totalPipeline.toLocaleString("pt-BR",{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">Contratos fechados</div><div className="metric-value yellow" style={{fontSize:18}}>R$ {contratos.toLocaleString("pt-BR",{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">Taxa de conversão</div><div className="metric-value">{txConversao}%</div></div>
        <div className="metric"><div className="metric-label">Total de oport.</div><div className="metric-value">{ops.length}</div></div>
      </div>

      {loading ? <div className="spinner"/> : (
        <KanbanBoard
          colunas={COLUNAS_FUNIL}
          cards={ops}
          onMover={handleMover}
          onNovoCard={(colId)=>setModal({op:{coluna:colId}})}
          onEditCard={(card)=>setModal({op:card})}
        />
      )}

      {modal && <OportunidadeModal op={modal.op} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// Sub-página clientes (placeholder expansível)
function ClientesPage({ addToast, toasts }) {
  const [clientes, setClientes] = useState([]);
  useEffect(()=>{ return onSnapshot(collection(db,"clientes"),snap=>setClientes(snap.docs.map(d=>({id:d.id,...d.data()})))); },[]);
  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div className="panel-title">Clientes</div>
        <button className="btn btn-primary">+ Novo cliente</button>
      </div>
      {clientes.length===0 && <div className="empty-state"><div className="empty-icon">🏢</div><p>Nenhum cliente cadastrado ainda</p></div>}
    </div>
  );
}
