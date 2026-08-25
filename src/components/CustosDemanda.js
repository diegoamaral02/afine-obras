// src/components/CustosDemanda.js
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { isGestorOuAdm, isExterno } from "../constants/departamentos";
import { addComAuditoria, updateComAuditoria, deleteComAuditoria } from "../services/auditoria";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";

const TIPOS_CUSTO = [
  "Empreiteiro","Terceiro","Material avulso","Mão de obra","Subempreitada",
  "Aluguel de equipamento","Transporte","Descarte/Caçamba","Medição","Outros",
];
const STATUS_CUSTO = ["pendente","aprovado","pago","cancelado"];
const STATUS_COR = { pendente:"var(--afine-yellow-dk)", aprovado:"var(--verde)", pago:"#185FA5", cancelado:"#7A7A7A" };
const STATUS_BG  = { pendente:"var(--afine-yellow-lt)", aprovado:"var(--verde-lt)", pago:"rgba(24,95,165,.1)", cancelado:"var(--cinza-lt)" };
const fmt  = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const hoje = () => new Date().toISOString().split("T")[0];

const FORM_VAZIO = (nomeUser) => ({
  descricao:"", tipo:"", valor:"", data:hoje(),
  prestadorNome: nomeUser, // preenche automaticamente com o usuário logado
  localCompra:"", reembolsavel:"nao", obs:"",
});

