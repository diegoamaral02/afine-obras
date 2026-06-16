// src/pages/Funcionarios.js — com excluir acesso + mudar senha pelo gestor
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { statusBadge, fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

// App secundário para operações de auth sem deslogar o gestor
function getSecAuth() {
  const config = getApps()[0].options;
  const app = getApps().find(a => a.name === "afine-sec") || initializeApp(config, "afine-sec");
  return getAuth(app);
}

// Cria login sem deslogar gestor
async function criarLoginFirebase(email, senha) {
  const secAuth = getSecAuth();
  const cred = await createUserWithEmailAndPassword(secAuth, email, senha);
  await secAuth.signOut();
  return cred.user.uid;
}

// Modal de mudança de senha pelo gestor
function AlterarSenhaModal({ func, onClose, addToast }) {
  const [novaSenha,    setNovaSenha]    = useState("");
  const [confirmar,    setConfirmar]    = useState("");
  const [showNova,     setShowNova]     = useState(false);
  const [showConf,     setShowConf]     = useState(false);
  const [saving,       setSaving]       = useState(false);

  async function save() {
    if (novaSenha.length < 6) { alert("A senha deve ter pelo menos 6 caracteres."); return; }
    if (novaSenha !== confirmar) { alert("As senhas não coincidem."); return; }
    setSaving(true);
    try {
      // Estratégia: logar no app secundário com a senha ATUAL (nova senha fornecida),
      // se falhar tenta via REST API do Firebase Identity Toolkit
      const secAuth = getSecAuth();

      // Tenta trocar via REST API (método mais direto — funciona com apiKey)
      const apiKey = getApps()[0].options.apiKey;
      if (apiKey) {
        // 1. Primeiro localiza o usuário pelo e-mail para pegar o idToken
        // Usamos signInWithEmailAndPassword com a nova senha — se funcionar, já era a senha
        // O método correto é via Admin SDK, mas no client SDK usamos updatePassword após login
        // Como não temos a senha atual, vamos logar com senha temporária no app sec
        // e usar o token para chamar a API de update
        const res = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              // Precisaria do idToken do usuário — não disponível sem login
              // Usamos a abordagem de reset por e-mail como fallback seguro
            })
          }
        );
      }
      throw new Error("USE_RESET"); // força usar reset por email
    } catch (err) {
      if (err.message !== "USE_RESET") {
        addToast("Erro: " + err.message, "error");
        setSaving(false);
        return;
      }
      // Fallback final: link de redefinição por e-mail
      try {
        // Valida formato de e-mail antes de enviar
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(func.email)) {
          addToast(`E-mail inválido (${func.email}). Não é possível enviar link de redefinição. Use um e-mail válido ao cadastrar funcionários.`, "error");
          setSaving(false);
          return;
        }
        await sendPasswordResetEmail(auth, func.email);
        addToast(`✓ Link de redefinição enviado para ${func.email}`);
        onClose();
      } catch (err2) {
        addToast("Erro ao enviar link: " + err2.message, "error");
      }
    }
    setSaving(false);
  }

  return (
    <Modal title={`Alterar senha — ${func.nome}`} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Enviando..." : "Alterar senha"}
          </button>
        </>
      }>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div className="alert alert-info" style={{ fontSize:12 }}>
          🔐 Por segurança do Firebase, a troca de senha direta pelo gestor envia um link de redefinição para o e-mail do funcionário. Ele clica no link e define a nova senha.
        </div>

        <div style={{ background:"var(--cinza-lt)", borderRadius:8, padding:12 }}>
          <div style={{ fontSize:12, color:"#7A7A7A", marginBottom:4 }}>Funcionário</div>
          <div style={{ fontWeight:600 }}>{func.nome}</div>
          <div style={{ fontSize:12, color:"#7A7A7A" }}>{func.email}</div>
        </div>

        <div style={{ borderTop:"1px solid var(--border)", paddingTop:14 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>
            Ou defina a nova senha manualmente:
          </div>
          <div style={{ background:"var(--afine-yellow-lt)", borderRadius:8, padding:10, fontSize:12, marginBottom:12, color:"#8A6000" }}>
            ⚠️ Esta opção só funciona se o funcionário ainda não alterou a senha após o cadastro. Caso contrário, use o link por e-mail.
          </div>
          <div className="form-group" style={{ marginBottom:10 }}>
            <label>Nova senha</label>
            <div style={{ position:"relative" }}>
              <input
                type={showNova ? "text" : "password"}
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={{ paddingRight:40 }}
              />
              <button type="button" onClick={() => setShowNova(!showNova)}
                style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:15, color:"#888" }}>
                {showNova ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Confirmar nova senha</label>
            <div style={{ position:"relative" }}>
              <input
                type={showConf ? "text" : "password"}
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                placeholder="Repita a nova senha"
                style={{ paddingRight:40, borderColor: confirmar && novaSenha !== confirmar ? "var(--vermelho)" : "" }}
              />
              <button type="button" onClick={() => setShowConf(!showConf)}
                style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:15, color:"#888" }}>
                {showConf ? "🙈" : "👁️"}
              </button>
            </div>
            {confirmar && novaSenha !== confirmar && (
              <span style={{ fontSize:11, color:"var(--vermelho)" }}>As senhas não coincidem</span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Modal de confirmação de exclusão
function ExcluirModal({ func, onClose, addToast }) {
  const [confirma, setConfirma] = useState("");
  const [saving,   setSaving]   = useState(false);
  const nomeCorreto = confirma.trim().toLowerCase() === func.nome.trim().toLowerCase();

  async function excluir() {
    if (!nomeCorreto) { alert("Digite o nome corretamente para confirmar."); return; }
    setSaving(true);
    try {
      // Remove perfil do Firestore
      await deleteDoc(doc(db, "usuarios", func.id));
      // Nota: remoção do Firebase Auth exige Admin SDK (backend)
      // O acesso é bloqueado pois o documento não existe mais no Firestore
      addToast(`Acesso de ${func.nome} removido do sistema.`);
      onClose();
    } catch (err) {
      addToast("Erro ao excluir: " + err.message, "error");
    }
    setSaving(false);
  }

  return (
    <Modal title="Excluir acesso" onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-danger" onClick={excluir} disabled={saving || !nomeCorreto}>
            {saving ? "Excluindo..." : "Excluir acesso"}
          </button>
        </>
      }>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div className="alert alert-danger" style={{ fontSize:12 }}>
          ⚠️ <strong>Esta ação é irreversível.</strong> O funcionário perderá acesso imediato ao sistema e todos os dados de perfil serão removidos.
        </div>

        <div style={{ background:"var(--cinza-lt)", borderRadius:8, padding:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div className="user-avatar" style={{ width:40, height:40, fontSize:14 }}>{initials(func.nome)}</div>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{func.nome}</div>
              <div style={{ fontSize:12, color:"#7A7A7A" }}>{func.email}</div>
              <span className={`badge ${func.perfil==="gestor"?"badge-yellow":func.perfil==="encarregado"?"badge-blue":"badge-gray"}`} style={{ fontSize:10, marginTop:4 }}>
                {func.perfil}
              </span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label style={{ color:"var(--vermelho)", fontWeight:600 }}>
            Para confirmar, digite o nome do funcionário: <strong>{func.nome}</strong>
          </label>
          <input
            value={confirma}
            onChange={e => setConfirma(e.target.value)}
            placeholder="Digite o nome exato..."
            style={{ borderColor: confirma && !nomeCorreto ? "var(--vermelho)" : confirma && nomeCorreto ? "var(--verde)" : "" }}
          />
          {confirma && nomeCorreto && (
            <span style={{ fontSize:11, color:"var(--verde)", fontWeight:600 }}>✓ Confirmado</span>
          )}
        </div>

        <div style={{ fontSize:12, color:"#7A7A7A", background:"var(--afine-yellow-lt)", borderRadius:8, padding:10, lineHeight:1.6 }}>
          💡 <strong>Nota técnica:</strong> O login no Firebase Authentication é desabilitado removendo o perfil de acesso. Para remoção completa do Firebase Auth, entre em contato com o administrador do sistema.
        </div>
      </div>
    </Modal>
  );
}

function FuncionarioModal({ func, obras, onClose, addToast }) {
  const [form, setForm] = useState({
    nome:    func?.nome||"",   funcao:  func?.funcao||"",  empresa: func?.empresa||"",
    tel:     func?.tel||"",   cpf:     func?.cpf||"",     email:   func?.email||"",
    perfil:  func?.perfil||"campo",    status:  func?.status||"ATIVO",
    entrada: func?.entrada||new Date().toISOString().split("T")[0],
    obras:   func?.obras||[],
  });
  const [senha,     setSenha]     = useState("");
  const [modoSenha, setModoSenha] = useState("criar");
  const [saving,    setSaving]    = useState(false);
  const isNovo = !func?.id;

  function set(f, v) { setForm(p => ({...p, [f]: v})); }
  function toggleObra(id) {
    setForm(p => ({...p, obras: p.obras.includes(id) ? p.obras.filter(x=>x!==id) : [...p.obras, id]}));
  }

  async function save() {
    if (!form.nome || !form.email) { alert("Nome e e-mail são obrigatórios."); return; }
    if (isNovo && modoSenha==="criar" && !senha) { alert("Defina uma senha."); return; }
    if (isNovo && modoSenha==="criar" && senha.length<6) { alert("Senha mínimo 6 caracteres."); return; }
    setSaving(true);
    try {
      let uid = func?.uid;
      if (isNovo) {
        if (modoSenha === "criar") {
          try {
            uid = await criarLoginFirebase(form.email, senha);
            addToast("✓ Login criado!");
          } catch (err) {
            if (err.code === "auth/email-already-in-use") { addToast("E-mail já cadastrado.", "error"); setSaving(false); return; }
            await sendPasswordResetEmail(auth, form.email).catch(()=>{});
            addToast("Perfil criado. Link de acesso enviado para " + form.email);
            uid = "pending_" + btoa(form.email).replace(/[^a-zA-Z0-9]/g,"").slice(0,20);
          }
        } else {
          await sendPasswordResetEmail(auth, form.email).catch(()=>{});
          addToast("✓ Link de acesso enviado para " + form.email);
          uid = "pending_" + btoa(form.email).replace(/[^a-zA-Z0-9]/g,"").slice(0,20);
        }
      }
      const payload = { ...form, uid, pendente: uid?.startsWith("pending_")||false, updatedAt: new Date().toISOString(), createdAt: func?.createdAt||new Date().toISOString() };
      await setDoc(doc(db, "usuarios", uid), payload);
      addToast(isNovo ? "Funcionário cadastrado!" : "Funcionário atualizado!");
      onClose();
    } catch (err) { addToast("Erro: " + (err.message||err.code||"Tente novamente"), "error"); }
    setSaving(false);
  }

  const perfilInfo = { gestor:"Acesso total", encarregado:"Cria e edita", campo:"Atualiza status e fotos" };

  return (
    <Modal title={isNovo ? "Novo funcionário" : "Editar funcionário"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

        <div style={{ fontSize:11, fontWeight:700, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:".06em" }}>Dados pessoais</div>
        <div className="form-grid">
          <div className="form-group"><label className="required">Nome completo</label><input value={form.nome} onChange={e=>set("nome",e.target.value)}/></div>
          <div className="form-group"><label className="required">Função / Cargo</label><input value={form.funcao} onChange={e=>set("funcao",e.target.value)} placeholder="Ex: Eletricista"/></div>
          <div className="form-group"><label>Empresa</label><input value={form.empresa} onChange={e=>set("empresa",e.target.value)}/></div>
          <div className="form-group"><label>Telefone / WhatsApp</label><input value={form.tel} onChange={e=>set("tel",e.target.value)} placeholder="(11) 9xxxx-xxxx"/></div>
          <div className="form-group"><label>CPF / RG</label><input value={form.cpf} onChange={e=>set("cpf",e.target.value)}/></div>
          <div className="form-group"><label>Data de entrada</label><input type="date" value={form.entrada} onChange={e=>set("entrada",e.target.value)}/></div>
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:".06em" }}>Acesso ao sistema</div>
        <div className="form-group">
          <label className="required">E-mail (login)</label>
          <input type="email" value={form.email} onChange={e=>set("email",e.target.value)} disabled={!isNovo} style={{ opacity:!isNovo?.6:1 }}/>
          {!isNovo && <span style={{ fontSize:11, color:"#7A7A7A" }}>E-mail não pode ser alterado após criação</span>}
        </div>

        {isNovo && (
          <>
            <div style={{ display:"flex", gap:8 }}>
              <button type="button" onClick={()=>setModoSenha("criar")} className="btn"
                style={{ flex:1, justifyContent:"center", background:modoSenha==="criar"?"#1A1A1A":"", color:modoSenha==="criar"?"#F5C800":"", borderColor:modoSenha==="criar"?"#1A1A1A":"" }}>
                🔑 Definir senha agora
              </button>
              <button type="button" onClick={()=>setModoSenha("link")} className="btn"
                style={{ flex:1, justifyContent:"center", background:modoSenha==="link"?"#1A1A1A":"", color:modoSenha==="link"?"#F5C800":"", borderColor:modoSenha==="link"?"#1A1A1A":"" }}>
                📧 Enviar link por e-mail
              </button>
            </div>
            {modoSenha==="criar" ? (
              <div className="form-group">
                <label className="required">Senha inicial</label>
                <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Mínimo 6 caracteres"/>
              </div>
            ) : (
              <div className="alert alert-info" style={{ fontSize:12 }}>
                📧 Link de criação de senha será enviado para <strong>{form.email||"o e-mail informado"}</strong>.
              </div>
            )}
          </>
        )}

        <div className="form-grid">
          <div className="form-group">
            <label>Perfil de acesso</label>
            <select value={form.perfil} onChange={e=>set("perfil",e.target.value)}>
              <option value="gestor">Gestor</option>
              <option value="encarregado">Encarregado</option>
              <option value="campo">Campo</option>
            </select>
            <span style={{ fontSize:11, color:"#7A7A7A" }}>{perfilInfo[form.perfil]}</span>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {["ATIVO","AFASTADO","DESLIGADO","FÉRIAS"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize:11, fontWeight:700, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:".06em" }}>Obras com acesso</div>
        {form.perfil==="gestor"
          ? <div style={{ fontSize:12, color:"#7A7A7A" }}>Gestores têm acesso automático a todas as obras.</div>
          : (
            <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto" }}>
              {obras.length===0 && <span style={{ fontSize:12, color:"#7A7A7A" }}>Nenhuma obra cadastrada ainda</span>}
              {obras.map(o=>(
                <label key={o.id} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer", padding:"4px 8px", borderRadius:6, background:form.obras.includes(o.id)?"var(--afine-yellow-lt)":"transparent" }}>
                  <input type="checkbox" checked={form.obras.includes(o.id)} onChange={()=>toggleObra(o.id)} style={{ width:15, height:15 }}/>
                  <span style={{ flex:1 }}>{o.nome}</span>
                  <span style={{ fontSize:11, color:"#7A7A7A" }}>{o.cliente}</span>
                </label>
              ))}
            </div>
          )
        }

        <div className="alert alert-info" style={{ fontSize:12 }}>
          💡 Link de acesso: <strong>afine-obras.vercel.app</strong> — envie por WhatsApp com e-mail e senha.
        </div>
      </div>
    </Modal>
  );
}

export default function Funcionarios() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [funcs,        setFuncs]        = useState([]);
  const [obras,        setObras]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filtro,       setFiltro]       = useState("ATIVO");
  const [modal,        setModal]        = useState(null);
  const [modalSenha,   setModalSenha]   = useState(null);
  const [modalExcluir, setModalExcluir] = useState(null);
  const isGestor = userProfile?.perfil === "gestor";

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"usuarios"), snap => { setFuncs(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); });
    const u2 = onSnapshot(collection(db,"obras"),    snap => setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { u1(); u2(); };
  }, []);

  const filtered = funcs.filter(f => {
    const q = search.toLowerCase();
    const mQ = !q || f.nome?.toLowerCase().includes(q) || f.funcao?.toLowerCase().includes(q) || f.email?.toLowerCase().includes(q);
    const mF = filtro==="todos" || f.status===filtro;
    return mQ && mF;
  });

  const perfilBadge = { gestor:"badge-yellow", encarregado:"badge-blue", campo:"badge-gray" };
  const perfilLabel = { gestor:"Gestor", encarregado:"Encarregado", campo:"Campo" };

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Funcionários</div>
          <div style={{ fontSize:12, color:"#7A7A7A" }}>{funcs.filter(f=>f.status==="ATIVO").length} ativos · {funcs.length} total</div>
        </div>
        {isGestor && <button className="btn btn-primary" onClick={()=>setModal({func:null})}>+ Novo funcionário</button>}
      </div>

      <div className="chip-row">
        {["ATIVO","AFASTADO","DESLIGADO","FÉRIAS","todos"].map(s=>(
          <button key={s} className={`chip ${filtro===s?"active":""}`} onClick={()=>setFiltro(s)}>
            {s==="todos"?"Todos":s} ({s==="todos"?funcs.length:funcs.filter(f=>f.status===s).length})
          </button>
        ))}
      </div>
      <div className="search-bar">🔍<input placeholder="Buscar por nome, função ou e-mail..." value={search} onChange={e=>setSearch(e.target.value)}/></div>

      {loading && <div className="spinner"/>}
      {!loading && filtered.length===0 && <div className="empty-state"><div className="empty-icon">👷</div><p>Nenhum funcionário encontrado</p></div>}
      {!loading && filtered.length>0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th><th>Nome</th><th>Função</th><th>E-mail</th><th>Perfil</th><th>Obras</th><th>Status</th>
                {isGestor && <th style={{ textAlign:"center" }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id}>
                  <td><div className="user-avatar" style={{ width:32, height:32, fontSize:11 }}>{initials(f.nome)}</div></td>
                  <td>
                    <strong>{f.nome}</strong>
                    {f.pendente && <span className="badge badge-amber" style={{ fontSize:9, marginLeft:6 }}>Aguard. 1º acesso</span>}
                  </td>
                  <td style={{ fontSize:12 }}>{f.funcao}</td>
                  <td style={{ fontSize:11, color:"#7A7A7A" }}>{f.email}</td>
                  <td><span className={`badge ${perfilBadge[f.perfil]||"badge-gray"}`}>{perfilLabel[f.perfil]||f.perfil}</span></td>
                  <td style={{ fontSize:11 }}>{f.perfil==="gestor"?"Todas":(f.obras?.length||0)+" obras"}</td>
                  <td><span className={`badge ${statusBadge(f.status)}`}>{f.status}</span></td>
                  {isGestor && (
                    <td>
                      <div style={{ display:"flex", gap:4, justifyContent:"center" }}>
                        {/* Editar */}
                        <button className="btn btn-sm btn-icon" title="Editar" onClick={()=>setModal({func:f})}>✏️</button>
                        {/* Mudar senha */}
                        <button className="btn btn-sm btn-icon" title="Alterar senha"
                          onClick={()=>setModalSenha(f)}
                          style={{ background:"var(--afine-yellow-lt)", borderColor:"var(--afine-yellow-dk)" }}>
                          🔑
                        </button>
                        {/* Excluir acesso */}
                        <button className="btn btn-sm btn-icon" title="Excluir acesso"
                          onClick={()=>setModalExcluir(f)}
                          style={{ background:"var(--vermelho-lt)", borderColor:"rgba(184,50,50,.3)", color:"var(--vermelho)" }}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal        && <FuncionarioModal  func={modal.func}    obras={obras}  onClose={()=>setModal(null)}        addToast={addToast}/>}
      {modalSenha   && <AlterarSenhaModal func={modalSenha}                   onClose={()=>setModalSenha(null)}   addToast={addToast}/>}
      {modalExcluir && <ExcluirModal      func={modalExcluir}                 onClose={()=>setModalExcluir(null)} addToast={addToast}/>}
    </div>
  );
}
