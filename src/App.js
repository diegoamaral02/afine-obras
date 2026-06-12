// src/App.js — Home sem obra selecionada, seleção de obra só na aba Obras
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./contexts/AuthContext";
import { initials } from "./utils/helpers";

import Login        from "./pages/Login";
import Dashboard    from "./pages/Dashboard";
import Obras        from "./pages/Obras";
import Diario       from "./pages/Diario";
import Manutencao   from "./pages/Manutencao";
import Funcionarios from "./pages/Funcionarios";
import MateriaisGlobal from "./pages/Materiais";
import { Equipe, Ocorrencias } from "./pages/Equipe";

import "./index.css";

function Protected({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
}

function Sidebar({ obraAtual, ocorrAbertas, manutAbertas, sideOpen, setSideOpen }) {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const perfil = userProfile?.perfil || "campo";

  async function handleLogout() { await logout(); navigate("/login"); }

  const navItems = [
    { to:"/",             icon:"🏠", label:"Home",            roles:["gestor","encarregado","campo"] },
    { to:"/obras",        icon:"🏗️", label:"Obras",           roles:["gestor","encarregado"] },
    { to:"/manutencao",   icon:"🔧", label:"Manutenção",      roles:["gestor","encarregado","campo"], badge:manutAbertas>0?manutAbertas:null, badgeType:"red" },
    { to:"/diario",       icon:"📓", label:"Diário de obra",  roles:["gestor","encarregado","campo"] },
    { to:"/equipe",       icon:"👷", label:"Equipe",          roles:["gestor","encarregado"] },
    { to:"/funcionarios", icon:"👤", label:"Funcionários",    roles:["gestor"] },
    { to:"/materiais",    icon:"📦", label:"Materiais",       roles:["gestor","encarregado"] },
    { to:"/ocorrencias",  icon:"⚠️", label:"Ocorrências",    roles:["gestor","encarregado","campo"], badge:ocorrAbertas>0?ocorrAbertas:null, badgeType:"red" },
  ];

  return (
    <div className={`sidebar ${sideOpen?"open":""}`}>
      <div className="sidebar-logo"><h1>AFINE</h1><p>Gestão de Obras</p></div>

      {obraAtual && (
        <div style={{padding:"8px 14px",background:"rgba(255,255,255,.08)",fontSize:12,color:"rgba(255,255,255,.8)",borderBottom:"1px solid rgba(255,255,255,.1)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.45)",marginBottom:2}}>OBRA ATIVA</div>
          <div style={{fontWeight:500}}>{obraAtual.nome}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,.45)"}}>{obraAtual.cliente}</div>
        </div>
      )}

      <nav style={{flex:1}}>
        <div className="nav-section">Menu</div>
        {navItems.filter(i=>i.roles.includes(perfil)).map(item=>(
          <NavLink key={item.to} to={item.to} end={item.to==="/"} className={({isActive})=>`nav-item${isActive?" active":""}`} onClick={()=>setSideOpen(false)}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.badge!=null && <span className={`nav-badge ${item.badgeType||""}`}>{item.badge}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{initials(userProfile?.nome||currentUser?.email||"?")}</div>
          <div>
            <div className="user-name">{userProfile?.nome||currentUser?.email}</div>
            <div className="user-role">{perfil?.charAt(0).toUpperCase()+(perfil?.slice(1)||"")}</div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Sair">↩</button>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const [obraAtual,    setObraAtual]    = useState(null); // objeto completo {id, nome, cliente...}
  const [ocorrAbertas, setOcorrAbertas] = useState(0);
  const [manutAbertas, setManutAbertas] = useState(0);
  const [sideOpen,     setSideOpen]     = useState(false);

  // Badge ocorrências
  useEffect(()=>{
    if(!obraAtual?.id) return;
    return onSnapshot(query(collection(db,"ocorrencias"),where("obraId","==",obraAtual.id),where("status","==","ABERTA")),snap=>setOcorrAbertas(snap.size));
  },[obraAtual]);

  // Badge manutenções
  useEffect(()=>{
    return onSnapshot(query(collection(db,"manutencoes"),where("status","in",["ABERTA","EM ANDAMENTO"])),snap=>setManutAbertas(snap.size));
  },[]);

  // Recebe objeto obra completo da página Obras
  function handleObraSelect(obraObj) { setObraAtual(obraObj); }

  return (
    <div className="app-shell">
      <Sidebar obraAtual={obraAtual} ocorrAbertas={ocorrAbertas} manutAbertas={manutAbertas} sideOpen={sideOpen} setSideOpen={setSideOpen}/>

      <div className="main-content">
        <div className="topbar">
          <span style={{fontWeight:600,fontSize:15,color:"var(--azul)"}}>
            {obraAtual ? obraAtual.nome : "AFINE · Gestão de Obras"}
          </span>
          {obraAtual && (
            <button className="btn btn-sm" style={{fontSize:11}} onClick={()=>setObraAtual(null)} title="Limpar obra selecionada">
              ✕ Limpar seleção
            </button>
          )}
          <button className="btn btn-sm" style={{marginLeft:"auto"}} onClick={()=>setSideOpen(s=>!s)}>☰</button>
        </div>

        <div className="page">
          <Routes>
            <Route path="/"            element={<Dashboard   obraAtual={obraAtual?.id}/>}/>
            <Route path="/obras"       element={<Obras        onObraSelect={handleObraSelect}/>}/>
            <Route path="/manutencao"  element={<Manutencao   obraAtual={obraAtual?.id}/>}/>
            <Route path="/diario"      element={<Diario       obraAtual={obraAtual?.id}/>}/>
            <Route path="/equipe"      element={<Equipe       obraAtual={obraAtual?.id}/>}/>
            <Route path="/funcionarios"element={<Funcionarios/>}/>
            <Route path="/materiais"   element={<MateriaisGlobal/>}/>
            <Route path="/ocorrencias" element={<Ocorrencias  obraAtual={obraAtual?.id}/>}/>
            <Route path="*"            element={<Navigate to="/" replace/>}/>
          </Routes>
        </div>
      </div>

      {sideOpen&&<div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:99}}/>}
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
