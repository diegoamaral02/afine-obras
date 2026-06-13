// src/pages/Diario.js — com atividades pré-prontas, equipe da obra, controle por usuário/obra
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

// Atividades pré-prontas por tipo
const ATIVIDADES_OBRA = [
  "Execução de alvenaria / drywall","Instalação elétrica — infraestrutura","Instalação elétrica — fiação",
  "Instalação hidráulica","Aplicação de revestimento / piso","Pintura — massa corrida e tinta",
  "Instalação de forro","Montagem de mobiliário","Instalação de cabeamento","Instalação de AC",
  "Instalação de controle de acesso / CFTV","Limpeza grossa","Limpeza fina","Vistoria técnica",
];
const ATIVIDADES_MANUT = [
  "Manutenção elétrica — tomadas e interruptores","Manutenção elétrica — quadro e circuitos",
  "Manutenção elétrica — iluminação","Manutenção hidráulica — vazamentos",
  "Manutenção hidráulica — louças e metais","Limpeza de filtros de AC","Manutenção de AC",
  "Manutenção de cabeamento estruturado","Manutenção de CFTV","Manutenção de controle de acesso",
  "Pintura corretiva","Reparo em revestimentos","Reparo em forro / gesso","Vistoria preventiva",
];
const OCORRENCIAS_PRONTAS = [
  "Falta de material — aguardando entrega","Atraso por chuva / condições climáticas",
  "Ausência de funcionário","Interferência com operação do cliente",
  "Retrabalho identificado","Acidente de trabalho (sem lesão)",
  "Acidente de trabalho (com lesão)","Paralisação por determinação do cliente",
  "Problema técnico não previsto","Aguardando aprovação da gerenciadora",
  "Material com defeito / fora da especificação","Acesso negado à área",
];

