// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./contexts/AuthContext";
import { initials } from "./utils/helpers";

import Login      from "./pages/Login";
import Dashboard  from "./pages/Dashboard";
import Obras      from "./pages/Obras";
import Escopos    from "./pages/Escopos";
import Diario     from "./pages/Diario";
import { Equipe, Materiais, Ocorrencias } from "./pages/Equipe";

import "./index.css";

// ─── Protected wrapper ────────────────────────────────────────────────────────
function Protected({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" replace />;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ obras, obraAtual, setObraAtual, ocorrAbertas, escoposAndamento, sideOpen, setSideOpen }) {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const perfil = userProfile?.perfil || "campo";

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  function handleObraChange(e) {
    const v = e.target.value;
    if (v === "__nova") { navigate("/obras"); }
    else { setObraAtual(v); }
    setSideOpen(false);
  }

  const obraAtualInfo = obras.find(o => o.id === obraAtual);

  const navItems = [
    { to: "/",           icon: "📊", label: "Painel",        roles: ["gestor","encarregado","campo"] },
    { to: "/obras",      icon: "🏗️", label: "Obras",         roles: ["gestor","encarregado"] },
    { to: "/escopos",    icon: "✅", label: "Escopos",       roles: ["gestor","encarregado","campo"], badge: escoposAndamento > 0 ? escoposAndamento : null, badgeType: "amber" },
    { to: "/diario",     icon: "📓", label: "Diário de obra",roles: ["gestor","encarregado","campo"] },
    { to: "/equipe",     icon: "👷", label: "Equipe",        roles: ["gestor","encarregado"] },
    { to: "/materiais",  icon: "📦", label: "Materiais",     roles: ["gestor","encarregado"] },
    { to: "/ocorrencias",icon: "⚠️", label: "Ocorrências",  roles: ["gestor","encarregado","campo"], badge: ocorrAbertas > 0 ? ocorrAbertas : null, badgeType: "red" },
  ];

  return (
    <div className={`sidebar ${sideOpen ? "open" : ""}`}>
      <div className="sidebar-logo">
        <h1>AFINE</h1>
        <p>Gestão de Obras</p>
      </div>

      <div className="obra-picker">
        <label>OBRA ATIVA</label>
        <select value={obraAtual || ""} onChange={handleObraChange}>
          <option value="" disabled>Selecione uma obra</option>
          {obras.map(o => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
          {perfil === "gestor" && <option value="__nova">+ Nova obra...</option>}
        </select>
        {obraAtualInfo && (
          <div style={{ fontSize:10, color:"rgba(255,255,255,.4)", marginTop:4 }}>
            {obraAtualInfo.cliente} · {obraAtualInfo.progresso || 0}% concluído
          </div>
        )}
      </div>

      <nav style={{ flex:1 }}>
        <div className="nav-section">Menu</div>
        {navItems
          .filter(item => item.roles.includes(perfil))
          .map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={() => setSideOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge != null && (
                <span className={`nav-badge ${item.badgeType || ""}`}>{item.badge}</span>
              )}
            </NavLink>
          ))
        }
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{initials(userProfile?.nome || currentUser?.email || "?")}</div>
          <div>
            <div className="user-name">{userProfile?.nome || currentUser?.email}</div>
            <div className="user-role">{perfil?.charAt(0).toUpperCase() + (perfil?.slice(1) || "")}</div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Sair">↩</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shell (after login) ──────────────────────────────────────────────────────
function AppShell() {
  const [obras,        setObras]        = useState([]);
  const [obraAtual,    setObraAtual]    = useState(null);
  const [ocorrAbertas, setOcorrAbertas] = useState(0);
  const [escoposAnd,   setEscoposAnd]   = useState(0);
  const [sideOpen,     setSideOpen]     = useState(false);
  const { userProfile } = useAuth();

  // Carrega obras em tempo real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "obras"), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setObras(data);
      // Auto-seleciona a primeira obra se nenhuma selecionada
      if (!obraAtual && data.length > 0) {
        // gestor vê tudo, campo/encarregado vê só as suas
        const perfil = userProfile?.perfil;
        const obras_permitidas = perfil === "gestor"
          ? data
          : data.filter(o => userProfile?.obras?.includes(o.id));
        if (obras_permitidas.length > 0) setObraAtual(obras_permitidas[0].id);
      }
    });
    return unsub;
  }, []); // eslint-disable-line

  // Badge: ocorrências abertas
  useEffect(() => {
    if (!obraAtual) return;
    const { query, where } = require("firebase/firestore");
    const q = query(
      collection(db, "ocorrencias"),
      where("obraId", "==", obraAtual),
      where("status", "==", "ABERTA")
    );
    return onSnapshot(q, snap => setOcorrAbertas(snap.size));
  }, [obraAtual]);

  // Badge: escopos em andamento
  useEffect(() => {
    if (!obraAtual) return;
    const { query, where } = require("firebase/firestore");
    const q = query(
      collection(db, "escopos"),
      where("obraId", "==", obraAtual),
      where("status", "==", "EM ANDAMENTO")
    );
    return onSnapshot(q, snap => setEscoposAnd(snap.size));
  }, [obraAtual]);

  const pageTitle = {
    "/":            "Painel",
    "/obras":       "Todas as obras",
    "/escopos":     "Escopos",
    "/diario":      "Diário de obra",
    "/equipe":      "Equipe",
    "/materiais":   "Materiais",
    "/ocorrencias": "Ocorrências",
  };

  return (
    <div className="app-shell">
      <Sidebar
        obras={obras}
        obraAtual={obraAtual}
        setObraAtual={setObraAtual}
        ocorrAbertas={ocorrAbertas}
        escoposAndamento={escoposAnd}
        sideOpen={sideOpen}
        setSideOpen={setSideOpen}
      />

      <div className="main-content">
        {/* Topbar mobile */}
        <div className="topbar">
          <button
            className="btn btn-icon"
            style={{ display:"none" }}
            id="menu-btn"
            onClick={() => setSideOpen(s => !s)}
          >
            ☰
          </button>
          <span style={{ fontWeight:600, fontSize:15, color:"var(--azul)" }}>
            {obras.find(o => o.id === obraAtual)?.nome || "AFINE · Gestão de Obras"}
          </span>
          <button className="btn btn-sm" style={{ marginLeft:"auto" }}
            onClick={() => setSideOpen(s => !s)}
          >
            ☰
          </button>
        </div>

        <div className="page">
          <Routes>
            <Route path="/"            element={<Dashboard  obraAtual={obraAtual} />} />
            <Route path="/obras"       element={<Obras       onObraSelect={setObraAtual} />} />
            <Route path="/escopos"     element={<Escopos     obraAtual={obraAtual} />} />
            <Route path="/diario"      element={<Diario      obraAtual={obraAtual} />} />
            <Route path="/equipe"      element={<Equipe      obraAtual={obraAtual} />} />
            <Route path="/materiais"   element={<Materiais   obraAtual={obraAtual} />} />
            <Route path="/ocorrencias" element={<Ocorrencias obraAtual={obraAtual} />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>

      {/* Overlay para fechar sidebar no mobile */}
      {sideOpen && (
        <div
          onClick={() => setSideOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:99 }}
        />
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const { currentUser } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/*"     element={<Protected><AppShell /></Protected>} />
      </Routes>
    </BrowserRouter>
  );
}
