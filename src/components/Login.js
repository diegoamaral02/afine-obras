// src/pages/Login.js — AFINE branded
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError("E-mail ou senha inválidos.");
    }
    setLoading(false);
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <img src="/logo.png" alt="AFINE" />
          <h1>AFINE</h1>
          <p>A.F. Nery Arquitetura &amp; Construção</p>
        </div>
        <div className="login-divider" />

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="form-group">
            <label>E-mail</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="seu@email.com" required autoComplete="email"/>
          </div>
          <div className="form-group">
            <label>Senha</label>
            <div style={{ position:"relative" }}>
              <input type={showPass?"text":"password"} value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                style={{ paddingRight:40 }}/>
              <button type="button" onClick={()=>setShowPass(!showPass)}
                style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#888" }}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary"
            style={{ marginTop:8, justifyContent:"center", padding:"12px", fontSize:14 }}
            disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p style={{ textAlign:"center", fontSize:11, color:"#aaa", marginTop:24 }}>
          Acesso restrito — solicite ao gestor seu e-mail e senha.
        </p>
      </div>
    </div>
  );
}

// Export ForgotPassword modal too
export function ForgotPassword({ onClose }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent]   = useState(false);
  const [err, setErr]     = useState("");

  async function handle(e) {
    e.preventDefault();
    try { await resetPassword(email); setSent(true); }
    catch { setErr("E-mail não encontrado."); }
  }

  if (sent) return (
    <div style={{ textAlign:"center", padding:16 }}>
      <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
      <p style={{ fontWeight:600, marginBottom:8 }}>E-mail enviado!</p>
      <p style={{ fontSize:13, color:"#7A7A7A", marginBottom:16 }}>Verifique sua caixa de entrada e siga as instruções.</p>
      <button className="btn btn-primary" onClick={onClose}>Fechar</button>
    </div>
  );

  return (
    <form onSubmit={handle} style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {err && <div className="login-error">{err}</div>}
      <p style={{ fontSize:13, color:"#7A7A7A" }}>Informe seu e-mail para receber o link de redefinição de senha.</p>
      <div className="form-group">
        <label>E-mail</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="seu@email.com"/>
      </div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
        <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn btn-primary">Enviar link</button>
      </div>
    </form>
  );
}
