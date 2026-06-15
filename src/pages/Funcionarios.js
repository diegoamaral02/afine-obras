// src/pages/Funcionarios.js
// Cadastro de funcionários com duas opções:
// 1. Criar login automático (se Firebase permitir)
// 2. Criar perfil e enviar link de redefinição de senha
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { statusBadge, fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

// Tenta criar usuário em app secundário (não desloga o gestor)
async function criarLoginFirebase(email, senha) {
  const mainApp = getApps()[0];
  const config = mainApp.options;
  const secondaryApp = getApps().find(a => a.name === "afine-sec")
    || initializeApp(config, "afine-sec");
  const secAuth = getAuth(secondaryApp);
  const cred = await createUserWithEmailAndPassword(secAuth, email, senha);
  await secAuth.signOut();
  return cred.user.uid;
}

function FuncionarioModal({ func, obras, onClose, addToast }) {
  const [form, setForm] = useState({
    nome: func?.nome||"", funcao: func?.funcao||"", empresa: func?.empresa||"",
    tel: func?.tel||"", cpf: func?.cpf||"", email: func?.email||"",
    perfil: func?.perfil||"campo", status: func?.status||"ATIVO",
    entrada: func?.entrada||new Date().toISOString().split("T")[0],
    obras: func?.obras||[],
  });
  const [senha,    setSenha]    = useState("");
  const [modoSenha,setModoSenha]= useState("criar"); // "criar" | "link"
  const [saving,   setSaving]   = useState(false);
  const isNovo = !func?.id;

  function set(f,v) { setForm(p=>({...p,[f]:v})); }
  function toggleObra(id) {
    setForm(p=>({...p,obras:p.obras.includes(id)?p.obras.filter(x=>x!==id):[...p.obras,id]}));
  }

  async function save() {
    if (!form.nome||!form.email) { alert("Nome e e-mail são obrigatórios."); return; }
    if (isNovo && modoSenha==="criar" && !senha) { alert("Defina uma senha."); return; }
    if (isNovo && modoSenha==="criar" && senha.length<6) { alert("Senha mínimo 6 caracteres."); return; }
    setSaving(true);

    try {
      let uid = func?.uid;

      if (isNovo) {
        if (modoSenha === "criar") {
          // Tenta criar login automaticamente
          try {
            uid = await criarLoginFirebase(form.email, senha);
            addToast("✓ Login criado automaticamente!");
          } catch(err) {
            if (err.code === "auth/email-already-in-use") {
              addToast("E-mail já cadastrado no sistema.","error");
              setSaving(false); return;
            }
            // Se falhar por restrição, usa modo link
            addToast("Criando perfil e enviando link de acesso...","info");
            try {
              await sendPasswordResetEmail(auth, form.email);
              addToast("✓ Link de acesso enviado para "+form.email);
            } catch {}
            // Gera UID temporário baseado no email para o perfil
            uid = "pending_" + btoa(form.email).replace(/[^a-zA-Z0-9]/g,"").slice(0,20);
          }
        } else {
          // Modo link: envia e-mail de redefinição para o usuário criar a própria senha
          try {
            await sendPasswordResetEmail(auth, form.email);
            addToast("✓ Link de acesso enviado para " + form.email);
          } catch(err) {
            // Ignora erro — o e-mail pode não existir ainda, mas o perfil será criado
          }
          uid = "pending_" + btoa(form.email).replace(/[^a-zA-Z0-9]/g,"").slice(0,20);
        }
      }

      // Salva perfil no Firestore
      const payload = {
        ...form, uid,
        pendente: uid.startsWith("pending_"),
        updatedAt: new Date().toISOString(),
        createdAt: func?.createdAt || new Date().toISOString(),
      };
      await setDoc(doc(db,"usuarios",uid), payload);
      addToast(isNovo ? "Funcionário cadastrado!" : "Funcionário atualizado!");
      onClose();
    } catch(err) {
      addToast("Erro: " + (err.message||err.code||"Tente novamente"),"error");
    }
    setSaving(false);
  }

  const perfilInfo = {
    gestor: "Acesso total — cria obras, usuários e apaga dados",
    encarregado: "Cria e edita escopos, RDOs, equipe e materiais",
    campo: "Atualiza status, sobe fotos e cria RDOs (se permitido)",
  };

  return (
    <Modal title={isNovo?"Novo funcionário":"Editar funcionário"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving?"Salvando...":"Salvar"}
        </button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Dados pessoais</div>
        <div className="form-grid">
          <div className="form-group"><label className="required">Nome completo</label><input value={form.nome} onChange={e=>set("nome",e.target.value)}/></div>
          <div className="form-group"><label className="required">Função / Cargo</label><input value={form.funcao} onChange={e=>set("funcao",e.target.value)} placeholder="Ex: Eletricista"/></div>
          <div className="form-group"><label>Empresa</label><input value={form.empresa} onChange={e=>set("empresa",e.target.value)}/></div>
          <div className="form-group"><label>Telefone / WhatsApp</label><input value={form.tel} onChange={e=>set("tel",e.target.value)} placeholder="(11) 9xxxx-xxxx"/></div>
          <div className="form-group"><label>CPF / RG</label><input value={form.cpf} onChange={e=>set("cpf",e.target.value)}/></div>
          <div className="form-group"><label>Data de entrada</label><input type="date" value={form.entrada} onChange={e=>set("entrada",e.target.value)}/></div>
        </div>

        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Acesso ao sistema</div>

        <div className="form-group">
          <label className="required">E-mail (usado para login)</label>
          <input type="email" value={form.email} onChange={e=>set("email",e.target.value)}
            disabled={!isNovo} style={{opacity:!isNovo?.6:1}}/>
          {!isNovo&&<span style={{fontSize:11,color:"#7A7A7A"}}>E-mail não pode ser alterado após criação</span>}
        </div>

        {isNovo && (
          <>
            {/* Modo de acesso */}
            <div style={{display:"flex",gap:8}}>
              <button type="button" onClick={()=>setModoSenha("criar")} className="btn"
                style={{flex:1,justifyContent:"center",
                  background:modoSenha==="criar"?"#1A1A1A":"",
                  color:modoSenha==="criar"?"#F5C800":"",
                  borderColor:modoSenha==="criar"?"#1A1A1A":""}}>
                🔑 Definir senha agora
              </button>
              <button type="button" onClick={()=>setModoSenha("link")} className="btn"
                style={{flex:1,justifyContent:"center",
                  background:modoSenha==="link"?"#1A1A1A":"",
                  color:modoSenha==="link"?"#F5C800":"",
                  borderColor:modoSenha==="link"?"#1A1A1A":""}}>
                📧 Enviar link por e-mail
              </button>
            </div>

            {modoSenha==="criar" ? (
              <div className="form-group">
                <label className="required">Senha inicial</label>
                <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Mínimo 6 caracteres"/>
              </div>
            ) : (
              <div className="alert alert-info" style={{fontSize:12}}>
                📧 Um link de criação de senha será enviado para <strong>{form.email||"o e-mail informado"}</strong>.<br/>
                O funcionário clica no link e define a própria senha.
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
            <span style={{fontSize:11,color:"#7A7A7A"}}>{perfilInfo[form.perfil]}</span>
          </div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {["ATIVO","AFASTADO","DESLIGADO","FÉRIAS"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Obras com acesso</div>
        {form.perfil==="gestor"
          ? <div style={{fontSize:12,color:"#7A7A7A"}}>Gestores têm acesso automático a todas as obras.</div>
          : (
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:160,overflowY:"auto"}}>
              {obras.length===0&&<span style={{fontSize:12,color:"#7A7A7A"}}>Nenhuma obra cadastrada ainda</span>}
              {obras.map(o=>(
                <label key={o.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",
                  padding:"4px 8px",borderRadius:6,
                  background:form.obras.includes(o.id)?"var(--afine-yellow-lt)":"transparent"}}>
                  <input type="checkbox" checked={form.obras.includes(o.id)} onChange={()=>toggleObra(o.id)} style={{width:15,height:15}}/>
                  <span style={{flex:1}}>{o.nome}</span>
                  <span style={{fontSize:11,color:"#7A7A7A"}}>{o.cliente}</span>
                </label>
              ))}
            </div>
          )
        }

        <div className="alert alert-info" style={{fontSize:12}}>
          💡 Link de acesso: <strong>afine-obras.vercel.app</strong> — envie por WhatsApp ao funcionário com o e-mail e senha.
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
  const isGestor = userProfile?.perfil==="gestor";

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"usuarios"),snap=>{
      setFuncs(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    const u2=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();};
  },[]);

  const filtered=funcs.filter(f=>{
    const q=search.toLowerCase();
    const mQ=!q||f.nome?.toLowerCase().includes(q)||f.funcao?.toLowerCase().includes(q)||f.email?.toLowerCase().includes(q);
    const mF=filtro==="todos"||f.status===filtro;
    return mQ&&mF;
  });

  const perfilBadge={gestor:"badge-yellow",encarregado:"badge-blue",campo:"badge-gray"};
  const perfilLabel={gestor:"Gestor",encarregado:"Encarregado",campo:"Campo"};

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Funcionários</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{funcs.filter(f=>f.status==="ATIVO").length} ativos · {funcs.length} total</div>
        </div>
        {isGestor&&<button className="btn btn-primary" onClick={()=>setModal({func:null})}>+ Novo funcionário</button>}
      </div>

      <div className="chip-row">
        {["ATIVO","AFASTADO","DESLIGADO","FÉRIAS","todos"].map(s=>(
          <button key={s} className={`chip ${filtro===s?"active":""}`} onClick={()=>setFiltro(s)}>
            {s==="todos"?"Todos":s} ({s==="todos"?funcs.length:funcs.filter(f=>f.status===s).length})
          </button>
        ))}
      </div>
      <div className="search-bar">🔍<input placeholder="Buscar por nome, função ou e-mail..." value={search} onChange={e=>setSearch(e.target.value)}/></div>

      {loading&&<div className="spinner"/>}
      {!loading&&filtered.length===0&&<div className="empty-state"><div className="empty-icon">👷</div><p>Nenhum funcionário encontrado</p></div>}
      {!loading&&filtered.length>0&&(
        <div className="table-wrap">
          <table>
            <thead><tr><th></th><th>Nome</th><th>Função</th><th>E-mail</th><th>Perfil</th><th>Obras</th><th>Status</th>{isGestor&&<th></th>}</tr></thead>
            <tbody>
              {filtered.map(f=>(
                <tr key={f.id} style={{opacity:f.pendente?.7:1}}>
                  <td><div className="user-avatar" style={{width:32,height:32,fontSize:11}}>{initials(f.nome)}</div></td>
                  <td>
                    <strong>{f.nome}</strong>
                    {f.pendente&&<span className="badge badge-amber" style={{fontSize:9,marginLeft:6}}>Aguard. 1º acesso</span>}
                  </td>
                  <td style={{fontSize:12}}>{f.funcao}</td>
                  <td style={{fontSize:11,color:"#7A7A7A"}}>{f.email}</td>
                  <td><span className={`badge ${perfilBadge[f.perfil]||"badge-gray"}`}>{perfilLabel[f.perfil]||f.perfil}</span></td>
                  <td style={{fontSize:11}}>{f.perfil==="gestor"?"Todas":(f.obras?.length||0)+" obras"}</td>
                  <td><span className={`badge ${statusBadge(f.status)}`}>{f.status}</span></td>
                  {isGestor&&<td><button className="btn btn-sm btn-icon" onClick={()=>setModal({func:f})}>✏️</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal&&<FuncionarioModal func={modal.func} obras={obras} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
