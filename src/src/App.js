// src/App.js — v5 com todos os módulos
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./contexts/AuthContext";
import { initials } from "./utils/helpers";
import { LOGO_BASE64 } from "./utils/assets";

import Login        from "./pages/Login";
import Dashboard    from "./pages/Dashboard";
import Obras        from "./pages/Obras";
import Diario       from "./pages/Diario";
import Manutencao   from "./pages/Manutencao";
import Funcionarios from "./pages/Funcionarios";
import Fornecedores from "./pages/Fornecedores";
import Compras      from "./pages/Compras";
import Financeiro   from "./pages/Financeiro";
import DRE          from "./pages/DRE";
import Medicao      from "./pages/Medicao";
import MateriaisGlobal from "./pages/Materiais";
import { Equipe, Ocorrencias } from "./pages/Equipe";

import "./index.css";

function Protected({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
}

function Sidebar({ obraAtual, ocorrAbertas, manutAbertas, comprasPend, sideOpen, setSideOpen }) {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const perfil = userProfile?.perfil || "campo";
  async function handleLogout() { await logout(); navigate("/login"); }

  const navGroups = [
    { label:"Principal", items:[
      { to:"/", icon:"🏠", label:"Home", roles:["gestor","encarregado","campo"] },
    ]},
    { label:"Operação", items:[
      { to:"/obras",       icon:"🏗️", label:"Obras",           roles:["gestor","encarregado"] },
      { to:"/medicao",     icon:"📐", label:"Medição & FVS",   roles:["gestor","encarregado"] },
      { to:"/manutencao",  icon:"🔧", label:"Manutenção",      roles:["gestor","encarregado","campo"], badge:manutAbertas>0?manutAbertas:null, badgeType:"red" },
      { to:"/diario",      icon:"📓", label:"Diário de obra",  roles:["gestor","encarregado","campo"] },
      { to:"/ocorrencias", icon:"⚠️", label:"Ocorrências",    roles:["gestor","encarregado","campo"], badge:ocorrAbertas>0?ocorrAbertas:null, badgeType:"red" },
    ]},
    { label:"Suprimentos", items:[
      { to:"/compras",      icon:"🛒", label:"Compras",        roles:["gestor","encarregado","campo"], badge:comprasPend>0?comprasPend:null, badgeType:"amber" },
      { to:"/materiais",    icon:"📦", label:"Materiais",      roles:["gestor","encarregado"] },
      { to:"/fornecedores", icon:"🏢", label:"Fornecedores",   roles:["gestor","encarregado"] },
    ]},
    { label:"Financeiro", items:[
      { to:"/financeiro",   icon:"💰", label:"Lançamentos",    roles:["gestor"] },
      { to:"/dre",          icon:"📊", label:"DRE & Indicadores", roles:["gestor"] },
    ]},
    { label:"Pessoas", items:[
      { to:"/equipe",       icon:"👷", label:"Equipe",         roles:["gestor","encarregado"] },
      { to:"/funcionarios", icon:"👤", label:"Funcionários",   roles:["gestor"] },
    ]},
  ];

  return (
    <div className={`sidebar ${sideOpen?"open":""}`}>
      <div className="sidebar-logo">
        <img src={LOGO_BASE64} alt="AFINE" style={{height:40,width:"auto",filter:"brightness(0) invert(1)",opacity:.95}}/>
        <div className="sidebar-logo-text"><h1>AFINE</h1><p>Gestão de Obras</p></div>
      </div>

      {obraAtual && (
        <div className="obra-active-banner">
          <div className="label">Obra ativa</div>
          <div className="nome">{obraAtual.nome}</div>
          <div className="sub">{obraAtual.cliente}</div>
        </div>
      )}

      <nav style={{flex:1,overflowY:"auto"}}>
        {navGroups.map(group=>{
          const visible=group.items.filter(i=>i.roles.includes(perfil));
          if(!visible.length) return null;
          return (
            <div key={group.label}>
              <div className="nav-section">{group.label}</div>
              {visible.map(item=>(
                <NavLink key={item.to} to={item.to} end={item.to==="/"} onClick={()=>setSideOpen(false)}
                  className={({isActive})=>`nav-item${isActive?" active":""}`}>
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.badge!=null&&<span className={`nav-badge ${item.badgeType||""}`}>{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

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

  useEffect(()=>{
    if(!obraAtual?.id) return;
    return onSnapshot(query(collection(db,"ocorrencias"),where("obraId","==",obraAtual.id),where("status","==","ABERTA")),snap=>setOcorrAbertas(snap.size));
  },[obraAtual]);

  useEffect(()=>{
    const u1=onSnapshot(query(collection(db,"manutencoes"),where("status","in",["ABERTA","EM ANDAMENTO"])),snap=>setManutAbertas(snap.size));
    const u2=onSnapshot(query(collection(db,"compras"),where("status","in",["SOLICITAÇÃO","COTAÇÃO"])),snap=>setComprasPend(snap.size));
    return()=>{u1();u2();};
  },[]);

  return (
    <div className="app-shell">
      <Sidebar obraAtual={obraAtual} ocorrAbertas={ocorrAbertas} manutAbertas={manutAbertas} comprasPend={comprasPend} sideOpen={sideOpen} setSideOpen={setSideOpen}/>
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">{obraAtual?obraAtual.nome:"AFINE · Gestão de Obras"}</div>
            {obraAtual&&(
              <div className="topbar-obra">
                <span className="obra-tag">{obraAtual.cliente}</span>
                <button onClick={()=>setObraAtual(null)} style={{background:"none",border:"none",fontSize:11,color:"var(--vermelho)",cursor:"pointer",padding:0}}>✕ limpar</button>
              </div>
            )}
          </div>
          <button className="btn btn-sm" onClick={()=>setSideOpen(s=>!s)} style={{marginLeft:"auto"}}>☰</button>
        </div>
        <div className="page">
          <Routes>
            <Route path="/"             element={<Dashboard    obraAtual={obraAtual?.id}/>}/>
            <Route path="/obras"        element={<Obras         onObraSelect={setObraAtual}/>}/>
            <Route path="/medicao"      element={<Medicao       obraAtual={obraAtual?.id}/>}/>
            <Route path="/manutencao"   element={<Manutencao    obraAtual={obraAtual?.id}/>}/>
            <Route path="/diario"       element={<Diario        obraAtual={obraAtual?.id}/>}/>
            <Route path="/equipe"       element={<Equipe        obraAtual={obraAtual?.id}/>}/>
            <Route path="/funcionarios" element={<Funcionarios/>}/>
            <Route path="/fornecedores" element={<Fornecedores/>}/>
            <Route path="/compras"      element={<Compras/>}/>
            <Route path="/financeiro"   element={<Financeiro/>}/>
            <Route path="/dre"          element={<DRE/>}/>
            <Route path="/materiais"    element={<MateriaisGlobal/>}/>
            <Route path="/ocorrencias"  element={<Ocorrencias   obraAtual={obraAtual?.id}/>}/>
            <Route path="*"             element={<Navigate to="/" replace/>}/>
          </Routes>
        </div>
      </div>
      {sideOpen&&<div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99}}/>}
    </div>
  );
}

export default function App() {
  const { currentUser } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={currentUser?<Navigate to="/" replace/>:<Login/>}/>
        <Route path="/*"     element={<Protected><AppShell/></Protected>}/>
      </Routes>
    </BrowserRouter>
  );
}
