// src/pages/Financeiro.js — v2: sub-abas completas, KPIs corretos, UX aprimorada
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, limit, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";

// ── Constantes ────────────────────────────────────────────────────────────────
const CATS_PAGAR   = ["Materiais","Mão de obra","Subempreiteiro","Aluguel equipamentos","Serviços terceiros","Despesas viagem","Impressos","Despesas administrativas","Impostos","Outros"];
const CATS_RECEBER = ["Medição / BM","Adiantamento contratual","Saldo contratual","Reembolso","Outros"];

const STATUS_BADGE = {
  ABERTO:    "badge-amber",
  PAGO:      "badge-green",
  RECEBIDO:  "badge-green",
  VENCIDO:   "badge-red",
  CANCELADO: "badge-gray",
  PARCIAL:   "badge-yellow",
};

// ── Utilitários ───────────────────────────────────────────────────────────────
const fmt    = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const fmtK   = v => { const n=Number(v||0); return n>=1000?`R$ ${(n/1000).toFixed(1)}k`:`R$ ${n.toFixed(0)}`; };
const daysDiff = v => { if(!v) return 0; return Math.floor((new Date()-new Date(v+"T12:00"))/(86400000)); };

// ── Modal de lançamento ───────────────────────────────────────────────────────
function LancamentoModal({ lanc, obras, onClose, addToast }) {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    tipo:        lanc?.tipo        || "PAGAR",
    descricao:   lanc?.descricao   || "",
    categoria:   lanc?.categoria   || "",
    obraId:      lanc?.obraId      || "",
    obraNome:    lanc?.obraNome    || "",
    valor:       lanc?.valor       || "",
    vencimento:  lanc?.vencimento  || "",
    pagamento:   lanc?.pagamento   || "",
    status:      lanc?.status      || "ABERTO",
    fornecedor:  lanc?.fornecedor  || "",
    numeroNF:    lanc?.numeroNF    || "",
    tipoValor:   lanc?.tipoValor   || "realizado",
    centroCusto: lanc?.centroCusto || "",
    obs:         lanc?.obs         || "",
    parcelas:    lanc?.parcelas    || 1,
  });
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }
  function handleObra(id) { const o=obras.find(x=>x.id===id); set("obraId",id); set("obraNome",o?.nome||""); }

  // Auto-calcular vencido
  useEffect(()=>{
    const hoje=new Date().toISOString().split("T")[0];
    if(form.status==="ABERTO"&&form.vencimento&&form.vencimento<hoje) set("status","VENCIDO");
  },[form.vencimento]);

  async function save() {
    if(!form.descricao||!form.valor) { alert("Informe descrição e valor."); return; }
    if(!form.vencimento) { alert("Informe a data de vencimento."); return; }
    setSaving(true);
    const agora=new Date().toISOString();
    const payload={...form,valor:Number(form.valor),updatedAt:agora,
      autorNome:userProfile?.nome||"–"};
    try {
      if(lanc?.id) { await updateDoc(doc(db,"financeiro",lanc.id),payload); addToast("✓ Lançamento atualizado!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"financeiro"),payload); addToast("✓ Lançamento criado!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  // Marcar como pago/recebido rapidamente
  async function marcarPago() {
    if(!lanc?.id) return;
    setSaving(true);
    const novoStatus = form.tipo==="PAGAR"?"PAGO":"RECEBIDO";
    const hoje=new Date().toISOString().split("T")[0];
    try {
      await updateDoc(doc(db,"financeiro",lanc.id),{ status:novoStatus, pagamento:hoje, updatedAt:new Date().toISOString() });
      addToast(`✓ Marcado como ${novoStatus}`);
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  const isPago = ["PAGO","RECEBIDO","CANCELADO"].includes(form.status);

  return (
    <Modal title={lanc?.id?"Editar lançamento":"Novo lançamento"} onClose={onClose}
      footer={
        <div style={{display:"flex",gap:8,justifyContent:"space-between",width:"100%"}}>
          <div>
            {lanc?.id&&form.status==="ABERTO"&&(
              <button className="btn btn-primary" onClick={marcarPago} disabled={saving}
                style={{background:"var(--verde)",borderColor:"var(--verde)"}}>
                {saving?"...":form.tipo==="PAGAR"?"✓ Marcar pago":"✓ Marcar recebido"}
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
            <input value={form.descricao} onChange={e=>set("descricao",e.target.value)} placeholder="Ex: Pagamento subempreiteiro elétrica — AG 0442"/>
          </div>
          <div className="form-group">
            <label>Categoria</label>
            <select value={form.categoria} onChange={e=>set("categoria",e.target.value)}>
              <option value="">Selecione...</option>
              {(form.tipo==="PAGAR"?CATS_PAGAR:CATS_RECEBER).map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Centro de custo / Obra</label>
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
            <label>Tipo de valor</label>
            <select value={form.tipoValor} onChange={e=>set("tipoValor",e.target.value)}>
              <option value="orcado">Orçado</option>
              <option value="comprometido">Comprometido</option>
              <option value="realizado">Realizado</option>
            </select>
          </div>
          <div className="form-group">
            <label className="required">Vencimento</label>
            <input type="date" value={form.vencimento} onChange={e=>set("vencimento",e.target.value)}/>
          </div>
          <div className="form-group">
            <label>Data de pagamento/recebimento</label>
            <input type="date" value={form.pagamento} onChange={e=>set("pagamento",e.target.value)}/>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}
              style={{background:form.status==="PAGO"||form.status==="RECEBIDO"?"var(--verde-lt)":form.status==="VENCIDO"?"var(--vermelho-lt)":form.status==="ABERTO"?"var(--afine-yellow-lt)":""}}>
              {["ABERTO","PAGO","RECEBIDO","VENCIDO","PARCIAL","CANCELADO"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fornecedor / Cliente</label>
            <input value={form.fornecedor} onChange={e=>set("fornecedor",e.target.value)}/>
          </div>
          <div className="form-group">
            <label>Nº NF / Documento</label>
            <input value={form.numeroNF} onChange={e=>set("numeroNF",e.target.value)}/>
          </div>
        </div>
        <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/></div>
      </div>
    </Modal>
  );
}

// ── Sub-aba: Lançamentos ──────────────────────────────────────────────────────
function AbaLancamentos({ lancs, obras, loading, hoje, addToast }) {
  const [filtro,     setFiltro]     = useState("todos");
  const [obraFiltro, setObraFiltro] = useState("");
  const [search,     setSearch]     = useState("");
  const [modal,      setModal]      = useState(null);

  const filtered = useMemo(()=>{
    const q=search.toLowerCase();
    return lancs.filter(l=>{
      const mQ=!q||l.descricao?.toLowerCase().includes(q)||l.fornecedor?.toLowerCase().includes(q)||l.obraNome?.toLowerCase().includes(q)||l.categoria?.toLowerCase().includes(q);
      const mT=filtro==="todos"
        ||(filtro==="pagar"&&l.tipo==="PAGAR")
        ||(filtro==="receber"&&l.tipo==="RECEBER")
        ||(filtro==="aberto"&&l.status==="ABERTO")
        ||(filtro==="vencido"&&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hoje)))
        ||(filtro==="pago"&&(l.status==="PAGO"||l.status==="RECEBIDO"));
      const mO=!obraFiltro||l.obraId===obraFiltro;
      return mQ&&mT&&mO;
    });
  },[lancs,filtro,obraFiltro,search,hoje]);

  const totalPagar   = filtered.filter(l=>l.tipo==="PAGAR"  &&l.status==="ABERTO").reduce((s,l)=>s+(l.valor||0),0);
  const totalReceber = filtered.filter(l=>l.tipo==="RECEBER"&&l.status==="ABERTO").reduce((s,l)=>s+(l.valor||0),0);

  const excelCols = [
    {key:"tipo",header:"Tipo"},{key:"descricao",header:"Descrição"},{key:"categoria",header:"Categoria"},
    {key:"obraNome",header:"Obra"},{key:"fornecedor",header:"Fornecedor/Cliente"},
    {key:"valor",header:"Valor",format:v=>`R$ ${Number(v||0).toFixed(2).replace(".",",")}`},
    {key:"vencimento",header:"Vencimento"},{key:"pagamento",header:"Data Pgto"},
    {key:"status",header:"Status"},{key:"tipoValor",header:"Tipo valor"},{key:"numeroNF",header:"NF"},
  ];

  return (
    <div>
      {/* Filtros */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <div className="chip-row" style={{margin:0,flex:1,flexWrap:"wrap"}}>
          {[["todos","Todos"],["aberto","Em aberto"],["pagar","A pagar"],["receber","A receber"],["vencido","Vencidos"],["pago","Pagos/Recebidos"]].map(([v,l])=>(
            <button key={v} className={`chip ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)}>
              {l} ({v==="todos"?lancs.length:v==="pagar"?lancs.filter(l=>l.tipo==="PAGAR").length:v==="receber"?lancs.filter(l=>l.tipo==="RECEBER").length:v==="aberto"?lancs.filter(l=>l.status==="ABERTO").length:v==="vencido"?lancs.filter(l=>l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hoje)).length:lancs.filter(l=>l.status==="PAGO"||l.status==="RECEBIDO").length})
            </button>
          ))}
        </div>
        <select value={obraFiltro} onChange={e=>setObraFiltro(e.target.value)} style={{padding:"5px 10px",borderRadius:6,border:"1px solid var(--border)",fontSize:12}}>
          <option value="">Todas as obras</option>
          {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <BtnExcel onClick={()=>exportarExcel(filtered,"Lancamentos_Financeiro",excelCols)}/>
      </div>

      <div className="search-bar">🔍<input placeholder="Buscar por descrição, fornecedor, obra, categoria..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"#7A7A7A"}}>✕</button>}</div>

      {/* Totais do filtro */}
      {(totalPagar>0||totalReceber>0)&&(
        <div style={{display:"flex",gap:10,marginBottom:12,fontSize:12}}>
          {totalPagar>0&&<span style={{background:"var(--vermelho-lt)",padding:"4px 12px",borderRadius:20,color:"var(--vermelho)",fontWeight:600}}>📤 A pagar: {fmt(totalPagar)}</span>}
          {totalReceber>0&&<span style={{background:"var(--verde-lt)",padding:"4px 12px",borderRadius:20,color:"var(--verde)",fontWeight:600}}>📥 A receber: {fmt(totalReceber)}</span>}
        </div>
      )}

      {loading&&<div className="spinner"/>}
      {!loading&&filtered.length===0&&<div className="empty-state"><div className="empty-icon">💰</div><p>Nenhum lançamento encontrado</p></div>}
      {!loading&&filtered.length>0&&(
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Obra</th><th>Valor</th><th>Vencimento</th><th>Pgto</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(l=>{
                const vencido=l.status==="ABERTO"&&l.vencimento<hoje;
                return (
                  <tr key={l.id} style={{background:vencido?"rgba(184,50,50,.04)":""}}>
                    <td><span className={`badge ${l.tipo==="PAGAR"?"badge-red":"badge-green"}`} style={{fontSize:10,whiteSpace:"nowrap"}}>{l.tipo==="PAGAR"?"📤 Pagar":"📥 Receber"}</span></td>
                    <td>
                      <div style={{fontWeight:500,fontSize:13}}>{l.descricao}</div>
                      {l.fornecedor&&<div style={{fontSize:11,color:"#7A7A7A"}}>{l.fornecedor}</div>}
                      {l.numeroNF&&<div style={{fontSize:10,color:"#7A7A7A"}}>NF: {l.numeroNF}</div>}
                    </td>
                    <td style={{fontSize:12}}>{l.categoria||"–"}</td>
                    <td style={{fontSize:12}}>{l.obraNome||<span style={{color:"#aaa"}}>Geral</span>}</td>
                    <td style={{fontWeight:700,color:l.tipo==="PAGAR"?"var(--vermelho)":"var(--verde)",whiteSpace:"nowrap"}}>{fmt(l.valor)}</td>
                    <td style={{fontSize:12,color:vencido?"var(--vermelho)":"inherit",fontWeight:vencido?700:400,whiteSpace:"nowrap"}}>
                      {fmtDate(l.vencimento)}
                      {vencido&&<div style={{fontSize:10,color:"var(--vermelho)"}}>{daysDiff(l.vencimento)}d atraso</div>}
                    </td>
                    <td style={{fontSize:12,whiteSpace:"nowrap"}}>{l.pagamento?fmtDate(l.pagamento):<span style={{color:"#aaa"}}>–</span>}</td>
                    <td><span className={`badge ${STATUS_BADGE[l.status]||"badge-gray"}`}>{l.status}</span></td>
                    <td>
                      <div style={{display:"flex",gap:4}}>
                        {l.status==="ABERTO"&&(
                          <button className="btn btn-sm" title={l.tipo==="PAGAR"?"Marcar pago":"Marcar recebido"}
                            onClick={async()=>{const s=l.tipo==="PAGAR"?"PAGO":"RECEBIDO";await updateDoc(doc(db,"financeiro",l.id),{status:s,pagamento:hoje,updatedAt:new Date().toISOString()});addToast("✓ "+s);}}
                            style={{background:"var(--verde-lt)",borderColor:"rgba(45,106,31,.3)",fontSize:11,padding:"3px 7px"}}>
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
          </table>
        </div>
      )}
      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// ── Sub-aba: Contas a Pagar ────────────────────────────────────────────────────
function AbaContasPagar({ lancs, obras, hoje, addToast }) {
  const [modal, setModal] = useState(null);
  const [filtro, setFiltro] = useState("aberto");
  const aberto    = lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="ABERTO");
  const vencido   = lancs.filter(l=>l.tipo==="PAGAR"&&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hoje)));
  const pago      = lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="PAGO");
  const proximos  = aberto.filter(l=>{
    const d=new Date(l.vencimento+"T12:00"); const n=new Date(); n.setDate(n.getDate()+7);
    return d>=new Date()&&d<=n;
  });
  const lista = filtro==="aberto"?aberto:filtro==="vencido"?vencido:filtro==="proximo"?proximos:pago;
  const totalAberto = aberto.reduce((s,l)=>s+(l.valor||0),0);
  const totalVencido = vencido.reduce((s,l)=>s+(l.valor||0),0);

  return (
    <div>
      {/* KPIs */}
      <div className="metrics-grid" style={{marginBottom:14}}>
        <div className="metric"><div className="metric-label">Total a pagar</div><div className="metric-value red" style={{fontSize:18}}>{fmt(totalAberto)}</div></div>
        <div className="metric"><div className="metric-label">Vencidos</div><div className="metric-value red">{fmt(totalVencido)}<div style={{fontSize:10,color:"var(--vermelho)"}}>{vencido.length} lançtos</div></div></div>
        <div className="metric"><div className="metric-label">Próx. 7 dias</div><div className="metric-value amber">{fmt(proximos.reduce((s,l)=>s+(l.valor||0),0))}</div></div>
        <div className="metric"><div className="metric-label">Pagos (total)</div><div className="metric-value green">{fmt(pago.reduce((s,l)=>s+(l.valor||0),0))}</div></div>
      </div>
      <div className="chip-row" style={{marginBottom:10}}>
        {[["aberto","Em aberto"],["vencido","Vencidos"],["proximo","Próx. 7 dias"],["pago","Pagos"]].map(([v,l])=>(
          <button key={v} className={`chip ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>
      {lista.length===0&&<div className="empty-state"><div className="empty-icon">📤</div><p>Nenhum lançamento nesta categoria</p></div>}
      {lista.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
        {lista.sort((a,b)=>a.vencimento?.localeCompare(b.vencimento||"")).map(l=>{
          const venc=l.status==="ABERTO"&&l.vencimento<hoje;
          return (
            <div key={l.id} className="rdo-card" style={{borderLeft:`4px solid ${venc?"var(--vermelho)":"var(--afine-yellow-dk)"}`}}>
              <div className="rdo-header">
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{l.descricao}</div>
                  <div style={{fontSize:12,color:"#7A7A7A"}}>{l.categoria}{l.fornecedor&&` · ${l.fornecedor}`}{l.obraNome&&` · ${l.obraNome}`}</div>
                  {venc&&<div style={{fontSize:11,color:"var(--vermelho)",fontWeight:600}}>⚠ {daysDiff(l.vencimento)} dias em atraso</div>}
                </div>
                <div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                  <div style={{fontWeight:700,fontSize:16,color:"var(--vermelho)"}}>{fmt(l.valor)}</div>
                  <div style={{fontSize:11,color:"#7A7A7A"}}>Vence: {fmtDate(l.vencimento)}</div>
                  <div style={{display:"flex",gap:6}}>
                    {l.status==="ABERTO"&&<button className="btn btn-sm" onClick={async()=>{await updateDoc(doc(db,"financeiro",l.id),{status:"PAGO",pagamento:hoje,updatedAt:new Date().toISOString()});addToast("✓ Marcado como PAGO");}} style={{background:"var(--verde-lt)",borderColor:"rgba(45,106,31,.3)",fontSize:11}}>✓ Pago</button>}
                    <button className="btn btn-sm btn-icon" onClick={()=>setModal({lanc:l})}>✏️</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>}
      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// ── Sub-aba: Contas a Receber ─────────────────────────────────────────────────
function AbaContasReceber({ lancs, obras, hoje, addToast }) {
  const [modal, setModal] = useState(null);
  const [filtro, setFiltro] = useState("aberto");
  const aberto   = lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="ABERTO");
  const vencido  = lancs.filter(l=>l.tipo==="RECEBER"&&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hoje)));
  const recebido = lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="RECEBIDO");
  const lista = filtro==="aberto"?aberto:filtro==="vencido"?vencido:recebido;

  return (
    <div>
      <div className="metrics-grid" style={{marginBottom:14}}>
        <div className="metric"><div className="metric-label">Total a receber</div><div className="metric-value green" style={{fontSize:18}}>{fmt(aberto.reduce((s,l)=>s+(l.valor||0),0))}</div></div>
        <div className="metric"><div className="metric-label">Em atraso</div><div className="metric-value red">{fmt(vencido.reduce((s,l)=>s+(l.valor||0),0))}<div style={{fontSize:10,color:"var(--vermelho)"}}>{vencido.length} lançtos</div></div></div>
        <div className="metric"><div className="metric-label">Recebidos</div><div className="metric-value green">{fmt(recebido.reduce((s,l)=>s+(l.valor||0),0))}</div></div>
        <div className="metric"><div className="metric-label">Inadimplência</div><div className="metric-value red">{aberto.length>0?Math.round(vencido.length/aberto.length*100):0}%</div></div>
      </div>
      <div className="chip-row" style={{marginBottom:10}}>
        {[["aberto","A receber"],["vencido","Em atraso"],["recebido","Recebidos"]].map(([v,l])=>(
          <button key={v} className={`chip ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>
      {lista.length===0&&<div className="empty-state"><div className="empty-icon">📥</div><p>Nenhum lançamento nesta categoria</p></div>}
      {lista.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
        {lista.sort((a,b)=>a.vencimento?.localeCompare(b.vencimento||"")).map(l=>{
          const venc=l.status==="ABERTO"&&l.vencimento<hoje;
          return (
            <div key={l.id} className="rdo-card" style={{borderLeft:`4px solid ${venc?"var(--vermelho)":"var(--verde)"}`}}>
              <div className="rdo-header">
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{l.descricao}</div>
                  <div style={{fontSize:12,color:"#7A7A7A"}}>{l.categoria}{l.fornecedor&&` · ${l.fornecedor}`}{l.obraNome&&` · ${l.obraNome}`}</div>
                  {venc&&<div style={{fontSize:11,color:"var(--vermelho)",fontWeight:600}}>⚠ {daysDiff(l.vencimento)} dias em atraso</div>}
                </div>
                <div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                  <div style={{fontWeight:700,fontSize:16,color:"var(--verde)"}}>{fmt(l.valor)}</div>
                  <div style={{fontSize:11,color:"#7A7A7A"}}>Vence: {fmtDate(l.vencimento)}</div>
                  <div style={{display:"flex",gap:6}}>
                    {l.status==="ABERTO"&&<button className="btn btn-sm" onClick={async()=>{await updateDoc(doc(db,"financeiro",l.id),{status:"RECEBIDO",pagamento:hoje,updatedAt:new Date().toISOString()});addToast("✓ Marcado como RECEBIDO");}} style={{background:"var(--verde-lt)",borderColor:"rgba(45,106,31,.3)",fontSize:11}}>✓ Recebido</button>}
                    <button className="btn btn-sm btn-icon" onClick={()=>setModal({lanc:l})}>✏️</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>}
      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// ── Sub-aba: Fluxo de Caixa ───────────────────────────────────────────────────
function AbaFluxoCaixa({ lancs }) {
  const meses = useMemo(()=>{
    return Array.from({length:12},(_,i)=>{
      const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-3+i);
      const m=d.toISOString().slice(0,7);
      const mes=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.getMonth()];
      const rec=lancs.filter(l=>l.tipo==="RECEBER"&&(l.vencimento||"").startsWith(m)).reduce((s,l)=>s+(l.valor||0),0);
      const pag=lancs.filter(l=>l.tipo==="PAGAR"&&(l.vencimento||"").startsWith(m)).reduce((s,l)=>s+(l.valor||0),0);
      const recReal=lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="RECEBIDO"&&(l.pagamento||"").startsWith(m)).reduce((s,l)=>s+(l.valor||0),0);
      const pagReal=lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="PAGO"&&(l.pagamento||"").startsWith(m)).reduce((s,l)=>s+(l.valor||0),0);
      const atual=new Date().toISOString().slice(0,7);
      return {mes:mes+" "+(d.getFullYear()%100),m,rec,pag,saldo:rec-pag,recReal,pagReal,saldoReal:recReal-pagReal,isPast:m<atual,isCurrent:m===atual};
    });
  },[lancs]);

  const maxVal=useMemo(()=>Math.max(...meses.map(m=>Math.max(m.rec,m.pag,1)),1),[meses]);
  const H=80;

  return (
    <div>
      {/* Gráfico de barras */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>Fluxo projetado × realizado — 12 meses</div>
        <div style={{fontSize:11,color:"#7A7A7A",marginBottom:14}}>3 meses atrás + mês atual + 8 meses à frente</div>
        <div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:4}}>
          {meses.map((m,i)=>(
            <div key={i} style={{flex:"0 0 72px",display:"flex",flexDirection:"column",alignItems:"center"}}>
              {/* Barras */}
              <div style={{display:"flex",gap:2,alignItems:"flex-end",height:H,marginBottom:4}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                  <div style={{width:14,background:"var(--verde)",borderRadius:"3px 3px 0 0",opacity:.4+(m.isPast?.4:0),height:`${Math.max(3,m.rec/maxVal*H)}px`}} title={`Previsto: ${fmt(m.rec)}`}/>
                  {m.recReal>0&&<div style={{width:14,background:"var(--verde)",borderRadius:"3px 3px 0 0",height:`${Math.max(3,m.recReal/maxVal*H)}px`}} title={`Realizado: ${fmt(m.recReal)}`}/>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                  <div style={{width:14,background:"var(--vermelho)",borderRadius:"3px 3px 0 0",opacity:.4+(m.isPast?.4:0),height:`${Math.max(3,m.pag/maxVal*H)}px`}} title={`Previsto: ${fmt(m.pag)}`}/>
                  {m.pagReal>0&&<div style={{width:14,background:"var(--vermelho)",borderRadius:"3px 3px 0 0",height:`${Math.max(3,m.pagReal/maxVal*H)}px`}} title={`Realizado: ${fmt(m.pagReal)}`}/>}
                </div>
              </div>
              {/* Rótulo */}
              <div style={{fontSize:9,color:m.isCurrent?"var(--afine-yellow-dk)":"#7A7A7A",fontWeight:m.isCurrent?700:400,textAlign:"center",lineHeight:1.2}}>{m.mes}</div>
              {/* Saldo */}
              <div style={{fontSize:8,color:m.saldo>=0?"var(--verde)":"var(--vermelho)",fontWeight:600,marginTop:2}}>{m.saldo>=0?"+":""}{fmtK(m.saldo)}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:16,marginTop:10,fontSize:11}}>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"var(--verde)",borderRadius:2,display:"inline-block",opacity:.5}}/> Rec. previsto</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"var(--verde)",borderRadius:2,display:"inline-block"}}/> Rec. realizado</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"var(--vermelho)",borderRadius:2,display:"inline-block",opacity:.5}}/> Pag. previsto</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"var(--vermelho)",borderRadius:2,display:"inline-block"}}/> Pag. realizado</span>
        </div>
      </div>

      {/* Tabela */}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Mês</th><th>Prev. Receber</th><th>Prev. Pagar</th><th>Saldo prev.</th><th>Real. Recebido</th><th>Real. Pago</th><th>Saldo real.</th></tr></thead>
          <tbody>
            {meses.map((m,i)=>(
              <tr key={i} style={{background:m.isCurrent?"rgba(245,200,0,.05)":"",fontWeight:m.isCurrent?600:400}}>
                <td>{m.isCurrent?"→ ":""}{m.mes}</td>
                <td style={{color:"var(--verde)"}}>{m.rec>0?fmt(m.rec):"–"}</td>
                <td style={{color:"var(--vermelho)"}}>{m.pag>0?fmt(m.pag):"–"}</td>
                <td style={{fontWeight:700,color:m.saldo>=0?"var(--verde)":"var(--vermelho)"}}>{m.saldo!==0?fmt(m.saldo):"–"}</td>
                <td style={{color:"var(--verde)"}}>{m.recReal>0?fmt(m.recReal):"–"}</td>
                <td style={{color:"var(--vermelho)"}}>{m.pagReal>0?fmt(m.pagReal):"–"}</td>
                <td style={{fontWeight:700,color:m.saldoReal>=0?"var(--verde)":"var(--vermelho)"}}>{m.saldoReal!==0?fmt(m.saldoReal):"–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-aba: Custo por Obra ───────────────────────────────────────────────────
function AbaCustoObra({ lancs, obras }) {
  const custoObras = useMemo(()=>{
    return obras.map(o=>{
      const l=lancs.filter(x=>x.obraId===o.id);
      return {
        ...o,
        orcado:       l.filter(x=>x.tipoValor==="orcado"      &&x.tipo==="PAGAR").reduce((s,x)=>s+(x.valor||0),0),
        comprometido: l.filter(x=>x.tipoValor==="comprometido" &&x.tipo==="PAGAR").reduce((s,x)=>s+(x.valor||0),0),
        realizado:    l.filter(x=>x.tipoValor==="realizado"    &&x.tipo==="PAGAR"&&(x.status==="PAGO"||x.status==="ABERTO")).reduce((s,x)=>s+(x.valor||0),0),
        recebido:     l.filter(x=>x.tipo==="RECEBER"&&x.status==="RECEBIDO").reduce((s,x)=>s+(x.valor||0),0),
        aReceber:     l.filter(x=>x.tipo==="RECEBER"&&x.status==="ABERTO").reduce((s,x)=>s+(x.valor||0),0),
      };
    }).filter(o=>o.realizado>0||o.orcado>0||o.aReceber>0||o.recebido>0);
  },[lancs,obras]);

  const hoje=new Date().toISOString().split("T")[0];
  if(custoObras.length===0) return <div className="empty-state"><div className="empty-icon">🏗️</div><p>Nenhum lançamento vinculado a obras ainda</p></div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {custoObras.map(o=>{
        const desvio=o.realizado-o.orcado;
        const pct=o.orcado>0?Math.min(Math.round(o.realizado/o.orcado*100),150):0;
        return (
          <div key={o.id} className="card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{o.nome}</div>
                <div style={{fontSize:12,color:"#7A7A7A"}}>{o.cliente}</div>
              </div>
              <span className={`badge ${desvio>0?"badge-red":desvio<0?"badge-green":"badge-gray"}`}>
                {desvio>0?"⚠ Acima do orçado":desvio<0?"✓ Dentro do orçado":"No orçado"}
              </span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:12}}>
              {[
                ["Orçado",o.orcado,"#7A7A7A"],
                ["Comprometido",o.comprometido,"var(--afine-yellow-dk)"],
                ["Realizado (custo)",o.realizado,desvio>0?"var(--vermelho)":"var(--verde)"],
                ["A receber",o.aReceber,"var(--afine-yellow-dk)"],
                ["Recebido",o.recebido,"var(--verde)"],
              ].map(([l,v,c])=>(
                <div key={l} style={{textAlign:"center",padding:"10px",background:"var(--cinza-lt)",borderRadius:8}}>
                  <div style={{fontSize:10,color:"#7A7A7A",marginBottom:3}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:700,color:c}}>{fmt(v)}</div>
                </div>
              ))}
            </div>
            {o.orcado>0&&(
              <>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#7A7A7A",marginBottom:3}}>
                  <span>Realizado vs Orçado</span><span style={{fontWeight:600,color:pct>100?"var(--vermelho)":"var(--verde)"}}>{pct}%</span>
                </div>
                <div className="progress-bar" style={{height:8}}>
                  <div className="progress-fill" style={{width:`${Math.min(pct,100)}%`,background:pct>100?"var(--vermelho)":pct>80?"var(--afine-yellow-dk)":"var(--verde)"}}/>
                </div>
                {desvio!==0&&<div style={{fontSize:12,fontWeight:600,color:desvio>0?"var(--vermelho)":"var(--verde)",textAlign:"right",marginTop:4}}>Desvio: {desvio>0?"+":""}{fmt(desvio)}</div>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-aba: Aging (inadimplência) ────────────────────────────────────────────
function AbaAging({ lancs, obras, hoje, addToast }) {
  const [modal, setModal] = useState(null);
  const aReceber = lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="ABERTO");
  const faixas = [
    {label:"A vencer",        filter:l=>l.vencimento>=hoje,                   cor:"var(--verde)"},
    {label:"1–30 dias",       filter:l=>daysDiff(l.vencimento)>0&&daysDiff(l.vencimento)<=30,cor:"var(--afine-yellow-dk)"},
    {label:"31–60 dias",      filter:l=>daysDiff(l.vencimento)>30&&daysDiff(l.vencimento)<=60,cor:"#BA7517"},
    {label:"61–90 dias",      filter:l=>daysDiff(l.vencimento)>60&&daysDiff(l.vencimento)<=90,cor:"var(--laranja)"},
    {label:"+90 dias",        filter:l=>daysDiff(l.vencimento)>90,            cor:"var(--vermelho)"},
  ];
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:16}}>
        {faixas.map(f=>{
          const its=aReceber.filter(f.filter);
          return (
            <div key={f.label} className="metric" style={{borderLeft:`3px solid ${f.cor}`}}>
              <div className="metric-label">{f.label}</div>
              <div style={{fontSize:16,fontWeight:700,color:f.cor}}>{fmt(its.reduce((s,l)=>s+(l.valor||0),0))}</div>
              <div style={{fontSize:11,color:"#7A7A7A"}}>{its.length} lançto(s)</div>
            </div>
          );
        })}
      </div>
      {aReceber.length===0&&<div className="empty-state"><div className="empty-icon">✅</div><p>Nenhum valor em aberto a receber</p></div>}
      {aReceber.length>0&&(
        <div className="table-wrap">
          <table>
            <thead><tr><th>Descrição</th><th>Obra</th><th>Valor</th><th>Vencimento</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {aReceber.sort((a,b)=>(a.vencimento||"").localeCompare(b.vencimento||"")).map(l=>{
                const d=daysDiff(l.vencimento);
                const atrasado=l.vencimento<hoje;
                const faixa=faixas.find(f=>aReceber.filter(f.filter).includes(l));
                return (
                  <tr key={l.id} style={{background:atrasado?"rgba(184,50,50,.03)":""}}>
                    <td><div style={{fontWeight:500}}>{l.descricao}</div><div style={{fontSize:11,color:"#7A7A7A"}}>{l.fornecedor}</div></td>
                    <td style={{fontSize:12}}>{l.obraNome||"Geral"}</td>
                    <td style={{fontWeight:700,color:"var(--verde)"}}>{fmt(l.valor)}</td>
                    <td style={{fontSize:12,color:atrasado?"var(--vermelho)":"inherit"}}>{fmtDate(l.vencimento)}</td>
                    <td><span style={{fontSize:11,fontWeight:600,color:faixa?.cor}}>{atrasado?`${d}d atrasado`:"A vencer"}</span></td>
                    <td>
                      <div style={{display:"flex",gap:4}}>
                        <button className="btn btn-sm" onClick={async()=>{await updateDoc(doc(db,"financeiro",l.id),{status:"RECEBIDO",pagamento:hoje,updatedAt:new Date().toISOString()});addToast("✓ Recebido");}} style={{background:"var(--verde-lt)",borderColor:"rgba(45,106,31,.3)",fontSize:11}}>✓ Recebido</button>
                        <button className="btn btn-sm btn-icon" onClick={()=>setModal({lanc:l})}>✏️</button>
                      </div>
                    </td>
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

// ── Página Principal ──────────────────────────────────────────────────────────
export default function Financeiro() {
  const { toasts, addToast } = useToast();
  const [lancs,   setLancs]   = useState([]);
  const [obras,   setObras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [aba,     setAba]     = useState("lancamentos");
  const [modal,   setModal]   = useState(null);

  useEffect(()=>{
    const u1=onSnapshot(
      query(collection(db,"financeiro"),orderBy("vencimento","asc"),limit(500)),
      snap=>{setLancs(snap.docs.map(x=>({id:x.id,...x.data()})));setLoading(false);}
    );
    const u2=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();};
  },[]);

  const hoje = new Date().toISOString().split("T")[0];

  // KPIs globais sempre atualizados
  const kpis = useMemo(()=>{
    const aPagar   = lancs.filter(l=>l.tipo==="PAGAR"  &&["ABERTO","VENCIDO"].includes(l.status)).reduce((s,l)=>s+(l.valor||0),0);
    const aReceber = lancs.filter(l=>l.tipo==="RECEBER"&&["ABERTO","VENCIDO"].includes(l.status)).reduce((s,l)=>s+(l.valor||0),0);
    const vencPagar= lancs.filter(l=>l.tipo==="PAGAR"  &&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hoje))).reduce((s,l)=>s+(l.valor||0),0);
    const vencRec  = lancs.filter(l=>l.tipo==="RECEBER"&&(l.status==="VENCIDO"||(l.status==="ABERTO"&&l.vencimento<hoje))).reduce((s,l)=>s+(l.valor||0),0);
    const totalPago=lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="PAGO").reduce((s,l)=>s+(l.valor||0),0);
    const totalRec =lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="RECEBIDO").reduce((s,l)=>s+(l.valor||0),0);
    return {aPagar,aReceber,saldo:aReceber-aPagar,vencPagar,vencRec,totalPago,totalRec};
  },[lancs,hoje]);

  const ABAS = [
    {id:"lancamentos",   label:"📋 Lançamentos"},
    {id:"contas_pagar",  label:"📤 Contas a Pagar"},
    {id:"contas_receber",label:"📥 Contas a Receber"},
    {id:"fluxo",         label:"📊 Fluxo de Caixa"},
    {id:"custo_obra",    label:"🏗️ Custo por Obra"},
    {id:"aging",         label:"⏱ Aging / Inadimplência"},
  ];

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Financeiro</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{lancs.length} lançamentos</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal({lanc:null})}>+ Lançamento</button>
      </div>

      {/* KPIs globais */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:18}}>
        <div className="metric" style={{borderLeft:"3px solid var(--vermelho)"}}>
          <div className="metric-label">A pagar (aberto)</div>
          <div className="metric-value red" style={{fontSize:18}}>{fmt(kpis.aPagar)}</div>
          {kpis.vencPagar>0&&<div style={{fontSize:11,color:"var(--vermelho)",marginTop:2}}>⚠ {fmt(kpis.vencPagar)} vencidos</div>}
        </div>
        <div className="metric" style={{borderLeft:"3px solid var(--verde)"}}>
          <div className="metric-label">A receber (aberto)</div>
          <div className="metric-value green" style={{fontSize:18}}>{fmt(kpis.aReceber)}</div>
          {kpis.vencRec>0&&<div style={{fontSize:11,color:"var(--vermelho)",marginTop:2}}>⚠ {fmt(kpis.vencRec)} em atraso</div>}
        </div>
        <div className="metric" style={{borderLeft:`3px solid ${kpis.saldo>=0?"var(--verde)":"var(--vermelho)"}`}}>
          <div className="metric-label">Saldo projetado</div>
          <div className="metric-value" style={{fontSize:18,color:kpis.saldo>=0?"var(--verde)":"var(--vermelho)"}}>{fmt(kpis.saldo)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total pago (histórico)</div>
          <div className="metric-value" style={{fontSize:16}}>{fmt(kpis.totalPago)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total recebido (histórico)</div>
          <div className="metric-value green" style={{fontSize:16}}>{fmt(kpis.totalRec)}</div>
        </div>
      </div>

      {/* Sub-abas */}
      <div style={{display:"flex",gap:0,marginBottom:20,borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",flexWrap:"wrap"}}>
        {ABAS.map((a,i)=>(
          <button key={a.id} onClick={()=>setAba(a.id)}
            style={{flex:"1 1 auto",padding:"9px 10px",border:"none",cursor:"pointer",
              background:aba===a.id?"#1A1A1A":"var(--cinza-lt)",
              color:aba===a.id?"#F5C800":"#4A4A4A",
              borderRight:i<ABAS.length-1?"1px solid var(--border)":"none",
              transition:"all .15s",fontSize:11,fontWeight:aba===a.id?700:400,whiteSpace:"nowrap"}}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {aba==="lancamentos"   &&<AbaLancamentos    lancs={lancs} obras={obras} loading={loading} hoje={hoje} addToast={addToast}/>}
      {aba==="contas_pagar"  &&<AbaContasPagar    lancs={lancs} obras={obras} hoje={hoje} addToast={addToast}/>}
      {aba==="contas_receber"&&<AbaContasReceber  lancs={lancs} obras={obras} hoje={hoje} addToast={addToast}/>}
      {aba==="fluxo"         &&<AbaFluxoCaixa     lancs={lancs}/>}
      {aba==="custo_obra"    &&<AbaCustoObra      lancs={lancs} obras={obras}/>}
      {aba==="aging"         &&<AbaAging          lancs={lancs} obras={obras} hoje={hoje} addToast={addToast}/>}

      {modal&&<LancamentoModal lanc={modal.lanc} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
