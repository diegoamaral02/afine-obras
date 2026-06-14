// src/pages/Login.js — logo embutida (nunca quebra)
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LOGO_BASE64 } from "../utils/assets";

export default function Login() {
  const { login, resetPassword } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [forgot,   setForgot]   = useState(false);
  const [resetSent,setResetSent]= useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try { await login(email, password); }
    catch { setError("E-mail ou senha inválidos. Verifique e tente novamente."); }
    setLoading(false);
  }

  async function handleReset(e) {
    e.preventDefault(); setLoading(true);
    try { await resetPassword(email); setResetSent(true); }
    catch { setError("E-mail não encontrado."); }
    setLoading(false);
  }

  if (resetSent) return (
    <div className="login-wrap">
      <div className="login-card" style={{textAlign:"center"}}>
        <img src={LOGO_BASE64} alt="AFINE" style={{height:60,width:"auto",marginBottom:16}}/>
        <div style={{fontSize:36,marginBottom:12}}>✅</div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:8}}>E-mail enviado!</h2>
        <p style={{fontSize:13,color:"#7A7A7A",marginBottom:20}}>Verifique sua caixa de entrada e clique no link para redefinir a senha.</p>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={()=>{setForgot(false);setResetSent(false);}}>Voltar ao login</button>
      </div>
    </div>
  );

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <img src={LOGO_BASE64} alt="AFINE" style={{height:64,width:"auto"}}/>
          <h1>AFINE</h1>
          <p>A.F. Nery Arquitetura &amp; Construção</p>
        </div>
        <div className="login-divider"/>

        {error && <div className="login-error">{error}</div>}

        {!forgot ? (
          <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:14}}>
            <div className="form-group">
              <label>E-mail</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email"/>
            </div>
            <div className="form-group">
              <label>Senha</label>
              <div style={{position:"relative"}}>
                <input type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" style={{paddingRight:40}}/>
                <button type="button" onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#888"}}>
                  {showPass?"🙈":"👁️"}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{marginTop:4,justifyContent:"center",padding:"12px",fontSize:14}} disabled={loading}>
              {loading?"Entrando...":"Entrar"}
            </button>
            <button type="button" onClick={()=>{setForgot(true);setError("");}} style={{background:"none",border:"none",color:"#7A7A7A",fontSize:12,cursor:"pointer",textAlign:"center",marginTop:4}}>
              Esqueci minha senha
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} style={{display:"flex",flexDirection:"column",gap:14}}>
            <p style={{fontSize:13,color:"#7A7A7A"}}>Informe seu e-mail para receber o link de redefinição.</p>
            <div className="form-group">
              <label>E-mail</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" required/>
            </div>
            <button type="submit" className="btn btn-primary" style={{justifyContent:"center",padding:"12px"}} disabled={loading}>
              {loading?"Enviando...":"Enviar link de redefinição"}
            </button>
            <button type="button" onClick={()=>{setForgot(false);setError("");}} style={{background:"none",border:"none",color:"#7A7A7A",fontSize:12,cursor:"pointer",textAlign:"center"}}>
              ← Voltar ao login
            </button>
          </form>
        )}

        <p style={{textAlign:"center",fontSize:11,color:"#bbb",marginTop:20}}>
          Acesso restrito — solicite ao gestor seu e-mail e senha.
        </p>
      </div>
    </div>
  );
}
