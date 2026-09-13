// src/App.js — v8: sidebar persist + notificações + loading granular
import React, { useEffect, useState, useCallback, memo } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./contexts/AuthContext";
import { AgendaProvider, useAgenda } from "./contexts/AgendaContext";
import { useNotificacoes } from "./hooks/useNotificacoes";
import { usePushNotificacoes } from "./hooks/usePushNotificacoes";
import { useFilaOffline } from "./hooks/useFilaOffline";
import { initials } from "./utils/helpers";
import { LOGO_BASE64 } from "./utils/assets";
import { getAcesso, podeVer, isCampo, resolverPerfilMenu } from "./constants/departamentos";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";

import Login           from "./pages/Login";
import PainelGerencial from "./pages/PainelGerencial";
import Obras           from "./pages/Obras";
import Diario          from "./pages/Diario";
import Manutencao      from "./pages/Manutencao";
import Funcionarios    from "./pages/Funcionarios";
import Fornecedores    from "./pages/Fornecedores";
import Compras         from "./pages/Compras";
import FinanceiroUnificado from "./pages/FinanceiroUnificado";
import Financeiro      from "./pages/Financeiro";
import Despesas        from "./pages/Despesas";
import DRE             from "./pages/DRE";
import Medicao         from "./pages/Medicao";
import Calendario      from "./pages/Calendario";
import Comercial       from "./pages/Comercial";
import MateriaisGlobal from "./pages/Materiais";
import Gerenciamento   from "./pages/Gerenciamento";
import SeedPage        from "./pages/SeedPage";
import SLADashboard    from "./pages/SLADashboard";
import SLAConfig       from "./pages/SLAConfig";
import ChecklistTemplates from "./pages/ChecklistTemplates";
import PontoEletronico from "./pages/PontoEletronico";
import AuditLog       from "./pages/AuditLog";
import BITendencias   from "./pages/BITendencias";
import Garantias      from "./pages/Garantias";
import { Equipe, Ocorrencias } from "./pages/Equipe";
import OcorrenciasCanteiro from "./pages/OcorrenciasCanteiro";
import AnalistasContatos from "./pages/AnalistasContatos";
import NotFound from "./pages/NotFound";

import "./index.css";