export default function CustosDemanda({ demandaTipo, demandaId, demandaNome, orcamento, impostoPercent, custoMaoDeObra }) {
  const { userProfile, currentUser } = useAuth();
  const nomeUser = userProfile?.nome || currentUser?.email || "–";

  const podeAprovar = isGestorOuAdm(userProfile) ||
    ["financeiro","fiscal","compras"].includes(userProfile?.departamento||userProfile?.perfil||"");
  const souExterno  = isExterno(userProfile);
  if (souExterno) return null; // empreiteiro/terceiro não veem a aba

  const souCampoDep = !podeAprovar && !souExterno;
  const podeLancar  = !souExterno;

  const [custos,       setCustos]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [formAberto,   setFormAberto]   = useState(false);
  const [editandoId,   setEditandoId]   = useState(null); // ID do custo sendo editado
  const [form, setForm] = useState(FORM_VAZIO(nomeUser));
  const [saving, setSaving] = useState(false);

  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  useEffect(() => {
    if (!demandaId) return;
    const q = query(collection(db,"custos_demanda"), where("demandaId","==",demandaId));
    const u = onSnapshot(q, snap => { setCustos(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); });
    return u;
  }, [demandaId]);

  function abrirNovo() {
    setEditandoId(null);
    setForm(FORM_VAZIO(nomeUser));
    setFormAberto(true);
  }

  function abrirEdicao(c) {
    setEditandoId(c.id);
    setForm({
      descricao:    c.descricao||"",
      tipo:         c.tipo||"",
      valor:        c.valor||"",
      data:         c.data||hoje(),
      prestadorNome:c.prestadorNome||nomeUser,
      localCompra:  c.localCompra||"",
      reembolsavel: c.reembolsavel||"nao",
      obs:          c.obs||"",
    });
    setFormAberto(true);
  }

  async function salvar() {
    if (!form.descricao || !form.valor || !form.tipo) { alert("Preencha descrição, tipo e valor."); return; }
    setSaving(true);
    const payload = {
      ...form, valor: Number(form.valor),
      demandaTipo, demandaId, demandaNome: demandaNome||"",
    };
    try {
      if (editandoId) {
        await updateComAuditoria("custos_demanda", editandoId, payload, currentUser?.uid, userProfile?.nome);
      } else {
        await addComAuditoria("custos_demanda", {
          ...payload, status:"pendente",
          lancadoPorId: currentUser?.uid||"", lancadoPorNome: nomeUser,
        }, currentUser?.uid, userProfile?.nome);
      }
      setFormAberto(false);
      setEditandoId(null);
    } finally { setSaving(false); }
  }

  async function alterarStatus(id, novoStatus) {
    await updateComAuditoria("custos_demanda", id, {
      status: novoStatus, aprovadoPor: nomeUser, aprovadoEm: new Date().toISOString(),
    }, currentUser?.uid, userProfile?.nome);
  }

  async function excluir(id) {
    if (!window.confirm("Excluir este lançamento?")) return;
    await deleteComAuditoria("custos_demanda", id, currentUser?.uid, userProfile?.nome);
  }

  const custosFiltrados = useMemo(()=>{
    let base = filtroStatus==="todos" ? custos : custos.filter(c=>c.status===filtroStatus);
    if (souCampoDep) base = base.filter(c=>c.lancadoPorId===currentUser?.uid||c.lancadoPorNome===nomeUser);
    return [...base].sort((a,b)=>(b.data||"").localeCompare(a.data||""));
  },[custos, filtroStatus, souCampoDep, currentUser, nomeUser]);

  const totais = useMemo(() => ({
    geral:    custos.filter(c=>c.status!=="cancelado").reduce((s,c)=>s+(c.valor||0),0),
    aprovado: custos.filter(c=>c.status==="aprovado").reduce((s,c)=>s+(c.valor||0),0),
    pago:     custos.filter(c=>c.status==="pago").reduce((s,c)=>s+(c.valor||0),0),
    pendente: custos.filter(c=>c.status==="pendente").reduce((s,c)=>s+(c.valor||0),0),
  }),[custos]);

  const orcNum      = Number(orcamento)||0;
  const impPct      = Number(impostoPercent)||0;
  const maoDeObra   = Number(custoMaoDeObra)||0;
  // Saldo calculado a partir do líquido (após imposto e mão de obra)
  const orcLiquido  = orcNum * (1 - impPct/100) - maoDeObra;
  const pctGasto    = orcLiquido>0 ? Math.min(100, Math.round(totais.geral/orcLiquido*100)) : 0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* KPIs + orçamento — só para gestão/fiscal/financeiro/compras/adm */}
      {podeAprovar && (<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
          <div className="kpi-card"><div className="kpi-label">TOTAL LANÇADO</div><div className="kpi-value">{fmt(totais.geral)}</div><div style={{fontSize:11,color:"#7A7A7A"}}>{custos.filter(c=>c.status!=="cancelado").length} item(ns)</div></div>
          <div className="kpi-card" style={{borderLeftColor:"var(--afine-yellow-dk)"}}><div className="kpi-label">PENDENTE APROVAÇÃO</div><div className="kpi-value" style={{color:"var(--afine-yellow-dk)",fontSize:18}}>{fmt(totais.pendente)}</div></div>
          <div className="kpi-card" style={{borderLeftColor:"var(--verde)"}}><div className="kpi-label">APROVADO</div><div className="kpi-value" style={{color:"var(--verde)",fontSize:18}}>{fmt(totais.aprovado)}</div></div>
          <div className="kpi-card" style={{borderLeftColor:"#185FA5"}}><div className="kpi-label">PAGO</div><div className="kpi-value" style={{color:"#185FA5",fontSize:18}}>{fmt(totais.pago)}</div></div>
          {orcNum>0 && (
            <div className="kpi-card" style={{borderLeftColor:totais.geral<=orcLiquido?"var(--verde)":"var(--vermelho)"}}>
              <div className="kpi-label">SALDO ORÇAMENTO</div>
              <div className="kpi-value" style={{fontSize:18,color:orcLiquido-totais.geral>=0?"var(--verde)":"var(--vermelho)"}}>{fmt(orcLiquido-totais.geral)}</div>
              {(impPct>0||maoDeObra>0) && <div style={{fontSize:10,color:"#7A7A7A"}}>líquido após impostos{maoDeObra>0?" e mão de obra":""}</div>}
            </div>
          )}
        </div>
        {orcNum>0 && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#7A7A7A",marginBottom:4}}>
              <span>Base: {fmt(orcLiquido)}{(impPct>0||maoDeObra>0)?` (líquido)`:""}</span>
              <span style={{fontWeight:700,color:pctGasto>=100?"var(--vermelho)":"var(--afine-black)"}}>{pctGasto}% utilizado</span>
            </div>
            <div className="progress-bar" style={{height:8}}>
              <div className={`progress-fill ${pctGasto>=100?"red":pctGasto>=80?"amber":"green"}`} style={{width:`${pctGasto}%`}}/>
            </div>
          </div>
        )}
      </>)}

      {/* Barra de ações */}
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        {podeLancar && !formAberto && (
          <button className="btn btn-primary" onClick={abrirNovo}>+ Lançar custo</button>
        )}
        {podeAprovar && (
          <BtnExcel disabled={custos.length===0} onClick={()=>exportarExcel(custos,"custos_demanda",[
            {key:"data",header:"Data"},{key:"tipo",header:"Tipo"},{key:"descricao",header:"Descrição"},
            {key:"prestadorNome",header:"Responsável"},{key:"localCompra",header:"Local de compra"},
            {key:"valor",header:"Valor",format:v=>Number(v||0).toFixed(2)},{key:"status",header:"Status"},
            {key:"reembolsavel",header:"Reembolsável"},{key:"lancadoPorNome",header:"Lançado por"},
          ])}/>
        )}
        <div className="chip-row" style={{margin:0,flex:1}}>
          {["todos",...STATUS_CUSTO].map(s=>(
            <button key={s} className={`chip ${filtroStatus===s?"active":""}`} onClick={()=>setFiltroStatus(s)}>
              {s==="todos"?"Todos":s}{s!=="todos"&&` (${custos.filter(c=>c.status===s).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Formulário (novo ou edição) */}
      {podeLancar && formAberto && (
        <div style={{border:"1px solid var(--afine-yellow-dk)",borderRadius:10,padding:14,background:"var(--afine-yellow-lt)"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>
            {editandoId ? "✏️ Editar lançamento" : "Novo lançamento de custo"}
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="required">Tipo de custo</label>
              <select value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
                <option value="">Selecione...</option>
                {TIPOS_CUSTO.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="required">Data</label>
              <input type="date" value={form.data} onChange={e=>set("data",e.target.value)}/>
            </div>
            <div className="form-group span-2">
              <label className="required">Descrição do serviço / custo</label>
              <input value={form.descricao} onChange={e=>set("descricao",e.target.value)} placeholder="Ex: Instalação elétrica 2º pavimento"/>
            </div>
            <div className="form-group">
              <label className="required">Valor (R$)</label>
              <input type="number" step="0.01" value={form.valor} onChange={e=>set("valor",e.target.value)} placeholder="0,00"/>
            </div>
            <div className="form-group">
              <label>Responsável pelo lançamento</label>
              <input value={form.prestadorNome} onChange={e=>set("prestadorNome",e.target.value)}/>
            </div>
            <div className="form-group">
              <label>Local de compra / Fornecedor</label>
              <input value={form.localCompra} onChange={e=>set("localCompra",e.target.value)} placeholder="Ex: Leroy Merlin, Fornecedor X"/>
            </div>
            <div className="form-group">
              <label>Observações</label>
              <input value={form.obs} onChange={e=>set("obs",e.target.value)}/>
            </div>
            {/* Reembolsável — mesma lógica das Despesas */}
            <div className="form-group span-2" style={{background:"rgba(0,0,0,.04)",borderRadius:8,padding:10}}>
              <label className="required" style={{display:"block",marginBottom:8}}>Necessita reembolso?</label>
              <div style={{display:"flex",gap:6}}>
                {[["nao","Não necessita reembolso"],["sim","Sim, necessita reembolso"]].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>set("reembolsavel",v)}
                    style={{flex:1,padding:"8px 6px",fontSize:12,borderRadius:8,cursor:"pointer",
                      border:`1px solid ${form.reembolsavel===v?"var(--afine-yellow-dk)":"var(--border)"}`,
                      background:form.reembolsavel===v?"var(--afine-white)":"var(--cinza-lt)",
                      fontWeight:form.reembolsavel===v?700:400}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button className="btn" onClick={()=>{setFormAberto(false);setEditandoId(null);}}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={saving}>
              {saving?"Salvando...":(editandoId?"✓ Salvar alterações":"✓ Confirmar lançamento")}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading && <div className="spinner"/>}
      {!loading && custosFiltrados.length===0 && (
        <div className="empty-state"><div className="empty-icon">💰</div><p>Nenhum custo lançado{filtroStatus!=="todos"?` com status "${filtroStatus}"`:" nesta demanda"}.</p></div>
      )}
      {!loading && custosFiltrados.length>0 && (
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {custosFiltrados.map(c=>(
            <div key={c.id} style={{border:"1px solid var(--border)",borderRadius:8,padding:12,display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap",background:"#fff"}}>
              <div style={{flex:"1 1 200px",minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13}}>{c.descricao}</div>
                <div style={{fontSize:11,color:"#7A7A7A",marginTop:3,display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span>{c.data?.split("-").reverse().join("/")}</span>
                  <span className="badge badge-gray" style={{fontSize:9}}>{c.tipo}</span>
                  {c.prestadorNome && <span>👤 {c.prestadorNome}</span>}
                  {c.localCompra && <span>🏪 {c.localCompra}</span>}
                  {c.reembolsavel==="sim" && <span style={{color:"var(--vermelho)",fontWeight:600,fontSize:10}}>⟳ Reembolso</span>}
                </div>
                {c.obs && <div style={{fontSize:11,color:"#7A7A7A",fontStyle:"italic",marginTop:2}}>{c.obs}</div>}
                <div style={{fontSize:10,color:"#B8B6AE",marginTop:2}}>Lançado por {c.lancadoPorNome||"–"}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontWeight:700,fontSize:15}}>{fmt(c.valor)}</div>
                <span style={{fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:10,display:"inline-block",marginTop:4,
                  background:STATUS_BG[c.status]||"var(--cinza-lt)",color:STATUS_COR[c.status]||"#7A7A7A"}}>
                  {c.status}
                </span>
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0,flexWrap:"wrap"}}>
                {/* Editar: lançador pode editar se pendente; gestão pode sempre */}
                {(c.status==="pendente"||(podeAprovar)) && (c.lancadoPorId===currentUser?.uid||podeAprovar) && (
                  <button className="btn btn-sm" style={{fontSize:11}} onClick={()=>abrirEdicao(c)}>✏️</button>
                )}
                {podeAprovar && (<>
                  {c.status==="pendente" && <>
                    <button className="btn btn-sm" style={{background:"var(--verde-lt)",color:"var(--verde)",border:"none",fontSize:11}} onClick={()=>alterarStatus(c.id,"aprovado")}>✓ Aprovar</button>
                    <button className="btn btn-sm" style={{fontSize:11,color:"var(--vermelho)"}} onClick={()=>alterarStatus(c.id,"cancelado")}>✕ Cancelar</button>
                  </>}
                  {c.status==="aprovado" && (<>
                    <button className="btn btn-sm" style={{background:"rgba(24,95,165,.1)",color:"#185FA5",border:"none",fontSize:11}} onClick={()=>alterarStatus(c.id,"pago")}>💳 Pago</button>
                    <button className="btn btn-sm" style={{fontSize:11,color:"#7A7A7A"}} title="Voltar para pendente" onClick={()=>alterarStatus(c.id,"pendente")}>↩ Pendente</button>
                  </>)}
                  {c.status==="pago" && (
                    <button className="btn btn-sm" style={{fontSize:11,color:"#7A7A7A"}} title="Voltar para aprovado" onClick={()=>alterarStatus(c.id,"aprovado")}>↩ Aprovado</button>
                  )}
                  {c.status==="cancelado" && (
                    <button className="btn btn-sm" style={{fontSize:11,color:"#7A7A7A"}} title="Reativar como pendente" onClick={()=>alterarStatus(c.id,"pendente")}>↩ Reativar</button>
                  )}
                  <button className="btn btn-sm" style={{color:"var(--vermelho)",fontSize:11}} onClick={()=>excluir(c.id)}>🗑️</button>
                </>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
