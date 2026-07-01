// src/components/CustosDemanda.js
// Aba de custos vinculados a uma demanda (obra ou manutenção).
// Permite lançar, visualizar e aprovar custos de empreiteiros, terceiros,
// materiais avulsos e qualquer outra saída vinculada à demanda.
// Também puxa automaticamente os custos já registrados em Compras e Despesas.
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { isCampo, isExterno } from "../constants/departamentos";

const TIPOS_CUSTO = [
  "Empreiteiro","Terceiro","Material avulso","Mão de obra","Subempreitada",
  "Aluguel de equipamento","Transporte","Descarte/Caçamba","Outros",
];
const STATUS_CUSTO = ["pendente","aprovado","pago","cancelado"];
const fmt  = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const hoje = () => new Date().toISOString().split("T")[0];

export default function CustosDemanda({ demandaTipo, demandaId, demandaNome, orcamento }) {
  const { userProfile, currentUser } = useAuth();
  const nomeUser = userProfile?.nome || currentUser?.email || "–";
  const souCampoOuExterno = isCampo(userProfile);
  const souExterno = isExterno(userProfile);
  const podeAprovar = !souCampoOuExterno; // Gestão/Financeiro/ADM aprovam

  const [custos,     setCustos]     = useState([]);
  const [compras,    setCompras]    = useState([]);
  const [despesas,   setDespesas]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState({
    descricao:"", tipo:"", valor:"", data:hoje(),
    prestadorNome: souExterno ? nomeUser : "",
    empresa: souExterno ? (userProfile?.empresa||"") : "",
    obs:"",
  });

  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  useEffect(() => {
    if (!demandaId) return;
    const q = query(collection(db,"custos_demanda"), where("demandaId","==",demandaId));
    const u1 = onSnapshot(q, snap => { setCustos(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); });
    const u2 = onSnapshot(query(collection(db,"compras"), where("demandaId","==",demandaId)), snap => setCompras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3 = onSnapshot(query(collection(db,"despesas"), where(demandaTipo==="obra"?"obraId":"manutencaoId","==",demandaId)), snap => setDespesas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { u1(); u2(); u3(); };
  }, [demandaId, demandaTipo]);

  async function lancar() {
    if (!form.descricao || !form.valor || !form.tipo) { alert("Preencha descrição, tipo e valor."); return; }
    const payload = {
      ...form, valor: Number(form.valor),
      demandaTipo, demandaId, demandaNome: demandaNome||"",
      status: "pendente",
      lancadoPorId: currentUser?.uid||"",
      lancadoPorNome: nomeUser,
      createdAt: new Date().toISOString(),
    };
    await addDoc(collection(db,"custos_demanda"), payload);
    setForm({ descricao:"", tipo:"", valor:"", data:hoje(), prestadorNome: souExterno?nomeUser:"", empresa: souExterno?(userProfile?.empresa||""):"", obs:"" });
    setFormAberto(false);
  }

  async function alterarStatus(id, novoStatus) {
    await updateDoc(doc(db,"custos_demanda",id), { status: novoStatus, aprovadoPor: nomeUser, aprovadoEm: new Date().toISOString() });
  }

  async function excluir(id) {
    if (!window.confirm("Excluir este lançamento?")) return;
    await deleteDoc(doc(db,"custos_demanda",id));
  }

  // ── Cálculos consolidados ─────────────────────────────────────────────────
  const totalCustosLancados = useMemo(() =>
    custos.filter(c=>c.status!=="cancelado").reduce((s,c)=>s+(c.valor||0),0)
  ,[custos]);

  const totalCompras = useMemo(() =>
    compras.filter(c=>["RECEBIDO","AGUARD. NF","NF VINCULADA"].includes(c.status))
      .reduce((s,c)=>s+(c.valorAprovado||c.valorCotado||0),0)
  ,[compras]);

  const totalDespesas = useMemo(() =>
    despesas.reduce((s,d)=>s+(d.valor||0),0)
  ,[despesas]);

  const totalGeral = totalCustosLancados + totalCompras + totalDespesas;
  const orcNum = Number(orcamento)||0;
  const saldoOrcamento = orcNum - totalGeral;
  const pctGasto = orcNum>0 ? Math.min(100, Math.round(totalGeral/orcNum*100)) : 0;

  const STATUS_COR = { pendente:"var(--afine-yellow-dk)", aprovado:"var(--verde)", pago:"#185FA5", cancelado:"#7A7A7A" };
  const STATUS_BG  = { pendente:"var(--afine-yellow-lt)", aprovado:"var(--verde-lt)", pago:"rgba(24,95,165,.1)", cancelado:"var(--cinza-lt)" };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* KPIs ─────────────────────────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
        <div className="kpi-card"><div className="kpi-label">TOTAL GERAL</div><div className="kpi-value">{fmt(totalGeral)}</div></div>
        <div className="kpi-card" style={{borderLeftColor:"var(--vermelho)"}}>
          <div className="kpi-label">LANÇAMENTOS MANUAIS</div>
          <div className="kpi-value" style={{fontSize:16}}>{fmt(totalCustosLancados)}</div>
        </div>
        <div className="kpi-card" style={{borderLeftColor:"#7B4F00"}}>
          <div className="kpi-label">COMPRAS (recebidas)</div>
          <div className="kpi-value" style={{fontSize:16}}>{fmt(totalCompras)}</div>
        </div>
        <div className="kpi-card" style={{borderLeftColor:"var(--afine-yellow-dk)"}}>
          <div className="kpi-label">DESPESAS</div>
          <div className="kpi-value" style={{fontSize:16}}>{fmt(totalDespesas)}</div>
        </div>
        {orcNum>0 && (
          <div className="kpi-card" style={{borderLeftColor:saldoOrcamento>=0?"var(--verde)":"var(--vermelho)"}}>
            <div className="kpi-label">SALDO DO ORÇAMENTO</div>
            <div className="kpi-value" style={{fontSize:16,color:saldoOrcamento>=0?"var(--verde)":"var(--vermelho)"}}>{fmt(saldoOrcamento)}</div>
          </div>
        )}
      </div>

      {/* Barra de progresso do orçamento */}
      {orcNum>0 && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#7A7A7A",marginBottom:4}}>
            <span>Orçamento: {fmt(orcNum)}</span>
            <span style={{fontWeight:700,color:pctGasto>=100?"var(--vermelho)":"var(--afine-black)"}}>{pctGasto}% utilizado</span>
          </div>
          <div className="progress-bar" style={{height:8}}>
            <div className={`progress-fill ${pctGasto>=100?"red":pctGasto>=80?"amber":"green"}`} style={{width:`${pctGasto}%`}}/>
          </div>
        </div>
      )}

      {/* Botão de novo lançamento */}
      <div>
        {!formAberto ? (
          <button className="btn btn-primary" onClick={()=>setFormAberto(true)}>+ Lançar custo</button>
        ) : (
          <div style={{border:"1px solid var(--border)",borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{fontWeight:600,fontSize:13}}>Novo lançamento de custo</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="required">Tipo</label>
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
                <label className="required">Descrição</label>
                <input value={form.descricao} onChange={e=>set("descricao",e.target.value)} placeholder="Ex: Serviço de instalação elétrica"/>
              </div>
              <div className="form-group">
                <label className="required">Valor (R$)</label>
                <input type="number" step="0.01" value={form.valor} onChange={e=>set("valor",e.target.value)} placeholder="0,00"/>
              </div>
              <div className="form-group">
                <label>Prestador / Empresa</label>
                <input value={form.prestadorNome} onChange={e=>set("prestadorNome",e.target.value)} placeholder="Nome do empreiteiro ou empresa"/>
              </div>
              <div className="form-group span-2">
                <label>Observações</label>
                <input value={form.obs} onChange={e=>set("obs",e.target.value)}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn" onClick={()=>setFormAberto(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={lancar}>Confirmar lançamento</button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de custos lançados manualmente */}
      {loading && <div className="spinner"/>}
      {!loading && custos.length>0 && (
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
            Custos lançados nesta demanda
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[...custos].sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(c=>(
              <div key={c.id} style={{border:"1px solid var(--border)",borderRadius:8,padding:10,display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap"}}>
                <div style={{flex:"1 1 180px",minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13}}>{c.descricao}</div>
                  <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>
                    {c.data?.split("-").reverse().join("/")} · {c.tipo}
                    {c.prestadorNome && ` · ${c.prestadorNome}`}
                    {c.lancadoPorNome && ` · por ${c.lancadoPorNome}`}
                  </div>
                  {c.obs && <div style={{fontSize:11,color:"#7A7A7A",fontStyle:"italic"}}>{c.obs}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:700,fontSize:15}}>{fmt(c.valor)}</div>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:STATUS_BG[c.status]||"var(--cinza-lt)",color:STATUS_COR[c.status]||"#7A7A7A"}}>
                    {c.status}
                  </span>
                </div>
                {podeAprovar && c.status==="pendente" && (
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    <button className="btn btn-sm" style={{background:"var(--verde-lt)",color:"var(--verde)",border:"none",fontSize:11}} onClick={()=>alterarStatus(c.id,"aprovado")}>✓ Aprovar</button>
                    <button className="btn btn-sm" style={{color:"var(--vermelho)",fontSize:11}} onClick={()=>alterarStatus(c.id,"cancelado")}>Cancelar</button>
                  </div>
                )}
                {podeAprovar && c.status==="aprovado" && (
                  <button className="btn btn-sm" style={{background:"rgba(24,95,165,.1)",color:"#185FA5",border:"none",fontSize:11,flexShrink:0}} onClick={()=>alterarStatus(c.id,"pago")}>💳 Marcar pago</button>
                )}
                {podeAprovar && (
                  <button className="btn btn-sm" style={{color:"var(--vermelho)",flexShrink:0,fontSize:11}} onClick={()=>excluir(c.id)}>🗑️</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compras vinculadas (somente leitura) */}
      {compras.filter(c=>["RECEBIDO","AGUARD. NF","NF VINCULADA"].includes(c.status)).length>0 && (
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
            🛒 Compras recebidas (Suprimentos)
          </div>
          {compras.filter(c=>["RECEBIDO","AGUARD. NF","NF VINCULADA"].includes(c.status)).map(c=>(
            <div key={c.id} style={{fontSize:12,padding:"6px 10px",borderRadius:6,background:"var(--cinza-lt)",marginBottom:4,display:"flex",justifyContent:"space-between"}}>
              <span>{c.titulo||"Compra"} · {c.fornecedorNome||"–"} · {c.status}</span>
              <span style={{fontWeight:700}}>{fmt(c.valorAprovado||c.valorCotado||0)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Despesas vinculadas (somente leitura) */}
      {despesas.length>0 && (
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
            🧾 Despesas (reembolsos)
          </div>
          {despesas.map(d=>(
            <div key={d.id} style={{fontSize:12,padding:"6px 10px",borderRadius:6,background:"var(--cinza-lt)",marginBottom:4,display:"flex",justifyContent:"space-between"}}>
              <span>{d.descricao} · {d.funcionarioNome||"–"}</span>
              <span style={{fontWeight:700}}>{fmt(d.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
