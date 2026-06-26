// src/pages/Dashboard.js — Dashboard executivo com KPIs, pipeline, gráficos
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LOGO_BASE64 } from "../utils/assets";

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round(value/max*100)) : 0;
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
        <span style={{color:"#7A7A7A"}}>{label}</span>
        <span style={{fontWeight:600}}>R$ {Number(value||0).toLocaleString("pt-BR",{minimumFractionDigits:0})}</span>
      </div>
      <div className="progress-bar"><div className="progress-fill" style={{width:`${pct}%`,background:color}}/></div>
    </div>
  );
}

export default function Dashboard({ obraAtual }) {
  const { userProfile } = useAuth();
  const [obras,   setObras]   = useState([]);
  const [manuts,  setManuts]  = useState([]);
  const [ocorr,   setOcorr]   = useState([]);
  const [lancs,   setLancs]   = useState([]);
  const [compras, setCompras] = useState([]);
  const [comprasComprometidas, setComprasComprometidas] = useState([]);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(query(collection(db,"manutencoes"),where("status","in",["ABERTA","EM ANDAMENTO"])),snap=>setManuts(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"financeiro"),snap=>setLancs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4=onSnapshot(query(collection(db,"compras"),where("status","in",["SOLICITAÇÃO","COTAÇÃO","APROVADA"])),snap=>setCompras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    // Compras já aprovadas/em andamento de recebimento — representam valor
    // comprometido ainda não lançado como pagamento no Financeiro
    const u5=onSnapshot(query(collection(db,"compras"),where("status","in",["APROVADA","ORDEM DE COMPRA","RECEBIDO","AGUARD. NF"])),snap=>setComprasComprometidas(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();u4();u5();};
  },[]);

  useEffect(()=>{
    if (!obraAtual) return;
    return onSnapshot(query(collection(db,"ocorrencias"),where("obraId","==",obraAtual),where("status","==","ABERTA")),snap=>setOcorr(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[obraAtual]);

  const hoje = new Date().toISOString().split("T")[0];

  // KPIs financeiros
  // BUG CORRIGIDO: "A pagar" só somava lançamentos manuais do Financeiro
  // (status ABERTO), ignorando compromissos já assumidos via Compras
  // aprovadas/em andamento — por isso ficava R$0 mesmo com compras reais
  // em curso. Agora soma os dois.
  const totalPagarLanc = lancs.filter(l=>l.tipo==="PAGAR"&&l.status==="ABERTO").reduce((s,l)=>s+(l.valor||0),0);
  const totalComprasComprometido = comprasComprometidas
    .reduce((s,c)=>s+(c.valorAprovado||c.valorCotado||0),0);
  const totalPagar   = totalPagarLanc + totalComprasComprometido;
  const totalReceber = lancs.filter(l=>l.tipo==="RECEBER"&&l.status==="ABERTO").reduce((s,l)=>s+(l.valor||0),0);
  const vencidos     = lancs.filter(l=>l.status==="ABERTO"&&l.vencimento<hoje).length;
  const saldo        = totalReceber - totalPagar;

  // Obras stats
  const andamento  = obras.filter(o=>o.status==="EM ANDAMENTO");
  const concluidas = obras.filter(o=>o.status==="CONCLUÍDA");
  // BUG CORRIGIDO: "Orçado total" só somava lançamentos com tipoValor==="orcado"
  // no Financeiro — campo que a equipe praticamente não usa. O orçamento real
  // é preenchido direto em cada Obra (aba Financeiro → "Valor do orçamento"),
  // então agora soma esse campo das obras, que é onde o dado de fato existe.
  const totalOrcado = obras.filter(o=>o.status!=="PARALISADA").reduce((s,o)=>s+(Number(o.valorOrcamento)||0),0);
  const totalReal   = lancs.filter(l=>l.tipoValor==="realizado"&&l.tipo==="PAGAR"&&l.status==="PAGO").reduce((s,l)=>s+(l.valor||0),0);

  const fmt=(v)=>`R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0})}`;

  return (
    <div>
      {/* Welcome */}
      <div style={{marginBottom:20,display:"flex",alignItems:"center",gap:14}}>
        <img src={LOGO_BASE64} alt="AFINE" style={{height:44,width:"auto",opacity:.9}}/>
        <div>
          <h2 style={{fontSize:20,fontWeight:700}}>Olá, {userProfile?.nome?.split(" ")[0]||"bem-vindo"} 👋</h2>
          <p style={{fontSize:12,color:"#7A7A7A",marginTop:2}}>AFINE A.F. Nery Arquitetura &amp; Construção · {new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</p>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="metric"><div className="metric-label">Obras em andamento</div><div className="metric-value yellow">{andamento.length}</div></div>
        <div className="metric"><div className="metric-label">Manutenções abertas</div><div className="metric-value red">{manuts.length}</div></div>
        <div className="metric"><div className="metric-label">Compras pendentes</div><div className="metric-value amber">{compras.length}</div></div>
        <div className="metric"><div className="metric-label">A receber</div><div className="metric-value green" style={{fontSize:18}}>{fmt(totalReceber)}</div></div>
        <div className="metric"><div className="metric-label">A pagar</div><div className="metric-value red" style={{fontSize:18}}>{fmt(totalPagar)}</div></div>
        <div className="metric"><div className="metric-label">Saldo projetado</div><div className="metric-value" style={{fontSize:18,color:saldo>=0?"var(--verde)":"var(--vermelho)"}}>{fmt(saldo)}</div></div>
      </div>

      {vencidos>0&&<div className="alert alert-danger" style={{marginBottom:16}}>⚠️ <strong>{vencidos} lançamento(s) vencido(s)</strong> — acesse o módulo Financeiro para regularizar.</div>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>

        {/* Obras em andamento */}
        <div className="card">
          <div className="panel-header"><span className="panel-title">Obras em andamento</span><Link to="/obras" className="btn btn-sm">Ver todas →</Link></div>
          {andamento.length===0&&<div className="empty-state" style={{padding:"16px 0"}}><p>Nenhuma obra em andamento</p></div>}
          {andamento.slice(0,4).map(o=>(
            <div key={o.id} style={{borderBottom:"1px solid var(--border)",paddingBottom:10,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <div style={{fontWeight:600,fontSize:13}}>{o.nome}</div>
                <div style={{display:"flex",gap:4}}>
                  {o.orcamentoEnviado==="NÃO"&&<span style={{fontSize:9,background:"#FCEAEA",color:"var(--vermelho)",padding:"1px 5px",borderRadius:8,fontWeight:600}}>ORC</span>}
                  {o.relatorioEnviado==="NÃO"&&<span style={{fontSize:9,background:"#FEF5DC",color:"#8A6000",padding:"1px 5px",borderRadius:8,fontWeight:600}}>REL</span>}
                </div>
              </div>
              <div style={{fontSize:11,color:"#7A7A7A",marginBottom:5}}>{o.cliente} · Término: {fmtDate(o.termino)}</div>
              <div className="progress-bar"><div className={`progress-fill ${o.progresso>=100?"green":"blue"}`} style={{width:`${o.progresso||0}%`}}/></div>
              <div style={{fontSize:10,color:"#7A7A7A",marginTop:2,textAlign:"right"}}>{o.progresso||0}%</div>
            </div>
          ))}
        </div>

        {/* Financeiro rápido */}
        <div className="card">
          <div className="panel-header"><span className="panel-title">Custo por nível — geral</span><Link to="/financeiro" className="btn btn-sm">Detalhar →</Link></div>
          <MiniBar label="Orçado total" value={totalOrcado} max={totalOrcado} color="#7A7A7A"/>
          <MiniBar label="Realizado" value={totalReal} max={totalOrcado||totalReal} color={totalReal>totalOrcado?"var(--vermelho)":"var(--verde)"}/>
          <MiniBar label="A pagar (comprometido)" value={totalPagar} max={totalOrcado||totalPagar} color="var(--afine-yellow-dk)"/>
          <div className="divider"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div style={{textAlign:"center",padding:"8px",background:"var(--verde-lt)",borderRadius:8}}>
              <div style={{fontSize:11,color:"var(--verde)"}}>A receber</div>
              <div style={{fontSize:15,fontWeight:700,color:"var(--verde)"}}>{fmt(totalReceber)}</div>
            </div>
            <div style={{textAlign:"center",padding:"8px",background:"var(--vermelho-lt)",borderRadius:8}}>
              <div style={{fontSize:11,color:"var(--vermelho)"}}>A pagar</div>
              <div style={{fontSize:15,fontWeight:700,color:"var(--vermelho)"}}>{fmt(totalPagar)}</div>
            </div>
          </div>
        </div>

        {/* Manutenções urgentes */}
        <div className="card">
          <div className="panel-header"><span className="panel-title">Manutenções abertas</span><Link to="/manutencao" className="btn btn-sm">Ver todas →</Link></div>
          {manuts.length===0&&<div className="empty-state" style={{padding:"16px 0"}}><div style={{fontSize:24,marginBottom:6}}>✅</div><p>Nenhuma manutenção aberta</p></div>}
          {manuts.slice(0,5).map(m=>(
            <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>{m.titulo}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>{m.cliente} · {m.agencia}</div>
                {m.semOT&&<span style={{fontSize:9,background:"#FEF5DC",color:"#8A6000",padding:"1px 5px",borderRadius:8,fontWeight:600}}>S/OT</span>}
              </div>
              <span className={`badge ${m.prioridade==="urgente"?"badge-red":m.prioridade==="alta"?"badge-amber":"badge-gray"}`} style={{fontSize:10}}>{m.prioridade}</span>
            </div>
          ))}
        </div>

        {/* Compras pendentes */}
        <div className="card">
          <div className="panel-header"><span className="panel-title">Compras pendentes</span><Link to="/compras" className="btn btn-sm">Ver todas →</Link></div>
          {compras.length===0&&<div className="empty-state" style={{padding:"16px 0"}}><div style={{fontSize:24,marginBottom:6}}>✅</div><p>Nenhuma compra pendente</p></div>}
          {compras.slice(0,5).map(c=>(
            <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>{c.titulo}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>{c.demandaNome||c.demandaTipo} · {c.autorNome}</div>
              </div>
              <span className={`badge ${STATUS_COLOR[c.status]||"badge-gray"}`} style={{fontSize:10}}>{c.status}</span>
            </div>
          ))}
        </div>

      </div>

      {/* Acesso rápido */}
      <div style={{marginTop:16}}>
        <div className="section-heading">Acesso rápido</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
          {[
            {to:"/obras",icon:"🏗️",label:"Nova obra"},
            {to:"/manutencao",icon:"🔧",label:"Manutenção"},
            {to:"/compras",icon:"🛒",label:"Compras"},
            {to:"/financeiro",icon:"💰",label:"Financeiro"},
            {to:"/diario",icon:"📓",label:"RDO do dia"},
            {to:"/materiais",icon:"📦",label:"Estoque"},
            {to:"/fornecedores",icon:"🏢",label:"Fornecedores"},
            {to:"/funcionarios",icon:"👤",label:"Equipe"},
          ].map(item=>(
            <Link key={item.to} to={item.to} style={{textDecoration:"none"}}>
              <div style={{background:"var(--afine-white)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer",transition:"all .15s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--afine-yellow)";e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.transform="";}}>
                <span style={{fontSize:22}}>{item.icon}</span>
                <span style={{fontSize:11,fontWeight:600,color:"#1A1A1A",textAlign:"center",lineHeight:1.3}}>{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const STATUS_COLOR={"SOLICITAÇÃO":"badge-gray","COTAÇÃO":"badge-blue","APROVADA":"badge-yellow","ORDEM DE COMPRA":"badge-purple","RECEBIDO":"badge-green","NF VINCULADA":"badge-green"};
