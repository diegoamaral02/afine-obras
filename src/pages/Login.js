// src/pages/Login.js — logo embutida (nunca quebra)
import React, { useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { LOGO_BASE64 } from "../utils/assets";

const MAX_TENTATIVAS = 5;
const BLOQUEIO_SEGUNDOS = 30;

export default function Login() {
  const { login, resetPassword } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [forgot,   setForgot]   = useState(false);
  const [resetSent,setResetSent]= useState(false);
  const [tentativas, setTentativas] = useState(0);
  const [bloqueadoAte, setBloqueadoAte] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  function iniciarBloqueio() {
    const ate = Date.now() + BLOQUEIO_SEGUNDOS * 1000;
    setBloqueadoAte(ate);
    setCountdown(BLOQUEIO_SEGUNDOS);
    timerRef.current = setInterval(() => {
      const restante = Math.ceil((ate - Date.now()) / 1000);
      if (restante <= 0) { clearInterval(timerRef.current); setBloqueadoAte(null); setTentativas(0); setCountdown(0); }
      else setCountdown(restante);
    }, 1000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (bloqueadoAte && Date.now() < bloqueadoAte) return;
    setError(""); setLoading(true);
    try {
      await login(email, password);
      setTentativas(0);
    } catch {
      const novas = tentativas + 1;
      setTentativas(novas);
      if (novas >= MAX_TENTATIVAS) {
        iniciarBloqueio();
        setError(`Muitas tentativas incorretas. Aguarde ${BLOQUEIO_SEGUNDOS} segundos.`);
      } else {
        setError(`E-mail ou senha inválidos. Tentativa ${novas}/${MAX_TENTATIVAS}.`);
      }
    }
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
            {countdown > 0 && (
              <div style={{textAlign:"center",fontSize:12,color:"var(--vermelho)",fontWeight:600,padding:"8px",background:"var(--vermelho-lt)",borderRadius:6}}>
                🔒 Login bloqueado — aguarde {countdown}s
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{marginTop:4,justifyContent:"center",padding:"12px",fontSize:14}} disabled={loading || countdown > 0}>
              {loading?"Entrando...":countdown>0?`Aguarde ${countdown}s`:"Entrar"}
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
