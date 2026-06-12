// src/pages/Manutencao.js — aba completa de manutenção
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import OSScanner from "../components/OSScanner";
import { useToast } from "../hooks/useToast";

const MIN_FOTOS = 15;

// Checklist padrão de manutenção
const CHECKLIST_ITENS = [
  "Elétrica — tomadas e interruptores","Elétrica — quadro de distribuição","Elétrica — iluminação",
  "Hidráulica — torneiras e metais","Hidráulica — vasos e louças","Hidráulica — tubulação visível",
  "Ar-condicionado — filtros limpos","Ar-condicionado — funcionamento","Cabeamento — pontos de rede",
  "Cabeamento — rack e patch panel","Pintura — paredes e teto","Piso — estado geral",
  "Forro — estado geral","Portas e fechaduras","Controle de acesso","CFTV — câmeras",
  "Sinalização de emergência","Extintores — validade","Limpeza geral"
];

function ManutencaoModal({ manut, obraId, onClose, addToast }) {
  const { userProfile } = useAuth();
  const isCampo = userProfile?.perfil === "campo";

  const [form, setForm] = useState({
    titulo:       manut?.titulo       || "",
    cliente:      manut?.cliente      || "",
    agencia:      manut?.agencia      || "",
    tipo:         manut?.tipo         || "corretiva",
    prioridade:   manut?.prioridade   || "normal",
    numeroOT:     manut?.numeroOT     || "",
    semOT:        manut?.semOT        || false,
    responsavel:  manut?.responsavel  || "",
    dataAbertura: manut?.dataAbertura || new Date().toISOString().split("T")[0],
    dataPrevista: manut?.dataPrevista || "",
    dataConclusao:manut?.dataConclusao|| "",
    status:       manut?.status       || "ABERTA",
    garantia:     manut?.garantia     || "NÃO",
    vencGarantia: manut?.vencGarantia || "",
    obs:          manut?.obs          || "",
    camposCustom: manut?.camposCustom || {},
  });
  const [checklist, setChecklist] = useState(manut?.checklist || {});
  const [fotos,  setFotos]  = useState(manut?.fotos  || []);
  const [osFile, setOsFile] = useState(manut?.osFile || null);
  const [saving, setSaving] = useState(false);

  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }
  function setCustom(f, v) { setForm(p => ({ ...p, camposCustom: { ...p.camposCustom, [f]: v } })); }
  function toggleCheck(item) { setChecklist(p => ({ ...p, [item]: !p[item] })); }

  const isItau = form.cliente?.toLowerCase().includes("itaú") || form.cliente?.toLowerCase().includes("itau");
  const otOk = !isItau || form.semOT || (form.numeroOT && form.numeroOT.trim() !== "");
  const fotosOk = fotos.length >= MIN_FOTOS;
  const osOk = !isCampo || !!osFile;
  const podeConc = fotosOk && osOk && otOk;

  async function save() {
    if (!form.titulo || !form.cliente) { alert("Título e cliente são obrigatórios."); return; }
    if (isItau && !form.semOT && !form.numeroOT.trim()) { alert("Para Itaú: informe o número da OT ou marque S/OT."); return; }
    if (form.status === "CONCLUÍDA" && !podeConc) {
      alert(`Para concluir:\n${!fotosOk?"• Envie no mínimo 15 fotos\n":""}${!osOk?"• Anexe a OS assinada\n":""}${!otOk?"• Informe o número da OT ou marque S/OT":""}`.trim());
      return;
    }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = { ...form, checklist, fotos, osFile: osFile || null, obraId, updatedAt: agora };
    try {
      if (manut?.id) {
        await updateDoc(doc(db, "manutencoes", manut.id), payload);
        addToast("Manutenção atualizada!");
      } else {
        payload.createdAt = agora;
        await addDoc(collection(db, "manutencoes"), payload);
        addToast("Manutenção criada!");
      }
      onClose();
    } catch (err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  const checkOk = Object.values(checklist).filter(Boolean).length;

  return (
    <Modal title={manut?.id ? "Editar manutenção" : "Nova manutenção"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* IDENTIFICAÇÃO */}
        <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>IDENTIFICAÇÃO</div>
        <div className="form-grid">
          <div className="form-group span-2"><label className="required">Título / descrição</label><input value={form.titulo} onChange={e=>set("titulo",e.target.value)} placeholder="Ex: Troca de lâmpadas — Agência Centro"/></div>
          <div className="form-group"><label className="required">Cliente</label><input value={form.cliente} onChange={e=>set("cliente",e.target.value)} placeholder="Itaú, Bradesco..."/></div>
          <div className="form-group"><label>Agência / local</label><input value={form.agencia} onChange={e=>set("agencia",e.target.value)} placeholder="AG 0442 — Cravinhos"/></div>
          <div className="form-group"><label>Tipo</label>
            <select value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
              <option value="corretiva">Corretiva</option>
              <option value="preventiva">Preventiva</option>
              <option value="preditiva">Preditiva</option>
              <option value="emergencial">Emergencial</option>
            </select>
          </div>
          <div className="form-group"><label>Prioridade</label>
            <select value={form.prioridade} onChange={e=>set("prioridade",e.target.value)}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div className="form-group"><label>Responsável</label><input value={form.responsavel} onChange={e=>set("responsavel",e.target.value)}/></div>
        </div>

        {/* OT — obrigatório para Itaú */}
        {isItau && (
          <div style={{background:"#FFF2CC",border:"1px solid #F0C040",borderRadius:8,padding:12}}>
            <div style={{fontSize:12,fontWeight:600,color:"#854F0B",marginBottom:8}}>⚠️ ITAÚ — Número da OT obrigatório</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="required">Número da OT</label>
                <input value={form.numeroOT} onChange={e=>set("numeroOT",e.target.value)} placeholder="Ex: OT-2025-00123" disabled={form.semOT}
                  style={{opacity:form.semOT?0.4:1}}/>
              </div>
              <div className="form-group" style={{justifyContent:"flex-end",paddingBottom:2}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:20}}>
                  <input type="checkbox" checked={form.semOT} onChange={e=>{set("semOT",e.target.checked); if(e.target.checked) set("numeroOT","S/OT");}} style={{width:16,height:16}}/>
                  <span style={{fontSize:13}}>S/OT (sem número ainda)</span>
                </label>
              </div>
            </div>
            {form.semOT && (
              <div style={{fontSize:11,color:"#854F0B",marginTop:4}}>
                Marcado como S/OT. Atualize com o número real quando disponível.
              </div>
            )}
          </div>
        )}

        {/* Campos customizáveis para outros clientes */}
        {!isItau && form.cliente && (
          <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12}}>
            <div style={{fontSize:12,fontWeight:600,color:"#444",marginBottom:8}}>Campos específicos — {form.cliente}</div>
            <div className="form-grid">
              <div className="form-group"><label>Nº documento / protocolo</label><input value={form.camposCustom?.protocolo||""} onChange={e=>setCustom("protocolo",e.target.value)} placeholder="Número interno do cliente"/></div>
              <div className="form-group"><label>Centro de custo</label><input value={form.camposCustom?.centroCusto||""} onChange={e=>setCustom("centroCusto",e.target.value)}/></div>
              <div className="form-group span-2"><label>Referência adicional</label><input value={form.camposCustom?.ref||""} onChange={e=>setCustom("ref",e.target.value)} placeholder="Qualquer campo específico do cliente"/></div>
            </div>
          </div>
        )}

        {/* DATAS */}
        <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>DATAS E STATUS</div>
        <div className="form-grid">
          <div className="form-group"><label>Data de abertura</label><input type="date" value={form.dataAbertura} onChange={e=>set("dataAbertura",e.target.value)}/></div>
          <div className="form-group"><label>Data prevista</label><input type="date" value={form.dataPrevista} onChange={e=>set("dataPrevista",e.target.value)}/></div>
          <div className="form-group"><label>Data de conclusão</label><input type="date" value={form.dataConclusao} onChange={e=>set("dataConclusao",e.target.value)}/></div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {["ABERTA","EM ANDAMENTO","CONCLUÍDA","CANCELADA","AGUARDANDO PEÇAS"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Em garantia?</label>
            <select value={form.garantia} onChange={e=>set("garantia",e.target.value)}>
              <option>NÃO</option><option>SIM</option>
            </select>
          </div>
          {form.garantia === "SIM" && (
            <div className="form-group"><label>Vencimento garantia</label><input type="date" value={form.vencGarantia} onChange={e=>set("vencGarantia",e.target.value)}/></div>
          )}
        </div>

        {/* CHECKLIST */}
        <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>CHECKLIST DE VISTORIA <span style={{color:"var(--cinza-med)",fontWeight:400}}>({checkOk}/{CHECKLIST_ITENS.length} itens)</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {CHECKLIST_ITENS.map(item=>(
            <label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer",padding:"4px 0"}}>
              <input type="checkbox" checked={!!checklist[item]} onChange={()=>toggleCheck(item)} style={{width:14,height:14,flexShrink:0}}/>
              <span style={{color:checklist[item]?"var(--verde)":"inherit"}}>{item}</span>
            </label>
          ))}
        </div>

        <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} placeholder="Detalhes, materiais utilizados, observações técnicas..." rows={3}/></div>

        <div className="divider"/>

        {/* FOTOS */}
        <PhotoUploader fotos={fotos} onChange={setFotos} obraId={obraId||"manut"} escopoId={manut?.id||"novo"}/>

        <div className="divider"/>

        {/* OS */}
        <OSScanner osFile={osFile} onChange={setOsFile} obraId={obraId||"manut"} escopoId={manut?.id||"novo"}/>

        {/* Validação conclusão */}
        {form.status === "CONCLUÍDA" && !podeConc && (
          <div className="alert alert-danger">
            <strong>Não é possível concluir ainda:</strong><br/>
            {!fotosOk && `• Envie no mínimo ${MIN_FOTOS} fotos (você tem ${fotos.length})\n`}
            {!osOk   && "• Anexe a OS assinada e carimbada\n"}
            {!otOk   && "• Informe o número da OT ou marque S/OT"}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── HISTORICO por agência ────────────────────────────────────────────────────
function HistoricoCard({ manut }) {
  const [open, setOpen] = useState(false);
  const checkOk = Object.values(manut.checklist||{}).filter(Boolean).length;
  return (
    <div className="rdo-card" style={{marginBottom:10}}>
      <div className="rdo-header">
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:13}}>{manut.titulo}</div>
          <div style={{fontSize:11,color:"var(--cinza-med)"}}>{manut.agencia} · {fmtDate(manut.dataAbertura)}</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span className={`badge ${manut.prioridade==="urgente"?"badge-red":manut.prioridade==="alta"?"badge-amber":"badge-blue"}`}>{manut.prioridade}</span>
          <span className={`badge ${statusBadge(manut.status)}`}>{manut.status}</span>
          <button className="btn btn-sm" onClick={()=>setOpen(!open)}>{open?"▲":"▼"}</button>
        </div>
      </div>
      {open && (
        <div style={{marginTop:10,fontSize:12,display:"flex",flexDirection:"column",gap:6}}>
          {manut.numeroOT && <div><strong>OT:</strong> {manut.numeroOT}</div>}
          {manut.responsavel && <div><strong>Responsável:</strong> {manut.responsavel}</div>}
          {manut.dataConclusao && <div><strong>Concluída em:</strong> {fmtDate(manut.dataConclusao)}</div>}
          {manut.garantia==="SIM" && <div style={{color:"var(--verde)"}}><strong>Em garantia até:</strong> {fmtDate(manut.vencGarantia)}</div>}
          <div><strong>Checklist:</strong> {checkOk}/{CHECKLIST_ITENS.length} itens verificados</div>
          {manut.obs && <div><strong>Obs:</strong> {manut.obs}</div>}
          {manut.fotos?.length>0 && (
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
              {manut.fotos.slice(0,6).map((f,i)=>(
                <img key={i} src={f.base64} alt="" style={{width:60,height:60,objectFit:"cover",borderRadius:4,border:"1px solid #ddd"}}/>
              ))}
              {manut.fotos.length>6 && <div style={{width:60,height:60,borderRadius:4,background:"#eee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>+{manut.fotos.length-6}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Manutencao({ obraAtual }) {
  const { toasts, addToast } = useToast();
  const [manuts,  setManuts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filtro,  setFiltro]  = useState("todas");
  const [aba,     setAba]     = useState("lista");
  const [modal,   setModal]   = useState(null);

  useEffect(() => {
    const q = obraAtual
      ? query(collection(db,"manutencoes"), where("obraId","==",obraAtual))
      : collection(db,"manutencoes");
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setManuts(data);
      setLoading(false);
    });
  }, [obraAtual]);

  const filtered = manuts.filter(m=>{
    const q = search.toLowerCase();
    const mQ = !q || m.titulo?.toLowerCase().includes(q) || m.cliente?.toLowerCase().includes(q) || m.agencia?.toLowerCase().includes(q) || m.numeroOT?.toLowerCase().includes(q);
    const mF = filtro==="todas" || m.status===filtro;
    return mQ && mF;
  });

  // KPIs
  const abertas   = manuts.filter(m=>m.status==="ABERTA"||m.status==="EM ANDAMENTO").length;
  const concl     = manuts.filter(m=>m.status==="CONCLUÍDA").length;
  const garantia  = manuts.filter(m=>m.garantia==="SIM").length;
  const semOT     = manuts.filter(m=>m.semOT).length;

  // Histórico por agência
  const porAgencia = manuts.reduce((acc,m)=>{
    const ag = m.agencia||"Sem agência";
    if(!acc[ag]) acc[ag]=[];
    acc[ag].push(m);
    return acc;
  },{});

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div><div className="panel-title">Manutenções</div><div style={{fontSize:12,color:"var(--cinza-med)"}}>{manuts.length} registros</div></div>
        <button className="btn btn-primary" onClick={()=>setModal({manut:null})}>+ Nova manutenção</button>
      </div>

      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="metric"><div className="metric-label">Em aberto</div><div className="metric-value red">{abertas}</div></div>
        <div className="metric"><div className="metric-label">Concluídas</div><div className="metric-value green">{concl}</div></div>
        <div className="metric"><div className="metric-label">Em garantia</div><div className="metric-value blue">{garantia}</div></div>
        <div className="metric"><div className="metric-label">S/OT pendente</div><div className="metric-value amber">{semOT}</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${aba==="lista"?"active":""}`} onClick={()=>setAba("lista")}>Lista</button>
        <button className={`tab ${aba==="historico"?"active":""}`} onClick={()=>setAba("historico")}>Por agência</button>
        <button className={`tab ${aba==="garantia"?"active":""}`} onClick={()=>setAba("garantia")}>Garantias</button>
        <button className={`tab ${aba==="semOT"?"active":""}`} onClick={()=>setAba("semOT")}>S/OT pendente</button>
      </div>

      {aba==="lista" && (
        <>
          <div className="chip-row">
            {["todas","ABERTA","EM ANDAMENTO","CONCLUÍDA","CANCELADA","AGUARDANDO PEÇAS"].map(s=>(
              <button key={s} className={`chip ${filtro===s?"active":""}`} onClick={()=>setFiltro(s)}>
                {s==="todas"?"Todas":s} ({s==="todas"?manuts.length:manuts.filter(m=>m.status===s).length})
              </button>
            ))}
          </div>
          <div className="search-bar">🔍<input placeholder="Buscar por título, cliente, agência ou OT..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {loading && <div className="spinner"/>}
          {!loading && filtered.length===0 && <div className="empty-state"><div className="empty-icon">🔧</div><p>Nenhuma manutenção encontrada</p></div>}
          {!loading && filtered.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Título</th><th>Cliente</th><th>Agência</th><th>OT</th><th>Tipo</th><th>Prioridade</th><th>Abertura</th><th>Previsão</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(m=>(
                    <tr key={m.id}>
                      <td style={{fontWeight:600,maxWidth:200}}>{m.titulo}</td>
                      <td style={{fontSize:12}}>{m.cliente}</td>
                      <td style={{fontSize:12}}>{m.agencia||"–"}</td>
                      <td style={{fontSize:11}}>{m.semOT?<span className="badge badge-amber">S/OT</span>:m.numeroOT||"–"}</td>
                      <td><span className="badge badge-gray" style={{fontSize:10}}>{m.tipo}</span></td>
                      <td><span className={`badge ${m.prioridade==="urgente"?"badge-red":m.prioridade==="alta"?"badge-amber":"badge-blue"}`} style={{fontSize:10}}>{m.prioridade}</span></td>
                      <td style={{fontSize:12}}>{fmtDate(m.dataAbertura)}</td>
                      <td style={{fontSize:12}}>{fmtDate(m.dataPrevista)}</td>
                      <td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></td>
                      <td><button className="btn btn-sm btn-icon" onClick={()=>setModal({manut:m})}>✏️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aba==="historico" && (
        <div>
          {Object.keys(porAgencia).length===0 && <div className="empty-state"><div className="empty-icon">🏢</div><p>Nenhum histórico</p></div>}
          {Object.entries(porAgencia).map(([ag,items])=>(
            <div key={ag} style={{marginBottom:20}}>
              <div style={{fontWeight:600,fontSize:14,color:"var(--azul)",marginBottom:8,borderBottom:"2px solid var(--azul-claro)",paddingBottom:4}}>
                🏢 {ag} <span style={{fontSize:12,fontWeight:400,color:"var(--cinza-med)"}}>({items.length} manutenções)</span>
              </div>
              {items.map(m=><HistoricoCard key={m.id} manut={m}/>)}
            </div>
          ))}
        </div>
      )}

      {aba==="garantia" && (
        <div>
          {manuts.filter(m=>m.garantia==="SIM").length===0 && <div className="empty-state"><div className="empty-icon">🛡️</div><p>Nenhum item em garantia</p></div>}
          {manuts.filter(m=>m.garantia==="SIM").map(m=>(
            <div key={m.id} className="rdo-card" style={{borderLeft:"3px solid var(--verde)"}}>
              <div className="rdo-header">
                <div><div style={{fontWeight:600}}>{m.titulo}</div><div style={{fontSize:11,color:"var(--cinza-med)"}}>{m.agencia}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:12,color:"var(--verde)",fontWeight:600}}>Garantia até {fmtDate(m.vencGarantia)}</div><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {aba==="semOT" && (
        <div>
          <div className="alert alert-warning" style={{marginBottom:12}}>⚠️ Estas manutenções foram registradas como S/OT. Atualize o número da OT quando disponível.</div>
          {manuts.filter(m=>m.semOT).length===0 && <div className="empty-state"><div className="empty-icon">✅</div><p>Nenhuma manutenção S/OT pendente</p></div>}
          {manuts.filter(m=>m.semOT).map(m=>(
            <div key={m.id} className="rdo-card" style={{borderLeft:"3px solid var(--laranja)"}}>
              <div className="rdo-header">
                <div><div style={{fontWeight:600}}>{m.titulo}</div><div style={{fontSize:11,color:"var(--cinza-med)"}}>{m.cliente} · {m.agencia}</div></div>
                <button className="btn btn-sm btn-primary" onClick={()=>setModal({manut:m})}>Informar OT</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <ManutencaoModal manut={modal.manut} obraId={obraAtual} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
