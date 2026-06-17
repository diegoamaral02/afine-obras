// src/pages/Financeiro.js — v3: rico em informações para equipe financeira
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";

// ── Constantes ────────────────────────────────────────────────────────────────
const CATS_PAGAR   = ["Materiais","Mão de obra","Subempreiteiro","Aluguel equipamentos","Serviços terceiros","Despesas viagem","Impressos","Combustível","Despesas administrativas","Impostos / Taxas","Honorários","Outros"];
const CATS_RECEBER = ["Medição / BM","Adiantamento contratual","Saldo contratual","Reembolso despesas","Bônus / Prêmio","Outros"];
const FORMAS_PAG   = ["Boleto","PIX","Transferência","Débito automático","Dinheiro","Cheque","Cartão"];

const STATUS_COR  = { ABERTO:"#BA7517",PAGO:"#2D6A1F",RECEBIDO:"#2D6A1F",VENCIDO:"#B83232",PARCIAL:"#C9A200",CANCELADO:"#7A7A7A" };
const STATUS_BG   = { ABERTO:"var(--afine-yellow-lt)",PAGO:"var(--verde-lt)",RECEBIDO:"var(--verde-lt)",VENCIDO:"var(--vermelho-lt)",PARCIAL:"rgba(201,162,0,.12)",CANCELADO:"var(--cinza-lt)" };

// ── Utilitários ───────────────────────────────────────────────────────────────
const fmt     = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const fmtK    = v => { const n=Number(v||0); return n>=1000000?`R$ ${(n/1000000).toFixed(1)}M`:n>=1000?`R$ ${(n/1000).toFixed(1)}k`:`R$ ${n.toFixed(0)}`; };
const pctN    = (v,t) => t>0?Math.round(v/t*100):0;
const daysDiff= v => v ? Math.floor((new Date()-new Date(v+"T12:00"))/86400000) : 0;
const hoje    = () => new Date().toISOString().split("T")[0];
const mesAtual= () => new Date().toISOString().slice(0,7);

