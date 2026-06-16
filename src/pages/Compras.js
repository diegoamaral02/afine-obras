// src/pages/Compras.js — Painel de Compras: Solicitação → Cotação → OC → NF
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import KanbanBoard from "../components/KanbanBoard";


const COLS_COMPRAS = [
  { id:"SOLICITAÇÃO",      titulo:"Solicitação",      cor:"#4A4A4A", icone:"📝" },
  { id:"COTAÇÃO",          titulo:"Em cotação",        cor:"#185FA5", icone:"💬" },
  { id:"APROVADA",         titulo:"Aprovada",          cor:"#C9A200", icone:"✅" },
  { id:"ORDEM DE COMPRA",  titulo:"Ordem de Compra",   cor:"#7B4F00", icone:"📋" },
  { id:"RECEBIDO",         titulo:"Recebido",          cor:"#2D6A1F", icone:"📦" },
  { id:"NF VINCULADA",     titulo:"NF Vinculada",      cor:"#1A5A10", icone:"🧾" },
];
const STATUS_JORNADA = ["SOLICITAÇÃO","COTAÇÃO","APROVADA","ORDEM DE COMPRA","RECEBIDO","NF VINCULADA"];
const STATUS_COLOR   = {"SOLICITAÇÃO":"badge-gray","COTAÇÃO":"badge-blue","APROVADA":"badge-yellow","ORDEM DE COMPRA":"badge-purple","RECEBIDO":"badge-green","NF VINCULADA":"badge-green"};