function RDOModal({ obraId, tipoObra, equipeObra, permissoes, onClose, addToast }) {
  const { currentUser, userProfile } = useAuth();
  const [form, setForm] = useState({
    data: new Date().toISOString().split("T")[0],
    clima: "Ensolarado",
    obs: "",
  });
  const [atividadesSel, setAtividadesSel] = useState([]);
  const [atividadeExtra, setAtividadeExtra] = useState("");
  const [ocorrenciasSel, setOcorrenciasSel] = useState([]);
  const [ocorrenciaExtra, setOcorrenciaExtra] = useState("");
  const [equipeSel, setEquipeSel] = useState([]);
  const [materiais, setMateriais] = useState("");
  const [saving, setSaving] = useState(false);

  const lista = tipoObra === "manutencao" ? ATIVIDADES_MANUT : ATIVIDADES_OBRA;

  function toggleAtiv(s) { setAtividadesSel(p => p.includes(s) ? p.filter(x=>x!==s) : [...p,s]); }
  function toggleOcorr(s) { setOcorrenciasSel(p => p.includes(s) ? p.filter(x=>x!==s) : [...p,s]); }
  function toggleEquipe(nome) { setEquipeSel(p => p.includes(nome) ? p.filter(x=>x!==nome) : [...p,nome]); }
  function set(f, v) { setForm(p => ({...p, [f]: v})); }

  async function save() {
    if (atividadesSel.length === 0 && !atividadeExtra.trim()) { alert("Informe ao menos uma atividade."); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, "rdos"), {
        data: form.data, clima: form.clima, obs: form.obs,
        atividades: atividadesSel,
        atividadeExtra,
        ocorrencias: ocorrenciasSel,
        ocorrenciaExtra,
        equipePresente: equipeSel,
        materiais,
        obraId,
        autor: currentUser.email,
        autorNome: userProfile?.nome || currentUser.email,
        createdAt: new Date().toISOString(),
      });
      addToast("RDO registrado!");
      onClose();
    } catch (err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title="Novo Registro Diário de Obra (RDO)" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar RDO"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        <div className="form-grid">
          <div className="form-group"><label className="required">Data</label><input type="date" value={form.data} onChange={e=>set("data",e.target.value)}/></div>
          <div className="form-group"><label>Clima</label>
            <select value={form.clima} onChange={e=>set("clima",e.target.value)}>
              {["Ensolarado","Parcialmente nublado","Nublado","Chuva fraca","Chuva forte"].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* EQUIPE PRESENTE */}
        <div>
          <div style={{fontSize:12,fontWeight:600,color:"#185FA5",marginBottom:6}}>EQUIPE PRESENTE</div>
          {equipeObra.length === 0 ? (
            <div style={{fontSize:12,color:"var(--cinza-med)"}}>Nenhum funcionário alocado a esta obra ainda.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {equipeObra.map(f => (
                <label key={f.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,background:equipeSel.includes(f.nome)?"var(--verde-lt)":"var(--cinza-lt)"}}>
                  <input type="checkbox" checked={equipeSel.includes(f.nome)} onChange={()=>toggleEquipe(f.nome)} style={{width:15,height:15}}/>
                  <div style={{width:26,height:26,borderRadius:"50%",background:"var(--azul-claro)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--azul-med)",flexShrink:0}}>{initials(f.nome)}</div>
                  <span style={{flex:1}}>{f.nome}</span>
                  <span style={{fontSize:11,color:"var(--cinza-med)"}}>{f.funcao}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* ATIVIDADES */}
        <div>
          <div style={{fontSize:12,fontWeight:600,color:"#185FA5",marginBottom:6}}>ATIVIDADES EXECUTADAS</div>
          <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:180,overflowY:"auto"}}>
            {lista.map(a=>(
              <label key={a} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,background:atividadesSel.includes(a)?"var(--azul-claro)":"var(--cinza-lt)"}}>
                <input type="checkbox" checked={atividadesSel.includes(a)} onChange={()=>toggleAtiv(a)} style={{width:15,height:15}}/>
                <span>{a}</span>
              </label>
            ))}
          </div>
          <div className="form-group" style={{marginTop:8}}>
            <label>Descrição adicional / detalhes</label>
            <textarea value={atividadeExtra} onChange={e=>setAtividadeExtra(e.target.value)} placeholder="Descreva atividades específicas do dia..." rows={2}/>
          </div>
        </div>

        {/* MATERIAIS */}
        <div className="form-group">
          <label>Materiais recebidos</label>
          <input value={materiais} onChange={e=>setMateriais(e.target.value)} placeholder="Ex: 2 rolos cabo Cat.6, 20 sacos de cimento"/>
        </div>

        {/* OCORRÊNCIAS */}
        <div>
          <div style={{fontSize:12,fontWeight:600,color:"#185FA5",marginBottom:6}}>OCORRÊNCIAS / OBSERVAÇÕES</div>
          <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:180,overflowY:"auto"}}>
            {OCORRENCIAS_PRONTAS.map(o=>(
              <label key={o} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,background:ocorrenciasSel.includes(o)?"var(--amarelo-lt)":"var(--cinza-lt)"}}>
                <input type="checkbox" checked={ocorrenciasSel.includes(o)} onChange={()=>toggleOcorr(o)} style={{width:15,height:15}}/>
                <span>{o}</span>
              </label>
            ))}
          </div>
          <div className="form-group" style={{marginTop:8}}>
            <label>Descrição adicional / observações</label>
            <textarea value={ocorrenciaExtra} onChange={e=>setOcorrenciaExtra(e.target.value)} placeholder="Descreva ocorrências específicas..." rows={2}/>
          </div>
        </div>

        {/* OBS GERAIS */}
        <div className="form-group">
          <label>Observações gerais</label>
          <textarea value={form.obs} onChange={e=>set("obs",e.target.value)} placeholder="Qualquer observação adicional sobre o dia..." rows={2}/>
        </div>

      </div>
    </Modal>
  );
}

