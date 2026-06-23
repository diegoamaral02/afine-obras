// src/pages/Comercial.js — CRM + Funil de vendas + Kanban
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import KanbanBoard from "../components/KanbanBoard";
import { useToast } from "../hooks/useToast";
import { fmtDate } from "../utils/helpers";

// Gera ID simples para agências (não depende do Firestore autoId pois ficam embutidas em array)
function gerarIdAgencia() { return "ag_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

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

// ── Modal de cliente ───────────────────────────────────────────────────────────
function ClienteModal({ cliente, onClose, addToast }) {
  const [form, setForm] = useState({
    razaoSocial:  cliente?.razaoSocial  || "",
    nomeFantasia: cliente?.nomeFantasia || "",
    cnpj:         cliente?.cnpj         || "",
    contato:      cliente?.contato      || "",
    telefone:     cliente?.telefone     || "",
    email:        cliente?.email        || "",
    endereco:     cliente?.endereco     || "",
    segmento:     cliente?.segmento     || "",
    status:       cliente?.status       || "ATIVO",
    obs:          cliente?.obs          || "",
    agencias:     cliente?.agencias     || [],
  });
  const [saving, setSaving] = useState(false);
  const [novaAgencia, setNovaAgencia] = useState({ nome:"", agenciaFilial:"", endereco:"", numero:"", cidade:"", uf:"" });
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  function addAgencia() {
    if(!novaAgencia.nome.trim()){ alert("Informe o nome/número da agência, loja ou filial."); return; }
    set("agencias",[...form.agencias,{ id:gerarIdAgencia(), ...novaAgencia, nome:novaAgencia.nome.trim() }]);
    setNovaAgencia({ nome:"", agenciaFilial:"", endereco:"", numero:"", cidade:"", uf:"" });
  }
  function removerAgencia(id) {
    set("agencias", form.agencias.filter(a=>a.id!==id));
  }

  async function save() {
    if(!form.razaoSocial){ alert("Informe a razão social / nome do cliente."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = { ...form, updatedAt: agora };
    try {
      if(cliente?.id){ await updateDoc(doc(db,"clientes",cliente.id),payload); addToast("✓ Cliente atualizado!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"clientes"),payload); addToast("✓ Cliente cadastrado!"); }
      onClose();
    } catch(err){ addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title={cliente?.id?"Editar cliente":"Novo cliente"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="form-grid">
          <div className="form-group span-2"><label className="required">Razão social / Nome</label>
            <input value={form.razaoSocial} onChange={e=>set("razaoSocial",e.target.value)} placeholder="Ex: Bradesco S.A."/>
          </div>
          <div className="form-group"><label>Nome fantasia</label>
            <input value={form.nomeFantasia} onChange={e=>set("nomeFantasia",e.target.value)}/>
          </div>
          <div className="form-group"><label>CNPJ</label>
            <input value={form.cnpj} onChange={e=>set("cnpj",e.target.value)} placeholder="00.000.000/0001-00"/>
          </div>
          <div className="form-group"><label>Contato (nome)</label>
            <input value={form.contato} onChange={e=>set("contato",e.target.value)}/>
          </div>
          <div className="form-group"><label>Telefone</label>
            <input value={form.telefone} onChange={e=>set("telefone",e.target.value)} placeholder="(11) 9xxxx-xxxx"/>
          </div>
          <div className="form-group"><label>E-mail</label>
            <input type="email" value={form.email} onChange={e=>set("email",e.target.value)}/>
          </div>
          <div className="form-group"><label>Segmento</label>
            <input value={form.segmento} onChange={e=>set("segmento",e.target.value)} placeholder="Ex: Bancário, Varejo..."/>
          </div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              <option value="ATIVO">ATIVO</option>
              <option value="INATIVO">INATIVO</option>
            </select>
          </div>
          <div className="form-group span-2"><label>Endereço (sede)</label>
            <input value={form.endereco} onChange={e=>set("endereco",e.target.value)}/>
          </div>
        </div>

        {/* ── Agências / Lojas / Filiais ──────────────────────────────────── */}
        <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12,border:"1px solid var(--border)"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#4A4A4A",marginBottom:4}}>🏢 Agências / Lojas / Filiais</div>
          <div style={{fontSize:11,color:"#7A7A7A",marginBottom:10}}>
            Cadastre quantas forem necessárias. Elas ficam disponíveis para seleção ao criar Obras ou Manutenções deste cliente.
          </div>

          {form.agencias.length>0 && (
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
              {form.agencias.map(a=>{
                const endCompleto = a.endereco ? `${a.endereco}${a.numero?`, ${a.numero}`:""}${a.cidade?` — ${a.cidade}`:""}${a.uf?`/${a.uf}`:""}` : "";
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:6,padding:"6px 10px",border:"1px solid var(--border)"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontWeight:600,fontSize:13}}>{a.nome}</span>
                        {a.agenciaFilial&&<span style={{fontSize:10,background:"var(--afine-yellow-lt)",color:"var(--afine-yellow-dk)",padding:"1px 7px",borderRadius:10,fontWeight:600}}>Ag/Fil {a.agenciaFilial}</span>}
                      </div>
                      {endCompleto&&<div style={{fontSize:11,color:"#7A7A7A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{endCompleto}</div>}
                    </div>
                    {a.endereco&&(
                      <button onClick={()=>{
                        const enc=encodeURIComponent(`${a.endereco}, ${a.numero||""} ${a.cidade||""} ${a.uf||""}`);
                        window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
                      }} title="Abrir navegação" style={{background:"none",border:"none",cursor:"pointer",color:"#185FA5",fontSize:14,padding:"0 4px"}}>🗺️</button>
                    )}
                    <button onClick={()=>removerAgencia(a.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--vermelho)",fontSize:14,padding:"0 4px"}}>✕</button>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
            <input value={novaAgencia.nome} onChange={e=>setNovaAgencia(p=>({...p,nome:e.target.value}))}
              placeholder="Nome / nº (ex: AG Cravinhos)" style={{flex:"2 1 180px"}}/>
            <input value={novaAgencia.agenciaFilial} onChange={e=>setNovaAgencia(p=>({...p,agenciaFilial:e.target.value}))}
              placeholder="Nº Agência/Filial (ex: 0442)" style={{flex:"1 1 140px"}}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <input value={novaAgencia.endereco} onChange={e=>setNovaAgencia(p=>({...p,endereco:e.target.value}))}
              placeholder="Endereço" style={{flex:"2 1 160px"}}/>
            <input value={novaAgencia.numero} onChange={e=>setNovaAgencia(p=>({...p,numero:e.target.value}))}
              placeholder="Nº" style={{flex:"0 1 70px"}}/>
            <input value={novaAgencia.cidade} onChange={e=>setNovaAgencia(p=>({...p,cidade:e.target.value}))}
              placeholder="Cidade" style={{flex:"1 1 90px"}}/>
            <input value={novaAgencia.uf} onChange={e=>setNovaAgencia(p=>({...p,uf:e.target.value.toUpperCase()}))}
              placeholder="UF" maxLength={2} style={{flex:"0 1 50px"}}/>
            <button className="btn btn-primary btn-sm" onClick={addAgencia}>+ Add</button>
          </div>
        </div>
        <div className="form-group"><label>Observações</label>
          <textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/>
        </div>
      </div>
    </Modal>
  );
}

// Sub-página clientes — CRUD completo
function ClientesPage({ addToast, toasts }) {
  const [clientes, setClientes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [modal,    setModal]    = useState(null);

  useEffect(()=>{
    return onSnapshot(collection(db,"clientes"),snap=>{
      setClientes(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
  },[]);

  const filtered = clientes.filter(c=>{
    const q=search.toLowerCase();
    return !q||c.razaoSocial?.toLowerCase().includes(q)||c.nomeFantasia?.toLowerCase().includes(q)||c.cnpj?.includes(q)||c.contato?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Clientes</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{clientes.length} cliente(s) cadastrado(s)</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal({cliente:null})}>+ Novo cliente</button>
      </div>

      <div className="search-bar">🔍<input placeholder="Buscar por nome, CNPJ ou contato..." value={search} onChange={e=>setSearch(e.target.value)}/></div>

      {loading && <div className="spinner"/>}
      {!loading && filtered.length===0 && (
        <div className="empty-state">
          <div className="empty-icon">🏢</div>
          <p>{clientes.length===0?"Nenhum cliente cadastrado ainda":"Nenhum cliente encontrado"}</p>
        </div>
      )}
      {!loading && filtered.length>0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th>CNPJ</th><th>Contato</th><th>Telefone</th><th>Segmento</th><th>Agências</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(c=>(
                <tr key={c.id}>
                  <td><div style={{fontWeight:600}}>{c.razaoSocial}</div>{c.nomeFantasia&&<div style={{fontSize:11,color:"#7A7A7A"}}>{c.nomeFantasia}</div>}</td>
                  <td style={{fontSize:12}}>{c.cnpj||"–"}</td>
                  <td style={{fontSize:12}}>{c.contato||"–"}</td>
                  <td style={{fontSize:12}}>{c.telefone||"–"}</td>
                  <td style={{fontSize:12}}>{c.segmento||"–"}</td>
                  <td>
                    {(c.agencias||[]).length>0 ? (
                      <span style={{fontSize:11,background:"var(--afine-yellow-lt)",color:"var(--afine-yellow-dk)",padding:"2px 8px",borderRadius:10,fontWeight:600}}>
                        🏢 {c.agencias.length}
                      </span>
                    ) : <span style={{color:"#aaa",fontSize:11}}>–</span>}
                  </td>
                  <td><span className={`badge ${c.status==="ATIVO"?"badge-green":"badge-gray"}`}>{c.status}</span></td>
                  <td><button className="btn btn-sm btn-icon" onClick={()=>setModal({cliente:c})}>✏️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ClienteModal cliente={modal.cliente} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
