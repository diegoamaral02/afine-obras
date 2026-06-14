// src/pages/Equipe.js — Equipe, Materiais (legacy), Ocorrências com fotos
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import { useToast } from "../hooks/useToast";

// ─── EQUIPE ─────────────────────────────────────────────────────────────────
function EquipeModal({ membro, obraId, onClose, addToast }) {
  const [form, setForm] = useState({
    nome: membro?.nome||"", funcao: membro?.funcao||"", empresa: membro?.empresa||"",
    tel: membro?.tel||"", cpf: membro?.cpf||"",
    entrada: membro?.entrada||new Date().toISOString().split("T")[0],
    status: membro?.status||"ATIVO",
  });
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  async function save() {
    if (!form.nome) { alert("Informe o nome."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = { ...form, obraId, updatedAt: agora };
    try {
      if (membro?.id) { await updateDoc(doc(db,"equipe",membro.id),payload); addToast("Colaborador atualizado!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"equipe"),payload); addToast("Colaborador adicionado!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title={membro?.id?"Editar colaborador":"Adicionar colaborador"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div className="form-grid" style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="form-grid">
          <div className="form-group"><label className="required">Nome completo</label><input value={form.nome} onChange={e=>set("nome",e.target.value)}/></div>
          <div className="form-group"><label className="required">Função / Cargo</label><input value={form.funcao} onChange={e=>set("funcao",e.target.value)} placeholder="Ex: Eletricista"/></div>
          <div className="form-group"><label>Empresa / Subempreiteiro</label><input value={form.empresa} onChange={e=>set("empresa",e.target.value)}/></div>
          <div className="form-group"><label>Telefone</label><input value={form.tel} onChange={e=>set("tel",e.target.value)} placeholder="(11) 9xxxx-xxxx"/></div>
          <div className="form-group"><label>CPF / RG</label><input value={form.cpf} onChange={e=>set("cpf",e.target.value)}/></div>
          <div className="form-group"><label>Data de entrada</label><input type="date" value={form.entrada} onChange={e=>set("entrada",e.target.value)}/></div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {["ATIVO","AFASTADO","DESLIGADO","FÉRIAS"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function Equipe({ obraAtual }) {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [equipe,  setEquipe]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [modal,   setModal]   = useState(null);
  const canEdit = userProfile?.perfil==="gestor"||userProfile?.perfil==="encarregado";

  useEffect(() => {
    if (!obraAtual) return;
    const q = query(collection(db,"equipe"),where("obraId","==",obraAtual));
    return onSnapshot(q, snap=>{setEquipe(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false);});
  },[obraAtual]);

  const filtered = equipe.filter(m=>!search||m.nome?.toLowerCase().includes(search.toLowerCase())||m.funcao?.toLowerCase().includes(search.toLowerCase()));

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra no menu.</div>;
  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div className="panel-title">Equipe alocada</div>
        {canEdit && <button className="btn btn-primary" onClick={()=>setModal({membro:null})}>+ Adicionar</button>}
      </div>
      <div className="search-bar">🔍<input placeholder="Buscar por nome ou função..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {loading && <div className="spinner"/>}
      {!loading && filtered.length===0 && <div className="empty-state"><div className="empty-icon">👷</div><p>Nenhum colaborador</p></div>}
      {!loading && filtered.length>0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th></th><th>Nome</th><th>Função</th><th>Empresa</th><th>Telefone</th><th>Entrada</th><th>Status</th>{canEdit&&<th></th>}</tr></thead>
            <tbody>
              {filtered.map(m=>(
                <tr key={m.id}>
                  <td><div className="user-avatar" style={{width:32,height:32,fontSize:11}}>{initials(m.nome)}</div></td>
                  <td><strong>{m.nome}</strong></td>
                  <td style={{fontSize:12}}>{m.funcao}</td>
                  <td style={{fontSize:12,color:"var(--afine-yellow-dk)"}}>{m.empresa||"–"}</td>
                  <td style={{fontSize:12}}>{m.tel||"–"}</td>
                  <td style={{fontSize:12}}>{fmtDate(m.entrada)}</td>
                  <td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></td>
                  {canEdit&&<td><button className="btn btn-sm btn-icon" onClick={()=>setModal({membro:m})}>✏️</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <EquipeModal membro={modal.membro} obraId={obraAtual} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

// ─── OCORRÊNCIAS com fotos + PDF ─────────────────────────────────────────────
function OcorrModal({ ocorr, obraAtual, onClose, addToast }) {
  const { currentUser, userProfile } = useAuth();
  const [form, setForm] = useState({
    data: ocorr?.data||new Date().toISOString().split("T")[0],
    tipo: ocorr?.tipo||"NÃO-CONFORMIDADE",
    descricao: ocorr?.descricao||"",
    acao: ocorr?.acao||"",
    responsavel: ocorr?.responsavel||"",
    prazo: ocorr?.prazo||"",
    status: ocorr?.status||"ABERTA",
  });
  const [fotos,  setFotos]  = useState(ocorr?.fotos||[]);
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  async function save() {
    if (!form.descricao) { alert("Informe a descrição."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = { ...form, fotos, obraId: obraAtual, updatedAt: agora,
      autorNome: userProfile?.nome||currentUser?.email };
    try {
      if (ocorr?.id) { await updateDoc(doc(db,"ocorrencias",ocorr.id),payload); addToast("Ocorrência atualizada!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"ocorrencias"),payload); addToast("Ocorrência registrada!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title={ocorr?.id?"Editar ocorrência":"Registrar ocorrência / RNC"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Registrar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="form-grid">
          <div className="form-group"><label>Data</label><input type="date" value={form.data} onChange={e=>set("data",e.target.value)}/></div>
          <div className="form-group"><label>Tipo</label>
            <select value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
              {["NÃO-CONFORMIDADE","ACIDENTE","PARALISAÇÃO","ATRASO","FALTA DE MATERIAL","OUTRO"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label className="required">Descrição</label><textarea value={form.descricao} onChange={e=>set("descricao",e.target.value)} rows={3}/></div>
        <div className="form-group"><label>Ação corretiva</label><textarea value={form.acao} onChange={e=>set("acao",e.target.value)} rows={2}/></div>
        <div className="form-grid">
          <div className="form-group"><label>Responsável</label><input value={form.responsavel} onChange={e=>set("responsavel",e.target.value)}/></div>
          <div className="form-group"><label>Prazo</label><input type="date" value={form.prazo} onChange={e=>set("prazo",e.target.value)}/></div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {["ABERTA","EM TRATAMENTO","CONCLUÍDA","CANCELADA"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="divider"/>
        <PhotoUploader fotos={fotos} onChange={setFotos} minFotos={0}/>
      </div>
    </Modal>
  );
}

export function Ocorrencias({ obraAtual }) {
  const { userProfile, currentUser } = useAuth();
  const { toasts, addToast } = useToast();
  const [ocorr,   setOcorr]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro,  setFiltro]  = useState("todas");
  const [modal,   setModal]   = useState(null);

  const perfil = userProfile?.perfil||"campo";
  const canCreate = perfil==="gestor"||perfil==="encarregado"||
    (obraAtual && userProfile?.obras?.includes(obraAtual));

  useEffect(() => {
    if (!obraAtual) return;
    const q = query(collection(db,"ocorrencias"),where("obraId","==",obraAtual));
    return onSnapshot(q, snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setOcorr(data); setLoading(false);
    });
  },[obraAtual]);

  const filtered = ocorr.filter(o=>filtro==="todas"||o.status===filtro);

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra.</div>;
  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div className="panel-title">Ocorrências / RNC</div>
        {canCreate && <button className="btn btn-primary" onClick={()=>setModal({ocorr:null})}>+ Registrar</button>}
      </div>
      <div className="tabs">
        {[["todas","Todas"],["ABERTA","Abertas"],["EM TRATAMENTO","Em tratamento"],["CONCLUÍDA","Concluídas"]].map(([v,l])=>(
          <button key={v} className={`tab ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)}>
            {l} ({v==="todas"?ocorr.length:ocorr.filter(o=>o.status===v).length})
          </button>
        ))}
      </div>
      {loading && <div className="spinner"/>}
      {!loading && filtered.length===0 && <div className="empty-state"><div className="empty-icon">✅</div><p>Nenhuma ocorrência</p></div>}
      {!loading && filtered.length>0 && (
        <div>
          {filtered.map(o=>(
            <div key={o.id} className="rdo-card" style={{borderLeft:`3px solid ${o.status==="ABERTA"?"var(--vermelho)":o.status==="CONCLUÍDA"?"var(--verde)":"var(--afine-yellow-dk)"}`}}>
              <div className="rdo-header">
                <div>
                  <span className="badge badge-amber" style={{fontSize:10,marginBottom:4,display:"inline-block"}}>{o.tipo}</span>
                  <div style={{fontSize:13,fontWeight:600}}>{o.descricao?.slice(0,80)}{o.descricao?.length>80?"...":""}</div>
                  <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>Resp: {o.responsavel||"–"} · Prazo: {fmtDate(o.prazo)} · {o.autorNome}</div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
                  <button className="btn btn-sm btn-icon" onClick={()=>setModal({ocorr:o})}>✏️</button>
                </div>
              </div>
              {o.acao && <div style={{fontSize:12,color:"#4A4A4A",marginTop:4}}>✅ Ação: {o.acao}</div>}
              {o.fotos?.length>0 && (
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                  {o.fotos.slice(0,4).map((f,i)=><img key={i} src={f.base64} alt="" style={{width:56,height:56,objectFit:"cover",borderRadius:4,border:"1px solid var(--border)"}}/>)}
                  {o.fotos.length>4&&<div style={{width:56,height:56,borderRadius:4,background:"var(--cinza-lt)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>+{o.fotos.length-4}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {modal && <OcorrModal ocorr={modal.ocorr} obraAtual={obraAtual} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
