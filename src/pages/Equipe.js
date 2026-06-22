// src/pages/Equipe.js — v2: alocação cruzada (obras + manutenções) com reatribuição direta
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import { useAgenda } from "../contexts/AgendaContext";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import { useToast } from "../hooks/useToast";
import { DEPARTAMENTOS } from "../constants/departamentos";

// ── Modal: editar dados do colaborador (perfil básico) ────────────────────────
function ColaboradorInfoModal({ colaborador, onClose }) {
  if (!colaborador) return null;
  const dep = DEPARTAMENTOS.find(d=>d.id===colaborador.departamento);
  return (
    <Modal title={colaborador.nome} onClose={onClose} footer={<button className="btn" onClick={onClose}>Fechar</button>}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div className="user-avatar" style={{width:48,height:48,fontSize:16,background:dep?.cor||"#4A4A4A"}}>{initials(colaborador.nome)}</div>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>{colaborador.nome}</div>
            <div style={{fontSize:12,color:"#7A7A7A"}}>{colaborador.funcao}</div>
            {dep&&<span style={{fontSize:11,fontWeight:600,color:dep.cor,background:`${dep.cor}15`,padding:"2px 8px",borderRadius:10}}>{dep.icone} {dep.label}</span>}
          </div>
        </div>
        <div className="form-grid">
          <div><div style={{fontSize:10,color:"#7A7A7A"}}>Telefone</div><div style={{fontSize:13}}>{colaborador.tel||"–"}</div></div>
          <div><div style={{fontSize:10,color:"#7A7A7A"}}>E-mail</div><div style={{fontSize:13}}>{colaborador.email||"–"}</div></div>
          <div><div style={{fontSize:10,color:"#7A7A7A"}}>Empresa</div><div style={{fontSize:13}}>{colaborador.empresa||"AFINE"}</div></div>
          <div><div style={{fontSize:10,color:"#7A7A7A"}}>Status</div><span className={`badge ${statusBadge(colaborador.status)}`}>{colaborador.status||"ATIVO"}</span></div>
        </div>
        {colaborador.tel&&(
          <a href={`https://wa.me/55${colaborador.tel.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{textAlign:"center"}}>
            💬 Conversar no WhatsApp
          </a>
        )}
      </div>
    </Modal>
  );
}

// ── Modal: reatribuir colaborador de uma demanda para outra ──────────────────
function ReatribuirModal({ colaborador, demandasAbertas, onClose, addToast }) {
  const [demandaSelecionada, setDemandaSelecionada] = useState("");
  const [saving, setSaving] = useState(false);

  // Onde ele está alocado agora (manutenções cujo array alocadoIds contém o colaborador)
  const alocacoesAtuais = demandasAbertas.filter(d=>
    d.tipo==="manutencao" && (d.alocadoIds||[]).includes(colaborador.id)
  );

  function semColaborador(manut) {
    const ids   = (manut.alocadoIds||[]).filter(id=>id!==colaborador.id);
    const nomes = (manut.alocadoNomes||[]).filter(n=>n!==colaborador.nome);
    return { alocadoIds: ids, alocadoNomes: nomes };
  }
  function comColaborador(manut) {
    const ids   = [...new Set([...(manut.alocadoIds||[]), colaborador.id])];
    const nomes = [...new Set([...(manut.alocadoNomes||[]), colaborador.nome])];
    return { alocadoIds: ids, alocadoNomes: nomes };
  }

  async function reatribuir(manutOrigemId) {
    if(!demandaSelecionada){alert("Selecione a nova manutenção.");return;}
    setSaving(true);
    try {
      const origem = demandasAbertas.find(d=>d.id===manutOrigemId);
      const destino = demandasAbertas.find(d=>d.id===demandaSelecionada);
      await updateDoc(doc(db,"manutencoes",manutOrigemId),{
        ...semColaborador(origem), updatedAt:new Date().toISOString()
      });
      await updateDoc(doc(db,"manutencoes",demandaSelecionada),{
        ...comColaborador(destino), updatedAt:new Date().toISOString()
      });
      addToast(`✓ ${colaborador.nome} reatribuído para "${destino?.titulo}"`);
      onClose();
    } catch(err){addToast("Erro: "+err.message,"error");}
    setSaving(false);
  }

  async function alocarDireto() {
    if(!demandaSelecionada){alert("Selecione a manutenção.");return;}
    setSaving(true);
    try {
      const destino = demandasAbertas.find(d=>d.id===demandaSelecionada);
      await updateDoc(doc(db,"manutencoes",demandaSelecionada),{
        ...comColaborador(destino), updatedAt:new Date().toISOString()
      });
      addToast(`✓ ${colaborador.nome} alocado em "${destino?.titulo}"`);
      onClose();
    } catch(err){addToast("Erro: "+err.message,"error");}
    setSaving(false);
  }

  async function desalocar(manutId) {
    setSaving(true);
    try {
      const manut = demandasAbertas.find(d=>d.id===manutId);
      await updateDoc(doc(db,"manutencoes",manutId),{...semColaborador(manut),updatedAt:new Date().toISOString()});
      addToast("✓ Desalocado");
      onClose();
    } catch(err){addToast("Erro: "+err.message,"error");}
    setSaving(false);
  }

  const manutDisponiveis = demandasAbertas.filter(d=>d.tipo==="manutencao"&&!(d.alocadoIds||[]).includes(colaborador.id));

  return (
    <Modal title={`Realocar — ${colaborador.nome}`} onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fechar</button>}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* Onde está alocado agora */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>Alocações atuais (manutenções)</div>
          {alocacoesAtuais.length===0&&<div style={{fontSize:12,color:"#7A7A7A",padding:"8px 0"}}>Nenhuma manutenção alocada</div>}
          {alocacoesAtuais.map(m=>(
            <div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"var(--afine-yellow-lt)",borderRadius:8,marginBottom:6}}>
              <div>
                <div style={{fontWeight:600,fontSize:13}}>{m.titulo}</div>
                <div style={{fontSize:11,color:"#7A7A7A"}}>{m.cliente}{m.agencia&&` · ${m.agencia}`}</div>
                {m.alocadoNomes?.length>1&&<div style={{fontSize:10,color:"#8A6000",marginTop:2}}>Junto com: {m.alocadoNomes.filter(n=>n!==colaborador.nome).join(", ")}</div>}
              </div>
              <button className="btn btn-sm" onClick={()=>desalocar(m.id)} disabled={saving} style={{background:"var(--vermelho-lt)",borderColor:"rgba(184,50,50,.3)",color:"var(--vermelho)",fontSize:11}}>
                ✕ Desalocar
              </button>
            </div>
          ))}
        </div>

        {/* Realocar para outra demanda */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
            {alocacoesAtuais.length>0?"Mover para outra manutenção":"Alocar em uma manutenção"}
          </div>
          <select value={demandaSelecionada} onChange={e=>setDemandaSelecionada(e.target.value)}
            style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid var(--border)",fontSize:13,marginBottom:10}}>
            <option value="">Selecione a manutenção destino...</option>
            {manutDisponiveis.map(m=>(
              <option key={m.id} value={m.id}>{m.titulo} — {m.cliente}{m.alocadoNomes?.length>0?` (atual: ${m.alocadoNomes.join(", ")})`:""}</option>
            ))}
          </select>
          {alocacoesAtuais.length>0 ? (
            <button className="btn btn-primary" disabled={saving||!demandaSelecionada} onClick={()=>reatribuir(alocacoesAtuais[0].id)} style={{width:"100%"}}>
              {saving?"Movendo...":"🔄 Mover alocação"}
            </button>
          ) : (
            <button className="btn btn-primary" disabled={saving||!demandaSelecionada} onClick={alocarDireto} style={{width:"100%"}}>
              {saving?"Alocando...":"👷 Alocar nesta manutenção"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Card de colaborador com alocações ─────────────────────────────────────────
function ColaboradorCard({ colaborador, alocacoes, onVerInfo, onReatribuir, canEdit }) {
  const dep = DEPARTAMENTOS.find(d=>d.id===colaborador.departamento);
  const semAlocacao = alocacoes.length===0;

  return (
    <div className="rdo-card" style={{borderLeft:`4px solid ${dep?.cor||"#4A4A4A"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
        <div style={{display:"flex",gap:10,flex:1}}>
          <div className="user-avatar" style={{width:38,height:38,fontSize:13,flexShrink:0,background:dep?.cor||"#4A4A4A"}} onClick={onVerInfo} role="button">
            {initials(colaborador.nome)}
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontWeight:700,fontSize:14,cursor:"pointer"}} onClick={onVerInfo}>{colaborador.nome}</span>
              {dep&&<span style={{fontSize:10,fontWeight:600,color:dep.cor,background:`${dep.cor}15`,padding:"1px 7px",borderRadius:10}}>{dep.icone} {dep.label}</span>}
            </div>
            <div style={{fontSize:11,color:"#7A7A7A"}}>{colaborador.funcao}</div>

            {/* Alocações */}
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:5}}>
              {semAlocacao && (
                <span style={{fontSize:11,color:"#aaa",fontStyle:"italic"}}>Sem alocação ativa no momento</span>
              )}
              {alocacoes.map((a,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,background:"var(--cinza-lt)",borderRadius:6,padding:"4px 8px"}}>
                  <span style={{fontSize:13}}>{a.tipo==="obra"?"🏗️":"🔧"}</span>
                  <span style={{fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.titulo}</span>
                  {a.cliente&&<span style={{color:"#7A7A7A",fontSize:11}}>{a.cliente}</span>}
                  <span className={`badge ${statusBadge(a.status)}`} style={{fontSize:9}}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {canEdit&&(
          <button className="btn btn-sm" onClick={onReatribuir} style={{fontSize:11,whiteSpace:"nowrap",flexShrink:0}}>
            🔄 Realocar
          </button>
        )}
      </div>
    </div>
  );
}

// ── EXPORT: Equipe (página principal) ─────────────────────────────────────────
export function Equipe() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [funcionarios, setFuncionarios] = useState([]);
  const [obras,        setObras]        = useState([]);
  const [manutencoes,  setManutencoes]  = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [search,        setSearch]       = useState("");
  const [filtroDep,     setFiltroDep]    = useState("todos");
  const [filtroAlocacao,setFiltroAlocacao]=useState("todos"); // todos | alocados | livres
  const [modalInfo,     setModalInfo]    = useState(null);
  const [modalReatrib,  setModalReatrib] = useState(null);

  const canEdit = userProfile?.adm || ["gestao","adm"].includes(userProfile?.departamento) || userProfile?.perfil==="gestor";

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"usuarios"),snap=>{
      setFuncionarios(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="ATIVO"||!f.status));
      setLoading(false);
    });
    const u2=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"manutencoes"),snap=>setManutencoes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();};
  },[]);

  // Demandas abertas (para o modal de realocação) — só manutenções não concluídas
  const demandasAbertas = useMemo(()=>{
    const m = manutencoes
      .filter(x=>!["CONCLUÍDA","CANCELADA"].includes(x.status))
      .map(x=>({...x,tipo:"manutencao"}));
    return m;
  },[manutencoes]);

  // Cruzamento: para cada funcionário, onde ele está alocado
  // 1) Obras: colaborador.id está em obra.equipeIds[]
  // 2) Manutenções: colaboradorId presente no array alocadoIds[] (não concluída)
  function alocacoesDe(colaboradorId) {
    const emObras = obras
      .filter(o=>(o.equipeIds||[]).includes(colaboradorId) && o.status!=="CONCLUÍDA")
      .map(o=>({tipo:"obra",titulo:o.nome,cliente:o.cliente,status:o.status,id:o.id}));
    const emManuts = manutencoes
      .filter(m=>(m.alocadoIds||[]).includes(colaboradorId) && !["CONCLUÍDA","CANCELADA"].includes(m.status))
      .map(m=>({tipo:"manutencao",titulo:m.titulo,cliente:m.cliente,status:m.status,id:m.id}));
    return [...emObras, ...emManuts];
  }

  const lista = useMemo(()=>{
    const q=search.toLowerCase();
    return funcionarios
      .map(f=>({...f, alocacoes:alocacoesDe(f.id)}))
      .filter(f=>{
        const mQ=!q||f.nome?.toLowerCase().includes(q)||f.funcao?.toLowerCase().includes(q)||f.alocacoes.some(a=>a.titulo?.toLowerCase().includes(q));
        const mD=filtroDep==="todos"||f.departamento===filtroDep;
        const mA=filtroAlocacao==="todos"||(filtroAlocacao==="alocados"&&f.alocacoes.length>0)||(filtroAlocacao==="livres"&&f.alocacoes.length===0);
        return mQ&&mD&&mA;
      })
      .sort((a,b)=>b.alocacoes.length-a.alocacoes.length);
  },[funcionarios,obras,manutencoes,search,filtroDep,filtroAlocacao]);

  const totalAlocados = funcionarios.filter(f=>alocacoesDe(f.id).length>0).length;
  const totalLivres    = funcionarios.length - totalAlocados;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Equipe</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{funcionarios.length} colaboradores · {totalAlocados} alocados · {totalLivres} livres</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:16}}>
        <div className="metric"><div className="metric-label">Total equipe</div><div className="metric-value">{funcionarios.length}</div></div>
        <div className="metric" style={{borderLeft:"3px solid var(--afine-yellow-dk)"}}><div className="metric-label">Alocados</div><div className="metric-value yellow">{totalAlocados}</div></div>
        <div className="metric" style={{borderLeft:"3px solid var(--verde)"}}><div className="metric-label">Livres</div><div className="metric-value green">{totalLivres}</div></div>
        <div className="metric" style={{borderLeft:"3px solid #185FA5"}}><div className="metric-label">Em obras</div><div className="metric-value" style={{color:"#185FA5"}}>{obras.filter(o=>(o.equipeIds||[]).length>0&&o.status!=="CONCLUÍDA").length}</div></div>
        <div className="metric" style={{borderLeft:"3px solid var(--vermelho)"}}><div className="metric-label">Em manutenção</div><div className="metric-value red">{manutencoes.filter(m=>(m.alocadoIds||[]).length>0&&!["CONCLUÍDA","CANCELADA"].includes(m.status)).length}</div></div>
      </div>

      {/* Filtro departamento */}
      <div className="chip-row" style={{marginBottom:8}}>
        <button className={`chip ${filtroDep==="todos"?"active":""}`} onClick={()=>setFiltroDep("todos")}>Todos os departamentos</button>
        {DEPARTAMENTOS.map(dep=>{
          const count=funcionarios.filter(f=>f.departamento===dep.id).length;
          if(count===0) return null;
          return (
            <button key={dep.id} className={`chip ${filtroDep===dep.id?"active":""}`} onClick={()=>setFiltroDep(dep.id)}
              style={{background:filtroDep===dep.id?dep.cor:"",borderColor:filtroDep===dep.id?dep.cor:"",color:filtroDep===dep.id?"#fff":""}}>
              {dep.icone} {dep.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filtro alocação */}
      <div className="chip-row" style={{marginBottom:10}}>
        {[["todos","Todos"],["alocados","Alocados"],["livres","Livres / disponíveis"]].map(([v,l])=>(
          <button key={v} className={`chip ${filtroAlocacao===v?"active":""}`} onClick={()=>setFiltroAlocacao(v)}>{l}</button>
        ))}
      </div>

      <div className="search-bar">🔍<input placeholder="Buscar por nome, função ou demanda alocada..." value={search} onChange={e=>setSearch(e.target.value)}/></div>

      {loading&&<div className="spinner"/>}
      {!loading&&lista.length===0&&<div className="empty-state"><div className="empty-icon">👷</div><p>Nenhum colaborador encontrado</p></div>}
      {!loading&&lista.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {lista.map(f=>(
            <ColaboradorCard
              key={f.id}
              colaborador={f}
              alocacoes={f.alocacoes}
              canEdit={canEdit}
              onVerInfo={()=>setModalInfo(f)}
              onReatribuir={()=>setModalReatrib(f)}
            />
          ))}
        </div>
      )}

      {modalInfo&&<ColaboradorInfoModal colaborador={modalInfo} onClose={()=>setModalInfo(null)}/>}
      {modalReatrib&&(
        <ReatribuirModal
          colaborador={modalReatrib}
          demandasAbertas={demandasAbertas}
          onClose={()=>setModalReatrib(null)}
          addToast={addToast}
        />
      )}
    </div>
  );
}

// ─── OCORRÊNCIAS com fotos + vínculo a funcionário (inalterado) ──────────────
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

  async function save() {
    if(!form.descricao){alert("Descreva a ocorrência.");return;}
    setSaving(true);
    const agora=new Date().toISOString();
    const func = funcionarios.find(f=>f.id===form.funcId||f.uid===form.funcId);
    const payload={...form, fotos, obraId:obraAtual, responsavel: func?.nome||form.responsavel, updatedAt:agora, autorNome:userProfile?.nome||currentUser?.email};
    try {
      if(ocorr?.id){await updateDoc(doc(db,"ocorrencias",ocorr.id),payload);addToast("Atualizada!");}
      else{payload.createdAt=agora;await addDoc(collection(db,"ocorrencias"),payload);addToast("Registrada!");}
      onClose();
    } catch(err){addToast("Erro: "+err.message,"error");}
    setSaving(false);
  }

  return (
    <Modal title={ocorr?.id?"Editar ocorrência":"Registrar ocorrência"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="form-grid">
          <div className="form-group"><label>Data</label><input type="date" value={form.data} onChange={e=>set("data",e.target.value)}/></div>
          <div className="form-group"><label>Tipo</label>
            <select value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
              {["NÃO-CONFORMIDADE","ACIDENTE","ATRASO","FALTA DE MATERIAL","SEGURANÇA","OUTRO"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group span-2"><label className="required">Descrição</label><textarea value={form.descricao} onChange={e=>set("descricao",e.target.value)} rows={3}/></div>
          <div className="form-group span-2"><label>Ação tomada / corretiva</label><textarea value={form.acao} onChange={e=>set("acao",e.target.value)} rows={2}/></div>
          <div className="form-group">
            <label>Funcionário vinculado</label>
            <select value={form.funcId} onChange={e=>set("funcId",e.target.value)}>
              <option value="">Nenhum / Geral</option>
              {(equipeAtiva||[]).map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
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
