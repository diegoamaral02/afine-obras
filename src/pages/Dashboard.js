// src/pages/Dashboard.js — Home sem obra obrigatória, painel geral
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard({ obraAtual }) {
  const { userProfile } = useAuth();
  const [obras,   setObras]   = useState([]);
  const [escopos, setEscopos] = useState([]);
  const [ocorr,   setOcorr]   = useState([]);
  const [manuts,  setManuts]  = useState([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"obras"), snap => setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2 = onSnapshot(query(collection(db,"manutencoes"),where("status","in",["ABERTA","EM ANDAMENTO"])), snap => setManuts(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();};
  }, []);

  useEffect(() => {
    if (!obraAtual) return;
    const q = query(collection(db,"ocorrencias"),where("obraId","==",obraAtual),where("status","==","ABERTA"));
    return onSnapshot(q, snap => setOcorr(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, [obraAtual]);

  const andamento = obras.filter(o=>o.status==="EM ANDAMENTO");
  const concluidas = obras.filter(o=>o.status==="CONCLUÍDA");

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:22, fontWeight:700, color:"#1A1A1A" }}>
          Olá, {userProfile?.nome?.split(" ")[0] || "bem-vindo"} 👋
        </h2>
        <p style={{ fontSize:13, color:"#7A7A7A", marginTop:4 }}>
          Painel geral — AFINE A.F. Nery Arquitetura &amp; Construção
        </p>
      </div>

      {/* KPIs */}
      <div className="metrics-grid">
        <div className="metric">
          <div className="metric-label">Obras em andamento</div>
          <div className="metric-value yellow">{andamento.length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Obras concluídas</div>
          <div className="metric-value green">{concluidas.length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Manutenções abertas</div>
          <div className="metric-value red">{manuts.length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Ocorrências abertas</div>
          <div className="metric-value amber">{ocorr.length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total de obras</div>
          <div className="metric-value">{obras.length}</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* Obras em andamento */}
        <div className="card">
          <div className="panel-header">
            <span className="panel-title">Obras em andamento</span>
            <Link to="/obras" className="btn btn-sm">Ver todas →</Link>
          </div>
          {andamento.length === 0 && (
            <div className="empty-state" style={{ padding:"20px 0" }}>
              <p>Nenhuma obra em andamento</p>
            </div>
          )}
          {andamento.map(o => (
            <div key={o.id} style={{ borderBottom:"1px solid var(--border)", paddingBottom:12, marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{o.nome}</div>
                  <div style={{ fontSize:12, color:"#7A7A7A" }}>{o.cliente} · {o.tipo||"–"}</div>
                </div>
                <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:4 }}>
                {o.orcamentoEnviado==="NÃO" && <span style={{ fontSize:10, background:"#FCEAEA", color:"#B83232", padding:"1px 6px", borderRadius:10, fontWeight:600 }}>Orçamento pendente</span>}
                {o.relatorioEnviado==="NÃO" && o.status==="CONCLUÍDA" && <span style={{ fontSize:10, background:"#FEF5DC", color:"#8A6000", padding:"1px 6px", borderRadius:10, fontWeight:600 }}>Relatório pendente</span>}
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${o.progresso>=100?"green":"blue"}`} style={{ width:`${o.progresso||0}%` }}/>
              </div>
              <div style={{ fontSize:11, color:"#7A7A7A", marginTop:3, textAlign:"right" }}>
                {o.progresso||0}% · Término: {fmtDate(o.termino)}
              </div>
            </div>
          ))}
        </div>

        {/* Manutenções urgentes */}
        <div className="card">
          <div className="panel-header">
            <span className="panel-title">Manutenções abertas</span>
            <Link to="/manutencao" className="btn btn-sm">Ver todas →</Link>
          </div>
          {manuts.length === 0 && (
            <div className="empty-state" style={{ padding:"20px 0" }}>
              <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
              <p>Nenhuma manutenção aberta</p>
            </div>
          )}
          {manuts.slice(0,5).map(m => (
            <div key={m.id} className="rdo-card" style={{ marginBottom:8, padding:"10px 12px",
              borderLeft:`3px solid ${m.prioridade==="urgente"?"#B83232":m.prioridade==="alta"?"#BA7517":"#F5C800"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:12 }}>{m.titulo}</div>
                  <div style={{ fontSize:11, color:"#7A7A7A" }}>{m.cliente} · {m.agencia}</div>
                </div>
                <span className={`badge ${m.prioridade==="urgente"?"badge-red":m.prioridade==="alta"?"badge-amber":"badge-yellow"}`} style={{ fontSize:10 }}>
                  {m.prioridade}
                </span>
              </div>
              {m.semOT && <div style={{ fontSize:10, marginTop:4, color:"#8A6000" }}>⚠ S/OT pendente</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Ocorrências abertas da obra */}
      {ocorr.length > 0 && (
        <div className="card" style={{ marginTop:16 }}>
          <div className="panel-header">
            <span className="panel-title">⚠️ Ocorrências abertas na obra selecionada</span>
            <Link to="/ocorrencias" className="btn btn-sm">Ver todas →</Link>
          </div>
          {ocorr.map(o => (
            <div key={o.id} className="rdo-card" style={{ borderLeft:"3px solid var(--vermelho)", paddingLeft:13, marginBottom:8 }}>
              <div className="rdo-header">
                <span style={{ fontWeight:600, fontSize:12 }}>{o.tipo}</span>
                <span className="badge badge-red">ABERTA</span>
              </div>
              <p style={{ fontSize:12, color:"#444" }}>{o.descricao}</p>
              <p style={{ fontSize:11, color:"#7A7A7A", marginTop:4 }}>
                Resp: {o.responsavel} · Prazo: {fmtDate(o.prazo)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Acesso rápido */}
      <div style={{ marginTop:16 }}>
        <div className="section-heading">Acesso rápido</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10 }}>
          {[
            { to:"/obras",       icon:"🏗️", label:"Nova obra" },
            { to:"/manutencao",  icon:"🔧", label:"Nova manutenção" },
            { to:"/diario",      icon:"📓", label:"Registro do dia" },
            { to:"/materiais",   icon:"📦", label:"Estoque" },
            { to:"/funcionarios",icon:"👤", label:"Funcionários" },
            { to:"/ocorrencias", icon:"⚠️", label:"Ocorrências" },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{ textDecoration:"none" }}>
              <div style={{ background:"var(--afine-white)", border:"1px solid var(--border)", borderRadius:10, padding:"16px 14px", display:"flex", flexDirection:"column", alignItems:"center", gap:8, cursor:"pointer", transition:"all .15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--afine-yellow)"; e.currentTarget.style.boxShadow="0 2px 12px rgba(245,200,0,.15)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.boxShadow="none"; }}>
                <span style={{ fontSize:24 }}>{item.icon}</span>
                <span style={{ fontSize:12, fontWeight:600, color:"#1A1A1A", textAlign:"center" }}>{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
