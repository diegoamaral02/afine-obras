// src/pages/Despesas.js — Controle de gastos / reembolsos por funcionário
// (migrado da antiga aba "Controle de Gasto" da planilha)
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { podeEditar } from "../constants/departamentos";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";
import { exportarDespesasParaPDF } from "../utils/exportPDF";
import FiltroAvancado, { dentroPeriodo } from "../components/FiltroAvancado";
import { addComAuditoria, updateComAuditoria, deleteComAuditoria } from "../services/auditoria";

const METODOS = ["Cartão","PIX","Transferência","Dinheiro","Boleto","Outro"];
const fmt  = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const hoje = () => new Date().toISOString().split("T")[0];

// ── Modal de Despesa ─────────────────────────────────────────────────────────
function DespesaModal({ despesa, funcionarios, obras, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const nomeUser = userProfile?.nome || currentUser?.email || "–";
  const [form, setForm] = useState({
    data:            despesa?.data            || hoje(),
    descricao:       despesa?.descricao       || "",
    valor:           despesa?.valor           || "",
    metodoPagamento: despesa?.metodoPagamento || "Cartão",
    reembolso:       despesa?.reembolso       || false,
    funcionarioId:   despesa?.funcionarioId   || "",
    funcionarioNome: despesa?.funcionarioNome || "",
    obraId:          despesa?.obraId          || "",
    obraNome:        despesa?.obraNome        || "",
    obs:             despesa?.obs             || "",
  });
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }
  function handleFunc(id) {
    const f = funcionarios.find(x=>x.id===id);
    set("funcionarioId", id); set("funcionarioNome", f?.nome||"");
  }
  function handleObra(id) {
    const o = obras.find(x=>x.id===id);
    set("obraId", id); set("obraNome", o?.nome||"");
  }

  async function save() {
    if (!form.descricao || !form.valor || !form.data) { alert("Informe data, descrição e valor."); return; }
    setSaving(true);
    const payload = { ...form, valor: Number(form.valor) };
    try {
      if (despesa?.id) { await updateComAuditoria("despesas", despesa.id, payload, currentUser?.uid, nomeUser); addToast("✓ Despesa atualizada!"); }
      else { await addComAuditoria("despesas", payload, currentUser?.uid, nomeUser); addToast("✓ Despesa registrada!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title={despesa?.id ? "Editar despesa" : "Nova despesa"} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button>
      </>}>
      <div className="form-grid">
        <div className="form-group"><label className="required">Data</label><input type="date" value={form.data} onChange={e=>set("data",e.target.value)}/></div>
        <div className="form-group"><label className="required">Valor (R$)</label><input type="number" step="0.01" value={form.valor} onChange={e=>set("valor",e.target.value)} placeholder="0,00"/></div>
        <div className="form-group span-2"><label className="required">Descrição</label><input value={form.descricao} onChange={e=>set("descricao",e.target.value)} placeholder="Ex: Material, Combustível, Gasolina..."/></div>
        <div className="form-group">
          <label>Funcionário</label>
          <select value={form.funcionarioId} onChange={e=>handleFunc(e.target.value)}>
            <option value="">Selecione...</option>
            {funcionarios.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          {!form.funcionarioId && (
            <input value={form.funcionarioNome} onChange={e=>set("funcionarioNome",e.target.value)} placeholder="Ou digite o nome (não cadastrado)" style={{marginTop:6}}/>
          )}
        </div>
        <div className="form-group">
          <label>Método de pagamento</label>
          <select value={form.metodoPagamento} onChange={e=>set("metodoPagamento",e.target.value)}>
            {METODOS.map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Obra (centro de custo)</label>
          <select value={form.obraId} onChange={e=>handleObra(e.target.value)}>
            <option value="">Geral / Administrativo (sem obra)</option>
            {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div className="form-group span-2" style={{display:"flex",alignItems:"center",gap:8}}>
          <input type="checkbox" checked={form.reembolso} onChange={e=>set("reembolso",e.target.checked)} id="chk-reembolso" style={{width:"auto"}}/>
          <label htmlFor="chk-reembolso" style={{margin:0}}>Necessita reembolso ao funcionário</label>
        </div>
        <div className="form-group span-2"><label>Observações</label><textarea rows={2} value={form.obs} onChange={e=>set("obs",e.target.value)}/></div>
      </div>
    </Modal>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Despesas() {
  const { userProfile } = useAuth();
  const podeEditarDespesas = podeEditar(userProfile, "despesas");
  const { toasts, addToast } = useToast();
  const [despesas,     setDespesas]     = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [obras,        setObras]        = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [search,        setSearch]       = useState("");
  const [filtros,       setFiltros]      = useState({ periodo:{de:"",ate:""}, funcionarioNome:"", metodoPagamento:"", obraId:"", reembolso:"" });
  const [qtdMostrar,    setQtdMostrar]   = useState(100);
  const [modal,         setModal]        = useState(null);

  useEffect(()=>{
    const q1 = query(collection(db,"despesas"), orderBy("data","desc"), limit(3000));
    const u1 = onSnapshot(q1, snap=>{ setDespesas(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); }, ()=>setLoading(false));
    const u2 = onSnapshot(collection(db,"usuarios"), snap=>setFuncionarios(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="ATIVO"||!f.status)));
    const u3 = onSnapshot(collection(db,"obras"), snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();u3();};
  },[]);

  const nomesFuncionarios = useMemo(()=>[...new Set(despesas.map(d=>d.funcionarioNome).filter(Boolean))].sort(),[despesas]);

  const filtradas = useMemo(()=>{
    const q = search.toLowerCase();
    return despesas.filter(d=>{
      const mQ = !q || d.descricao?.toLowerCase().includes(q) || d.funcionarioNome?.toLowerCase().includes(q) || d.obraNome?.toLowerCase().includes(q);
      const mPeriodo = dentroPeriodo(d.data, filtros.periodo);
      const mFunc = !filtros.funcionarioNome || d.funcionarioNome===filtros.funcionarioNome;
      const mMetodo = !filtros.metodoPagamento || d.metodoPagamento===filtros.metodoPagamento;
      const mObra = !filtros.obraId || d.obraId===filtros.obraId;
      const mReemb = filtros.reembolso==="" || (filtros.reembolso===true ? d.reembolso : !d.reembolso);
      return mQ && mPeriodo && mFunc && mMetodo && mObra && mReemb;
    });
  },[despesas,search,filtros]);

  const kpis = useMemo(()=>({
    total: filtradas.reduce((s,d)=>s+(d.valor||0),0),
    qtd: filtradas.length,
    pendentesReembolso: filtradas.filter(d=>d.reembolso).reduce((s,d)=>s+(d.valor||0),0),
    qtdPendentes: filtradas.filter(d=>d.reembolso).length,
  }),[filtradas]);

  async function excluir(d) {
    if (!window.confirm(`Excluir a despesa "${d.descricao}" (${fmt(d.valor)})?`)) return;
    try { await deleteComAuditoria("despesas", d.id, currentUser?.uid, userProfile?.nome||currentUser?.email, d); addToast("✓ Excluída"); }
    catch(err) { addToast("Erro: "+err.message,"error"); }
  }

  function exportar() {
    exportarExcel(filtradas, "despesas", [
      { key:"data", header:"Data" },
      { key:"descricao", header:"Descrição" },
      { key:"valor", header:"Valor", format:v=>Number(v||0).toFixed(2) },
      { key:"metodoPagamento", header:"Método" },
      { key:"reembolso", header:"Reembolso", format:v=>v?"Sim":"Não" },
      { key:"funcionarioNome", header:"Funcionário" },
      { key:"obraNome", header:"Obra (centro de custo)" },
      { key:"obs", header:"Observações" },
    ]);
  }

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Despesas</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{despesas.length} registro(s) · {filtradas.length} exibido(s) no filtro atual</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <BtnExcel onClick={exportar} disabled={filtradas.length===0}/>
          <button className="btn btn-sm" disabled={filtradas.length===0} onClick={()=>exportarDespesasParaPDF(filtradas)}>📄 PDF</button>
          {podeEditarDespesas && <button className="btn btn-primary" onClick={()=>setModal({despesa:null})}>+ Nova despesa</button>}
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-label">TOTAL NO FILTRO</div><div className="kpi-value">{fmt(kpis.total)}</div></div>
        <div className="kpi-card"><div className="kpi-label">LANÇAMENTOS</div><div className="kpi-value">{kpis.qtd}</div></div>
        <div className="kpi-card" style={{borderLeftColor:"var(--vermelho)"}}>
          <div className="kpi-label">A REEMBOLSAR</div>
          <div className="kpi-value" style={{color:"var(--vermelho)"}}>{fmt(kpis.pendentesReembolso)}</div>
          <div style={{fontSize:11,color:"#7A7A7A"}}>{kpis.qtdPendentes} lançamento(s)</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="search-bar" style={{marginBottom:8}}>🔍<input placeholder="Buscar por descrição ou funcionário..." value={search} onChange={e=>setSearch(e.target.value)}/></div>

      <FiltroAvancado
        campos={[
          { tipo:"periodo", key:"periodo", label:"Período" },
          { tipo:"select", key:"obraId", label:"Obra (centro de custo)", opcoes: obras.map(o=>({value:o.id,label:o.nome})) },
          { tipo:"select", key:"funcionarioNome", label:"Funcionário", opcoes: nomesFuncionarios.map(n=>({value:n,label:n})) },
          { tipo:"select", key:"metodoPagamento", label:"Método de pagamento", opcoes: METODOS.map(m=>({value:m,label:m})) },
          { tipo:"bool", key:"reembolso", label:"Necessita reembolso" },
        ]}
        valores={filtros} onChange={setFiltros}
        onLimpar={()=>setFiltros({ periodo:{de:"",ate:""}, funcionarioNome:"", metodoPagamento:"", obraId:"", reembolso:"" })}
      />

      {loading && <div className="spinner"/>}
      {!loading && filtradas.length===0 && (
        <div className="empty-state"><div className="empty-icon">💰</div><p>Nenhuma despesa encontrada para esse filtro.</p></div>
      )}

      {!loading && filtradas.length>0 && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th><th>Descrição</th><th>Funcionário</th><th>Obra</th><th>Método</th>
                <th>Reembolso</th><th style={{textAlign:"right"}}>Valor</th>
                {podeEditarDespesas && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(0,qtdMostrar).map(d=>(
                <tr key={d.id}>
                  <td>{d.data?.split("-").reverse().join("/")}</td>
                  <td>{d.descricao}</td>
                  <td>{d.funcionarioNome||"–"}</td>
                  <td>{d.obraNome?<span className="badge badge-blue" style={{fontSize:10}}>🏗️ {d.obraNome}</span>:<span style={{color:"#B8B6AE",fontSize:12}}>Geral</span>}</td>
                  <td>{d.metodoPagamento||"–"}</td>
                  <td>{d.reembolso?<span style={{color:"var(--vermelho)",fontWeight:600}}>Sim</span>:"Não"}</td>
                  <td style={{textAlign:"right",fontWeight:600}}>{fmt(d.valor)}</td>
                  {podeEditarDespesas && (
                    <td style={{whiteSpace:"nowrap"}}>
                      <button className="btn btn-sm" onClick={()=>setModal({despesa:d})}>✏️</button>
                      <button className="btn btn-sm" onClick={()=>excluir(d)} style={{color:"var(--vermelho)"}}>🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length>qtdMostrar && (
            <div style={{textAlign:"center",marginTop:12}}>
              <button className="btn" onClick={()=>setQtdMostrar(q=>q+200)}>Carregar mais ({filtradas.length-qtdMostrar} restante(s))</button>
            </div>
          )}
        </>
      )}

      {modal && (
        <DespesaModal despesa={modal.despesa} funcionarios={funcionarios} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>
      )}
    </div>
  );
}
