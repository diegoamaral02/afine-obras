// src/pages/Equipe.js — Visão do fiscal + Ocorrências integradas
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import { useAgenda } from "../contexts/AgendaContext";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import { useToast } from "../hooks/useToast";

// ─── EQUIPE ──────────────────────────────────────────────────────────────────
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
      if (membro?.id) { await updateDoc(doc(db,"equipe",membro.id),payload); addToast("Atualizado!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"equipe"),payload); addToast("Adicionado!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }
  return (
    <Modal title={membro?.id?"Editar colaborador":"Adicionar colaborador"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="form-grid">
          <div className="form-group"><label className="required">Nome completo</label><input value={form.nome} onChange={e=>set("nome",e.target.value)}/></div>
          <div className="form-group"><label className="required">Função</label><input value={form.funcao} onChange={e=>set("funcao",e.target.value)}/></div>
          <div className="form-group"><label>Empresa</label><input value={form.empresa} onChange={e=>set("empresa",e.target.value)}/></div>
          <div className="form-group"><label>Telefone</label><input value={form.tel} onChange={e=>set("tel",e.target.value)}/></div>
          <div className="form-group"><label>CPF / RG</label><input value={form.cpf} onChange={e=>set("cpf",e.target.value)}/></div>
          <div className="form-group"><label>Entrada</label><input type="date" value={form.entrada} onChange={e=>set("entrada",e.target.value)}/></div>
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

// ─── EQUIPE DO DIA (Visão Fiscal) ────────────────────────────────────────────
function EquipeDoDia({ obraAtual }) {
  const { agendamentosDodia, obras, manutencoes, funcionarios } = useAgenda();
  const hoje = new Date().toISOString().split("T")[0];
  const agsHoje = agendamentosDodia(hoje).filter(a =>
    !obraAtual || a.demandaId === obraAtual
  );
  const funcIdsHoje = [...new Set(agsHoje.flatMap(a=>a.funcionarios||[]))];
  const funcsHoje = funcionarios.filter(f=>
    funcIdsHoje.includes(f.id)||funcIdsHoje.includes(f.uid)
  );

  const dataFmt = new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});

  return (
    <div>
      <div style={{background:"#1A1A1A",borderRadius:10,padding:14,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.45)",marginBottom:2}}>EQUIPE ATIVA HOJE</div>
          <div style={{fontSize:15,fontWeight:700,color:"#F5C800"}}>{dataFmt}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:28,fontWeight:700,color:"#F5C800"}}>{funcsHoje.length}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.45)"}}>no campo</div>
        </div>
      </div>

      {agsHoje.length === 0 && (
        <div className="empty-state"><div className="empty-icon">📅</div><p>Nenhuma equipe agendada para hoje</p></div>
      )}

      {agsHoje.map(ag=>{
        const demanda = [...obras,...manutencoes].find(d=>d.id===ag.demandaId);
        const funcsAg = funcionarios.filter(f=>
          (ag.funcionarios||[]).includes(f.id)||(ag.funcionarios||[]).includes(f.uid)
        );
        return (
          <div key={ag.id} className="rdo-card" style={{borderLeft:"4px solid #F5C800",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{ag.demandaNome}</div>
                <div style={{fontSize:12,color:"#7A7A7A"}}>
                  {ag.demandaTipo==="obra"?"🏗️ Obra":"🔧 Manutenção"} · {ag.turno}
                </div>
                {demanda?.endereco&&<div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>📍 {demanda.endereco}</div>}
                {demanda?.logradouro&&(
                  <button onClick={()=>{
                    const enc=encodeURIComponent(`${demanda.logradouro}, ${demanda.numero}, ${demanda.cidade}`);
                    window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
                  }} style={{background:"none",border:"none",color:"var(--afine-yellow-dk)",fontSize:11,cursor:"pointer",padding:0,marginTop:2}}>
                    🗺️ Abrir no mapa
                  </button>
                )}
              </div>
              <span className="badge badge-green" style={{fontSize:10}}>ATIVA HOJE</span>
            </div>

            {/* Funcionários alocados */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {funcsAg.map(f=>(
                <div key={f.id} style={{display:"flex",alignItems:"center",gap:6,background:"var(--cinza-lt)",borderRadius:20,padding:"4px 10px"}}>
                  <div className="user-avatar" style={{width:24,height:24,fontSize:9,flexShrink:0}}>{initials(f.nome)}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:500}}>{f.nome}</div>
                    <div style={{fontSize:10,color:"#7A7A7A"}}>{f.funcao}</div>
                  </div>
                  {f.tel&&(
                    <a href={`https://wa.me/55${f.tel.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                      style={{fontSize:14,textDecoration:"none",marginLeft:4}} title="WhatsApp">💬</a>
                  )}
                </div>
              ))}
              {funcsAg.length===0&&<span style={{fontSize:12,color:"#7A7A7A"}}>Nenhum funcionário alocado</span>}
            </div>

            {ag.obs&&<div style={{fontSize:12,color:"#7A7A7A",marginTop:8,fontStyle:"italic"}}>{ag.obs}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── OCORRÊNCIAS com fotos + vínculo a funcionário ───────────────────────────
function OcorrModal({ ocorr, obraAtual, onClose, addToast }) {
  const { currentUser, userProfile } = useAuth();
  const { equipeHoje, funcionarios } = useAgenda();
  const equipeAtiva = equipeHoje(obraAtual);

  const [form, setForm] = useState({
    data: ocorr?.data||new Date().toISOString().split("T")[0],
    tipo: ocorr?.tipo||"NÃO-CONFORMIDADE",
    descricao: ocorr?.descricao||"",
    acao: ocorr?.acao||"",
    responsavel: ocorr?.responsavel||"",
    funcId: ocorr?.funcId||"",
    prazo: ocorr?.prazo||"",
    status: ocorr?.status||"ABERTA",
  });
  const [fotos, setFotos] = useState(ocorr?.fotos||[]);
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  function handleFunc(id) {
    const f = funcionarios.find(x=>x.id===id||x.uid===id);
    set("funcId",id);
    set("responsavel",f?.nome||"");
  }

  async function save() {
    if (!form.descricao) { alert("Informe a descrição."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = { ...form, fotos, obraId: obraAtual, autorNome: userProfile?.nome||currentUser?.email, updatedAt: agora };
    try {
      if (ocorr?.id) { await updateDoc(doc(db,"ocorrencias",ocorr.id),payload); addToast("Atualizada!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"ocorrencias"),payload); addToast("Registrada!"); }
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
        <div className="form-group"><label className="required">Descrição</label>
          <textarea value={form.descricao} onChange={e=>set("descricao",e.target.value)} rows={3}/>
        </div>
        <div className="form-group"><label>Ação corretiva</label>
          <textarea value={form.acao} onChange={e=>set("acao",e.target.value)} rows={2}/>
        </div>

        {/* Vincular a funcionário da equipe ativa */}
        <div className="form-group">
          <label>Vincular a funcionário da equipe de hoje</label>
          <select value={form.funcId} onChange={e=>handleFunc(e.target.value)}>
            <option value="">Selecione ou deixe em branco</option>
            {equipeAtiva.map(f=><option key={f.id} value={f.id}>{f.nome} — {f.funcao}</option>)}
            {equipeAtiva.length===0&&<option disabled>Nenhuma equipe ativa hoje</option>}
          </select>
        </div>

        <div className="form-grid">
          <div className="form-group"><label>Responsável</label>
            <input value={form.responsavel} onChange={e=>set("responsavel",e.target.value)}/>
          </div>
          <div className="form-group"><label>Prazo</label>
            <input type="date" value={form.prazo} onChange={e=>set("prazo",e.target.value)}/>
          </div>
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

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
export function Equipe({ obraAtual }) {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [equipe,  setEquipe]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [aba,     setAba]     = useState("hoje");
  const [modal,   setModal]   = useState(null);
  const canEdit = userProfile?.perfil==="gestor"||userProfile?.perfil==="encarregado";

  useEffect(()=>{
    if (!obraAtual) return;
    const q = query(collection(db,"equipe"),where("obraId","==",obraAtual));
    return onSnapshot(q,snap=>{setEquipe(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
  },[obraAtual]);

  const filtered = equipe.filter(m=>!search||m.nome?.toLowerCase().includes(search.toLowerCase())||m.funcao?.toLowerCase().includes(search.toLowerCase()));

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra no menu.</div>;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div className="panel-title">Equipe</div>
        {canEdit&&<button className="btn btn-primary" onClick={()=>setModal({membro:null})}>+ Adicionar</button>}
      </div>
      <div className="tabs">
        <button className={`tab ${aba==="hoje"?"active":""}`} onClick={()=>setAba("hoje")}>📅 Equipe do dia</button>
        <button className={`tab ${aba==="lista"?"active":""}`} onClick={()=>setAba("lista")}>👷 Lista completa</button>
      </div>

      {aba==="hoje" && <EquipeDoDia obraAtual={obraAtual}/>}

      {aba==="lista" && (
        <>
          <div className="search-bar">🔍<input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {loading&&<div className="spinner"/>}
          {!loading&&filtered.length===0&&<div className="empty-state"><div className="empty-icon">👷</div><p>Nenhum colaborador</p></div>}
          {!loading&&filtered.length>0&&(
            <div className="table-wrap">
              <table>
                <thead><tr><th></th><th>Nome</th><th>Função</th><th>Empresa</th><th>Tel</th><th>Entrada</th><th>Status</th>{canEdit&&<th></th>}</tr></thead>
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
        </>
      )}
      {modal&&<EquipeModal membro={modal.membro} obraId={obraAtual} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}

export function Ocorrencias({ obraAtual }) {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [ocorr,   setOcorr]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro,  setFiltro]  = useState("todas");
  const [modal,   setModal]   = useState(null);

  const perfil = userProfile?.perfil||"campo";
  const canCreate = perfil==="gestor"||perfil==="encarregado";

  useEffect(()=>{
    if (!obraAtual) return;
    const q = query(collection(db,"ocorrencias"),where("obraId","==",obraAtual));
    return onSnapshot(q,snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setOcorr(data); setLoading(false);
    });
  },[obraAtual]);

  const filtered=ocorr.filter(o=>filtro==="todas"||o.status===filtro);

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra.</div>;
  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div className="panel-title">Ocorrências / RNC</div>
        {canCreate&&<button className="btn btn-primary" onClick={()=>setModal({ocorr:null})}>+ Registrar</button>}
      </div>
      <div className="tabs">
        {[["todas","Todas"],["ABERTA","Abertas"],["EM TRATAMENTO","Em tratamento"],["CONCLUÍDA","Concluídas"]].map(([v,l])=>(
          <button key={v} className={`tab ${filtro===v?"active":""}`} onClick={()=>setFiltro(v)}>
            {l} ({v==="todas"?ocorr.length:ocorr.filter(o=>o.status===v).length})
          </button>
        ))}
      </div>
      {loading&&<div className="spinner"/>}
      {!loading&&filtered.length===0&&<div className="empty-state"><div className="empty-icon">✅</div><p>Nenhuma ocorrência</p></div>}
      {!loading&&filtered.map(o=>(
        <div key={o.id} className="rdo-card" style={{borderLeft:`3px solid ${o.status==="ABERTA"?"var(--vermelho)":o.status==="CONCLUÍDA"?"var(--verde)":"var(--afine-yellow-dk)"}`}}>
          <div className="rdo-header">
            <div>
              <span className="badge badge-amber" style={{fontSize:10,marginBottom:4,display:"inline-block"}}>{o.tipo}</span>
              <div style={{fontWeight:600,fontSize:13}}>{o.descricao?.slice(0,80)}{o.descricao?.length>80?"...":""}</div>
              <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>
                Resp: {o.responsavel||"–"} · Prazo: {fmtDate(o.prazo)} · {o.autorNome}
                {o.funcId&&<span style={{marginLeft:6,color:"var(--afine-yellow-dk)"}}>· vinculado a funcionário</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
              <button className="btn btn-sm btn-icon" onClick={()=>setModal({ocorr:o})}>✏️</button>
            </div>
          </div>
          {o.acao&&<div style={{fontSize:12,color:"#4A4A4A",marginTop:4}}>✅ Ação: {o.acao}</div>}
          {o.fotos?.length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
              {o.fotos.slice(0,4).map((f,i)=><img key={i} src={f.base64} alt="" style={{width:56,height:56,objectFit:"cover",borderRadius:4,border:"1px solid var(--border)"}}/>)}
              {o.fotos.length>4&&<div style={{width:56,height:56,borderRadius:4,background:"var(--cinza-lt)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>+{o.fotos.length-4}</div>}
            </div>
          )}
        </div>
      ))}
      {modal&&<OcorrModal ocorr={modal.ocorr} obraAtual={obraAtual} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
