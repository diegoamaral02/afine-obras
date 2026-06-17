// src/App.js — v8: sidebar persist + notificações + loading granular
import React, { useEffect, useState, useCallback, memo } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./contexts/AuthContext";
import { AgendaProvider, useAgenda } from "./contexts/AgendaContext";
import { useNotificacoes } from "./hooks/useNotificacoes";
import { initials } from "./utils/helpers";
import { LOGO_BASE64 } from "./utils/assets";
import { getAcesso, podeVer } from "./constants/departamentos";

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

const MENU = [
  { id:"principal", label:"Principal", roles:["gestor","encarregado","campo"], items:[
    { to:"/painel",    icon:"📊", label:"Painel Gerencial", roles:["gestor"] },
    { to:"/",          icon:"🏠", label:"Home",             roles:["gestor","encarregado","campo"] },
    { to:"/calendario",icon:"📅", label:"Calendário",       roles:["gestor","encarregado","campo"] },
  ]},
  { id:"comercial", label:"Comercial", roles:["gestor","encarregado"], items:[
    { to:"/comercial",          icon:"📈", label:"Funil de vendas", roles:["gestor","encarregado"] },
    { to:"/comercial/clientes", icon:"🏢", label:"Clientes",        roles:["gestor","encarregado"] },
    { to:"/fornecedores",       icon:"🤝", label:"Fornecedores",    roles:["gestor","encarregado"] },
  ]},
  { id:"operacao", label:"Operação", roles:["gestor","encarregado","campo"], items:[
    { to:"/obras",       icon:"🏗️", label:"Obras",          roles:["gestor","encarregado"] },
    { to:"/medicao",     icon:"📐", label:"Medição & FVS",  roles:["gestor","encarregado"] },
    { to:"/manutencao",  icon:"🔧", label:"Manutenção",     roles:["gestor","encarregado","campo"] },
    { to:"/diario",      icon:"📓", label:"Diário de obra", roles:["gestor","encarregado","campo"] },
    { to:"/ocorrencias", icon:"⚠️", label:"Ocorrências",   roles:["gestor","encarregado","campo"] },
  ]},
  { id:"suprimentos", label:"Suprimentos", roles:["gestor","encarregado","campo"], items:[
    { to:"/compras",   icon:"🛒", label:"Compras",    roles:["gestor","encarregado","campo"] },
    { to:"/materiais", icon:"📦", label:"Materiais",  roles:["gestor","encarregado"] },
  ]},
  { id:"financeiro", label:"Financeiro", roles:["gestor"], items:[
    { to:"/financeiro", icon:"💰", label:"Lançamentos",      roles:["gestor"] },
    { to:"/dre",        icon:"📈", label:"Resultados",         roles:["gestor"] },
  ]},
  { id:"pessoas", label:"Pessoas", roles:["gestor","encarregado","campo"], items:[
    { to:"/equipe",       icon:"👷", label:"Equipe",       roles:["gestor","encarregado","campo"] },
    { to:"/funcionarios", icon:"👤", label:"Funcionários", roles:["gestor"] },
  ]},
];