function CompraModal({ compra, obras, manutencoes, fornecedores, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const isGestor = userProfile?.perfil==="gestor"||userProfile?.perfil==="encarregado";
  const [form, setForm] = useState({
    titulo: compra?.titulo||"",
    demandaTipo: compra?.demandaTipo||"obra",
    demandaId: compra?.demandaId||"",
    urgencia: compra?.urgencia||"normal",
    status: compra?.status||"SOLICITAÇÃO",
    fornecedorId: compra?.fornecedorId||"",
    valorCotado: compra?.valorCotado||"",
    valorAprovado: compra?.valorAprovado||"",
    formaPagamento: compra?.formaPagamento||"",
    prazoEntrega: compra?.prazoEntrega||"",
    numeroPedido: compra?.numeroPedido||"",
    numeroNF: compra?.numeroNF||"",
    valorNF: compra?.valorNF||"",
    dataRecebimento: compra?.dataRecebimento||"",
    obs: compra?.obs||"",
  });
  const [itens, setItens] = useState(compra?.itens||[]);
  const [itemNome, setItemNome] = useState(""); const [itemQtd, setItemQtd] = useState(""); const [itemUn, setItemUn] = useState("un");
  const [saving, setSaving] = useState(false);
  function set(f,v){setForm(p=>({...p,[f]:v}));}

  function addItem() {
    if (!itemNome||!itemQtd){alert("Informe o item e a quantidade.");return;}
    setItens(p=>[...p,{nome:itemNome,qtd:Number(itemQtd),un:itemUn}]);
    setItemNome(""); setItemQtd("");
  }

  const demandas = form.demandaTipo==="obra" ? obras : manutencoes;
  const fornSel  = fornecedores.find(f=>f.id===form.fornecedorId);

  async function save() {
    if (!form.titulo||!itens.length){alert("Informe o título e ao menos 1 item.");return;}
    setSaving(true);
    const agora = new Date().toISOString();
    const demanda = demandas.find(d=>d.id===form.demandaId);
    const payload = {
      ...form, itens,
      demandaNome: demanda?.nome||demanda?.titulo||"",
      fornecedorNome: fornSel?.razaoSocial||"",
      autorNome: userProfile?.nome||currentUser?.email,
      updatedAt: agora,
    };
    try {
      if (compra?.id){await updateDoc(doc(db,"compras",compra.id),payload);addToast("Compra atualizada!");}
      else{payload.createdAt=agora;await addDoc(collection(db,"compras"),payload);addToast("Solicitação criada!");}
      onClose();
    } catch(err){addToast("Erro: "+err.message,"error");}
    setSaving(false);
  }

  const passoAtual = STATUS_JORNADA.indexOf(form.status);

  return (
    <Modal title={compra?.id?"Editar compra":"Nova solicitação de compra"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* Jornada visual */}
        <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:4}}>
          {STATUS_JORNADA.map((s,i)=>(
            <div key={s} onClick={()=>isGestor&&set("status",s)} style={{flex:1,minWidth:80,textAlign:"center",padding:"6px 4px",borderRadius:6,cursor:isGestor?"pointer":"default",
              background:i===passoAtual?"#1A1A1A":i<passoAtual?"var(--verde-lt)":"var(--cinza-lt)",
              color:i===passoAtual?"#F5C800":i<passoAtual?"var(--verde)":"#7A7A7A",
              fontSize:10,fontWeight:i===passoAtual?700:500,transition:".15s"}}>
              {i<passoAtual?"✓ ":""}{s}
            </div>
          ))}
        </div>

        <div className="form-grid">
          <div className="form-group span-2"><label className="required">Título da compra</label><input value={form.titulo} onChange={e=>set("titulo",e.target.value)} placeholder="Ex: Cabos elétricos — AG 0442"/></div>
          <div className="form-group"><label>Vinculado a</label>
            <select value={form.demandaTipo} onChange={e=>{set("demandaTipo",e.target.value);set("demandaId","");}}>
              <option value="obra">Obra</option><option value="manutencao">Manutenção</option><option value="geral">Geral (estoque)</option>
            </select>
          </div>
          {form.demandaTipo!=="geral"&&(
            <div className="form-group"><label>Qual {form.demandaTipo==="obra"?"obra":"manutenção"}?</label>
              <select value={form.demandaId} onChange={e=>set("demandaId",e.target.value)}>
                <option value="">Selecione...</option>
                {demandas.map(d=><option key={d.id} value={d.id}>{d.nome||d.titulo}</option>)}
              </select>
            </div>
          )}
          <div className="form-group"><label>Urgência</label>
            <select value={form.urgencia} onChange={e=>set("urgencia",e.target.value)}>
              {["baixa","normal","alta","urgente"].map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* Itens */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Itens solicitados</div>
        <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
          <div className="form-group" style={{flex:2}}><label>Item</label><input value={itemNome} onChange={e=>setItemNome(e.target.value)} placeholder="Ex: Cabo 10mm²"/></div>
          <div className="form-group" style={{width:80}}><label>Qtd.</label><input type="number" min="1" value={itemQtd} onChange={e=>setItemQtd(e.target.value)}/></div>
          <div className="form-group" style={{width:80}}><label>Un.</label><select value={itemUn} onChange={e=>setItemUn(e.target.value)}>{["un","m","m²","kg","saco","cx","rolo"].map(u=><option key={u}>{u}</option>)}</select></div>
          <button className="btn btn-primary btn-sm" onClick={addItem} style={{marginBottom:1}}>+ Add</button>
        </div>
        {itens.length>0&&(
          <div className="table-wrap"><table>
            <thead><tr><th>Item</th><th>Qtd.</th><th>Un.</th><th></th></tr></thead>
            <tbody>{itens.map((item,i)=>(
              <tr key={i}><td style={{fontWeight:500}}>{item.nome}</td><td>{item.qtd}</td><td>{item.un}</td>
                <td><button className="btn btn-sm" style={{color:"var(--vermelho)"}} onClick={()=>setItens(p=>p.filter((_,j)=>j!==i))}>✕</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}

        {/* Cotação (gestor/encarregado) */}
        {isGestor&&(
          <>
            <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Cotação e fornecedor</div>
            <div className="form-grid">
              <div className="form-group"><label>Fornecedor</label>
                <select value={form.fornecedorId} onChange={e=>set("fornecedorId",e.target.value)}>
                  <option value="">Selecione...</option>
                  {fornecedores.filter(f=>f.status==="ATIVO").map(f=><option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Valor cotado (R$)</label><input type="number" value={form.valorCotado} onChange={e=>set("valorCotado",e.target.value)}/></div>
              <div className="form-group"><label>Valor aprovado (R$)</label><input type="number" value={form.valorAprovado} onChange={e=>set("valorAprovado",e.target.value)}/></div>
              <div className="form-group"><label>Forma de pagamento</label>
                <select value={form.formaPagamento} onChange={e=>set("formaPagamento",e.target.value)}>
                  <option value="">Selecione...</option>
                  {["À vista","30 dias","30/60","30/60/90","Boleto","PIX"].map(f=><option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Prazo de entrega (data)</label><input type="date" value={form.prazoEntrega} onChange={e=>set("prazoEntrega",e.target.value)}/></div>
              <div className="form-group"><label>Nº do pedido / OC</label><input value={form.numeroPedido} onChange={e=>set("numeroPedido",e.target.value)}/></div>
            </div>
          </>
        )}

        {/* Recebimento e NF */}
        {(form.status==="RECEBIDO"||form.status==="NF VINCULADA"||isGestor)&&(
          <>
            <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Recebimento e nota fiscal</div>
            <div className="form-grid">
              <div className="form-group"><label>Data de recebimento</label><input type="date" value={form.dataRecebimento} onChange={e=>set("dataRecebimento",e.target.value)}/></div>
              <div className="form-group"><label>Número da NF</label><input value={form.numeroNF} onChange={e=>set("numeroNF",e.target.value)} placeholder="Ex: NF-4521"/></div>
              <div className="form-group"><label>Valor da NF (R$)</label><input type="number" value={form.valorNF} onChange={e=>set("valorNF",e.target.value)}/></div>
            </div>
          </>
        )}

        <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/></div>
      </div>
    </Modal>
  );
}

export default function Compras() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [compras,      setCompras]      = useState([]);
  const [obras,        setObras]        = useState([]);
  const [manutencoes,  setManutencoes]  = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filtro,       setFiltro]       = useState("todas");
  const [modal,        setModal]        = useState(null);
  const [vista,        setVista]        = useState("lista"); // "lista" | "kanban"

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"compras"),snap=>{const d=snap.docs.map(x=>({id:x.id,...x.data()}));d.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));setCompras(d);setLoading(false);});
    const u2=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"manutencoes"),snap=>setManutencoes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4=onSnapshot(collection(db,"fornecedores"),snap=>setFornecedores(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();u4();};
  },[]);

  const filtered=compras.filter(c=>{
    const q=search.toLowerCase();
    const mQ=!q||c.titulo?.toLowerCase().includes(q)||c.demandaNome?.toLowerCase().includes(q)||c.fornecedorNome?.toLowerCase().includes(q);
    const mF=filtro==="todas"||c.status===filtro;
    return mQ&&mF;
  });

  // KPIs
  const solicit=compras.filter(c=>c.status==="SOLICITAÇÃO").length;
  const cotacao=compras.filter(c=>c.status==="COTAÇÃO").length;
  const aprovadas=compras.filter(c=>c.status==="APROVADA").length;
  const totalComprom=compras.filter(c=>["APROVADA","ORDEM DE COMPRA"].includes(c.status)).reduce((s,c)=>s+(Number(c.valorAprovado)||0),0);

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div><div className="panel-title">Painel de Compras</div><div style={{fontSize:12,color:"#7A7A7A"}}>{compras.length} solicitações</div></div>
        <div style={{display:"flex",gap:8}}>
          <div style={{display:"flex",border:"1px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
            <button className="btn btn-sm" style={{borderRadius:0,border:"none",background:vista==="lista"?"#1A1A1A":"",color:vista==="lista"?"#F5C800":""}} onClick={()=>setVista("lista")}>Lista</button>
            <button className="btn btn-sm" style={{borderRadius:0,border:"none",background:vista==="kanban"?"#1A1A1A":"",color:vista==="kanban"?"#F5C800":""}} onClick={()=>setVista("kanban")}>Kanban</button>
          </div>
          <button className="btn btn-primary" onClick={()=>setModal({compra:null})}>+ Nova solicitação</button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric"><div className="metric-label">Aguardando cotação</div><div className="metric-value amber">{solicit}</div></div>
        <div className="metric"><div className="metric-label">Em cotação</div><div className="metric-value" style={{color:"#185FA5"}}>{cotacao}</div></div>
        <div className="metric"><div className="metric-label">Aprovadas</div><div className="metric-value yellow">{aprovadas}</div></div>
        <div className="metric"><div className="metric-label">Valor comprometido</div><div className="metric-value red" style={{fontSize:18}}>R$ {totalComprom.toLocaleString("pt-BR",{minimumFractionDigits:2})}</div></div>
      </div>

      {/* Jornada visual */}
      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {[["todas","Todas"],["SOLICITAÇÃO","Solicitações"],["COTAÇÃO","Cotação"],["APROVADA","Aprovadas"],["ORDEM DE COMPRA","OC"],["RECEBIDO","Recebido"],["NF VINCULADA","NF OK"]].map(([v,l])=>(
          <button key={v} className={`chip ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)} style={{whiteSpace:"nowrap"}}>
            {l} ({v==="todas"?compras.length:compras.filter(c=>c.status===v).length})
          </button>
        ))}
      </div>

      <div className="search-bar">🔍<input placeholder="Buscar por título, obra, manutenção ou fornecedor..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {loading&&<div className="spinner"/>}
      {!loading&&filtered.length===0&&<div className="empty-state"><div className="empty-icon">🛒</div><p>Nenhuma compra encontrada</p></div>}
      {!loading&&filtered.length>0&&(
        <div className="table-wrap">
          <table>
            <thead><tr><th>Título</th><th>Vinculado a</th><th>Urgência</th><th>Fornecedor</th><th>Valor cotado</th><th>Valor NF</th><th>Entrega</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(c=>(
                <tr key={c.id}>
                  <td><div style={{fontWeight:600}}>{c.titulo}</div><div style={{fontSize:11,color:"#7A7A7A"}}>{c.autorNome}</div></td>
                  <td style={{fontSize:12}}>{c.demandaNome||c.demandaTipo}</td>
                  <td><span className={`badge ${c.urgencia==="urgente"?"badge-red":c.urgencia==="alta"?"badge-amber":"badge-gray"}`} style={{fontSize:10}}>{c.urgencia}</span></td>
                  <td style={{fontSize:12}}>{c.fornecedorNome||"–"}</td>
                  <td style={{fontSize:12}}>{c.valorCotado?`R$ ${Number(c.valorCotado).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"–"}</td>
                  <td style={{fontSize:12}}>{c.valorNF?`R$ ${Number(c.valorNF).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"–"}</td>
                  <td style={{fontSize:12}}>{fmtDate(c.prazoEntrega)}</td>
                  <td><span className={`badge ${STATUS_COLOR[c.status]||"badge-gray"}`} style={{fontSize:10}}>{c.status}</span></td>
                  <td><button className="btn btn-sm btn-icon" onClick={()=>setModal({compra:c})}>✏️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal&&<CompraModal compra={modal.compra} obras={obras} manutencoes={manutencoes} fornecedores={fornecedores} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
