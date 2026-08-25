// src/pages/Funcionarios.js — com departamentos, permissões e gestão completa
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc, updateDoc, addDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { statusBadge, fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { DEPARTAMENTOS, isGestorOuAdm } from "../constants/departamentos";
import { deleteComAuditoria, updateComAuditoria } from "../services/auditoria";

function getSecAuth() {
  const config = getApps()[0].options;
  const app = getApps().find(a => a.name === "afine-sec") || initializeApp(config, "afine-sec");
  return getAuth(app);
}

async function criarLoginFirebase(email, senha) {
  const secAuth = getSecAuth();
  const cred = await createUserWithEmailAndPassword(secAuth, email, senha);
  await secAuth.signOut();
  return cred.user.uid;
}

// ── Modal Alterar Senha ────────────────────────────────────────────────────────
function AlterarSenhaModal({ func, onClose, addToast }) {
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(func.email)) {
        addToast(`E-mail inválido (${func.email}). Corrija o e-mail do funcionário primeiro.`, "error");
        setSaving(false); return;
      }
      await sendPasswordResetEmail(auth, func.email);
      addToast(`✓ Link de redefinição enviado para ${func.email}`);
      onClose();
    } catch(err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title={`Redefinir senha — ${func.nome}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Enviando...":"Enviar link de redefinição"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12}}>
          <div style={{fontSize:12,color:"#7A7A7A",marginBottom:2}}>Funcionário</div>
          <div style={{fontWeight:600}}>{func.nome}</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{func.email}</div>
        </div>
        <div className="alert alert-info" style={{fontSize:12}}>
          🔐 Um link de redefinição de senha será enviado para o e-mail acima. O funcionário clica no link e define a nova senha diretamente.
        </div>
      </div>
    </Modal>
  );
}

// ── Modal Excluir ──────────────────────────────────────────────────────────────
function ExcluirModal({ func, onClose, addToast }) {
  const { currentUser, userProfile } = useAuth();
  const [confirma, setConfirma] = useState("");
  const [saving,   setSaving]   = useState(false);
  const ok = confirma.trim().toLowerCase() === func.nome.trim().toLowerCase();

  async function excluir() {
    if (!ok) return;
    setSaving(true);
    try {
      await deleteComAuditoria("usuarios", func.id, currentUser?.uid, userProfile?.nome, { nome: func.nome, email: func.email });
      addToast(`Acesso de ${func.nome} removido.`);
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title="Excluir acesso" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-danger" onClick={excluir} disabled={saving||!ok}>{saving?"Excluindo...":"Excluir acesso"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="alert alert-danger" style={{fontSize:12}}>⚠️ <strong>Irreversível.</strong> O funcionário perderá acesso imediato.</div>
        <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12,display:"flex",gap:12,alignItems:"center"}}>
          <div className="user-avatar" style={{width:40,height:40,fontSize:14}}>{initials(func.nome)}</div>
          <div>
            <div style={{fontWeight:600}}>{func.nome}</div>
            <div style={{fontSize:12,color:"#7A7A7A"}}>{func.email}</div>
            <div style={{fontSize:11,color:"#7A7A7A"}}>{func.departamento||func.perfil}</div>
          </div>
        </div>
        <div className="form-group">
          <label style={{color:"var(--vermelho)",fontWeight:600}}>Digite o nome para confirmar: <strong>{func.nome}</strong></label>
          <input value={confirma} onChange={e=>setConfirma(e.target.value)} placeholder="Nome exato..."
            style={{borderColor:confirma&&!ok?"var(--vermelho)":confirma&&ok?"var(--verde)":""}}/>
          {confirma&&ok&&<span style={{fontSize:11,color:"var(--verde)",fontWeight:600}}>✓ Confirmado</span>}
        </div>
      </div>
    </Modal>
  );
}

// ── Modal Cadastro / Edição ────────────────────────────────────────────────────
function FuncionarioModal({ func, obras, onClose, addToast }) {
  const { currentUser: authUser, userProfile: authProfile } = useAuth();
  const [form, setForm] = useState({
    nome:         func?.nome         || "",
    funcao:       func?.funcao       || "",
    empresa:      func?.empresa      || "",
    tel:          func?.tel          || "",
    cpf:          func?.cpf          || "",
    email:        func?.email        || "",
    departamento: func?.departamento || "campo",
    adm:          func?.adm          || false,
    podeAprovar:  func?.podeAprovar  || false,
    status:       func?.status       || "ATIVO",
    entrada:      func?.entrada      || new Date().toISOString().split("T")[0],
    obras:        func?.obras        || [],
    cartaoCorporativo: func?.cartaoCorporativo || "",
    empresa:      func?.empresa      || "",
    cnpj:         func?.cnpj         || "",
    salario:      func?.salario      || "",
    tipoContrato: func?.tipoContrato || "CLT",
  });
  const [senha,     setSenha]     = useState("");
  const [modoSenha, setModoSenha] = useState("criar");
  const [saving,    setSaving]    = useState(false);
  const isNovo = !func?.id;

  // Apenas ADM (Master) e Financeiro podem ver/editar remuneração
  const podeVerSalario = authProfile?.adm || authProfile?.departamento === "financeiro";

  function set(f,v) { setForm(p=>({...p,[f]:v})); }
  function toggleObra(id) { setForm(p=>({...p,obras:p.obras.includes(id)?p.obras.filter(x=>x!==id):[...p.obras,id]})); }

  // Info do departamento selecionado
  const depInfo = DEPARTAMENTOS.find(d=>d.id===form.departamento);

  // Mapa de o que o departamento pode fazer (para mostrar no cadastro)
  const RESUMO_ACESSO = {
    adm:        "Acesso master a todo o sistema — sem restrições",
    gestao:     "Ver e editar: Principal, Comercial, Operação, Suprimentos, Financeiro, Pessoas",
    financeiro: "Ver tudo · Editar: Financeiro e Compras (Cotação, OC, NF)",
    comercial:  "Ver tudo · Editar: Comercial, Operação, Suprimentos, Lançamentos",
    fiscal:     "Ver e editar: Principal, Comercial, Operação, Suprimentos, Financeiro (lançamentos), Pessoas",
    campo:      "Ver e editar: Manutenção, Diário, Ocorrências, criar Solicitações de Compra",
    compras:    "Ver e editar: Fornecedores, Compras (Cotação, OC, Recebido, NF), Materiais",
  };

  function validarCNPJ(v) {
    const n = (v||"").replace(/\D/g,"");
    if (n.length !== 14) return false;
    if (/^(\d)\1+$/.test(n)) return false;
    const calc = (arr, len) => {
      let s=0, p=len-7;
      for (let i=len;i>=1;i--){s+=arr[len-i]*(p--);if(p<2)p=9;}
      const r=s%11;
      return r<2?0:11-r;
    };
    const a = n.split("").map(Number);
    return calc(a,12)===a[12] && calc(a,13)===a[13];
  }
  function validarCPF(v) {
    const n = (v||"").replace(/\D/g,"");
    if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
    const s1 = n.slice(0,9).split("").reduce((s,d,i)=>s+Number(d)*(10-i),0);
    const d1 = (s1*10)%11; const r1 = d1>=10?0:d1;
    const s2 = n.slice(0,10).split("").reduce((s,d,i)=>s+Number(d)*(11-i),0);
    const d2 = (s2*10)%11; const r2 = d2>=10?0:d2;
    return r1===Number(n[9]) && r2===Number(n[10]);
  }

  async function save() {
    if (!form.nome||!form.email) { addToast("Nome e e-mail são obrigatórios.","error"); return; }
    if (isNovo&&modoSenha==="criar"&&!senha) { addToast("Defina uma senha.","error"); return; }
    if (isNovo&&modoSenha==="criar"&&senha.length<6) { addToast("Senha mínimo 6 caracteres.","error"); return; }
    if (form.cnpj && !validarCNPJ(form.cnpj)) { addToast("CNPJ inválido.","error"); return; }
    if (form.cpf && !validarCPF(form.cpf))   { addToast("CPF inválido.","error"); return; }
    setSaving(true);
    try {
      let uid = func?.uid;
      if (isNovo) {
        if (modoSenha==="criar") {
          try {
            uid = await criarLoginFirebase(form.email, senha);
            addToast("✓ Login criado!");
          } catch(err) {
            if (err.code==="auth/email-already-in-use") { addToast("E-mail já cadastrado.","error"); setSaving(false); return; }
            await sendPasswordResetEmail(auth, form.email).catch(()=>{});
            addToast("Perfil criado. Link de acesso enviado.");
            uid = "pending_" + btoa(form.email).replace(/[^a-zA-Z0-9]/g,"").slice(0,20);
          }
        } else {
          await sendPasswordResetEmail(auth, form.email).catch(()=>{});
          addToast("✓ Link enviado para "+form.email);
          uid = "pending_" + btoa(form.email).replace(/[^a-zA-Z0-9]/g,"").slice(0,20);
        }
      }
      const payload = { ...form, uid, pendente:uid?.startsWith("pending_")||false, updatedAt:new Date().toISOString(), createdAt:func?.createdAt||new Date().toISOString() };
      if (isNovo) {
        await setDoc(doc(db,"usuarios",uid), payload);
        await addDoc(collection(db,"audit_log"), { colecao:"usuarios", docId:uid, acao:"create", payload, userUid:authUser?.uid, userName:authProfile?.nome, timestamp:new Date().toISOString() });
      } else {
        await updateComAuditoria("usuarios", uid, payload, authUser?.uid, authProfile?.nome);
      }
      addToast(isNovo?"Funcionário cadastrado!":"Funcionário atualizado!");
      onClose();
    } catch(err) { addToast("Erro: "+(err.message||err.code||"Tente novamente"),"error"); }
    setSaving(false);
  }

  return (
    <Modal title={isNovo?"Novo funcionário":"Editar funcionário"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* DADOS PESSOAIS */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Dados pessoais</div>
        <div className="form-grid">
          <div className="form-group"><label className="required">Nome completo</label><input value={form.nome} onChange={e=>set("nome",e.target.value)}/></div>
          <div className="form-group"><label className="required">Função / Cargo</label><input value={form.funcao} onChange={e=>set("funcao",e.target.value)} placeholder="Ex: Técnico de Manutenção"/></div>
          <div className="form-group"><label>Empresa</label><input value={form.empresa} onChange={e=>set("empresa",e.target.value)}/></div>
          <div className="form-group"><label>Telefone / WhatsApp</label><input value={form.tel} onChange={e=>set("tel",e.target.value)} placeholder="(11) 9xxxx-xxxx"/></div>
          <div className="form-group"><label>CPF / RG</label><input value={form.cpf} onChange={e=>set("cpf",e.target.value)}/></div>
          <div className="form-group"><label>Cartão corporativo</label><input value={form.cartaoCorporativo} onChange={e=>set("cartaoCorporativo",e.target.value)} placeholder="Ex: Final 4827 (PagBank)"/></div>
          {(form.departamento==="empreiteiro"||form.departamento==="terceiro") && (<>
            <div className="form-group span-2"><label>Empresa / Razão social</label><input value={form.empresa} onChange={e=>set("empresa",e.target.value)} placeholder="Ex: Elétrica Silva LTDA"/></div>
            <div className="form-group"><label>CNPJ / CPF da empresa</label><input value={form.cnpj} onChange={e=>set("cnpj",e.target.value)} placeholder="00.000.000/0001-00"/></div>
          </>)}
          <div className="form-group"><label>Data de entrada</label><input type="date" value={form.entrada} onChange={e=>set("entrada",e.target.value)}/></div>
        </div>

        {/* REMUNERAÇÃO — visível apenas para ADM e Financeiro */}
        {podeVerSalario && (<>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",display:"flex",alignItems:"center",gap:6}}>
            🔒 Remuneração
            <span style={{fontSize:10,fontWeight:400,color:"#9CA3AF",textTransform:"none"}}>— visível apenas para ADM e Financeiro</span>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Salário / Remuneração (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.salario}
                onChange={e=>set("salario",e.target.value)}
                placeholder="Ex: 3500.00"
              />
            </div>
            <div className="form-group">
              <label>Tipo de contrato</label>
              <select value={form.tipoContrato} onChange={e=>set("tipoContrato",e.target.value)}>
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
                <option value="Estágio">Estágio</option>
                <option value="Autônomo">Autônomo</option>
                <option value="Empreitada">Empreitada</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>
        </>)}

        {/* DEPARTAMENTO E PERMISSÕES */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Departamento e permissões</div>

        {/* Seleção visual de departamento */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
          {DEPARTAMENTOS.map(dep=>(
            <button key={dep.id} type="button" onClick={()=>{set("departamento",dep.id);if(dep.id!=="gestao")set("podeAprovar",false);if(dep.id==="adm")set("adm",true);else set("adm",false);}}
              style={{
                padding:"10px 8px",borderRadius:8,border:`2px solid ${form.departamento===dep.id?dep.cor:"var(--border)"}`,
                background:form.departamento===dep.id?dep.cor:"transparent",
                color:form.departamento===dep.id?"#fff":"#4A4A4A",
                cursor:"pointer",transition:"all .15s",textAlign:"center",
              }}>
              <div style={{fontSize:18,marginBottom:4}}>{dep.icone}</div>
              <div style={{fontSize:11,fontWeight:600,lineHeight:1.2}}>{dep.label}</div>
            </button>
          ))}
        </div>

        {/* Resumo do acesso do departamento */}
        {form.departamento && (
          <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12,display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:20}}>{depInfo?.icone}</span>
            <div>
              <div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{depInfo?.label}</div>
              <div style={{fontSize:12,color:"#4A4A4A",lineHeight:1.5}}>{RESUMO_ACESSO[form.departamento]}</div>
            </div>
          </div>
        )}

        {/* Opções extras para Gestão */}
        {(form.departamento==="gestao"||form.departamento==="adm") && (
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--afine-yellow-lt)",borderRadius:8,cursor:"pointer"}}>
              <input type="checkbox" checked={form.podeAprovar} onChange={e=>set("podeAprovar",e.target.checked)} style={{width:17,height:17}}/>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>✅ Pode aprovar compras</div>
                <div style={{fontSize:11,color:"#8A6000"}}>Permissão para mover compras para etapa "APROVADA"</div>
              </div>
            </label>
            {form.departamento==="adm" && (
              <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--vermelho-lt)",borderRadius:8,cursor:"pointer"}}>
                <input type="checkbox" checked={form.adm} onChange={e=>set("adm",e.target.checked)} style={{width:17,height:17}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--vermelho)"}}>🔐 Acesso ADM (Master)</div>
                  <div style={{fontSize:11,color:"var(--vermelho)"}}>Acesso irrestrito a todo o sistema</div>
                </div>
              </label>
            )}
          </div>
        )}

        <div className="form-grid">
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {["ATIVO","AFASTADO","DESLIGADO","FÉRIAS"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* ACESSO */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Login e acesso</div>
        <div className="form-group">
          <label className="required">E-mail (usado para login)</label>
          <input type="email" value={form.email} onChange={e=>set("email",e.target.value)} disabled={!isNovo} style={{opacity:!isNovo?.6:1}}/>
          {!isNovo&&<span style={{fontSize:11,color:"#7A7A7A"}}>E-mail não pode ser alterado após criação</span>}
        </div>

        {isNovo && (
          <>
            <div style={{display:"flex",gap:8}}>
              <button type="button" onClick={()=>setModoSenha("criar")} className="btn"
                style={{flex:1,justifyContent:"center",background:modoSenha==="criar"?"#1A1A1A":"",color:modoSenha==="criar"?"#F5C800":"",borderColor:modoSenha==="criar"?"#1A1A1A":""}}>
                🔑 Definir senha agora
              </button>
              <button type="button" onClick={()=>setModoSenha("link")} className="btn"
                style={{flex:1,justifyContent:"center",background:modoSenha==="link"?"#1A1A1A":"",color:modoSenha==="link"?"#F5C800":"",borderColor:modoSenha==="link"?"#1A1A1A":""}}>
                📧 Enviar link por e-mail
              </button>
            </div>
            {modoSenha==="criar"
              ? <div className="form-group"><label className="required">Senha inicial</label><input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Mínimo 6 caracteres"/></div>
              : <div className="alert alert-info" style={{fontSize:12}}>📧 Link de criação de senha será enviado para <strong>{form.email||"o e-mail informado"}</strong>.</div>
            }
          </>
        )}

        {/* Obras com acesso — não se aplica para ADM/Gestão */}
        {!["adm","gestao"].includes(form.departamento) && (
          <>
            <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Obras com acesso</div>
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:160,overflowY:"auto"}}>
              {obras.length===0&&<span style={{fontSize:12,color:"#7A7A7A"}}>Nenhuma obra cadastrada</span>}
              {obras.map(o=>(
                <label key={o.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,background:form.obras.includes(o.id)?"var(--afine-yellow-lt)":"transparent"}}>
                  <input type="checkbox" checked={form.obras.includes(o.id)} onChange={()=>toggleObra(o.id)} style={{width:15,height:15}}/>
                  <span style={{flex:1}}>{o.nome}</span>
                  <span style={{fontSize:11,color:"#7A7A7A"}}>{o.cliente}</span>
                </label>
              ))}
            </div>
          </>
        )}
        {["adm","gestao"].includes(form.departamento) && (
          <div style={{fontSize:12,color:"#7A7A7A",background:"var(--cinza-lt)",padding:"8px 12px",borderRadius:8}}>
            🏗️ {depInfo?.label} têm acesso a todas as obras automaticamente.
          </div>
        )}
        {form.departamento === "fiscal" && (
          <div style={{fontSize:12,color:"#7A7A7A",background:"var(--cinza-lt)",padding:"8px 12px",borderRadius:8}}>
            🔧 Fiscal têm acesso a todas as manutenções automaticamente.
          </div>
        )}

        <div className="alert alert-info" style={{fontSize:12}}>
          💡 Link: <strong>afine-obras.vercel.app</strong> — envie por WhatsApp com e-mail e senha.
        </div>
      </div>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Funcionarios() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [funcs,        setFuncs]        = useState([]);
  const [obras,        setObras]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filtroDep,    setFiltroDep]    = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("ATIVO");
  const [modal,        setModal]        = useState(null);
  const [modalSenha,   setModalSenha]   = useState(null);
  const [modalExcluir, setModalExcluir] = useState(null);

  const isGestor = isGestorOuAdm(userProfile);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"usuarios"),snap=>{setFuncs(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false);});
    const u2=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();};
  },[]);

  const filtered = funcs.filter(f=>{
    const q=search.toLowerCase();
    const mQ=!q||f.nome?.toLowerCase().includes(q)||f.funcao?.toLowerCase().includes(q)||f.email?.toLowerCase().includes(q)||f.departamento?.toLowerCase().includes(q);
    const mD=filtroDep==="todos"||f.departamento===filtroDep;
    const mS=filtroStatus==="todos"||f.status===filtroStatus;
    return mQ&&mD&&mS;
  });

  const DEP_COR = Object.fromEntries(DEPARTAMENTOS.map(d=>[d.id,d.cor]));
  const DEP_ICONE = Object.fromEntries(DEPARTAMENTOS.map(d=>[d.id,d.icone]));
  const DEP_LABEL = Object.fromEntries(DEPARTAMENTOS.map(d=>[d.id,d.label]));

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

      {/* Filtro por departamento */}
      <div className="chip-row" style={{marginBottom:8}}>
        <button className={`chip ${filtroDep==="todos"?"active":""}`} onClick={()=>setFiltroDep("todos")}>
          Todos ({funcs.length})
        </button>
        {DEPARTAMENTOS.map(dep=>{
          const count = funcs.filter(f=>f.departamento===dep.id).length;
          if(count===0) return null;
          return (
            <button key={dep.id} className={`chip ${filtroDep===dep.id?"active":""}`} onClick={()=>setFiltroDep(dep.id)}
              style={{background:filtroDep===dep.id?dep.cor:"",borderColor:filtroDep===dep.id?dep.cor:"",color:filtroDep===dep.id?"#fff":""}}>
              {dep.icone} {dep.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filtro por status */}
      <div className="chip-row">
        {["ATIVO","AFASTADO","DESLIGADO","FÉRIAS","todos"].map(s=>(
          <button key={s} className={`chip ${filtroStatus===s?"active":""}`} onClick={()=>setFiltroStatus(s)}>
            {s==="todos"?"Todos os status":s} ({s==="todos"?funcs.length:funcs.filter(f=>f.status===s).length})
          </button>
        ))}
      </div>

      <div className="search-bar">🔍<input placeholder="Buscar por nome, função, e-mail ou departamento..." value={search} onChange={e=>setSearch(e.target.value)}/></div>

      {loading&&<div className="spinner"/>}
      {!loading&&filtered.length===0&&<div className="empty-state"><div className="empty-icon">👷</div><p>Nenhum funcionário encontrado</p></div>}

      {!loading&&filtered.length>0&&(
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th><th>Nome</th><th>Função</th><th>Departamento</th><th>E-mail</th><th>Obras</th><th>Status</th>
                {isGestor&&<th style={{textAlign:"center"}}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f=>{
                const depCor   = DEP_COR[f.departamento]   || "#4A4A4A";
                const depIcone = DEP_ICONE[f.departamento] || "👤";
                const depLabel = DEP_LABEL[f.departamento] || f.departamento || f.perfil || "–";
                return (
                  <tr key={f.id}>
                    <td>
                      <div className="user-avatar" style={{width:32,height:32,fontSize:11,background:depCor}}>
                        {initials(f.nome)}
                      </div>
                    </td>
                    <td>
                      <div style={{fontWeight:600}}>{f.nome}</div>
                      {f.pendente&&<span className="badge badge-amber" style={{fontSize:9}}>Aguard. 1º acesso</span>}
                      {f.adm&&<span className="badge badge-red" style={{fontSize:9,marginLeft:4}}>🔐 ADM</span>}
                    </td>
                    <td style={{fontSize:12}}>{f.funcao}</td>
                    <td>
                      <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,fontWeight:600,
                        background:depCor+"20",color:depCor,padding:"3px 9px",borderRadius:20,border:`1px solid ${depCor}30`}}>
                        {depIcone} {depLabel}
                      </span>
                      {f.podeAprovar&&<div style={{fontSize:9,color:"var(--verde)",marginTop:3,fontWeight:600}}>✅ Aprova compras</div>}
                    </td>
                    <td style={{fontSize:11,color:"#7A7A7A"}}>{f.email}</td>
                    <td style={{fontSize:11}}>
                      {["adm","gestao"].includes(f.departamento)?"Todas":(f.obras?.length||0)+" obras"}
                    </td>
                    <td><span className={`badge ${statusBadge(f.status)}`}>{f.status}</span></td>
                    {isGestor&&(
                      <td>
                        <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                          <button className="btn btn-sm btn-icon" title="Editar" onClick={()=>setModal({func:f})}>✏️</button>
                          <button className="btn btn-sm btn-icon" title="Alterar senha"
                            onClick={()=>setModalSenha(f)}
                            style={{background:"var(--afine-yellow-lt)",borderColor:"var(--afine-yellow-dk)"}}>
                            🔑
                          </button>
                          <button className="btn btn-sm btn-icon" title="Excluir acesso"
                            onClick={()=>setModalExcluir(f)}
                            style={{background:"var(--vermelho-lt)",borderColor:"rgba(184,50,50,.3)",color:"var(--vermelho)"}}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal        &&<FuncionarioModal  func={modal.func}  obras={obras} onClose={()=>setModal(null)}        addToast={addToast}/>}
      {modalSenha   &&<AlterarSenhaModal func={modalSenha}               onClose={()=>setModalSenha(null)}   addToast={addToast}/>}
      {modalExcluir &&<ExcluirModal      func={modalExcluir}              onClose={()=>setModalExcluir(null)} addToast={addToast}/>}
    </div>
  );
}