function Protected({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
}

const MENU = [
  { id:"principal", label:"Principal", roles:["gestor","encarregado","campo"], items:[
    { to:"/",           icon:"🏠", label:"Painel",      roles:["gestor","encarregado"] },
    { to:"/calendario", icon:"📅", label:"Calendário",  roles:["gestor","encarregado","campo"] },
  ]},
  { id:"operacao", label:"Operação", roles:["gestor","encarregado","campo"], items:[
    { to:"/obras",         icon:"🏗️", label:"Obras",         roles:["gestor","encarregado","campo"] },
    { to:"/manutencao",    icon:"🔧", label:"Manutenção",     roles:["gestor","encarregado","campo"] },
    { to:"/ocorrencias",   icon:"⚡", label:"Ocorrências",    roles:["gestor","encarregado","campo"] },
    { to:"/gerenciamento", icon:"📋", label:"Gerenciamento",  roles:["gestor","encarregado","campo"] },
  ]},
  { id:"suprimentos", label:"Suprimentos", roles:["gestor","encarregado","campo"], items:[
    { to:"/compras",      icon:"🛒", label:"Compras",      roles:["gestor","encarregado","campo"] },
    { to:"/materiais",    icon:"📦", label:"Materiais",    roles:["gestor","encarregado"] },
    { to:"/fornecedores", icon:"🤝", label:"Fornecedores", roles:["gestor","encarregado"] },
  ]},
  { id:"pessoas", label:"Pessoas & Clientes", roles:["gestor","encarregado","campo"], items:[
    { to:"/comercial/clientes", icon:"🏢", label:"Clientes",         roles:["gestor","encarregado"] },
    { to:"/equipe",             icon:"👷", label:"Equipe",            roles:["gestor","encarregado"] },
    { to:"/funcionarios",       icon:"👤", label:"Funcionários",      roles:["gestor"] },
    { to:"/ponto",              icon:"⏱️", label:"Ponto Eletrônico",  roles:["gestor","encarregado","campo"] },
  ]},
  { id:"financeiro", label:"Financeiro & Gestão", roles:["gestor","encarregado","campo"], items:[
    { to:"/financeiro",           icon:"💰", label:"Financeiro",       roles:["gestor","encarregado"] },
    { to:"/despesas",             icon:"🧾", label:"Despesas",         roles:["gestor","encarregado","campo"] },
    { to:"/bi",                   icon:"📊", label:"BI & Tendências",  roles:["gestor","encarregado"] },
    { to:"/sla",                  icon:"⏰", label:"SLA",              roles:["gestor","encarregado"] },
    { to:"/checklist-templates",  icon:"📋", label:"Checklists",       roles:["gestor","encarregado"] },
    { to:"/analistas",            icon:"📇", label:"Analistas",        roles:["gestor","encarregado"] },
    { to:"/garantias",            icon:"🛡️", label:"Garantias",        roles:["gestor","encarregado"] },
    { to:"/audit-log",            icon:"🔍", label:"Audit Log",        roles:["gestor","encarregado"] },
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

// Resolve o perfil efetivo para controle de menu — agora centralizado em
// departamentos.js (resolverPerfilMenu), única fonte de verdade compartilhada
// com as páginas, em vez de App.js ter sua própria lógica duplicada.

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
        <img src={LOGO_BASE64} alt="AFINE"/>
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
  const isCampoUser = isCampo(userProfile);
  const [obraAtual,    setObraAtual]    = useState(null);
  const [manutAbertas, setManutAbertas] = useState(0);
  const [comprasPend,  setComprasPend]  = useState(0);
  const [sideOpen,     setSideOpen]     = useState(false);
  const [showNotifs,   setShowNotifs]   = useState(false);
  const [todasObras,   setTodasObras]   = useState([]);
  const [busca,        setBusca]        = useState("");
  const [showBusca,    setShowBusca]    = useState(false);
  const navigate = useNavigate();
  const { agendamentosDodia } = useAgenda();
  const { notifs, naoLidas, marcarLida, marcarTodasLidas } = useNotificacoes(currentUser?.uid);
  usePushNotificacoes(currentUser?.uid);
  const filaOffline = useFilaOffline();
  const { darkMode, toggleTheme } = useTheme();
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  React.useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const hoje = new Date().toISOString().split("T")[0];
  const agsHoje = agendamentosDodia(hoje).length;

  useEffect(()=>{
    const u1=onSnapshot(query(collection(db,"manutencoes"),where("status","in",["ABERTA","EM ANDAMENTO"])),snap=>setManutAbertas(snap.size));
    const u2=onSnapshot(query(collection(db,"compras"),where("status","in",["SOLICITAÇÃO","COTAÇÃO"])),snap=>setComprasPend(snap.size));
    const u3=onSnapshot(collection(db,"obras"),snap=>setTodasObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();};
  },[]);

  const resultadosBusca = busca.trim().length >= 2
    ? todasObras.filter(o => {
        const q = busca.toLowerCase();
        return (o.nome||"").toLowerCase().includes(q) || (o.cliente||"").toLowerCase().includes(q);
      }).slice(0, 6)
    : [];

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
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button className="btn btn-sm" onClick={()=>setSideOpen(s=>!s)}>☰</button>
            <div>
              <div className="topbar-title">{obraAtual?obraAtual.nome:"AFINE · ERP"}</div>
              {obraAtual&&(
                <div className="topbar-obra">
                  <span className="obra-tag">{obraAtual.cliente}</span>
                  <button onClick={()=>setObraAtual(null)} style={{background:"none",border:"none",fontSize:11,color:"var(--vermelho)",cursor:"pointer",padding:0}}>✕</button>
                </div>
              )}
            </div>
          </div>

          {/* Busca global */}
          {!isCampoUser && (
            <div style={{position:"relative",flex:"0 1 280px",margin:"0 16px"}}>
              <input
                value={busca}
                onChange={e=>{setBusca(e.target.value);setShowBusca(true);}}
                onFocus={()=>setShowBusca(true)}
                onBlur={()=>setTimeout(()=>setShowBusca(false),150)}
                placeholder="🔍 Buscar obra ou cliente..."
                style={{width:"100%",padding:"6px 12px",border:"1px solid var(--border)",borderRadius:20,
                  background:"var(--cinza-lt)",fontSize:13,outline:"none",boxSizing:"border-box",
                  color:"var(--text)"}}
              />
              {showBusca && resultadosBusca.length > 0 && (
                <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:400,
                  background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:10,
                  boxShadow:"0 8px 24px rgba(0,0,0,.12)",overflow:"hidden"}}>
                  {resultadosBusca.map(o=>(
                    <div key={o.id} onMouseDown={()=>{setObraAtual(o);setBusca("");navigate("/obras");}}
                      style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid var(--border)",
                        transition:"background .1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--cinza-lt)"}
                      onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <div style={{fontWeight:600,fontSize:13}}>{o.nome}</div>
                      <div style={{fontSize:11,color:"var(--cinza-med)"}}>{o.cliente} · {o.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
            {/* Indicador de conexão */}
            {!isOnline && (
              <div style={{display:"flex",alignItems:"center",gap:5,background:"var(--vermelho-lt)",border:"1px solid var(--vermelho)",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:"var(--vermelho)"}}>
                📵 Sem conexão
              </div>
            )}
            {filaOffline.pendentes>0 && (
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <button onClick={filaOffline.tentarSincronizar} disabled={filaOffline.sincronizando || !isOnline}
                  title="Há dados salvos no dispositivo aguardando conexão para sincronizar. Clique para tentar agora."
                  style={{display:"flex",alignItems:"center",gap:6,background:"#FDF2D9",border:"1px solid rgba(184,145,10,.3)",
                    borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,color:"#7A5400",cursor:"pointer"}}>
                  {filaOffline.sincronizando ? "🔄 Sincronizando..." : `📡 ${filaOffline.pendentes} pendente(s) — sincronizar`}
                </button>
                <button
                  onClick={()=>{ if(window.confirm("Descartar os itens pendentes da fila offline? Eles não serão enviados.")) filaOffline.descartar(); }}
                  title="Descartar itens pendentes"
                  style={{background:"none",border:"1px solid rgba(184,145,10,.3)",borderRadius:8,padding:"5px 8px",fontSize:11,fontWeight:700,color:"#7A5400",cursor:"pointer"}}>
                  ✕
                </button>
              </div>
            )}
            <button onClick={toggleTheme} title={darkMode?"Modo claro":"Modo escuro"}
              style={{background:"none",border:"none",cursor:"pointer",fontSize:18,padding:"5px",lineHeight:1,borderRadius:8,transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--n-200)"}
              onMouseLeave={e=>e.currentTarget.style.background="none"}>
              {darkMode?"☀️":"🌙"}
            </button>
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
            <Route path="/"                   element={isCampoUser ? <Navigate to="/manutencao" replace/> : <PainelGerencial/>}/>
            <Route path="/painel"             element={<Navigate to="/" replace/>}/>
            <Route path="/calendario"         element={<Calendario/>}/>
            <Route path="/comercial"          element={<Comercial subpagina="funil"/>}/>
            <Route path="/comercial/clientes" element={<Comercial subpagina="clientes"/>}/>
            <Route path="/obras"              element={<Obras           onObraSelect={setObraAtual}/>}/>
            <Route path="/manutencao"         element={<Manutencao      obraAtual={obraAtual?.id}/>}/>
            <Route path="/ocorrencias"        element={<OcorrenciasCanteiro/>}/>
            <Route path="/gerenciamento"      element={<Gerenciamento/>}/>
            <Route path="/equipe"             element={isCampoUser ? <Navigate to="/manutencao" replace/> : <Equipe obraAtual={obraAtual?.id}/>}/>
            <Route path="/funcionarios"       element={<Funcionarios/>}/>
            <Route path="/fornecedores"       element={<Fornecedores/>}/>
            <Route path="/compras"            element={<Compras/>}/>
            <Route path="/financeiro"         element={<FinanceiroUnificado/>}/>
            <Route path="/despesas"           element={<Despesas/>}/>
            <Route path="/dre"                element={<Navigate to="/financeiro?tab=dre" replace/>}/>
            <Route path="/materiais"          element={<MateriaisGlobal/>}/>
            <Route path="/sla"               element={<SLADashboard/>}/>
            <Route path="/sla/config"             element={<SLAConfig/>}/>
            <Route path="/checklist-templates"    element={<ChecklistTemplates/>}/>
            <Route path="/ponto"             element={<PontoEletronico/>}/>
            <Route path="/garantias"         element={<Garantias/>}/>
            <Route path="/bi"               element={<BITendencias/>}/>
            <Route path="/analistas"         element={<AnalistasContatos/>}/>
            <Route path="/audit-log"        element={<AuditLog/>}/>
            <Route path="/seed"               element={<SeedPage/>}/>
            <Route path="*"                   element={<NotFound/>}/>
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
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
export default AppRoot;
