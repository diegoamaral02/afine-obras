// src/App.js — v7 ERP com sidebar accordion e todos os módulos
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./contexts/AuthContext";
import { AgendaProvider, useAgenda } from "./contexts/AgendaContext";
import { initials } from "./utils/helpers";
import { LOGO_BASE64 } from "./utils/assets";

import Login           from "./pages/Login";
import PainelGerencial from "./pages/PainelGerencial";
import Dashboard       from "./pages/Dashboard";
import Obras           from "./pages/Obras";
import Diario          from "./pages/Diario";
import Manutencao      from "./pages/Manutencao";
import Funcionarios    from "./pages/Funcionarios";
import Fornecedores    from "./pages/Fornecedores";
import Compras         from "./pages/Compras";
import Financeiro      from "./pages/Financeiro";
import DRE             from "./pages/DRE";
import Medicao         from "./pages/Medicao";
import Calendario      from "./pages/Calendario";
import Comercial       from "./pages/Comercial";
import MateriaisGlobal from "./pages/Materiais";
import { Equipe, Ocorrencias } from "./pages/Equipe";

import "./index.css";

function Protected({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
}

// Estrutura do menu com sub-itens (accordion)
const MENU_STRUCTURE = [
  {
    id:"principal", label:"Principal", roles:["gestor","encarregado","campo"],
    items:[
      { to:"/painel",    icon:"📊", label:"Painel Gerencial", roles:["gestor"] },
      { to:"/",          icon:"🏠", label:"Home",             roles:["gestor","encarregado","campo"] },
      { to:"/calendario",icon:"📅", label:"Calendário",       roles:["gestor","encarregado","campo"] },
    ]
  },
  {
    id:"comercial", label:"Comercial", roles:["gestor","encarregado"],
    items:[
      { to:"/comercial",         icon:"📈", label:"Funil de vendas",  roles:["gestor","encarregado"] },
      { to:"/comercial/clientes",icon:"🏢", label:"Clientes",         roles:["gestor","encarregado"] },
      { to:"/fornecedores",      icon:"🤝", label:"Fornecedores",     roles:["gestor","encarregado"] },
    ]
  },
  {
    id:"operacao", label:"Operação", roles:["gestor","encarregado","campo"],
    items:[
      { to:"/obras",       icon:"🏗️", label:"Obras",           roles:["gestor","encarregado"] },
      { to:"/medicao",     icon:"📐", label:"Medição & FVS",   roles:["gestor","encarregado"] },
      { to:"/manutencao",  icon:"🔧", label:"Manutenção",      roles:["gestor","encarregado","campo"] },
      { to:"/diario",      icon:"📓", label:"Diário de obra",  roles:["gestor","encarregado","campo"] },
      { to:"/ocorrencias", icon:"⚠️", label:"Ocorrências",    roles:["gestor","encarregado","campo"] },
    ]
  },
  {
    id:"suprimentos", label:"Suprimentos", roles:["gestor","encarregado","campo"],
    items:[
      { to:"/compras",   icon:"🛒", label:"Compras",     roles:["gestor","encarregado","campo"] },
      { to:"/materiais", icon:"📦", label:"Materiais",   roles:["gestor","encarregado"] },
    ]
  },
  {
    id:"financeiro", label:"Financeiro", roles:["gestor"],
    items:[
      { to:"/financeiro", icon:"💰", label:"Lançamentos",      roles:["gestor"] },
      { to:"/dre",        icon:"📊", label:"DRE & Indicadores", roles:["gestor"] },
    ]
  },
  {
    id:"pessoas", label:"Pessoas", roles:["gestor","encarregado","campo"],
    items:[
      { to:"/equipe",       icon:"👷", label:"Equipe",        roles:["gestor","encarregado","campo"] },
      { to:"/funcionarios", icon:"👤", label:"Funcionários",  roles:["gestor"] },
    ]
  },
];

function AccordionGroup({ group, perfil, badges, onNavigate }) {
  const location = useLocation();
  const [open, setOpen] = useState(()=>{
    return group.items.some(i=>location.pathname===i.to||location.pathname.startsWith(i.to+"/"));
  });
  const visibleItems = group.items.filter(i=>i.roles.includes(perfil));
  if(!visibleItems.length) return null;
  const hasActive = visibleItems.some(i=>location.pathname===i.to||location.pathname.startsWith(i.to+"/"));

  return (
    <div style={{marginBottom:2}}>
      {/* Group header */}
      <button onClick={()=>setOpen(!open)} style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"7px 16px",background:hasActive?"rgba(245,200,0,.08)":"none",
        border:"none",cursor:"pointer",color:hasActive?"var(--afine-yellow)":"rgba(255,255,255,.45)",
        fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",
        transition:"background .15s",
      }}>
        {group.label}
        <span style={{fontSize:10,opacity:.6,transform:open?"rotate(180deg)":"",transition:"transform .2s"}}>▼</span>
      </button>

      {/* Items */}
      {open && visibleItems.map(item=>{
        const badge = badges[item.to];
        return (
          <NavLink key={item.to} to={item.to} end={item.to==="/"||item.to==="/painel"} onClick={onNavigate}
            className={({isActive})=>`nav-item${isActive?" active":""}`}
            style={{paddingLeft:24}}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {badge>0&&<span className={`nav-badge ${badge.type||"red"}`}>{badge.count}</span>}
          </NavLink>
        );
      })}
    </div>
  );
}

