// src/pages/Funcionarios.js
// Cadastro de funcionários com criação de login via Firebase Auth REST API
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

// Cria usuário via Firebase Auth REST API (não precisa de Admin SDK)
async function criarUsuarioFirebase(email, senha, apiKey) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.localId; // UID do novo usuário
}

function FuncionarioModal({ func, obras, apiKey, onClose, addToast }) {
  const [form, setForm] = useState({
    nome:      func?.nome      || "",
    funcao:    func?.funcao    || "",
    empresa:   func?.empresa   || "",
    tel:       func?.tel       || "",
    cpf:       func?.cpf       || "",
    email:     func?.email     || "",
    perfil:    func?.perfil    || "campo",
    status:    func?.status    || "ATIVO",
    entrada:   func?.entrada   || new Date().toISOString().split("T")[0],
    obras:     func?.obras     || [],
  });
  const [senha,    setSenha]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const isNovo = !func?.id;

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }
  function toggleObra(id) {
    setForm(p => ({
      ...p,
      obras: p.obras.includes(id) ? p.obras.filter(x=>x!==id) : [...p.obras, id]
    }));
  }

  async function save() {
    if (!form.nome || !form.email) { alert("Nome e e-mail são obrigatórios."); return; }
    if (isNovo && !senha) { alert("Defina uma senha para o novo funcionário."); return; }
    if (isNovo && senha.length < 6) { alert("A senha deve ter pelo menos 6 caracteres."); return; }
    setSaving(true);
    try {
      let uid = func?.uid;
      if (isNovo) {
        // Cria o login no Firebase Authentication
        uid = await criarUsuarioFirebase(form.email, senha, apiKey);
        addToast("Login criado com sucesso!");
      }
      const payload = { ...form, uid, updatedAt: new Date().toISOString() };
      if (func?.id) {
        await updateDoc(doc(db, "usuarios", uid), payload);
        addToast("Funcionário atualizado!");
      } else {
        payload.createdAt = new Date().toISOString();
        // Salva na coleção usuarios com o UID como ID do documento
        await addDoc(collection(db, "usuarios_lista"), payload);
        // Cria também o documento com ID = UID para o sistema de perfil
        const { setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "usuarios", uid), payload);
        addToast("Funcionário cadastrado!");
      }
      onClose();
    } catch (err) {
      if (err.message.includes("EMAIL_EXISTS")) addToast("Este e-mail já está cadastrado.", "error");
      else addToast("Erro: " + err.message, "error");
    }
    setSaving(false);
  }

  return (
    <Modal title={isNovo ? "Novo funcionário" : "Editar funcionário"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>DADOS PESSOAIS</div>
        <div className="form-grid">
          <div className="form-group"><label className="required">Nome completo</label><input value={form.nome} onChange={e=>set("nome",e.target.value)}/></div>
          <div className="form-group"><label className="required">Função / Cargo</label><input value={form.funcao} onChange={e=>set("funcao",e.target.value)} placeholder="Ex: Eletricista"/></div>
          <div className="form-group"><label>Empresa / Subempreiteiro</label><input value={form.empresa} onChange={e=>set("empresa",e.target.value)}/></div>
          <div className="form-group"><label>Telefone / WhatsApp</label><input value={form.tel} onChange={e=>set("tel",e.target.value)} placeholder="(11) 9xxxx-xxxx"/></div>
          <div className="form-group"><label>CPF / RG</label><input value={form.cpf} onChange={e=>set("cpf",e.target.value)}/></div>
          <div className="form-group"><label>Data de entrada</label><input type="date" value={form.entrada} onChange={e=>set("entrada",e.target.value)}/></div>
        </div>

        <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>LOGIN E ACESSO</div>
        <div className="form-grid">
          <div className="form-group"><label className="required">E-mail (login)</label>
            <input type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="funcionario@email.com" disabled={!isNovo}
              style={{opacity:!isNovo?0.6:1}}/>
            {!isNovo && <span style={{fontSize:11,color:"var(--cinza-med)"}}>E-mail não pode ser alterado</span>}
          </div>
          {isNovo && (
            <div className="form-group"><label className="required">Senha inicial</label>
              <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Mínimo 6 caracteres"/>
              <span style={{fontSize:11,color:"var(--cinza-med)"}}>O funcionário poderá trocar depois</span>
            </div>
          )}
          <div className="form-group"><label>Perfil de acesso</label>
            <select value={form.perfil} onChange={e=>set("perfil",e.target.value)}>
              <option value="gestor">Gestor — acesso total</option>
              <option value="encarregado">Encarregado — cria e edita</option>
              <option value="campo">Campo — atualiza status e fotos</option>
            </select>
          </div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {["ATIVO","AFASTADO","DESLIGADO","FÉRIAS"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {isNovo && (
          <div className="alert alert-info" style={{fontSize:12}}>
            💡 O funcionário vai receber o link <strong>afine-obras.vercel.app</strong> e entrar com esse e-mail e senha. Recomende trocar a senha no primeiro acesso.
          </div>
        )}

        <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>OBRAS COM ACESSO</div>
        <div style={{fontSize:12,color:"var(--cinza-med)",marginBottom:4}}>
          Selecione as obras que este funcionário pode visualizar. Gestores veem todas automaticamente.
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:180,overflowY:"auto",padding:"4px 0"}}>
          {obras.length===0 && <span style={{fontSize:12,color:"var(--cinza-med)"}}>Nenhuma obra cadastrada ainda</span>}
          {obras.map(o=>(
            <label key={o.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,background:form.obras.includes(o.id)?"var(--azul-claro)":"transparent"}}>
              <input type="checkbox" checked={form.obras.includes(o.id)} onChange={()=>toggleObra(o.id)} style={{width:15,height:15}}/>
              <span style={{flex:1}}>{o.nome}</span>
              <span style={{fontSize:11,color:"var(--cinza-med)"}}>{o.cliente}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function Funcionarios() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [funcs,   setFuncs]   = useState([]);
  const [obras,   setObras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filtro,  setFiltro]  = useState("ATIVO");
  const [modal,   setModal]   = useState(null);
  const isGestor = userProfile?.perfil === "gestor";

  // Lê a API Key do firebase.js indiretamente via env ou config
  const [apiKey, setApiKey] = useState("");
  useEffect(() => {
    // Tenta ler do objeto de config do Firebase já inicializado
    try {
      const { getApp } = require("firebase/app");
      const app = getApp();
      setApiKey(app.options.apiKey || "");
    } catch {}
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "usuarios_lista"), snap => {
      setFuncs(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "obras"), snap => {
      setObras(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
  }, []);

  const filtered = funcs.filter(f=>{
    const q = search.toLowerCase();
    const mQ = !q || f.nome?.toLowerCase().includes(q) || f.funcao?.toLowerCase().includes(q) || f.email?.toLowerCase().includes(q);
    const mF = filtro==="todos" || f.status===filtro;
    return mQ && mF;
  });

  const perfilLabel = {gestor:"Gestor",encarregado:"Encarregado",campo:"Campo"};
  const perfilBadge = {gestor:"badge-blue",encarregado:"badge-purple",campo:"badge-gray"};

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Funcionários</div>
          <div style={{fontSize:12,color:"var(--cinza-med)"}}>{funcs.filter(f=>f.status==="ATIVO").length} ativos · {funcs.length} total</div>
        </div>
        {isGestor && <button className="btn btn-primary" onClick={()=>setModal({func:null})}>+ Novo funcionário</button>}
      </div>

      <div className="alert alert-info" style={{marginBottom:16,fontSize:12}}>
        💡 Ao criar um funcionário aqui, o login é criado automaticamente. Basta mandar o e-mail e senha para ele acessar pelo celular.
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
            <thead><tr><th></th><th>Nome</th><th>Função</th><th>Empresa</th><th>E-mail</th><th>Perfil</th><th>Obras</th><th>Entrada</th><th>Status</th>{isGestor&&<th></th>}</tr></thead>
            <tbody>
              {filtered.map(f=>(
                <tr key={f.id}>
                  <td><div style={{width:32,height:32,borderRadius:"50%",background:"var(--azul-claro)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"var(--azul-med)"}}>{initials(f.nome)}</div></td>
                  <td><strong>{f.nome}</strong></td>
                  <td style={{fontSize:12}}>{f.funcao}</td>
                  <td style={{fontSize:12,color:"var(--azul-med)"}}>{f.empresa||"–"}</td>
                  <td style={{fontSize:11,color:"var(--cinza-med)"}}>{f.email}</td>
                  <td><span className={`badge ${perfilBadge[f.perfil]||"badge-gray"}`}>{perfilLabel[f.perfil]||f.perfil}</span></td>
                  <td style={{fontSize:11}}>{f.perfil==="gestor"?"Todas":(f.obras?.length||0)+" obras"}</td>
                  <td style={{fontSize:12}}>{fmtDate(f.entrada)}</td>
                  <td><span className={`badge ${statusBadge(f.status)}`}>{f.status}</span></td>
                  {isGestor && <td><button className="btn btn-sm btn-icon" onClick={()=>setModal({func:f})}>✏️</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <FuncionarioModal func={modal.func} obras={obras} apiKey={apiKey} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
