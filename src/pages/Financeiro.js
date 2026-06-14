// src/pages/Financeiro.js — Custo por nível, contas a pagar/receber, fluxo de caixa
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

function LancamentoModal({ lanc, obras, onClose, addToast }) {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    tipo: lanc?.tipo||"PAGAR",
    descricao: lanc?.descricao||"",
    categoria: lanc?.categoria||"",
    obraId: lanc?.obraId||"",
    obraNome: lanc?.obraNome||"",
    valor: lanc?.valor||"",
    vencimento: lanc?.vencimento||"",
    pagamento: lanc?.pagamento||"",
    status: lanc?.status||"ABERTO",
    fornecedor: lanc?.fornecedor||"",
    numeroNF: lanc?.numeroNF||"",
    obs: lanc?.obs||"",
    tipoValor: lanc?.tipoValor||"realizado", // orçado | realizado | comprometido
  });
  const [saving, setSaving] = useState(false);
  function set(f,v){setForm(p=>({...p,[f]:v}));}

  function handleObra(id){
    const o=obras.find(x=>x.id===id);
    set("obraId",id); set("obraNome",o?.nome||"");
  }

  async function save(){
    if (!form.descricao||!form.valor){alert("Informe descrição e valor.");return;}
    setSaving(true);
    const agora=new Date().toISOString();
    const payload={...form,valor:Number(form.valor),updatedAt:agora};
    try{
      if(lanc?.id){await updateDoc(doc(db,"financeiro",lanc.id),payload);addToast("Lançamento atualizado!");}
      else{payload.createdAt=agora;await addDoc(collection(db,"financeiro"),payload);addToast("Lançamento criado!");}
      onClose();
    }catch(err){addToast("Erro: "+err.message,"error");}
    setSaving(false);
  }

  const CATEGORIAS_PAGAR=["Materiais","Mão de obra","Subempreiteiro","Aluguel equipamentos","Despesas administrativas","Impostos","Outros"];
  const CATEGORIAS_RECEBER=["Medição","Adiantamento contratual","Saldo contratual","Reembolso","Outros"];

  return (
    <Modal title={lanc?.id?"Editar lançamento":"Novo lançamento"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",gap:8}}>
          {["PAGAR","RECEBER"].map(t=>(
            <button key={t} onClick={()=>set("tipo",t)} className="btn"
              style={{flex:1,justifyContent:"center",background:form.tipo===t?"#1A1A1A":"",color:form.tipo===t?"#F5C800":"",borderColor:form.tipo===t?"#1A1A1A":""}}>
              {t==="PAGAR"?"📤 A Pagar":"📥 A Receber"}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <div className="form-group span-2"><label className="required">Descrição</label><input value={form.descricao} onChange={e=>set("descricao",e.target.value)} placeholder="Ex: Pagamento subempreiteiro elétrica"/></div>
          <div className="form-group"><label>Categoria</label>
            <select value={form.categoria} onChange={e=>set("categoria",e.target.value)}>
              <option value="">Selecione...</option>
              {(form.tipo==="PAGAR"?CATEGORIAS_PAGAR:CATEGORIAS_RECEBER).map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Tipo de valor</label>
            <select value={form.tipoValor} onChange={e=>set("tipoValor",e.target.value)}>
              <option value="orcado">Orçado</option>
              <option value="comprometido">Comprometido</option>
              <option value="realizado">Realizado</option>
            </select>
          </div>
          <div className="form-group"><label className="required">Valor (R$)</label><input type="number" value={form.valor} onChange={e=>set("valor",e.target.value)} placeholder="0,00"/></div>
          <div className="form-group"><label>Obra / projeto</label>
            <select value={form.obraId} onChange={e=>handleObra(e.target.value)}>
              <option value="">Geral (sem obra)</option>
              {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="required">Vencimento</label><input type="date" value={form.vencimento} onChange={e=>set("vencimento",e.target.value)}/></div>
          <div className="form-group"><label>Data de pagamento</label><input type="date" value={form.pagamento} onChange={e=>set("pagamento",e.target.value)}/></div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {["ABERTO","PAGO","VENCIDO","CANCELADO"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Fornecedor / cliente</label><input value={form.fornecedor} onChange={e=>set("fornecedor",e.target.value)}/></div>
          <div className="form-group"><label>Nº NF / documento</label><input value={form.numeroNF} onChange={e=>set("numeroNF",e.target.value)}/></div>
        </div>
        <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/></div>
      </div>
    </Modal>
  );
}

export default function Financeiro() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [lancs,   setLancs]   = useState([]);
  const [obras,   setObras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [aba,     setAba]     = useState("fluxo");
  const [filtro,  setFiltro]  = useState("todos");
  const [search,  setSearch]  = useState("");
  const [obraFiltro, setObraFiltro] = useState("");
  const [modal,   setModal]   = useState(null);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"financeiro"),snap=>{
      const d=snap.docs.map(x=>({id:x.id,...x.data()}));
      d.sort((a,b)=>(a.vencimento||"").localeCompare(b.vencimento||""));
      setLancs(d);setLoading(false);
    });
    const u2=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();};
  },[]);

  const hoje = new Date().toISOString().split("T")[0];

  // Filtros
  const filtered=lancs.filter(l=>{
    const q=search.toLowerCase();
    const mQ=!q||l.descricao?.toLowerCase().includes(q)||l.fornecedor?.toLowerCase().includes(q)||l.obraNome?.toLowerCase().includes(q);
    const mT=filtro==="todos"||(filtro==="pagar"&&l.tipo==="PAGAR")||(filtro==="receber"&&l.tipo==="RECEBER")||(filtro==="vencido"&&l.status==="ABERTO"&&l.vencimento<hoje);
    const mO=!obraFiltro||l.obraId===obraFiltro;
    return mQ&&mT&&mO;
  });

  // KPIs
  const totalPagar    = lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="ABERTO").reduce((s,l)=>s+(l.valor||0),0);
  const totalReceber  = lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="ABERTO").reduce((s,l)=>s+(l.valor||0),0);
  const totalVencido  = lancs.filter(l=>l.status==="ABERTO"&&l.vencimento<hoje).reduce((s,l)=>s+(l.valor||0),0);
  const saldo         = totalReceber - totalPagar;

  // Custo por nível por obra
  const custoPorObra = obras.map(o=>{
    const lancObra = lancs.filter(l=>l.obraId===o.id&&l.tipo==="PAGAR");
    const orcado      = lancObra.filter(l=>l.tipoValor==="orcado").reduce((s,l)=>s+(l.valor||0),0);
    const comprometido= lancObra.filter(l=>l.tipoValor==="comprometido").reduce((s,l)=>s+(l.valor||0),0);
    const realizado   = lancObra.filter(l=>l.tipoValor==="realizado"&&l.status==="PAGO").reduce((s,l)=>s+(l.valor||0),0);
    return {...o,orcado,comprometido,realizado};
  }).filter(o=>o.orcado>0||o.realizado>0||o.comprometido>0);

  // Aging contas a receber
  const aging = [
    {label:"A vencer",filter:l=>l.tipo==="RECEBER"&&l.status==="ABERTO"&&l.vencimento>=hoje,color:"badge-green"},
    {label:"Vencido 1-30d",filter:l=>l.tipo==="RECEBER"&&l.status==="ABERTO"&&l.vencimento<hoje&&daysDiff(l.vencimento)<=30,color:"badge-amber"},
    {label:"Vencido 31-60d",filter:l=>l.tipo==="RECEBER"&&l.status==="ABERTO"&&daysDiff(l.vencimento)>30&&daysDiff(l.vencimento)<=60,color:"badge-red"},
    {label:"Acima 60d",filter:l=>l.tipo==="RECEBER"&&l.status==="ABERTO"&&daysDiff(l.vencimento)>60,color:"badge-red"},
  ];
  function daysDiff(d){return Math.floor((new Date()-new Date(d))/86400000);}

  const statusBadge={ABERTO:"badge-blue",PAGO:"badge-green",VENCIDO:"badge-red",CANCELADO:"badge-gray"};

  const fmt=(v)=>`R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div><div className="panel-title">Financeiro</div><div style={{fontSize:12,color:"#7A7A7A"}}>{lancs.length} lançamentos</div></div>
        <button className="btn btn-primary" onClick={()=>setModal({lanc:null})}>+ Lançamento</button>
      </div>

      <div className="metrics-grid">
        <div className="metric"><div className="metric-label">A pagar (aberto)</div><div className="metric-value red" style={{fontSize:18}}>{fmt(totalPagar)}</div></div>
        <div className="metric"><div className="metric-label">A receber (aberto)</div><div className="metric-value green" style={{fontSize:18}}>{fmt(totalReceber)}</div></div>
        <div className="metric"><div className="metric-label">Saldo projetado</div><div className="metric-value" style={{fontSize:18,color:saldo>=0?"var(--verde)":"var(--vermelho)"}}>{fmt(saldo)}</div></div>
        <div className="metric"><div className="metric-label">Vencidos (total)</div><div className="metric-value red" style={{fontSize:18}}>{fmt(totalVencido)}</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${aba==="fluxo"?"active":""}`} onClick={()=>setAba("fluxo")}>Lançamentos</button>
        <button className={`tab ${aba==="custo"?"active":""}`} onClick={()=>setAba("custo")}>Custo por nível</button>
        <button className={`tab ${aba==="aging"?"active":""}`} onClick={()=>setAba("aging")}>Aging — A receber</button>
      </div>

      {aba==="fluxo"&&(
        <>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <div className="chip-row" style={{margin:0,flex:1}}>
              {[["todos","Todos"],["pagar","A pagar"],["receber","A receber"],["vencido","Vencidos"]].map(([v,l])=>(
                <button key={v} className={`chip ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)}>{l}</button>
              ))}
            </div>
            <select value={obraFiltro} onChange={e=>setObraFiltro(e.target.value)} style={{padding:"5px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:12}}>
              <option value="">Todas as obras</option>
              {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div className="search-bar">🔍<input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {loading&&<div className="spinner"/>}
          {!loading&&(
            <div className="table-wrap">
              <table>
                <thead><tr><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Obra</th><th>Nível</th><th>Valor</th><th>Vencimento</th><th>Pgto</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(l=>(
                    <tr key={l.id} style={{background:l.status==="ABERTO"&&l.vencimento<hoje?"rgba(184,50,50,.04)":""}}>
                      <td><span className={`badge ${l.tipo==="PAGAR"?"badge-red":"badge-green"}`} style={{fontSize:10}}>{l.tipo==="PAGAR"?"📤 Pagar":"📥 Receber"}</span></td>
                      <td><div style={{fontWeight:500,fontSize:13}}>{l.descricao}</div><div style={{fontSize:11,color:"#7A7A7A"}}>{l.fornecedor}</div></td>
                      <td style={{fontSize:12}}>{l.categoria||"–"}</td>
                      <td style={{fontSize:12}}>{l.obraNome||"Geral"}</td>
                      <td><span className="badge badge-gray" style={{fontSize:10}}>{l.tipoValor}</span></td>
                      <td style={{fontWeight:700,color:l.tipo==="PAGAR"?"var(--vermelho)":"var(--verde)"}}>{fmt(l.valor)}</td>
                      <td style={{fontSize:12,color:l.status==="ABERTO"&&l.vencimento<hoje?"var(--vermelho)":"inherit",fontWeight:l.status==="ABERTO"&&l.vencimento<hoje?700:400}}>{fmtDate(l.vencimento)}</td>
                      <td style={{fontSize:12}}>{fmtDate(l.pagamento)}</td>
                      <td><span className={`badge ${statusBadge[l.status]||"badge-gray"}`}>{l.status}</span></td>
                      <td><button className="btn btn-sm btn-icon" onClick={()=>setModal({lanc:l})}>✏️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aba==="custo"&&(
        <div>
          {custoPorObra.length===0&&<div className="empty-state"><div className="empty-icon">📊</div><p>Nenhum custo lançado por obra ainda</p></div>}
          {custoPorObra.map(o=>{
            const desvio=o.realizado-o.orcado;
            const pctReal=o.orcado>0?Math.round(o.realizado/o.orcado*100):0;
            return(
              <div key={o.id} className="card" style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div><div style={{fontWeight:600,fontSize:14}}>{o.nome}</div><div style={{fontSize:12,color:"#7A7A7A"}}>{o.cliente}</div></div>
                  <span className={`badge ${desvio>0?"badge-red":desvio<0?"badge-green":"badge-gray"}`}>{desvio>0?"⚠ Acima do orçado":desvio<0?"✓ Dentro do orçado":"No orçado"}</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                  {[["Orçado",o.orcado,"#7A7A7A"],["Comprometido",o.comprometido,"#B8820A"],["Realizado",o.realizado,o.realizado>o.orcado?"var(--vermelho)":"var(--verde)"]].map(([l,v,c])=>(
                    <div key={l} style={{textAlign:"center",padding:"10px",background:"var(--cinza-lt)",borderRadius:8}}>
                      <div style={{fontSize:11,color:"#7A7A7A",marginBottom:4}}>{l}</div>
                      <div style={{fontSize:16,fontWeight:700,color:c}}>{fmt(v)}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#7A7A7A",marginBottom:3}}>
                    <span>Realizado vs Orçado</span><span>{pctReal}%</span>
                  </div>
                  <div className="progress-bar" style={{height:8}}>
                    <div className="progress-fill" style={{width:`${Math.min(pctReal,100)}%`,background:pctReal>100?"var(--vermelho)":pctReal>80?"var(--afine-yellow-dk)":"var(--verde)"}}/>
                  </div>
                </div>
                {desvio!==0&&<div style={{fontSize:12,color:desvio>0?"var(--vermelho)":"var(--verde)",fontWeight:600,textAlign:"right"}}>Desvio: {desvio>0?"+":""}{fmt(desvio)}</div>}
              </div>
            );
          })}
        </div>
      )}

      {aba==="aging"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:20}}>
            {aging.map(a=>{
              const items=lancs.filter(a.filter);
              const total=items.reduce((s,l)=>s+(l.valor||0),0);
              return(
                <div key={a.label} className="metric">
                  <div className="metric-label">{a.label}</div>
                  <div style={{fontSize:16,fontWeight:700,marginBottom:2}}>{fmt(total)}</div>
                  <div style={{fontSize:11,color:"#7A7A7A"}}>{items.length} lançamento(s)</div>
                </div>
              );
            })}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Descrição</th><th>Obra</th><th>Valor</th><th>Vencimento</th><th>Dias em atraso</th><th></th></tr></thead>
              <tbody>
                {lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="ABERTO").sort((a,b)=>a.vencimento?.localeCompare(b.vencimento||"")).map(l=>{
                  const atraso=daysDiff(l.vencimento);
                  return(
                    <tr key={l.id}>
                      <td><div style={{fontWeight:500}}>{l.descricao}</div><div style={{fontSize:11,color:"#7A7A7A"}}>{l.fornecedor}</div></td>
                      <td style={{fontSize:12}}>{l.obraNome||"Geral"}</td>
                      <td style={{fontWeight:700,color:"var(--verde)"}}>{fmt(l.valor)}</td>
                      <td style={{fontSize:12,color:l.vencimento<hoje?"var(--vermelho)":"inherit"}}>{fmtDate(l.vencimento)}</td>
                      <td>{l.vencimento<hoje?<span style={{color:"var(--vermelho)",fontWeight:700}}>{atraso}d em atraso</span>:<span style={{color:"var(--verde)"}}>A vencer</span>}</td>
                      <td><button className="btn btn-sm btn-icon" onClick={()=>setModal({lanc:l})}>✏️</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