function Sidebar({ obraAtual, badges, sideOpen, setSideOpen }) {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const perfil = userProfile?.perfil || "campo";
  async function handleLogout() { await logout(); navigate("/login"); }

  return (
    <div className={`sidebar ${sideOpen?"open":""}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <img src={LOGO_BASE64} alt="AFINE" style={{height:40,width:"auto",filter:"brightness(0) invert(1)",opacity:.95}}/>
        <div className="sidebar-logo-text"><h1>AFINE</h1><p>ERP · Gestão</p></div>
      </div>

      {/* Obra ativa */}
      {obraAtual && (
        <div className="obra-active-banner">
          <div className="label">Obra ativa</div>
          <div className="nome">{obraAtual.nome}</div>
          <div className="sub">{obraAtual.cliente}</div>
        </div>
      )}

      {/* Menu accordion */}
      <nav style={{flex:1,overflowY:"auto",paddingTop:4}}>
        {MENU_STRUCTURE.map(group=>(
          <AccordionGroup key={group.id} group={group} perfil={perfil} badges={badges} onNavigate={()=>setSideOpen(false)}/>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{initials(userProfile?.nome||currentUser?.email||"?")}</div>
          <div>
            <div className="user-name">{userProfile?.nome||currentUser?.email}</div>
            <div className="user-role">{perfil==="gestor"?"Gestor":perfil==="encarregado"?"Encarregado":"Campo"}</div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Sair">↩</button>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const [obraAtual,    setObraAtual]    = useState(null);
  const [ocorrAbertas, setOcorrAbertas] = useState(0);
  const [manutAbertas, setManutAbertas] = useState(0);
  const [comprasPend,  setComprasPend]  = useState(0);
  const [sideOpen,     setSideOpen]     = useState(false);
  const { agendamentosDodia } = useAgenda();

  const hoje    = new Date().toISOString().split("T")[0];
  const agsHoje = agendamentosDodia(hoje).length;

  useEffect(()=>{
    if(!obraAtual?.id) return;
    return onSnapshot(query(collection(db,"ocorrencias"),where("obraId","==",obraAtual.id),where("status","==","ABERTA")),snap=>setOcorrAbertas(snap.size));
  },[obraAtual]);

  useEffect(()=>{
    const u1=onSnapshot(query(collection(db,"manutencoes"),where("status","in",["ABERTA","EM ANDAMENTO"])),snap=>setManutAbertas(snap.size));
    const u2=onSnapshot(query(collection(db,"compras"),where("status","in",["SOLICITAÇÃO","COTAÇÃO"])),snap=>setComprasPend(snap.size));
    return()=>{u1();u2();};
  },[]);

  const badges = {
    "/manutencao":  manutAbertas>0  ? {count:manutAbertas,  type:"red"}   : 0,
    "/ocorrencias": ocorrAbertas>0  ? {count:ocorrAbertas,  type:"red"}   : 0,
    "/compras":     comprasPend>0   ? {count:comprasPend,   type:"amber"} : 0,
    "/calendario":  agsHoje>0       ? {count:agsHoje,       type:"yellow"}: 0,
  };

  return (
    <div className="app-shell">
      <Sidebar obraAtual={obraAtual} badges={badges} sideOpen={sideOpen} setSideOpen={setSideOpen}/>

      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">{obraAtual?obraAtual.nome:"AFINE · ERP"}</div>
            {obraAtual&&(
              <div className="topbar-obra">
                <span className="obra-tag">{obraAtual.cliente}</span>
                <button onClick={()=>setObraAtual(null)} style={{background:"none",border:"none",fontSize:11,color:"var(--vermelho)",cursor:"pointer",padding:0}}>✕</button>
              </div>
            )}
          </div>
          <button className="btn btn-sm" onClick={()=>setSideOpen(s=>!s)} style={{marginLeft:"auto"}}>☰</button>
        </div>

        <div className="page">
          <Routes>
            <Route path="/"                    element={<Dashboard       obraAtual={obraAtual?.id}/>}/>
            <Route path="/painel"              element={<PainelGerencial/>}/>
            <Route path="/calendario"          element={<Calendario/>}/>
            <Route path="/comercial"           element={<Comercial subpagina="funil"/>}/>
            <Route path="/comercial/clientes"  element={<Comercial subpagina="clientes"/>}/>
            <Route path="/obras"               element={<Obras           onObraSelect={setObraAtual}/>}/>
            <Route path="/medicao"             element={<Medicao         obraAtual={obraAtual?.id}/>}/>
            <Route path="/manutencao"          element={<Manutencao      obraAtual={obraAtual?.id}/>}/>
            <Route path="/diario"              element={<Diario          obraAtual={obraAtual?.id}/>}/>
            <Route path="/equipe"              element={<Equipe          obraAtual={obraAtual?.id}/>}/>
            <Route path="/funcionarios"        element={<Funcionarios/>}/>
            <Route path="/fornecedores"        element={<Fornecedores/>}/>
            <Route path="/compras"             element={<Compras/>}/>
            <Route path="/financeiro"          element={<Financeiro/>}/>
            <Route path="/dre"                 element={<DRE/>}/>
            <Route path="/materiais"           element={<MateriaisGlobal/>}/>
            <Route path="/ocorrencias"         element={<Ocorrencias     obraAtual={obraAtual?.id}/>}/>
            <Route path="*"                    element={<Navigate to="/" replace/>}/>
          </Routes>
        </div>
      </div>

      {sideOpen&&<div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99}}/>}
    </div>
  );
}

function AppRoot() {
  const { currentUser } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={currentUser?<Navigate to="/" replace/>:<Login/>}/>
        <Route path="/*" element={
          <Protected>
            <AgendaProvider>
              <AppShell/>
            </AgendaProvider>
          </Protected>
        }/>
      </Routes>
    </BrowserRouter>
  );
}
export default AppRoot;