// ── Modal de Lançamento ───────────────────────────────────────────────────────
function LancamentoModal({ lanc, obras, onClose, addToast }) {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    tipo:        lanc?.tipo        || "PAGAR",
    descricao:   lanc?.descricao   || "",
    categoria:   lanc?.categoria   || "",
    obraId:      lanc?.obraId      || "",
    obraNome:    lanc?.obraNome    || "",
    valor:       lanc?.valor       || "",
    valorPago:   lanc?.valorPago   || "",
    vencimento:  lanc?.vencimento  || "",
    pagamento:   lanc?.pagamento   || "",
    competencia: lanc?.competencia || mesAtual(),
    status:      lanc?.status      || "ABERTO",
    fornecedor:  lanc?.fornecedor  || "",
    cnpj:        lanc?.cnpj        || "",
    numeroNF:    lanc?.numeroNF    || "",
    formaPag:    lanc?.formaPag    || "",
    centroCusto: lanc?.centroCusto || "",
    tipoValor:   lanc?.tipoValor   || "realizado",
    recorrente:  lanc?.recorrente  || false,
    obs:         lanc?.obs         || "",
  });
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }
  function handleObra(id) { const o=obras.find(x=>x.id===id); set("obraId",id); set("obraNome",o?.nome||""); }

  // Auto-detectar vencido
  useEffect(()=>{ if(form.status==="ABERTO"&&form.vencimento&&form.vencimento<hoje()) set("status","VENCIDO"); },[form.vencimento]);

  async function save() {
    if(!form.descricao||!form.valor){alert("Informe descrição e valor.");return;}
    if(!form.vencimento){alert("Informe a data de vencimento.");return;}
    setSaving(true);
    const agora=new Date().toISOString();
    const payload={...form,valor:Number(form.valor),valorPago:Number(form.valorPago)||0,updatedAt:agora,autorNome:userProfile?.nome||"–"};
    try {
      if(lanc?.id){await updateDoc(doc(db,"financeiro",lanc.id),payload);addToast("✓ Atualizado!");}
      else{payload.createdAt=agora;await addDoc(collection(db,"financeiro"),payload);addToast("✓ Lançamento criado!");}
      onClose();
    }catch(err){addToast("Erro: "+err.message,"error");}
    setSaving(false);
  }

  async function marcarPago() {
    if(!lanc?.id) return;
    setSaving(true);
    const s=form.tipo==="PAGAR"?"PAGO":"RECEBIDO";
    try { await updateDoc(doc(db,"financeiro",lanc.id),{status:s,pagamento:hoje(),valorPago:Number(form.valor),updatedAt:new Date().toISOString()}); addToast(`✓ ${s}`); onClose(); }
    catch(err){addToast("Erro: "+err.message,"error");}
    setSaving(false);
  }

  return (
    <Modal title={lanc?.id?"Editar lançamento":"Novo lançamento"} onClose={onClose}
      footer={
        <div style={{display:"flex",gap:8,justifyContent:"space-between",width:"100%"}}>
          <div style={{display:"flex",gap:6}}>
            {lanc?.id&&["ABERTO","VENCIDO"].includes(form.status)&&(
              <button className="btn btn-primary" onClick={marcarPago} disabled={saving}
                style={{background:"var(--verde)",borderColor:"var(--verde)"}}>
                {form.tipo==="PAGAR"?"✓ Marcar pago":"✓ Marcar recebido"}
              </button>
            )}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button>
          </div>
        </div>
      }>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {/* Tipo */}
        <div style={{display:"flex",gap:8}}>
          {[["PAGAR","📤 A Pagar"],["RECEBER","📥 A Receber"]].map(([t,l])=>(
            <button key={t} onClick={()=>set("tipo",t)} className="btn"
              style={{flex:1,justifyContent:"center",
                background:form.tipo===t?(t==="PAGAR"?"#B83232":"#2D6A1F"):"",
                color:form.tipo===t?"#fff":"",
                borderColor:form.tipo===t?(t==="PAGAR"?"#B83232":"#2D6A1F"):""}}>
              {l}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <div className="form-group span-2">
            <label className="required">Descrição</label>
            <input value={form.descricao} onChange={e=>set("descricao",e.target.value)} placeholder="Ex: Medição BM-03 — AG 0442"/>
          </div>
          <div className="form-group">
            <label>Categoria</label>
            <select value={form.categoria} onChange={e=>set("categoria",e.target.value)}>
              <option value="">Selecione...</option>
              {(form.tipo==="PAGAR"?CATS_PAGAR:CATS_RECEBER).map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Obra / Centro de custo</label>
            <select value={form.obraId} onChange={e=>handleObra(e.target.value)}>
              <option value="">Geral (sem obra)</option>
              {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="required">Valor (R$)</label>
            <input type="number" value={form.valor} onChange={e=>set("valor",e.target.value)} placeholder="0,00"/>
          </div>
          <div className="form-group">
            <label>Valor pago/recebido (R$)</label>
            <input type="number" value={form.valorPago} onChange={e=>set("valorPago",e.target.value)} placeholder="Para pagamentos parciais"/>
          </div>
          <div className="form-group">
            <label className="required">Vencimento</label>
            <input type="date" value={form.vencimento} onChange={e=>set("vencimento",e.target.value)}/>
          </div>
          <div className="form-group">
            <label>Competência (mês)</label>
            <input type="month" value={form.competencia} onChange={e=>set("competencia",e.target.value)}/>
          </div>
          <div className="form-group">
            <label>Data pagamento / recebimento</label>
            <input type="date" value={form.pagamento} onChange={e=>set("pagamento",e.target.value)}/>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}
              style={{background:STATUS_BG[form.status]||"",color:STATUS_COR[form.status]||"",fontWeight:600}}>
              {["ABERTO","PAGO","RECEBIDO","VENCIDO","PARCIAL","CANCELADO"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Forma de pagamento</label>
            <select value={form.formaPag} onChange={e=>set("formaPag",e.target.value)}>
              <option value="">Selecione...</option>
              {FORMAS_PAG.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fornecedor / Cliente</label>
            <input value={form.fornecedor} onChange={e=>set("fornecedor",e.target.value)}/>
          </div>
          <div className="form-group">
            <label>CNPJ / CPF</label>
            <input value={form.cnpj} onChange={e=>set("cnpj",e.target.value)} placeholder="00.000.000/0001-00"/>
          </div>
          <div className="form-group">
            <label>Nº NF / Documento</label>
            <input value={form.numeroNF} onChange={e=>set("numeroNF",e.target.value)}/>
          </div>
          <div className="form-group">
            <label>Tipo de valor</label>
            <select value={form.tipoValor} onChange={e=>set("tipoValor",e.target.value)}>
              <option value="orcado">Orçado</option>
              <option value="comprometido">Comprometido</option>
              <option value="realizado">Realizado</option>
            </select>
          </div>
        </div>

        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer"}}>
          <input type="checkbox" checked={form.recorrente} onChange={e=>set("recorrente",e.target.checked)} style={{width:15,height:15}}/>
          Lançamento recorrente (mensal)
        </label>
        <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/></div>
      </div>
    </Modal>
  );
}

// ── Componente Badge de status ────────────────────────────────────────────────
function StatusBadge({ status }) {
  return (
    <span style={{
      fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:10,whiteSpace:"nowrap",
      background:STATUS_BG[status]||"var(--cinza-lt)",
      color:STATUS_COR[status]||"#7A7A7A",
      border:`1px solid ${STATUS_COR[status]||"#ccc"}30`
    }}>{status}</span>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, valor, sub, cor, icon, trend, trendLabel, alerta }) {
  return (
    <div style={{background:"#fff",border:`1px solid ${alerta?"rgba(184,50,50,.3)":"var(--border)"}`,borderRadius:10,
      padding:"12px 14px",position:"relative",overflow:"hidden",
      background:alerta?"rgba(184,50,50,.03)":"#fff"}}>
      {icon&&<div style={{position:"absolute",top:10,right:12,fontSize:22,opacity:.1}}>{icon}</div>}
      <div style={{fontSize:10,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:3}}>{label}</div>
      <div style={{fontSize:18,fontWeight:700,color:cor||"#1A1A1A",lineHeight:1,marginBottom:3}}>{valor}</div>
      {trend!=null&&<div style={{fontSize:11,color:trend>0?"var(--verde)":"var(--vermelho)",fontWeight:600}}>{trend>0?"↑":"↓"} {Math.abs(trend)}% vs mês anterior</div>}
      {sub&&<div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>{sub}</div>}
    </div>
  );
}

// ── Sub-aba: Lançamentos ──────────────────────────────────────────────────────
function AbaLancamentos({ lancs, obras, addToast }) {
  const hj = hoje();
  const [filtro,      setFiltro]      = useState("todos");
  const [obraFiltro,  setObraFiltro]  = useState("");
  const [catFiltro,   setCatFiltro]   = useState("");
  const [mesFiltro,   setMesFiltro]   = useState("");
  const [search,      setSearch]      = useState("");
  const [ordem,       setOrdem]       = useState("vencimento");
  const [modal,       setModal]       = useState(null);

  const filtered = useMemo(()=>{
    const q=search.toLowerCase();
    return lancs.filter(l=>{
      const mQ=!q||l.descricao?.toLowerCase().includes(q)||l.fornecedor?.toLowerCase().includes(q)||l.obraNome?.toLowerCase().includes(q)||l.categoria?.toLowerCase().includes(q)||l.numeroNF?.toLowerCase().includes(q);
      const mT=filtro==="todos"||(filtro==="pagar"&&l.tipo==="PAGAR")||(filtro==="receber"&&l.tipo==="RECEBER")
        ||(filtro==="aberto"&&["ABERTO","VENCIDO"].includes(l.status))
        ||(filtro==="vencido"&&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hj)))
        ||(filtro==="pago"&&["PAGO","RECEBIDO"].includes(l.status))
        ||(filtro==="parcial"&&l.status==="PARCIAL");
      const mO=!obraFiltro||l.obraId===obraFiltro;
      const mC=!catFiltro||l.categoria===catFiltro;
      const mM=!mesFiltro||(l.vencimento||"").startsWith(mesFiltro);
      return mQ&&mT&&mO&&mC&&mM;
    }).sort((a,b)=>{
      if(ordem==="vencimento") return (a.vencimento||"").localeCompare(b.vencimento||"");
      if(ordem==="valor")       return (b.valor||0)-(a.valor||0);
      if(ordem==="data")        return (b.createdAt||"").localeCompare(a.createdAt||"");
      return 0;
    });
  },[lancs,filtro,obraFiltro,catFiltro,mesFiltro,search,ordem,hj]);

  const totais = useMemo(()=>({
    pagar:   filtered.filter(l=>l.tipo==="PAGAR"  &&["ABERTO","VENCIDO"].includes(l.status)).reduce((s,l)=>s+(l.valor||0),0),
    receber: filtered.filter(l=>l.tipo==="RECEBER"&&["ABERTO","VENCIDO"].includes(l.status)).reduce((s,l)=>s+(l.valor||0),0),
    pago:    filtered.filter(l=>["PAGO","RECEBIDO"].includes(l.status)).reduce((s,l)=>s+(l.valor||0),0),
  }),[filtered]);

  // Categorias disponíveis
  const cats = useMemo(()=>[...new Set(lancs.map(l=>l.categoria).filter(Boolean))].sort(),[lancs]);
  // Meses disponíveis
  const meses = useMemo(()=>[...new Set(lancs.map(l=>(l.vencimento||"").slice(0,7)).filter(Boolean))].sort().reverse().slice(0,12),[lancs]);

  const excelCols=[
    {key:"tipo",header:"Tipo"},{key:"descricao",header:"Descrição"},{key:"categoria",header:"Categoria"},
    {key:"obraNome",header:"Obra"},{key:"fornecedor",header:"Fornecedor/Cliente"},{key:"cnpj",header:"CNPJ/CPF"},
    {key:"valor",header:"Valor",format:v=>Number(v||0).toFixed(2).replace(".",",")},
    {key:"valorPago",header:"Valor Pago",format:v=>Number(v||0).toFixed(2).replace(".",",")},
    {key:"vencimento",header:"Vencimento"},{key:"pagamento",header:"Data Pgto"},
    {key:"competencia",header:"Competência"},{key:"formaPag",header:"Forma Pgto"},
    {key:"status",header:"Status"},{key:"tipoValor",header:"Tipo valor"},
    {key:"numeroNF",header:"NF"},{key:"obs",header:"Obs"},
  ];

  async function marcarRapido(l, status) {
    await updateDoc(doc(db,"financeiro",l.id),{
      status, pagamento:hoje(), valorPago:l.valor, updatedAt:new Date().toISOString()
    });
    addToast(`✓ ${status}`);
  }

  return (
    <div>
      {/* Totalizadores do filtro */}
      {(totais.pagar>0||totais.receber>0||totais.pago>0)&&(
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          {totais.pagar>0&&<span style={{background:"var(--vermelho-lt)",padding:"5px 12px",borderRadius:20,fontSize:12,color:"var(--vermelho)",fontWeight:700}}>📤 A pagar: {fmt(totais.pagar)}</span>}
          {totais.receber>0&&<span style={{background:"var(--verde-lt)",padding:"5px 12px",borderRadius:20,fontSize:12,color:"var(--verde)",fontWeight:700}}>📥 A receber: {fmt(totais.receber)}</span>}
          {totais.pago>0&&<span style={{background:"var(--cinza-lt)",padding:"5px 12px",borderRadius:20,fontSize:12,color:"#7A7A7A",fontWeight:600}}>✓ Liquidado: {fmt(totais.pago)}</span>}
        </div>
      )}

      {/* Filtros */}
      <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
        <div className="chip-row" style={{margin:0,flex:"1 1 300px",flexWrap:"wrap"}}>
          {[["todos","Todos"],["aberto","Em aberto"],["pagar","A pagar"],["receber","A receber"],["vencido","Vencidos"],["pago","Pagos"],["parcial","Parcial"]].map(([v,l])=>(
            <button key={v} className={`chip ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)}>
              {l} <span style={{opacity:.6,fontSize:10}}>({v==="todos"?lancs.length:v==="pagar"?lancs.filter(l=>l.tipo==="PAGAR").length:v==="receber"?lancs.filter(l=>l.tipo==="RECEBER").length:v==="aberto"?lancs.filter(l=>["ABERTO","VENCIDO"].includes(l.status)).length:v==="vencido"?lancs.filter(l=>l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hj)).length:v==="parcial"?lancs.filter(l=>l.status==="PARCIAL").length:lancs.filter(l=>["PAGO","RECEBIDO"].includes(l.status)).length})</span>
            </button>
          ))}
        </div>
        <BtnExcel onClick={()=>exportarExcel(filtered,"Lancamentos",excelCols)}/>
      </div>

      {/* Filtros secundários */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <select value={obraFiltro} onChange={e=>setObraFiltro(e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:12,flex:"1 1 140px"}}>
          <option value="">Todas as obras</option>
          {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select value={catFiltro} onChange={e=>setCatFiltro(e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:12,flex:"1 1 140px"}}>
          <option value="">Todas as categorias</option>
          {cats.map(c=><option key={c}>{c}</option>)}
        </select>
        <select value={mesFiltro} onChange={e=>setMesFiltro(e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:12,flex:"1 1 120px"}}>
          <option value="">Todos os meses</option>
          {meses.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <select value={ordem} onChange={e=>setOrdem(e.target.value)} style={{padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:12,flex:"1 1 120px"}}>
          <option value="vencimento">Ordenar: Vencimento</option>
          <option value="valor">Ordenar: Maior valor</option>
          <option value="data">Ordenar: Mais recente</option>
        </select>
      </div>

      <div className="search-bar">🔍<input placeholder="Descrição, fornecedor, obra, categoria, NF..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"#7A7A7A"}}>✕</button>}</div>

      {filtered.length===0&&<div className="empty-state"><div className="empty-icon">💰</div><p>Nenhum lançamento encontrado</p></div>}
      {filtered.length>0&&(
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Obra</th>
                <th>Fornecedor/Cliente</th><th>NF</th><th>Valor</th>
                <th>Vencimento</th><th>Pgto</th><th>Competência</th>
                <th>Forma Pgto</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l=>{
                const vencido=["ABERTO","VENCIDO"].includes(l.status)&&l.vencimento<hj;
                const dias=vencido?daysDiff(l.vencimento):0;
                const parcial=l.status==="PARCIAL"&&l.valorPago>0;
                return (
                  <tr key={l.id} style={{background:vencido?"rgba(184,50,50,.03)":""}}>
                    <td><span style={{fontSize:10,fontWeight:700,color:l.tipo==="PAGAR"?"var(--vermelho)":"var(--verde)"}}>{l.tipo==="PAGAR"?"📤 Pagar":"📥 Receber"}</span></td>
                    <td style={{maxWidth:180}}>
                      <div style={{fontWeight:600,fontSize:13}}>{l.descricao}</div>
                      {l.obs&&<div style={{fontSize:10,color:"#7A7A7A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:160}}>{l.obs}</div>}
                      {l.recorrente&&<span style={{fontSize:9,color:"#185FA5",fontWeight:600}}>🔄 Recorrente</span>}
                    </td>
                    <td><span style={{fontSize:11,background:"var(--cinza-lt)",padding:"2px 7px",borderRadius:10}}>{l.categoria||"–"}</span></td>
                    <td style={{fontSize:11}}>{l.obraNome||<span style={{color:"#aaa"}}>Geral</span>}</td>
                    <td style={{fontSize:11}}>
                      <div>{l.fornecedor||"–"}</div>
                      {l.cnpj&&<div style={{fontSize:10,color:"#7A7A7A"}}>{l.cnpj}</div>}
                    </td>
                    <td style={{fontSize:11}}>{l.numeroNF||"–"}</td>
                    <td style={{whiteSpace:"nowrap"}}>
                      <div style={{fontWeight:700,fontSize:14,color:l.tipo==="PAGAR"?"var(--vermelho)":"var(--verde)"}}>{fmt(l.valor)}</div>
                      {parcial&&<div style={{fontSize:10,color:"#BA7517"}}>Pago: {fmt(l.valorPago)}<br/>Saldo: {fmt((l.valor||0)-(l.valorPago||0))}</div>}
                    </td>
                    <td style={{whiteSpace:"nowrap"}}>
                      <div style={{fontSize:12,color:vencido?"var(--vermelho)":"inherit",fontWeight:vencido?700:400}}>{fmtDate(l.vencimento)}</div>
                      {vencido&&<div style={{fontSize:10,color:"var(--vermelho)",fontWeight:600}}>{dias}d atraso</div>}
                    </td>
                    <td style={{fontSize:11}}>{l.pagamento?fmtDate(l.pagamento):<span style={{color:"#aaa"}}>–</span>}</td>
                    <td style={{fontSize:11}}>{l.competencia||"–"}</td>
                    <td style={{fontSize:11}}>{l.formaPag||"–"}</td>
                    <td><StatusBadge status={l.status}/></td>
                    <td>
                      <div style={{display:"flex",gap:4}}>
                        {["ABERTO","VENCIDO"].includes(l.status)&&(
                          <button title={l.tipo==="PAGAR"?"Marcar pago":"Marcar recebido"}
                            onClick={()=>marcarRapido(l,l.tipo==="PAGAR"?"PAGO":"RECEBIDO")}
                            style={{background:"var(--verde-lt)",border:"1px solid rgba(45,106,31,.3)",borderRadius:6,cursor:"pointer",fontSize:13,padding:"3px 7px"}}>
                            ✓
                          </button>
                        )}
                        <button className="btn btn-sm btn-icon" onClick={()=>setModal({lanc:l})}>✏️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Rodapé de totais */}
            <tfoot>
              <tr style={{background:"#1A1A1A",fontWeight:700}}>
                <td colSpan={6} style={{color:"#F5C800",padding:"8px 10px"}}>TOTAL ({filtered.length} lançamentos)</td>
                <td style={{color:"#fff",padding:"8px 10px",whiteSpace:"nowrap"}}>
                  <div style={{color:"var(--vermelho-lt)",fontSize:11}}>Pagar: {fmt(filtered.filter(l=>l.tipo==="PAGAR"&&["ABERTO","VENCIDO"].includes(l.status)).reduce((s,l)=>s+(l.valor||0),0))}</div>
                  <div style={{color:"var(--verde-lt)",fontSize:11}}>Receber: {fmt(filtered.filter(l=>l.tipo==="RECEBER"&&["ABERTO","VENCIDO"].includes(l.status)).reduce((s,l)=>s+(l.valor||0),0))}</div>
                </td>
                <td colSpan={6}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// ── Sub-aba: Contas a Pagar ────────────────────────────────────────────────────
function AbaContasPagar({ lancs, obras, addToast }) {
  const hj=hoje();
  const [modal,  setModal]  = useState(null);
  const [filtro, setFiltro] = useState("aberto");

  const aberto   = lancs.filter(l=>l.tipo==="PAGAR"&&["ABERTO","VENCIDO"].includes(l.status));
  const vencido  = lancs.filter(l=>l.tipo==="PAGAR"&&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hj)));
  const pago     = lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="PAGO");
  const parcial  = lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="PARCIAL");
  const hoje7d   = new Date(); hoje7d.setDate(hoje7d.getDate()+7); const h7=hoje7d.toISOString().split("T")[0];
  const proximos = aberto.filter(l=>l.vencimento>=hj&&l.vencimento<=h7);
  const lista    = {aberto,vencido,proximo:proximos,pago,parcial}[filtro]||aberto;

  // Por categoria
  const porCat = useMemo(()=>{
    return [...new Set(aberto.map(l=>l.categoria||"Outros"))].map(cat=>({
      cat, val:aberto.filter(l=>(l.categoria||"Outros")===cat).reduce((s,l)=>s+(l.valor||0),0)
    })).sort((a,b)=>b.val-a.val);
  },[aberto]);

  async function marcar(l) {
    await updateDoc(doc(db,"financeiro",l.id),{status:"PAGO",pagamento:hj,valorPago:l.valor,updatedAt:new Date().toISOString()});
    addToast("✓ Marcado como PAGO");
  }

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:16}}>
        <KPICard label="Total a pagar"     valor={fmt(aberto.reduce((s,l)=>s+(l.valor||0),0))}    cor="var(--vermelho)" icon="📤" alerta={vencido.length>0}/>
        <KPICard label="Vencidos"           valor={fmt(vencido.reduce((s,l)=>s+(l.valor||0),0))}   cor="var(--vermelho)" sub={`${vencido.length} lançto(s)`} alerta={vencido.length>0}/>
        <KPICard label="Próximos 7 dias"    valor={fmt(proximos.reduce((s,l)=>s+(l.valor||0),0))}  cor="var(--afine-yellow-dk)" sub={`${proximos.length} vencendo`}/>
        <KPICard label="Total pago"         valor={fmt(pago.reduce((s,l)=>s+(l.valor||0),0))}      cor="var(--verde)" sub={`${pago.length} liquidados`}/>
        <KPICard label="Parcial"            valor={fmt(parcial.reduce((s,l)=>s+(l.valor||0),0))}   cor="#BA7517" sub={`${parcial.length} em aberto parcial`}/>
      </div>

      {/* Por categoria */}
      {porCat.length>0&&(
        <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12,marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Distribuição por categoria</div>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {porCat.slice(0,6).map(({cat,val})=>{
              const total=aberto.reduce((s,l)=>s+(l.valor||0),0);
              return (
                <div key={cat} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,width:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat}</span>
                  <div style={{flex:1,height:6,background:"#E0DED8",borderRadius:3,overflow:"hidden"}}>
                    <div style={{width:`${pctN(val,total)}%`,height:"100%",background:"var(--vermelho)",borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:11,fontWeight:600,color:"var(--vermelho)",width:70,textAlign:"right"}}>{fmt(val)}</span>
                  <span style={{fontSize:10,color:"#aaa",width:30}}>{pctN(val,total)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="chip-row" style={{marginBottom:10}}>
        {[["aberto","Em aberto"],["vencido","Vencidos"],["proximo","Próx. 7 dias"],["parcial","Parcial"],["pago","Pagos"]].map(([v,l])=>(
          <button key={v} className={`chip ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>

      {lista.length===0&&<div className="empty-state"><div className="empty-icon">✅</div><p>Nenhum lançamento nesta categoria</p></div>}
      {lista.sort((a,b)=>(a.vencimento||"").localeCompare(b.vencimento||"")).map(l=>{
        const venc=["ABERTO","VENCIDO"].includes(l.status)&&l.vencimento<hj;
        const dias=venc?daysDiff(l.vencimento):0;
        return (
          <div key={l.id} className="rdo-card" style={{borderLeft:`4px solid ${venc?"var(--vermelho)":l.status==="PARCIAL"?"#BA7517":"var(--afine-yellow-dk)"}`,marginBottom:8}}>
            <div className="rdo-header">
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{l.descricao}</div>
                <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>
                  {l.categoria&&<span style={{marginRight:8,background:"var(--cinza-lt)",padding:"1px 6px",borderRadius:8}}>{l.categoria}</span>}
                  {l.fornecedor&&<span>{l.fornecedor}</span>}
                  {l.cnpj&&<span style={{marginLeft:6,color:"#aaa"}}>{l.cnpj}</span>}
                  {l.obraNome&&<span style={{marginLeft:6,color:"var(--afine-yellow-dk)"}}>· {l.obraNome}</span>}
                </div>
                {l.numeroNF&&<div style={{fontSize:10,color:"#7A7A7A",marginTop:2}}>NF: {l.numeroNF}{l.formaPag&&` · ${l.formaPag}`}</div>}
                {venc&&<div style={{fontSize:11,color:"var(--vermelho)",fontWeight:700,marginTop:3}}>⚠ {dias} dia{dias>1?"s":""} em atraso</div>}
                {l.status==="PARCIAL"&&l.valorPago>0&&<div style={{fontSize:11,color:"#BA7517",marginTop:2}}>Pago: {fmt(l.valorPago)} · Saldo: {fmt((l.valor||0)-(l.valorPago||0))}</div>}
              </div>
              <div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                <div style={{fontWeight:700,fontSize:16,color:"var(--vermelho)"}}>{fmt(l.valor)}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>Vence: {fmtDate(l.vencimento)}</div>
                <StatusBadge status={l.status}/>
                <div style={{display:"flex",gap:4}}>
                  {["ABERTO","VENCIDO","PARCIAL"].includes(l.status)&&(
                    <button className="btn btn-sm" onClick={()=>marcar(l)} style={{background:"var(--verde-lt)",borderColor:"rgba(45,106,31,.3)",fontSize:11}}>✓ Pago</button>
                  )}
                  <button className="btn btn-sm btn-icon" onClick={()=>setModal({lanc:l})}>✏️</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// ── Sub-aba: Contas a Receber ─────────────────────────────────────────────────
function AbaContasReceber({ lancs, obras, addToast }) {
  const hj=hoje();
  const [modal,  setModal]  = useState(null);
  const [filtro, setFiltro] = useState("aberto");

  const aberto   = lancs.filter(l=>l.tipo==="RECEBER"&&["ABERTO","VENCIDO"].includes(l.status));
  const vencido  = lancs.filter(l=>l.tipo==="RECEBER"&&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hj)));
  const recebido = lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="RECEBIDO");
  const lista    = {aberto,vencido,recebido}[filtro]||aberto;

  const txInadim = aberto.length>0?pctN(vencido.length,aberto.length):0;
  const valInadim= vencido.reduce((s,l)=>s+(l.valor||0),0);

  // Por obra
  const porObra = useMemo(()=>{
    const ids=[...new Set(aberto.map(l=>l.obraId).filter(Boolean))];
    return ids.map(id=>({
      id, nome:aberto.find(l=>l.obraId===id)?.obraNome||"–",
      val:aberto.filter(l=>l.obraId===id).reduce((s,l)=>s+(l.valor||0),0)
    })).sort((a,b)=>b.val-a.val);
  },[aberto]);

  async function marcar(l) {
    await updateDoc(doc(db,"financeiro",l.id),{status:"RECEBIDO",pagamento:hj,valorPago:l.valor,updatedAt:new Date().toISOString()});
    addToast("✓ Marcado como RECEBIDO");
  }

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:16}}>
        <KPICard label="Total a receber"  valor={fmt(aberto.reduce((s,l)=>s+(l.valor||0),0))}   cor="var(--verde)" icon="📥"/>
        <KPICard label="Em atraso"         valor={fmt(valInadim)}  cor="var(--vermelho)" sub={`${vencido.length} lançto(s)`} alerta={valInadim>0}/>
        <KPICard label="Taxa inadimplência" valor={`${txInadim}%`} cor={txInadim>15?"var(--vermelho)":"var(--verde)"} sub="dos títulos em aberto"/>
        <KPICard label="Recebido (total)"  valor={fmt(recebido.reduce((s,l)=>s+(l.valor||0),0))} cor="var(--verde)" sub={`${recebido.length} liquidados`}/>
      </div>

      {/* Por obra */}
      {porObra.length>0&&(
        <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12,marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>A receber por obra</div>
          {porObra.map(o=>{
            const total=aberto.reduce((s,l)=>s+(l.valor||0),0);
            return (
              <div key={o.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                <span style={{fontSize:11,width:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.nome}</span>
                <div style={{flex:1,height:6,background:"#E0DED8",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:`${pctN(o.val,total)}%`,height:"100%",background:"var(--verde)",borderRadius:3}}/>
                </div>
                <span style={{fontSize:11,fontWeight:600,color:"var(--verde)",width:70,textAlign:"right"}}>{fmt(o.val)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="chip-row" style={{marginBottom:10}}>
        {[["aberto","A receber"],["vencido","Em atraso"],["recebido","Recebidos"]].map(([v,l])=>(
          <button key={v} className={`chip ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>

      {lista.length===0&&<div className="empty-state"><div className="empty-icon">📥</div><p>Nenhum lançamento</p></div>}
      {lista.sort((a,b)=>(a.vencimento||"").localeCompare(b.vencimento||"")).map(l=>{
        const venc=["ABERTO","VENCIDO"].includes(l.status)&&l.vencimento<hj;
        const dias=venc?daysDiff(l.vencimento):0;
        return (
          <div key={l.id} className="rdo-card" style={{borderLeft:`4px solid ${venc?"var(--vermelho)":"var(--verde)"}`,marginBottom:8}}>
            <div className="rdo-header">
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{l.descricao}</div>
                <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>
                  {l.categoria&&<span style={{marginRight:8,background:"var(--cinza-lt)",padding:"1px 6px",borderRadius:8}}>{l.categoria}</span>}
                  {l.fornecedor&&<span>{l.fornecedor}</span>}
                  {l.obraNome&&<span style={{marginLeft:6,color:"var(--afine-yellow-dk)"}}>· {l.obraNome}</span>}
                </div>
                {venc&&<div style={{fontSize:11,color:"var(--vermelho)",fontWeight:700,marginTop:3}}>⚠ {dias} dia{dias>1?"s":""} em atraso</div>}
              </div>
              <div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                <div style={{fontWeight:700,fontSize:16,color:"var(--verde)"}}>{fmt(l.valor)}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>Vence: {fmtDate(l.vencimento)}</div>
                <StatusBadge status={l.status}/>
                <div style={{display:"flex",gap:4}}>
                  {["ABERTO","VENCIDO"].includes(l.status)&&<button className="btn btn-sm" onClick={()=>marcar(l)} style={{background:"var(--verde-lt)",borderColor:"rgba(45,106,31,.3)",fontSize:11}}>✓ Recebido</button>}
                  <button className="btn btn-sm btn-icon" onClick={()=>setModal({lanc:l})}>✏️</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// ── Sub-aba: Fluxo de Caixa ───────────────────────────────────────────────────
function AbaFluxoCaixa({ lancs }) {
  const hj = hoje();
  const meses = useMemo(()=>{
    return Array.from({length:12},(_,i)=>{
      const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-3+i);
      const m=d.toISOString().slice(0,7);
      const l=lancs.filter(x=>(x.vencimento||"").startsWith(m));
      const rec    =l.filter(x=>x.tipo==="RECEBER").reduce((s,x)=>s+(x.valor||0),0);
      const pag    =l.filter(x=>x.tipo==="PAGAR").reduce((s,x)=>s+(x.valor||0),0);
      const recReal=l.filter(x=>x.tipo==="RECEBER"&&x.status==="RECEBIDO").reduce((s,x)=>s+(x.valor||0),0);
      const pagReal=l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO").reduce((s,x)=>s+(x.valor||0),0);
      const nf=lancs.filter(x=>x.tipo==="PAGAR"&&(x.numeroNF)&&(x.vencimento||"").startsWith(m)).length;
      return {mes:["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.getMonth()]+" "+(d.getFullYear()%100),m,rec,pag,saldo:rec-pag,recReal,pagReal,saldoReal:recReal-pagReal,nf,isPast:m<hj.slice(0,7),isCurrent:m===hj.slice(0,7)};
    });
  },[lancs]);

  const maxVal=useMemo(()=>Math.max(...meses.map(m=>Math.max(m.rec,m.pag)),1),[meses]);
  const H=90;
  const saldoAcum = meses.reduce((acc,m,i)=>{ acc.push((acc[i-1]||0)+m.saldoReal); return acc; },[]);

  return (
    <div>
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>📊 Fluxo projetado vs realizado — 12 meses</div>
        <div style={{fontSize:11,color:"#7A7A7A",marginBottom:16}}>3 meses atrás + mês atual + 8 meses à frente</div>
        <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:4}}>
          {meses.map((m,i)=>(
            <div key={i} style={{flex:"0 0 68px",display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div style={{display:"flex",gap:2,alignItems:"flex-end",height:H,marginBottom:4}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                  <div title={`Rec. previsto: ${fmt(m.rec)}`} style={{width:13,background:"var(--verde)",borderRadius:"3px 3px 0 0",opacity:.35,height:`${Math.max(2,m.rec/maxVal*H)}px`}}/>
                  {m.recReal>0&&<div title={`Rec. realizado: ${fmt(m.recReal)}`} style={{width:13,background:"var(--verde)",borderRadius:"3px 3px 0 0",height:`${Math.max(2,m.recReal/maxVal*H)}px`}}/>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                  <div title={`Pag. previsto: ${fmt(m.pag)}`} style={{width:13,background:"var(--vermelho)",borderRadius:"3px 3px 0 0",opacity:.35,height:`${Math.max(2,m.pag/maxVal*H)}px`}}/>
                  {m.pagReal>0&&<div title={`Pag. realizado: ${fmt(m.pagReal)}`} style={{width:13,background:"var(--vermelho)",borderRadius:"3px 3px 0 0",height:`${Math.max(2,m.pagReal/maxVal*H)}px`}}/>}
                </div>
              </div>
              <div style={{fontSize:9,color:m.isCurrent?"var(--afine-yellow-dk)":"#7A7A7A",fontWeight:m.isCurrent?700:400,textAlign:"center",lineHeight:1.2}}>{m.mes}</div>
              <div style={{fontSize:8,fontWeight:700,color:m.saldo>=0?"var(--verde)":"var(--vermelho)",marginTop:2}}>{m.saldo>=0?"+":""}{(m.saldo/1000).toFixed(0)}k</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap",fontSize:11}}>
          {[["var(--verde)",.35,"Rec. previsto"],["var(--verde)",1,"Rec. realizado"],["var(--vermelho)",.35,"Pag. previsto"],["var(--vermelho)",1,"Pag. realizado"]].map(([cor,op,label])=>(
            <span key={label} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:cor,borderRadius:2,display:"inline-block",opacity:op}}/>{label}</span>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Prev. Receber</th><th>Real. Recebido</th>
              <th>Prev. Pagar</th><th>Real. Pago</th>
              <th>Saldo prev.</th><th>Saldo real.</th>
              <th>Saldo acum.</th><th>NFs no mês</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m,i)=>(
              <tr key={i} style={{background:m.isCurrent?"rgba(245,200,0,.04)":"",fontWeight:m.isCurrent?600:400}}>
                <td>{m.isCurrent?"→ ":""}{m.mes}</td>
                <td style={{color:"var(--verde)"}}>{m.rec>0?fmt(m.rec):"–"}</td>
                <td style={{color:"var(--verde)",fontWeight:700}}>{m.recReal>0?fmt(m.recReal):"–"}</td>
                <td style={{color:"var(--vermelho)"}}>{m.pag>0?fmt(m.pag):"–"}</td>
                <td style={{color:"var(--vermelho)",fontWeight:700}}>{m.pagReal>0?fmt(m.pagReal):"–"}</td>
                <td style={{color:m.saldo>=0?"var(--verde)":"var(--vermelho)",fontWeight:600}}>{m.saldo!==0?fmt(m.saldo):"–"}</td>
                <td style={{color:m.saldoReal>=0?"var(--verde)":"var(--vermelho)",fontWeight:700}}>{m.saldoReal!==0?fmt(m.saldoReal):"–"}</td>
                <td style={{color:saldoAcum[i]>=0?"var(--verde)":"var(--vermelho)",fontWeight:700}}>{fmt(saldoAcum[i])}</td>
                <td style={{fontSize:11,textAlign:"center"}}>{m.nf>0?`${m.nf} NF`:"–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-aba: Custo por Obra ───────────────────────────────────────────────────
function AbaCustoObra({ lancs, obras, addToast }) {
  const hj=hoje();
  const [modal, setModal] = useState(null);
  const custoObras = useMemo(()=>{
    return obras.map(o=>{
      const l=lancs.filter(x=>x.obraId===o.id);
      const orcado      =l.filter(x=>x.tipoValor==="orcado"&&x.tipo==="PAGAR").reduce((s,x)=>s+(x.valor||0),0);
      const comprometido=l.filter(x=>x.tipoValor==="comprometido"&&x.tipo==="PAGAR").reduce((s,x)=>s+(x.valor||0),0);
      const realizado   =l.filter(x=>x.tipoValor==="realizado"&&x.tipo==="PAGAR"&&x.status==="PAGO").reduce((s,x)=>s+(x.valor||0),0);
      const recebido    =l.filter(x=>x.tipo==="RECEBER"&&x.status==="RECEBIDO").reduce((s,x)=>s+(x.valor||0),0);
      const aReceber    =l.filter(x=>x.tipo==="RECEBER"&&["ABERTO","VENCIDO"].includes(x.status)).reduce((s,x)=>s+(x.valor||0),0);
      const vencido     =l.filter(x=>x.tipo==="RECEBER"&&["ABERTO","VENCIDO"].includes(x.status)&&x.vencimento<hj).reduce((s,x)=>s+(x.valor||0),0);
      const margem      =recebido-realizado;
      return {...o,orcado,comprometido,realizado,recebido,aReceber,vencido,margem,pctReal:orcado>0?pctN(realizado,orcado):0,pctMarg:recebido>0?pctN(margem,recebido):0};
    }).filter(o=>o.realizado>0||o.orcado>0||o.aReceber>0||o.recebido>0);
  },[lancs,obras,hj]);

  const excelCols=[
    {key:"nome",header:"Obra"},{key:"cliente",header:"Cliente"},
    {key:"orcado",header:"Orçado",format:v=>fmt(v)},{key:"comprometido",header:"Comprometido",format:v=>fmt(v)},
    {key:"realizado",header:"Realizado",format:v=>fmt(v)},{key:"recebido",header:"Recebido",format:v=>fmt(v)},
    {key:"aReceber",header:"A receber",format:v=>fmt(v)},{key:"margem",header:"Margem",format:v=>fmt(v)},
    {key:"pctMarg",header:"Margem %",format:v=>`${v}%`},
  ];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
        <BtnExcel onClick={()=>exportarExcel(custoObras,"Custo_por_Obra",excelCols)}/>
      </div>
      {custoObras.length===0&&<div className="empty-state"><div className="empty-icon">🏗️</div><p>Nenhum lançamento vinculado a obras</p></div>}
      {custoObras.map(o=>{
        const desvio=o.realizado-o.orcado;
        const lucro=o.margem>=0;
        return (
          <div key={o.id} className="card" style={{marginBottom:12,borderLeft:`4px solid ${lucro?"var(--verde)":"var(--vermelho)"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{o.nome}</div>
                <div style={{fontSize:12,color:"#7A7A7A"}}>{o.cliente} · {o.status}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:700,color:lucro?"var(--verde)":"var(--vermelho)"}}>{fmt(o.margem)}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>margem {o.pctMarg}%</div>
                <span className={`badge ${desvio>0?"badge-red":desvio<0?"badge-green":"badge-gray"}`} style={{fontSize:10}}>{desvio>0?"⚠ Acima":"✓ Dentro"} do orçado</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:12}}>
              {[["Orçado",o.orcado,"#7A7A7A"],["Comprometido",o.comprometido,"#BA7517"],["Realizado (custo)",o.realizado,desvio>0?"var(--vermelho)":"var(--verde)"],["A receber",o.aReceber,"var(--afine-yellow-dk)"],["Recebido",o.recebido,"var(--verde)"],["Vencido",o.vencido,o.vencido>0?"var(--vermelho)":"var(--verde)"]].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center",padding:"8px",background:"var(--cinza-lt)",borderRadius:8}}>
                  <div style={{fontSize:10,color:"#7A7A7A",marginBottom:2}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:c}}>{fmt(v)}</div>
                </div>
              ))}
            </div>
            {o.orcado>0&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#7A7A7A",marginBottom:3}}>
                  <span>Realizado vs Orçado</span>
                  <span style={{fontWeight:600,color:o.pctReal>100?"var(--vermelho)":"var(--verde)"}}>{o.pctReal}%</span>
                </div>
                <div className="progress-bar" style={{height:8}}>
                  <div className="progress-fill" style={{width:`${Math.min(o.pctReal,100)}%`,background:o.pctReal>100?"var(--vermelho)":o.pctReal>80?"var(--afine-yellow-dk)":"var(--verde)"}}/>
                </div>
                {desvio!==0&&<div style={{fontSize:12,fontWeight:600,color:desvio>0?"var(--vermelho)":"var(--verde)",textAlign:"right",marginTop:4}}>Desvio: {desvio>0?"+":""}{fmt(desvio)}</div>}
              </>
            )}
            {o.vencido>0&&<div className="alert alert-danger" style={{fontSize:11,marginTop:8}}>⚠ {fmt(o.vencido)} em recebimento vencido nesta obra</div>}
          </div>
        );
      })}
      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// ── Sub-aba: Aging ────────────────────────────────────────────────────────────
function AbaAging({ lancs, obras, addToast }) {
  const hj=hoje();
  const [modal, setModal] = useState(null);
  const aReceber = lancs.filter(l=>l.tipo==="RECEBER"&&["ABERTO","VENCIDO"].includes(l.status));
  const FAIXAS=[
    {label:"A vencer",      filter:l=>l.vencimento>=hj,                            cor:"var(--verde)"},
    {label:"1 – 30 dias",   filter:l=>daysDiff(l.vencimento)>0&&daysDiff(l.vencimento)<=30,  cor:"var(--afine-yellow-dk)"},
    {label:"31 – 60 dias",  filter:l=>daysDiff(l.vencimento)>30&&daysDiff(l.vencimento)<=60, cor:"#BA7517"},
    {label:"61 – 90 dias",  filter:l=>daysDiff(l.vencimento)>60&&daysDiff(l.vencimento)<=90, cor:"var(--laranja)"},
    {label:"+90 dias",      filter:l=>daysDiff(l.vencimento)>90,                   cor:"var(--vermelho)"},
  ];
  const total=aReceber.reduce((s,l)=>s+(l.valor||0),0);
  async function marcar(l){await updateDoc(doc(db,"financeiro",l.id),{status:"RECEBIDO",pagamento:hj,valorPago:l.valor,updatedAt:new Date().toISOString()});addToast("✓ Recebido");}

  return (
    <div>
      {/* Pirâmide aging */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>
        {FAIXAS.map(f=>{
          const its=aReceber.filter(f.filter);
          const val=its.reduce((s,l)=>s+(l.valor||0),0);
          return (
            <div key={f.label} style={{background:"#fff",border:`2px solid ${f.cor}30`,borderRadius:10,padding:12,textAlign:"center",borderLeft:`4px solid ${f.cor}`}}>
              <div style={{fontSize:10,color:"#7A7A7A",marginBottom:4}}>{f.label}</div>
              <div style={{fontSize:16,fontWeight:700,color:f.cor}}>{fmt(val)}</div>
              <div style={{fontSize:11,color:"#7A7A7A"}}>{its.length} título(s)</div>
              {total>0&&<div style={{fontSize:10,color:"#aaa",marginTop:2}}>{pctN(val,total)}% do total</div>}
            </div>
          );
        })}
      </div>

      {aReceber.length===0&&<div className="empty-state"><div className="empty-icon">✅</div><p>Nenhum valor em aberto a receber</p></div>}
      {aReceber.length>0&&(
        <div className="table-wrap">
          <table>
            <thead><tr><th>Descrição</th><th>Obra</th><th>Fornecedor/Cliente</th><th>Valor</th><th>Vencimento</th><th>Dias atraso</th><th>Faixa</th><th></th></tr></thead>
            <tbody>
              {aReceber.sort((a,b)=>(a.vencimento||"").localeCompare(b.vencimento||"")).map(l=>{
                const d=daysDiff(l.vencimento);
                const atrasado=l.vencimento<hj;
                const faixa=FAIXAS.find(f=>aReceber.filter(f.filter).includes(l));
                return (
                  <tr key={l.id} style={{background:atrasado?"rgba(184,50,50,.02)":""}}>
                    <td><div style={{fontWeight:500}}>{l.descricao}</div>{l.numeroNF&&<div style={{fontSize:10,color:"#7A7A7A"}}>NF: {l.numeroNF}</div>}</td>
                    <td style={{fontSize:11}}>{l.obraNome||"Geral"}</td>
                    <td style={{fontSize:11}}>{l.fornecedor||"–"}{l.cnpj&&<div style={{fontSize:10,color:"#aaa"}}>{l.cnpj}</div>}</td>
                    <td style={{fontWeight:700,color:"var(--verde)"}}>{fmt(l.valor)}</td>
                    <td style={{fontSize:12,color:atrasado?"var(--vermelho)":"inherit"}}>{fmtDate(l.vencimento)}</td>
                    <td><span style={{fontWeight:700,color:faixa?.cor}}>{atrasado?`${d}d`:"-"}</span></td>
                    <td><span style={{fontSize:10,fontWeight:700,color:faixa?.cor}}>{faixa?.label}</span></td>
                    <td><div style={{display:"flex",gap:4}}>
                      <button className="btn btn-sm" onClick={()=>marcar(l)} style={{background:"var(--verde-lt)",borderColor:"rgba(45,106,31,.3)",fontSize:11}}>✓</button>
                      <button className="btn btn-sm btn-icon" onClick={()=>setModal({lanc:l})}>✏️</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Financeiro() {
  const { toasts, addToast } = useToast();
  const [lancs,   setLancs]   = useState([]);
  const [obras,   setObras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [aba,     setAba]     = useState("lancamentos");
  const [modal,   setModal]   = useState(null);

  useEffect(()=>{
    const u1=onSnapshot(query(collection(db,"financeiro"),orderBy("vencimento","asc"),limit(500)),
      snap=>{setLancs(snap.docs.map(x=>({id:x.id,...x.data()})));setLoading(false);});
    const u2=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();};
  },[]);

  const hj = hoje();
  const kpis = useMemo(()=>{
    const aPagar   =lancs.filter(l=>l.tipo==="PAGAR"  &&["ABERTO","VENCIDO"].includes(l.status)).reduce((s,l)=>s+(l.valor||0),0);
    const aReceber =lancs.filter(l=>l.tipo==="RECEBER"&&["ABERTO","VENCIDO"].includes(l.status)).reduce((s,l)=>s+(l.valor||0),0);
    const vencPag  =lancs.filter(l=>l.tipo==="PAGAR"  &&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hj))).reduce((s,l)=>s+(l.valor||0),0);
    const vencRec  =lancs.filter(l=>l.tipo==="RECEBER"&&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hj))).reduce((s,l)=>s+(l.valor||0),0);
    const pago     =lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="PAGO").reduce((s,l)=>s+(l.valor||0),0);
    const recebido =lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="RECEBIDO").reduce((s,l)=>s+(l.valor||0),0);
    const mesAtualStr=hj.slice(0,7);
    const recMes   =lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="RECEBIDO"&&(l.pagamento||"").startsWith(mesAtualStr)).reduce((s,l)=>s+(l.valor||0),0);
    const pagMes   =lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="PAGO"&&(l.pagamento||"").startsWith(mesAtualStr)).reduce((s,l)=>s+(l.valor||0),0);
    return {aPagar,aReceber,saldo:aReceber-aPagar,vencPag,vencRec,pago,recebido,recMes,pagMes,saldoMes:recMes-pagMes};
  },[lancs,hj]);

  const ABAS=[
    {id:"lancamentos",   label:"📋 Lançamentos"},
    {id:"contas_pagar",  label:"📤 Contas a Pagar"},
    {id:"contas_receber",label:"📥 Contas a Receber"},
    {id:"fluxo",         label:"📊 Fluxo de Caixa"},
    {id:"custo_obra",    label:"🏗️ Custo por Obra"},
    {id:"aging",         label:"⏱ Aging"},
  ];

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div><div className="panel-title">Financeiro</div><div style={{fontSize:12,color:"#7A7A7A"}}>{lancs.length} lançamentos · {new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</div></div>
        <button className="btn btn-primary" onClick={()=>setModal({lanc:null})}>+ Lançamento</button>
      </div>

      {/* KPIs globais em 2 linhas */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:6}}>
        <KPICard label="A pagar (aberto)"    valor={fmt(kpis.aPagar)}    cor="var(--vermelho)" icon="📤" sub={kpis.vencPag>0?`⚠ ${fmt(kpis.vencPag)} vencidos`:undefined} alerta={kpis.vencPag>0}/>
        <KPICard label="A receber (aberto)"  valor={fmt(kpis.aReceber)}  cor="var(--verde)"    icon="📥" sub={kpis.vencRec>0?`⚠ ${fmt(kpis.vencRec)} em atraso`:undefined} alerta={kpis.vencRec>0}/>
        <KPICard label="Saldo projetado"     valor={fmt(kpis.saldo)}     cor={kpis.saldo>=0?"var(--verde)":"var(--vermelho)"} icon="🏦"/>
        <KPICard label="Pago (histórico)"    valor={fmt(kpis.pago)}      cor="#4A4A4A" icon="✓"/>
        <KPICard label="Recebido (histórico)"valor={fmt(kpis.recebido)}  cor="var(--verde)" icon="💰"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:18}}>
        <KPICard label="Recebido este mês"   valor={fmt(kpis.recMes)}    cor="var(--verde)" icon="📅"/>
        <KPICard label="Pago este mês"       valor={fmt(kpis.pagMes)}    cor="var(--vermelho)" icon="📅"/>
        <KPICard label="Saldo do mês"        valor={fmt(kpis.saldoMes)}  cor={kpis.saldoMes>=0?"var(--verde)":"var(--vermelho)"} icon="📊"/>
        <KPICard label="Qtd. lançamentos"    valor={lancs.length} sub={`${lancs.filter(l=>["ABERTO","VENCIDO"].includes(l.status)).length} em aberto`} icon="📋"/>
      </div>

      {/* Sub-abas */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",flexWrap:"wrap"}}>
        {ABAS.map((a,i)=>(
          <button key={a.id} onClick={()=>setAba(a.id)}
            style={{flex:"1 1 auto",padding:"9px 8px",border:"none",cursor:"pointer",
              background:aba===a.id?"#1A1A1A":"var(--cinza-lt)",
              color:aba===a.id?"#F5C800":"#4A4A4A",
              borderRight:i<ABAS.length-1?"1px solid var(--border)":"none",
              transition:"all .15s",fontSize:11,fontWeight:aba===a.id?700:400,whiteSpace:"nowrap"}}>
            {a.label}
          </button>
        ))}
      </div>

      {!loading&&(
        <>
          {aba==="lancamentos"   &&<AbaLancamentos    lancs={lancs} obras={obras} addToast={addToast}/>}
          {aba==="contas_pagar"  &&<AbaContasPagar    lancs={lancs} obras={obras} addToast={addToast}/>}
          {aba==="contas_receber"&&<AbaContasReceber  lancs={lancs} obras={obras} addToast={addToast}/>}
          {aba==="fluxo"         &&<AbaFluxoCaixa     lancs={lancs}/>}
          {aba==="custo_obra"    &&<AbaCustoObra      lancs={lancs} obras={obras} addToast={addToast}/>}
          {aba==="aging"         &&<AbaAging          lancs={lancs} obras={obras} addToast={addToast}/>}
        </>
      )}
      {loading&&<div className="spinner"/>}
      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
