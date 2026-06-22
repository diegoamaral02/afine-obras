import { buscarCEP } from "../utils/cep";
// src/pages/Obras.js — completo com endereço, busca CEP, fotos, medições, subcontratados
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import { useToast } from "../hooks/useToast";
import { Ocorrencias } from "./Equipe";
import Medicao from "./Medicao";
import Diario from "./Diario";

const TIPOS_OBRA = ["Reforma geral","Layout","Adequação","Retrofit","Manutenção preventiva","Manutenção corretiva","Instalação","Ampliação","Outro"];



function ObraModal({ obra, funcionarios, clientes, onClose, addToast }) {
  const [aba, setAba] = useState("dados");
  const [form, setForm] = useState({
    nome: obra?.nome||"", tipo: obra?.tipo||"", cliente: obra?.cliente||"",
    clienteId: obra?.clienteId||"",
    agenciaId: obra?.agenciaId||"", agenciaNome: obra?.agenciaNome||"",
    gerenciadora: obra?.gerenciadora||"",
    responsavelId: obra?.responsavelId||"", responsavelNome: obra?.responsavelNome||obra?.responsavel||"",
    contrato: obra?.contrato||"", area: obra?.area||"",
    equipeIds: obra?.equipeIds||[],
    // Endereço
    cep: obra?.cep||"", logradouro: obra?.logradouro||"", numero: obra?.numero||"",
    bairro: obra?.bairro||"", cidade: obra?.cidade||"", uf: obra?.uf||"",
    // Datas
    inicio: obra?.inicio||"", termino: obra?.termino||"",
    dataVistoria: obra?.dataVistoria||"", conclusaoReal: obra?.conclusaoReal||"",
    // Status
    status: obra?.status||"EM ANDAMENTO", progresso: obra?.progresso||0,
    // Financeiro
    orcamentoEnviado: obra?.orcamentoEnviado||"NÃO",
    valorOrcamento: obra?.valorOrcamento||"",
    relatorioEnviado: obra?.relatorioEnviado||"NÃO",
    // Extra
    subcontratados: obra?.subcontratados||"",
    obs: obra?.obs||"",
  });
  const [fotos, setFotos] = useState(obra?.fotos||[]);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [saving, setSaving] = useState(false);

  function set(f,v) { setForm(p=>({...p,[f]:v})); }
  function handleFunc(field, idField, e) {
    const id=e.target.value;
    const f=(funcionarios||[]).find(x=>x.id===id||x.uid===id);
    set(field,f?.nome||""); set(idField,id);
  }

  async function handleCEP(cep) {
    set("cep",cep);
    if (cep.replace(/\D/g,"").length===8) {
      setBuscandoCEP(true);
      const d = await buscarCEP(cep);
      if (d) { set("logradouro",d.logradouro||""); set("bairro",d.bairro||""); set("cidade",d.localidade||""); set("uf",d.uf||""); }
      setBuscandoCEP(false);
    }
  }

  function abrirNavegacao() {
    const end = encodeURIComponent(`${form.logradouro}, ${form.numero}, ${form.cidade}, ${form.uf}`);
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) window.open(`maps://maps.apple.com/?q=${end}`);
    else window.open(`https://www.google.com/maps/search/?api=1&query=${end}`,"_blank");
  }

  async function save() {
    if (!form.nome||!form.cliente) { alert("Nome e cliente são obrigatórios."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = { ...form, progresso: Number(form.progresso)||0, fotos, updatedAt: agora };
    try {
      if (obra?.id) { await updateDoc(doc(db,"obras",obra.id),payload); addToast("Obra atualizada!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"obras"),payload); addToast("Obra criada!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  const ABAS = ["dados","endereço","financeiro","fotos"];

  return (
    <Modal title={obra?.id?"Editar obra":"Nova obra"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>

      <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
        {ABAS.map((a,i)=>(
          <button key={a} onClick={()=>setAba(a)} className="btn btn-sm"
            style={{background:aba===a?"var(--afine-yellow)":"",borderColor:aba===a?"var(--afine-yellow)":"",fontWeight:aba===a?700:400,color:aba===a?"var(--afine-black)":""}}>
            {a.charAt(0).toUpperCase()+a.slice(1)}
          </button>
        ))}
      </div>

      {aba==="dados" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-grid">
            <div className="form-group span-2"><label className="required">Nome da obra</label><input value={form.nome} onChange={e=>set("nome",e.target.value)} placeholder="AG-0500 · São Paulo Centro"/></div>
            <div className="form-group">
              <label className="required">Cliente</label>
              <select value={form.clienteId} onChange={e=>{
                const id=e.target.value;
                const c=(clientes||[]).find(x=>x.id===id);
                set("clienteId",id);
                set("cliente",c?.razaoSocial||"");
                set("agenciaId",""); set("agenciaNome","");
              }}>
                <option value="">Selecione o cliente...</option>
                {(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
              </select>
              {!form.clienteId && (
                <input value={form.cliente} onChange={e=>set("cliente",e.target.value)} placeholder="Ou digite o nome (cliente não cadastrado)" style={{marginTop:6}}/>
              )}
            </div>
            {/* Agência / Loja / Filial — só aparece se o cliente selecionado tiver agências cadastradas */}
            {(() => {
              const clienteSel = (clientes||[]).find(c=>c.id===form.clienteId);
              const agencias = clienteSel?.agencias||[];
              if (agencias.length===0) return null;
              return (
                <div className="form-group">
                  <label>🏢 Agência / Loja / Filial</label>
                  <select value={form.agenciaId} onChange={e=>{
                    const id=e.target.value;
                    const a=agencias.find(x=>x.id===id);
                    set("agenciaId",id); set("agenciaNome",a?.nome||"");
                  }}>
                    <option value="">Selecione...</option>
                    {agencias.map(a=><option key={a.id} value={a.id}>{a.nome}{a.cidade?` — ${a.cidade}`:""}</option>)}
                  </select>
                </div>
              );
            })()}
            <div className="form-group"><label className="required">Tipo de obra</label>
              <select value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
                <option value="">Selecione...</option>
                {TIPOS_OBRA.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Gerenciadora</label><input value={form.gerenciadora} onChange={e=>set("gerenciadora",e.target.value)}/></div>
            <div className="form-group">
              <label>👤 Responsável técnico (Gestor)</label>
              <select value={form.responsavelId} onChange={e=>handleFunc("responsavelNome","responsavelId",e)}
                style={{background:form.responsavelNome?"rgba(24,95,165,.06)":""}}>
                <option value="">Selecione o gestor responsável...</option>
                {(funcionarios||[])
                  .filter(f=>f.adm===true || ["gestao","adm"].includes(f.departamento) || f.perfil==="gestor")
                  .map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              {form.responsavelNome&&<span style={{fontSize:11,color:"#185FA5",fontWeight:600}}>✓ {form.responsavelNome}</span>}
            </div>
            <div className="form-group"><label>Contrato Nº</label><input value={form.contrato} onChange={e=>set("contrato",e.target.value)}/></div>
            <div className="form-group"><label>Área (m²)</label><input type="number" value={form.area} onChange={e=>set("area",e.target.value)}/></div>
          </div>
          <div className="form-grid">
            <div className="form-group"><label>Início</label><input type="date" value={form.inicio} onChange={e=>set("inicio",e.target.value)}/></div>
            <div className="form-group"><label>Término previsto</label><input type="date" value={form.termino} onChange={e=>set("termino",e.target.value)}/></div>
            <div className="form-group"><label>Data de vistoria</label><input type="date" value={form.dataVistoria} onChange={e=>set("dataVistoria",e.target.value)}/></div>
            <div className="form-group"><label>Conclusão real</label><input type="date" value={form.conclusaoReal} onChange={e=>set("conclusaoReal",e.target.value)}/></div>
            <div className="form-group"><label>Status</label>
              <select value={form.status} onChange={e=>set("status",e.target.value)}>
                {["EM ANDAMENTO","CONCLUÍDA","PARALISADA","PLANEJAMENTO","AGUARDANDO APROVAÇÃO"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Progresso (%)</label><input type="number" min="0" max="100" value={form.progresso} onChange={e=>set("progresso",e.target.value)}/></div>
          </div>
          <div className="form-group"><label>Subcontratados / empresas envolvidas</label><input value={form.subcontratados} onChange={e=>set("subcontratados",e.target.value)} placeholder="Ex: Elétrica Total, Sub. Souza Drywall..."/></div>

          {/* Equipe alocada na obra */}
          <div style={{background:"var(--afine-yellow-lt)",borderRadius:8,padding:12,border:"1px solid rgba(245,200,0,.3)"}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--afine-yellow-dk)",marginBottom:8}}>👷 Equipe alocada nesta obra</div>
            <div style={{fontSize:11,color:"#8A6000",marginBottom:10}}>
              Selecione os colaboradores responsáveis por esta obra. Eles aparecerão vinculados a ela na aba Equipe.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:160,overflowY:"auto",background:"#fff",borderRadius:6,padding:8}}>
              {(funcionarios||[]).length===0&&<span style={{fontSize:12,color:"#7A7A7A"}}>Nenhum funcionário cadastrado</span>}
              {(funcionarios||[]).map(f=>{
                const checked=form.equipeIds.includes(f.id);
                return (
                  <label key={f.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,background:checked?"var(--afine-yellow-lt)":"transparent"}}>
                    <input type="checkbox" checked={checked} onChange={()=>{
                      setForm(p=>({...p,equipeIds:checked?p.equipeIds.filter(id=>id!==f.id):[...p.equipeIds,f.id]}));
                    }} style={{width:15,height:15}}/>
                    <span style={{flex:1}}>{f.nome}</span>
                    <span style={{fontSize:11,color:"#7A7A7A"}}>{f.funcao||f.departamento}</span>
                  </label>
                );
              })}
            </div>
            {form.equipeIds.length>0&&<div style={{marginTop:6,fontSize:11,color:"var(--afine-yellow-dk)",fontWeight:600}}>✓ {form.equipeIds.length} colaborador(es) alocado(s)</div>}
          </div>

          <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={3}/></div>
        </div>
      )}

      {aba==="endereço" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="alert alert-info" style={{fontSize:12}}>Digite o CEP para preencher o endereço automaticamente.</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="required">CEP</label>
              <div style={{display:"flex",gap:6}}>
                <input value={form.cep} onChange={e=>handleCEP(e.target.value)} placeholder="00000-000" maxLength={9} style={{flex:1}}/>
                {buscandoCEP && <span style={{fontSize:12,color:"#7A7A7A",alignSelf:"center"}}>Buscando...</span>}
              </div>
            </div>
            <div className="form-group"><label className="required">Número</label><input value={form.numero} onChange={e=>set("numero",e.target.value)} placeholder="123"/></div>
            <div className="form-group span-2"><label className="required">Logradouro</label><input value={form.logradouro} onChange={e=>set("logradouro",e.target.value)}/></div>
            <div className="form-group"><label>Bairro</label><input value={form.bairro} onChange={e=>set("bairro",e.target.value)}/></div>
            <div className="form-group"><label>Cidade</label><input value={form.cidade} onChange={e=>set("cidade",e.target.value)}/></div>
            <div className="form-group"><label>UF</label><input value={form.uf} onChange={e=>set("uf",e.target.value)} maxLength={2}/></div>
          </div>
          {form.logradouro && form.numero && (
            <div style={{background:"var(--afine-yellow-lt)",borderRadius:8,padding:14,border:"1px solid rgba(245,200,0,.3)"}}>
              <div style={{fontSize:13,marginBottom:10}}>📍 {form.logradouro}, {form.numero} — {form.bairro}, {form.cidade}/{form.uf}</div>
              <button className="btn btn-primary" onClick={abrirNavegacao}>🗺️ Abrir no mapa / Navegar</button>
            </div>
          )}
        </div>
      )}

      {aba==="financeiro" && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-grid">
            <div className="form-group"><label>Orçamento enviado?</label>
              <select value={form.orcamentoEnviado} onChange={e=>set("orcamentoEnviado",e.target.value)}>
                {["NÃO","SIM","PENDENTE"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Valor do orçamento (R$)</label><input type="number" value={form.valorOrcamento} onChange={e=>set("valorOrcamento",e.target.value)} placeholder="0,00"/></div>
            <div className="form-group"><label>Relatório enviado?</label>
              <select value={form.relatorioEnviado} onChange={e=>set("relatorioEnviado",e.target.value)}>
                {["NÃO","SIM","PENDENTE"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {form.valorOrcamento && (
            <div style={{background:"var(--afine-yellow-lt)",borderRadius:8,padding:12,fontSize:13}}>
              💰 Valor do orçamento: <strong>R$ {Number(form.valorOrcamento).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong>
            </div>
          )}
        </div>
      )}

      {aba==="fotos" && (
        <div>
          <div style={{fontSize:12,color:"#7A7A7A",marginBottom:12}}>Fotos de vistoria e registro da obra. Não há mínimo obrigatório aqui.</div>
          <PhotoUploader fotos={fotos} onChange={setFotos} minFotos={0}/>
        </div>
      )}
    </Modal>
  );
}

export default function Obras({ onObraSelect }) {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [obras,   setObras]   = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filtro,  setFiltro]  = useState("todos");
  const [modal,   setModal]   = useState(null);
  const [obraAberta, setObraAberta] = useState(null);
  const [abaDrawer, setAbaDrawer]   = useState("ocorrencias");
  const isGestor = userProfile?.perfil==="gestor";

  useEffect(() => {
    return onSnapshot(collection(db,"obras"), snap => {
      setObras(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
  },[]);

  useEffect(() => {
    return onSnapshot(collection(db,"usuarios"), snap => {
      setFuncionarios(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="ATIVO"||!f.status));
    });
  },[]);

  useEffect(() => {
    return onSnapshot(collection(db,"clientes"), snap => {
      setClientes(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
  },[]);

  const filtered = obras.filter(o=>{
    const q=search.toLowerCase();
    const mQ=!q||o.nome?.toLowerCase().includes(q)||o.cliente?.toLowerCase().includes(q)||o.contrato?.toLowerCase().includes(q);
    const mF=filtro==="todos"||o.status===filtro;
    return mQ&&mF;
  });

  const statusList=["EM ANDAMENTO","CONCLUÍDA","PARALISADA","PLANEJAMENTO","AGUARDANDO APROVAÇÃO"];

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Obras</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{obras.length} obras · {obras.filter(o=>o.status==="EM ANDAMENTO").length} em andamento</div>
        </div>
        {isGestor && <button className="btn btn-primary" onClick={()=>setModal({obra:null})}>+ Nova obra</button>}
      </div>

      <div className="chip-row">
        {["todos",...statusList].map(s=>(
          <button key={s} className={`chip ${filtro===s?"active":""}`} onClick={()=>setFiltro(s)}>
            {s==="todos"?"Todas":s} ({s==="todos"?obras.length:obras.filter(o=>o.status===s).length})
          </button>
        ))}
      </div>

      <div className="search-bar">🔍<input placeholder="Buscar por nome, cliente ou contrato..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      {loading && <div className="spinner"/>}
      {!loading && filtered.length===0 && <div className="empty-state"><div className="empty-icon">🏗️</div><p>Nenhuma obra encontrada</p></div>}
      {!loading && filtered.length>0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Obra</th><th>Tipo</th><th>Cliente</th><th>Responsável</th><th>Equipe</th><th>Endereço</th><th>Vistoria</th><th>Término</th><th>Orçamento</th><th>Relatório</th><th>Progresso</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(o=>{
                const temEndereco = o.logradouro&&o.numero;
                const equipeIds = o.equipeIds||[];
                const nomesEquipe = equipeIds.map(id=>funcionarios.find(f=>f.id===id)?.nome).filter(Boolean);
                return (
                <tr key={o.id}>
                  <td><div style={{fontWeight:600}}>{o.nome}</div><div style={{fontSize:11,color:"#7A7A7A"}}>{o.contrato}</div></td>
                  <td><span className="badge badge-gray" style={{fontSize:10}}>{o.tipo||"–"}</span></td>
                  <td style={{fontSize:12}}>{o.cliente}{o.agenciaNome&&<div style={{fontSize:10,color:"var(--afine-yellow-dk)",fontWeight:600}}>🏢 {o.agenciaNome}</div>}</td>
                  <td style={{fontSize:12}}>
                    {o.responsavelNome ? (
                      <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                        <span style={{width:20,height:20,borderRadius:"50%",background:"#185FA5",color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          {o.responsavelNome.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase()}
                        </span>
                        {o.responsavelNome}
                      </span>
                    ) : <span style={{color:"#aaa"}}>–</span>}
                  </td>
                  <td style={{fontSize:11,maxWidth:160}}>
                    {nomesEquipe.length>0 ? (
                      <span title={nomesEquipe.join(", ")} style={{fontSize:11,background:"var(--afine-yellow-lt)",color:"var(--afine-yellow-dk)",padding:"2px 8px",borderRadius:10,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"inline-block",maxWidth:"100%"}}>
                        👷 {nomesEquipe.join(", ")}
                      </span>
                    ) : <span style={{color:"#aaa"}}>Sem equipe</span>}
                  </td>
                  <td style={{fontSize:11}}>
                    {temEndereco ? (
                      <button onClick={()=>{
                        const enc=encodeURIComponent(`${o.logradouro}, ${o.numero}, ${o.cidade}`);
                        window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
                      }} style={{background:"none",border:"none",color:"var(--afine-yellow-dk)",cursor:"pointer",fontSize:11,padding:0,textAlign:"left"}}>
                        🗺️ {o.logradouro}, {o.numero}
                      </button>
                    ):"–"}
                  </td>
                  <td style={{fontSize:12}}>{fmtDate(o.dataVistoria)}</td>
                  <td style={{fontSize:12}}>{fmtDate(o.conclusaoReal||o.termino)}</td>
                  <td><span className={`badge ${o.orcamentoEnviado==="SIM"?"badge-green":o.orcamentoEnviado==="PENDENTE"?"badge-amber":"badge-red"}`}>{o.orcamentoEnviado||"NÃO"}</span></td>
                  <td><span className={`badge ${o.relatorioEnviado==="SIM"?"badge-green":"badge-red"}`}>{o.relatorioEnviado||"NÃO"}</span></td>
                  <td style={{minWidth:90}}>
                    <div className="progress-bar" style={{marginBottom:3}}><div className={`progress-fill ${o.progresso>=100?"green":"blue"}`} style={{width:`${o.progresso||0}%`}}/></div>
                    <span style={{fontSize:11}}>{o.progresso||0}%</span>
                  </td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                  <td style={{display:"flex",gap:4}}>
                    <button className="btn btn-sm" onClick={()=>onObraSelect(o)} title="Selecionar">🔀</button>
                    {isGestor && <button className="btn btn-sm btn-icon" onClick={()=>setModal({obra:o})}>✏️</button>}
                    <button className="btn btn-sm btn-icon" title="Ocorrências" onClick={()=>{setObraAberta(o);setAbaDrawer("ocorrencias");}} style={{fontSize:12}}>⚠️</button>
                    <button className="btn btn-sm btn-icon" title="Acompanhamento" onClick={()=>{setObraAberta(o);setAbaDrawer("acompanhamento");}} style={{fontSize:12}}>📐</button>
                    <button className="btn btn-sm btn-icon" title="Diário de Obra"  onClick={()=>{setObraAberta(o);setAbaDrawer("diario");}} style={{fontSize:12}}>📓</button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
      {modal && <ObraModal obra={modal.obra} funcionarios={funcionarios} clientes={clientes} onClose={()=>setModal(null)} addToast={addToast}/>}

      {/* Painel lateral de ocorrências por obra */}
      {obraAberta && (
        <div style={{
          position:"fixed", top:0, right:0, bottom:0, width:480, maxWidth:"95vw",
          background:"#fff", boxShadow:"-4px 0 30px rgba(0,0,0,.15)",
          zIndex:200, display:"flex", flexDirection:"column", overflowY:"auto"
        }}>
          {/* Header */}
          <div style={{background:"#1A1A1A", padding:"14px 18px", flexShrink:0}}>
            <div style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12}}>
              <div>
                <div style={{fontSize:15, fontWeight:700, color:"#F5C800"}}>{obraAberta.nome}</div>
                <div style={{fontSize:11, color:"rgba(255,255,255,.4)"}}>{obraAberta.cliente}</div>
              </div>
              <button onClick={()=>setObraAberta(null)}
                style={{background:"rgba(255,255,255,.1)", border:"none", borderRadius:8, color:"#fff", cursor:"pointer", fontSize:18, padding:"4px 10px"}}>
                ✕
              </button>
            </div>
            {/* Sub-abas do drawer */}
            <div style={{display:"flex", gap:4}}>
              {[
                {id:"ocorrencias",     icon:"⚠️", label:"Ocorrências"},
                {id:"acompanhamento",  icon:"📐", label:"Acompanhamento"},
                {id:"diario",          icon:"📓", label:"Diário de obra"},
              ].map(a=>(
                <button key={a.id} onClick={()=>setAbaDrawer(a.id)}
                  style={{flex:1, padding:"6px 4px", border:"none", cursor:"pointer", borderRadius:6,
                    background:abaDrawer===a.id?"rgba(245,200,0,.2)":"rgba(255,255,255,.06)",
                    color:abaDrawer===a.id?"#F5C800":"rgba(255,255,255,.5)",
                    fontSize:10, fontWeight:abaDrawer===a.id?700:400, transition:".15s"}}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
          {/* Conteúdo */}
          <div style={{padding:"16px", flex:1, overflowY:"auto"}}>
            {abaDrawer==="ocorrencias"    && <Ocorrencias obraAtual={obraAberta.id}/>}
            {abaDrawer==="acompanhamento" && <Medicao     obraAtual={obraAberta.id}/>}
            {abaDrawer==="diario"         && <Diario      obraAtual={obraAberta.id}/>}
          </div>
        </div>
      )}
      {obraAberta && <div onClick={()=>setObraAberta(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:199}}/>}
    </div>
  );
}