// FIX: Accordion com persistência localStorage
const AccordionGroup = memo(({ group, perfil, badges, onNavigate }) => {
  const location = useLocation();
  const hasActive = group.items.some(i => location.pathname === i.to || location.pathname.startsWith(i.to+"/"));

  // FIX: persiste estado no localStorage
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(`afine-sidebar-${group.id}`);
      return saved !== null ? JSON.parse(saved) : hasActive;
    } catch { return hasActive; }
  });

  const toggle = useCallback(() => {
    setOpen(v => {
      const next = !v;
      try { localStorage.setItem(`afine-sidebar-${group.id}`, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [group.id]);

  const visibleItems = group.items.filter(i => i.roles.includes(perfil));
  if (!visibleItems.length) return null;

  return (
    <div>
      <button onClick={toggle} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"7px 16px", background: hasActive?"rgba(245,200,0,.08)":"none",
        border:"none", cursor:"pointer",
        color: hasActive?"var(--afine-yellow)":"rgba(255,255,255,.4)",
        fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em",
        transition:"background .15s",
      }}>
        {group.label}
        <span style={{fontSize:9,opacity:.6,transform:open?"rotate(180deg)":"",transition:"transform .2s"}}>▼</span>
      </button>
      {open && visibleItems.map(item => {
        const badge = badges[item.to];
        return (
          <NavLink key={item.to} to={item.to} end={item.to==="/"||item.to==="/painel"} onClick={onNavigate}
            className={({isActive})=>`nav-item${isActive?" active":""}`}
            style={{paddingLeft:24}}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {badge>0 && <span className={`nav-badge ${badge.type||"red"}`}>{badge.count}</span>}
          </NavLink>
        );
      })}
    </div>
  );
});

// FIX: Painel de notificações
function NotificacoesPanel({ notifs, naoLidas, marcarLida, marcarTodasLidas, onClose }) {
  return (
    <div style={{
      position:"fixed", top:56, right:16, zIndex:300, width:320, maxHeight:480,
      background:"#fff", borderRadius:12, boxShadow:"0 8px 40px rgba(0,0,0,.2)",
      border:"1px solid var(--border)", overflow:"hidden", display:"flex", flexDirection:"column",
    }}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontWeight:600,fontSize:14}}>Notificações</span>
        <div style={{display:"flex",gap:8}}>
          {naoLidas>0&&<button className="btn btn-sm" style={{fontSize:11}} onClick={marcarTodasLidas}>Marcar todas como lidas</button>}
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#7A7A7A"}}>×</button>
        </div>
      </div>
      <div style={{overflowY:"auto",flex:1}}>
        {notifs.length===0&&(
          <div style={{textAlign:"center",padding:"32px 16px",color:"#7A7A7A"}}>
            <div style={{fontSize:28,marginBottom:8}}>🔔</div>
            <p style={{fontSize:13}}>Nenhuma notificação</p>
          </div>
        )}
        {notifs.map(n=>(
          <div key={n.id} onClick={()=>marcarLida(n.id)}
            style={{padding:"12px 16px",borderBottom:"1px solid var(--border)",cursor:"pointer",
              background:n.lida?"transparent":"rgba(245,200,0,.04)",
              transition:"background .15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--cinza-lt)"}
            onMouseLeave={e=>e.currentTarget.style.background=n.lida?"transparent":"rgba(245,200,0,.04)"}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:n.lida?"transparent":"var(--afine-yellow)",flexShrink:0,marginTop:4}}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:n.lida?400:600,fontSize:13}}>{n.titulo}</div>
                <div style={{fontSize:12,color:"#7A7A7A",marginTop:2}}>{n.corpo}</div>
                <div style={{fontSize:10,color:"#aaa",marginTop:4}}>{n.criadaEm?new Date(n.criadaEm).toLocaleString("pt-BR"):""}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mapa de label e ícone por departamento (para exibir na sidebar)
const DEP_LABEL = {
  adm:       { label:"ADM Master",  icone:"🔐", cor:"#B83232" },
  gestao:    { label:"Gestão",      icone:"👑", cor:"#1A1A1A" },
  financeiro:{ label:"Financeiro",  icone:"💰", cor:"#2D6A1F" },
  comercial: { label:"Comercial",   icone:"📈", cor:"#185FA5" },
  compras:   { label:"Compras",     icone:"🛒", cor:"#7B4F00" },
  fiscal:    { label:"Fiscal",      icone:"🔍", cor:"#C9A200" },
  campo:     { label:"Campo",       icone:"🏗️", cor:"#4A4A4A" },
  // fallbacks para perfis antigos sem departamento
  gestor:    { label:"Gestor",      icone:"👑", cor:"#1A1A1A" },
  encarregado:{ label:"Encarregado",icone:"🔍", cor:"#C9A200" },
};

// Resolve o perfil efetivo para controle de menu
// ADM e Gestão → "gestor" (acesso total ao menu)
// Financeiro, Comercial, Fiscal, Compras → "encarregado" (acesso intermediário)
// Campo → "campo"
function resolverPerfilMenu(userProfile) {
  if (!userProfile) return "campo";
  if (userProfile.adm === true) return "gestor";
  const dep = userProfile.departamento || userProfile.perfil || "campo";
  if (["adm","gestao"].includes(dep) || dep === "gestor") return "gestor";
  if (["financeiro","comercial","fiscal","compras","encarregado"].includes(dep)) return "encarregado";
  return "campo";
}

function Sidebar({ obraAtual, badges, sideOpen, setSideOpen }) {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const onNavigate = useCallback(()=>setSideOpen(false),[setSideOpen]);
  async function handleLogout() { await logout(); navigate("/login"); }

  // Perfil efetivo para exibição e controle de menu
  const perfilMenu = resolverPerfilMenu(userProfile);

  // Informações de exibição: prioriza departamento, depois perfil, depois fallback
  const depKey = userProfile?.adm ? "adm" : (userProfile?.departamento || userProfile?.perfil || "campo");
  const depInfo = DEP_LABEL[depKey] || DEP_LABEL.campo;

  return (
    <div className={`sidebar ${sideOpen?"open":""}`}>
      <div className="sidebar-logo">
        <img src={LOGO_BASE64} alt="AFINE" style={{height:40,width:"auto",filter:"brightness(0) invert(1)",opacity:.95}}/>
        <div className="sidebar-logo-text"><h1>AFINE</h1><p>ERP · Gestão</p></div>
      </div>
      {obraAtual&&(
        <div className="obra-active-banner">
          <div className="label">Obra ativa</div>
          <div className="nome">{obraAtual.nome}</div>
          <div className="sub">{obraAtual.cliente}</div>
        </div>
      )}
      <nav style={{flex:1,overflowY:"auto",paddingTop:4}}>
        {MENU.map(group=>(
          <AccordionGroup key={group.id} group={group} perfil={perfilMenu} badges={badges} onNavigate={onNavigate}/>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-chip">
          {/* Avatar com cor do departamento */}
          <div className="user-avatar" style={{background: depInfo.cor, flexShrink:0}}>
            {initials(userProfile?.nome||currentUser?.email||"?")}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div className="user-name" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {userProfile?.nome||currentUser?.email}
            </div>
            {/* Exibe departamento real, não o perfil técnico */}
            <div className="user-role" style={{display:"flex",alignItems:"center",gap:4}}>
              {(() => {
                const dep = userProfile?.departamento;
                const adm = userProfile?.adm;
                const ICONS = {adm:"🔐",gestao:"👑",financeiro:"💰",comercial:"📈",compras:"🛒",fiscal:"🔍",campo:"🏗️"};
                const LABELS = {adm:"ADM (Master)",gestao:"Gestão",financeiro:"Financeiro",comercial:"Comercial",compras:"Compras",fiscal:"Fiscal",campo:"Campo"};
                const key = adm ? "adm" : dep || (userProfile?.perfil==="gestor"?"gestao":"campo");
                return <><span>{ICONS[key]||"👤"}</span><span>{LABELS[key]||userProfile?.perfil||"Campo"}</span></>;
              })()}
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Sair">↩</button>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { currentUser, userProfile } = useAuth();
  const [obraAtual,    setObraAtual]    = useState(null);
  const [manutAbertas, setManutAbertas] = useState(0);
  const [comprasPend,  setComprasPend]  = useState(0);
  const [sideOpen,     setSideOpen]     = useState(false);
  const [showNotifs,   setShowNotifs]   = useState(false);
  const { agendamentosDodia } = useAgenda();
  const { notifs, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes(currentUser?.uid);

  const hoje = new Date().toISOString().split("T")[0];
  const agsHoje = agendamentosDodia(hoje).length;

  useEffect(()=>{
    const u1=onSnapshot(query(collection(db,"manutencoes"),where("status","in",["ABERTA","EM ANDAMENTO"])),snap=>setManutAbertas(snap.size));
    const u2=onSnapshot(query(collection(db,"compras"),where("status","in",["SOLICITAÇÃO","COTAÇÃO"])),snap=>setComprasPend(snap.size));
    return()=>{u1();u2();};
  },[]);

  const badges = {
    "/manutencao":  manutAbertas>0  ? {count:manutAbertas,  type:"red"}    : 0,
    "/compras":     comprasPend>0   ? {count:comprasPend,   type:"amber"}  : 0,
    "/calendario":  agsHoje>0       ? {count:agsHoje,       type:"yellow"} : 0,
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
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
            {/* Sino de notificações */}
            <button onClick={()=>setShowNotifs(!showNotifs)}
              style={{position:"relative",background:"none",border:"none",cursor:"pointer",fontSize:20,padding:"4px",lineHeight:1}}>
              🔔
              {naoLidas>0&&(
                <span style={{position:"absolute",top:-2,right:-2,background:"var(--vermelho)",color:"#fff",fontSize:9,fontWeight:700,
                  width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {naoLidas>9?"9+":naoLidas}
                </span>
              )}
            </button>
            <button className="btn btn-sm" onClick={()=>setSideOpen(s=>!s)}>☰</button>
          </div>
        </div>

        {showNotifs&&(
          <>
            <NotificacoesPanel notifs={notifs} naoLidas={naoLidas} marcarLida={marcarLida}
              marcarTodasLidas={marcarTodasLidas} onClose={()=>setShowNotifs(false)}/>
            <div onClick={()=>setShowNotifs(false)} style={{position:"fixed",inset:0,zIndex:299}}/>
          </>
        )}

        <div className="page">
          <Routes>
            <Route path="/"                   element={<Dashboard       obraAtual={obraAtual?.id}/>}/>
            <Route path="/painel"             element={<PainelGerencial/>}/>
            <Route path="/calendario"         element={<Calendario/>}/>
            <Route path="/comercial"          element={<Comercial subpagina="funil"/>}/>
            <Route path="/comercial/clientes" element={<Comercial subpagina="clientes"/>}/>
            <Route path="/obras"              element={<Obras           onObraSelect={setObraAtual}/>}/>
            <Route path="/medicao"            element={<Medicao         obraAtual={obraAtual?.id}/>}/>
            <Route path="/manutencao"         element={<Manutencao      obraAtual={obraAtual?.id}/>}/>
            <Route path="/diario"             element={<Diario          obraAtual={obraAtual?.id}/>}/>
            <Route path="/equipe"             element={<Equipe          obraAtual={obraAtual?.id}/>}/>
            <Route path="/funcionarios"       element={<Funcionarios/>}/>
            <Route path="/fornecedores"       element={<Fornecedores/>}/>
            <Route path="/compras"            element={<Compras/>}/>
            <Route path="/financeiro"         element={<Financeiro/>}/>
            <Route path="/dre"                element={<DRE/>}/>
            <Route path="/materiais"          element={<MateriaisGlobal/>}/>
            <Route path="*"                   element={<Navigate to="/" replace/>}/>
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