// Modal de configuração de permissões por obra
function PermissoesModal({ obraId, permissoes, funcionarios, onClose, addToast }) {
  const [perm, setPerm] = useState(permissoes || { diarioCampo: true, ocorrenciasCampo: true, usuariosPermitidos: [] });
  const [saving, setSaving] = useState(false);

  function toggleUser(uid) {
    setPerm(p => ({
      ...p,
      usuariosPermitidos: p.usuariosPermitidos.includes(uid)
        ? p.usuariosPermitidos.filter(x=>x!==uid)
        : [...p.usuariosPermitidos, uid]
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "obras", obraId), { permissoes: perm });
      addToast("Permissões salvas!");
      onClose();
    } catch(err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title="Configurar permissões — Diário e Ocorrências" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{fontSize:12,color:"var(--cinza-med)"}}>
          Configure quem pode registrar o Diário de Obra e Ocorrências nesta obra.
        </div>

        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 12px",background:"var(--cinza-lt)",borderRadius:8}}>
          <input type="checkbox" checked={perm.diarioCampo} onChange={e=>setPerm(p=>({...p,diarioCampo:e.target.checked}))} style={{width:18,height:18}}/>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>Funcionários de campo podem criar RDO</div>
            <div style={{fontSize:11,color:"var(--cinza-med)"}}>Quando ativado, perfil "campo" pode registrar o diário</div>
          </div>
        </label>

        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"10px 12px",background:"var(--cinza-lt)",borderRadius:8}}>
          <input type="checkbox" checked={perm.ocorrenciasCampo} onChange={e=>setPerm(p=>({...p,ocorrenciasCampo:e.target.checked}))} style={{width:18,height:18}}/>
          <div>
            <div style={{fontSize:13,fontWeight:500}}>Funcionários de campo podem registrar ocorrências</div>
            <div style={{fontSize:11,color:"var(--cinza-med)"}}>Quando ativado, perfil "campo" pode criar ocorrências</div>
          </div>
        </label>

        <div>
          <div style={{fontSize:12,fontWeight:600,color:"#185FA5",marginBottom:8}}>USUÁRIOS ESPECÍFICOS COM PERMISSÃO</div>
          <div style={{fontSize:11,color:"var(--cinza-med)",marginBottom:8}}>Selecione usuários que têm permissão independente do perfil:</div>
          <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:200,overflowY:"auto"}}>
            {funcionarios.map(f=>(
              <label key={f.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"5px 8px",borderRadius:6,background:perm.usuariosPermitidos.includes(f.uid||f.id)?"var(--azul-claro)":"transparent"}}>
                <input type="checkbox" checked={perm.usuariosPermitidos.includes(f.uid||f.id)} onChange={()=>toggleUser(f.uid||f.id)} style={{width:14,height:14}}/>
                <span style={{flex:1}}>{f.nome}</span>
                <span style={{fontSize:11,color:"var(--cinza-med)"}}>{f.perfil}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Diario({ obraAtual }) {
  const { currentUser, userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [rdos,       setRdos]       = useState([]);
  const [equipeObra, setEquipeObra] = useState([]);
  const [todosFuncs, setTodosFuncs] = useState([]);
  const [obraInfo,   setObraInfo]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false);
  const [modalPerm,  setModalPerm]  = useState(false);

  const perfil = userProfile?.perfil || "campo";
  const isGestor = perfil === "gestor";
  const perm = obraInfo?.permissoes || { diarioCampo: true, ocorrenciasCampo: true, usuariosPermitidos: [] };

  const podeCriarRDO = isGestor || perfil === "encarregado" ||
    (perm.diarioCampo && perfil === "campo") ||
    perm.usuariosPermitidos.includes(currentUser?.uid);

  // Detecta tipo da obra para lista de atividades
  const tipoObra = (obraInfo?.tipo||"").toLowerCase().includes("manutenção") ? "manutencao" : "obra";

  useEffect(() => {
    if (!obraAtual) return;
    const q = query(collection(db,"rdos"), where("obraId","==",obraAtual));
    const unsub1 = onSnapshot(q, snap => {
      const data = snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.data||"").localeCompare(a.data||""));
      setRdos(data);
      setLoading(false);
    });
    // Carrega info da obra (tipo, permissões)
    const unsub2 = onSnapshot(doc(db,"obras",obraAtual), snap => {
      if (snap.exists()) setObraInfo({id:snap.id,...snap.data()});
    });
    return () => { unsub1(); unsub2(); };
  }, [obraAtual]);

  // Equipe da obra
  useEffect(() => {
    if (!obraAtual) return;
    const q = query(collection(db,"equipe"), where("obraId","==",obraAtual));
    return onSnapshot(q, snap => setEquipeObra(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, [obraAtual]);

  // Todos funcionários para modal de permissões
  useEffect(() => {
    return onSnapshot(collection(db,"usuarios"), snap => setTodosFuncs(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, []);

  const climaEmoji = {"Ensolarado":"☀️","Parcialmente nublado":"⛅","Nublado":"☁️","Chuva fraca":"🌧️","Chuva forte":"⛈️"};

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra no menu lateral.</div>;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Diário de obra</div>
          <div style={{fontSize:12,color:"var(--cinza-med)"}}>{rdos.length} registros</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {isGestor && (
            <button className="btn" onClick={()=>setModalPerm(true)} title="Configurar permissões">⚙️ Permissões</button>
          )}
          {podeCriarRDO && (
            <button className="btn btn-primary" onClick={()=>setModal(true)}>+ Novo RDO</button>
          )}
        </div>
      </div>

      {!podeCriarRDO && perfil === "campo" && (
        <div className="alert alert-warning" style={{marginBottom:14}}>
          Você não tem permissão para criar RDOs nesta obra. Solicite ao gestor.
        </div>
      )}

      {loading && <div className="spinner"/>}
      {!loading && rdos.length===0 && <div className="empty-state"><div className="empty-icon">📓</div><p>Nenhum RDO registrado</p></div>}

      {rdos.map(r => (
        <div key={r.id} className="rdo-card">
          <div className="rdo-header">
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>{climaEmoji[r.clima]||"🌤️"}</span>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>{fmtDate(r.data)}</div>
                <div style={{fontSize:11,color:"var(--cinza-med)"}}>{r.clima} · por {r.autorNome}</div>
              </div>
            </div>
          </div>

          {/* Atividades */}
          {(r.atividades?.length>0||r.atividadeExtra) && (
            <div style={{marginBottom:8}}>
              <strong style={{fontSize:12}}>Atividades:</strong>
              {r.atividades?.map((a,i)=><div key={i} style={{fontSize:12,color:"#444",paddingLeft:8}}>• {a}</div>)}
              {r.atividadeExtra && <div style={{fontSize:12,color:"#444",paddingLeft:8,fontStyle:"italic"}}>{r.atividadeExtra}</div>}
            </div>
          )}

          {/* Equipe */}
          {r.equipePresente?.length>0 && (
            <div style={{fontSize:12,marginBottom:6}}>
              <strong>👷 Equipe:</strong> {r.equipePresente.join(", ")}
            </div>
          )}

          {/* Materiais */}
          {r.materiais && <div style={{fontSize:12,marginBottom:6}}><strong>📦 Materiais:</strong> {r.materiais}</div>}

          {/* Ocorrências */}
          {(r.ocorrencias?.length>0||r.ocorrenciaExtra) && (
            <div className="alert alert-warning" style={{marginTop:8,fontSize:12}}>
              <div><strong>⚠️ Ocorrências:</strong></div>
              {r.ocorrencias?.map((o,i)=><div key={i} style={{paddingLeft:8}}>• {o}</div>)}
              {r.ocorrenciaExtra && <div style={{paddingLeft:8,fontStyle:"italic"}}>{r.ocorrenciaExtra}</div>}
            </div>
          )}

          {/* Obs gerais */}
          {r.obs && <div style={{fontSize:12,marginTop:6,color:"var(--cinza-med)"}}>{r.obs}</div>}
        </div>
      ))}

      {modal && (
        <RDOModal
          obraId={obraAtual}
          tipoObra={tipoObra}
          equipeObra={equipeObra}
          permissoes={perm}
          onClose={()=>setModal(false)}
          addToast={addToast}
        />
      )}

      {modalPerm && (
        <PermissoesModal
          obraId={obraAtual}
          permissoes={perm}
          funcionarios={todosFuncs}
          onClose={()=>setModalPerm(false)}
          addToast={addToast}
        />
      )}
    </div>
  );
}
