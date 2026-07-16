// src/pages/Gerenciamento.js — Módulo de Gerenciamento de Demandas por Cliente
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate, statusBadge } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { isGestorOuAdm, isCampo as isCampoHelper } from "../constants/departamentos";
import { addComAuditoria, updateComAuditoria } from "../services/auditoria";

// ── STATUS ───────────────────────────────────────────────────────────────────
const STATUS_LIST = [
  "AGENDAMENTO",
  "SOLICITAÇÃO MATERIAL",
  "EXECUÇÃO",
  "ANDAMENTO DEMANDA EXTRA",
  "SUSPENSA",
  "FINALIZADA — EXEC. DOCUMENTAÇÃO",
  "CONCLUÍDA",
  "CANCELADA",
];

const STATUS_GMUD = ["PENDENTE","ENVIADA","APROVADA","EXECUTADA","CANCELADA"];

function statusGerBadge(s) {
  const m = {
    "AGENDAMENTO":"badge-amber","SOLICITAÇÃO MATERIAL":"badge-amber",
    "EXECUÇÃO":"badge-blue","ANDAMENTO DEMANDA EXTRA":"badge-blue",
    "SUSPENSA":"badge-red","CANCELADA":"badge-gray",
    "FINALIZADA — EXEC. DOCUMENTAÇÃO":"badge-amber",
    "CONCLUÍDA":"badge-green",
  };
  return m[s]||"badge-gray";
}

// ── MODAL CONFIRMAÇÃO EXCLUSÃO ────────────────────────────────────────────────
function ModalExclusao({ nome, onConfirmar, onCancelar }) {
  const [digitado, setDigitado] = useState("");
  const ok = digitado.trim().toLowerCase() === (nome||"").trim().toLowerCase();
  return (
    <div onClick={onCancelar} style={{position:"fixed",inset:0,zIndex:400,background:"rgba(10,10,10,.65)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,width:"min(460px,94vw)",boxShadow:"0 24px 64px rgba(0,0,0,.28)",overflow:"hidden"}}>
        <div style={{background:"#1A1A1A",padding:"14px 20px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>🗑️</span>
          <div style={{fontWeight:700,fontSize:15,color:"var(--vermelho,#BD3838)"}}>Excluir demanda</div>
        </div>
        <div style={{padding:"20px 20px 16px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"#fff0f0",border:"1px solid rgba(189,56,56,.25)",borderRadius:8,padding:"10px 14px",fontSize:13,color:"var(--vermelho,#BD3838)",fontWeight:600}}>
            ⚠️ Esta ação é <strong>irreversível</strong>. Todos os dados serão excluídos permanentemente.
          </div>
          <div style={{fontSize:13,color:"#555"}}>Digite o nome da demanda para confirmar: <strong>"{nome}"</strong></div>
          <input type="text" value={digitado} onChange={e=>setDigitado(e.target.value)} placeholder={nome} autoFocus
            style={{padding:"9px 12px",border:`1px solid ${ok?"var(--verde,#1E7A3C)":digitado?"var(--vermelho,#BD3838)":"#ddd"}`,borderRadius:7,fontSize:13,outline:"none"}}/>
          {ok&&<span style={{fontSize:11,color:"var(--verde,#1E7A3C)",fontWeight:600}}>✓ Confirmado</span>}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={onCancelar} style={{padding:"9px 20px",border:"1px solid #ddd",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={onConfirmar} disabled={!ok} style={{padding:"9px 22px",border:"none",borderRadius:8,background:ok?"var(--vermelho,#BD3838)":"#e0e0e0",color:ok?"#fff":"#aaa",cursor:ok?"pointer":"not-allowed",fontSize:13,fontWeight:700}}>Excluir definitivamente</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MODAL NOVA ATUALIZAÇÃO ────────────────────────────────────────────────────
function ModalAtualizacao({ demanda, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const [nota, setNota] = useState("");
  const [eventosSel, setEventosSel] = useState([]);
  const [saving, setSaving] = useState(false);

  const eventos = demanda.eventosConfig || [];

  function toggleEvento(ev) {
    setEventosSel(prev => prev.includes(ev) ? prev.filter(e=>e!==ev) : [...prev, ev]);
  }

  async function salvar() {
    if (!nota.trim() && eventosSel.length === 0) { alert("Selecione ao menos um evento ou escreva uma nota."); return; }
    setSaving(true);
    const entrada = {
      data: new Date().toISOString(),
      autor: userProfile?.nome || "–",
      autorId: currentUser?.uid,
      eventos: eventosSel,
      nota: nota.trim(),
    };
    const historico = [...(demanda.historico || []), entrada];
    try {
      await updateComAuditoria("gerenciamento", demanda.id, { historico, updatedAt: new Date().toISOString() }, currentUser?.uid, userProfile?.nome);
      addToast("Atualização registrada!");
      onClose();
    } catch(e) { addToast("Erro: "+e.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title="📝 Registrar atualização" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving?"Salvando...":"Registrar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {eventos.length > 0 && (
          <div className="form-group">
            <label>Eventos ocorridos</label>
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:200,overflowY:"auto",padding:"6px 8px",border:"1px solid var(--border)",borderRadius:7,background:"#fafafa"}}>
              {eventos.map(ev=>(
                <label key={ev} style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,cursor:"pointer",padding:"3px 0"}}>
                  <input type="checkbox" checked={eventosSel.includes(ev)} onChange={()=>toggleEvento(ev)} style={{accentColor:"#1A1A1A"}}/>
                  {ev}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="form-group">
          <label>Nota</label>
          <textarea value={nota} onChange={e=>setNota(e.target.value)} rows={3} placeholder="Descreva o que ocorreu..."/>
        </div>
      </div>
    </Modal>
  );
}

// ── MODAL CONFIGURAR EVENTOS ──────────────────────────────────────────────────
function ModalConfigurarEventos({ demanda, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const [eventos, setEventos] = useState(demanda.eventosConfig || []);
  const [novoEvento, setNovoEvento] = useState("");
  const [saving, setSaving] = useState(false);

  function adicionar() {
    if (!novoEvento.trim() || eventos.includes(novoEvento.trim())) return;
    setEventos(prev=>[...prev, novoEvento.trim()]);
    setNovoEvento("");
  }

  async function salvar() {
    setSaving(true);
    try {
      await updateComAuditoria("gerenciamento", demanda.id, { eventosConfig: eventos, updatedAt: new Date().toISOString() }, currentUser?.uid, userProfile?.nome);
      addToast("Eventos salvos!");
      onClose();
    } catch(e) { addToast("Erro: "+e.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title="⚙️ Configurar eventos do histórico" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontSize:12,color:"#7A7A7A"}}>Defina os eventos predefinidos para registrar no histórico desta demanda.</div>
        <div style={{display:"flex",gap:8}}>
          <input value={novoEvento} onChange={e=>setNovoEvento(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&adicionar()}
            placeholder="Ex: GMUD enviada" style={{flex:1,padding:"7px 10px",border:"1px dashed #F5C400",borderRadius:7,fontSize:12.5,background:"#fffbea",outline:"none"}}/>
          <button className="btn btn-sm btn-primary" onClick={adicionar}>+ Adicionar</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:280,overflowY:"auto"}}>
          {eventos.length === 0 && <div style={{fontSize:12,color:"#aaa",textAlign:"center",padding:16}}>Nenhum evento cadastrado.</div>}
          {eventos.map((ev,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:"#F3F2EF",borderRadius:6,fontSize:12.5}}>
              <span>{ev}</span>
              <button onClick={()=>setEventos(prev=>prev.filter((_,j)=>j!==i))}
                style={{background:"none",border:"none",cursor:"pointer",color:"#BD3838",fontSize:14,padding:0,lineHeight:1}}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── MODAL DEMANDA (CRIAR/EDITAR) ──────────────────────────────────────────────
function DemandaModal({ demanda, clientes, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const isNova = !demanda?.id;
  const isGestor = isGestorOuAdm(userProfile);

  const [form, setForm] = useState({
    clienteId:        demanda?.clienteId        || "",
    clienteNome:      demanda?.clienteNome      || "",
    agenciaId:        demanda?.agenciaId        || "",
    agenciaNome:      demanda?.agenciaNome      || "",
    tiposDemanda:     demanda?.tiposDemanda     || [],   // lista de tipos do cliente
    tipoDemanda:      demanda?.tipoDemanda      || "",
    status:           demanda?.status           || "AGENDAMENTO",
    responsavel:      demanda?.responsavel      || userProfile?.nome || "",
    gestorCliente:    demanda?.gestorCliente    || "",
    inicio:           demanda?.inicio           || "",
    terminoPrevisto:  demanda?.terminoPrevisto  || "",
    termoChaves:      demanda?.termoChaves      || "",
    // Empresas
    construtora:      demanda?.construtora      || "",
    construtoraContato: demanda?.construtoraContato || "",
    instaladora:      demanda?.instaladora      || "",
    fornecedorACM:    demanda?.fornecedorACM    || "",
    // Códigos
    projSAP:          demanda?.projSAP          || "",
    codUPE:           demanda?.codUPE           || "",
    reservaMaterial:  demanda?.reservaMaterial  || "",
    formAutodesk:     demanda?.formAutodesk     || false,
    // GMUD
    gmudNumero:       demanda?.gmudNumero       || "",
    gmudData:         demanda?.gmudData         || "",
    gmudStatus:       demanda?.gmudStatus       || "PENDENTE",
    gmudObs:          demanda?.gmudObs          || "",
    // Financeiro
    orcConstrutora:   demanda?.orcConstrutora   || "",
    orcInstaladora:   demanda?.orcInstaladora   || "",
    medicaoConstrutora: demanda?.medicaoConstrutora || "",
    // Documentação
    docConstrutora:   demanda?.docConstrutora   || "",
    docAfine:         demanda?.docAfine         || "",
    entradaGestor:    demanda?.entradaGestor    || "",
    enviadoFinanceiro: demanda?.enviadoFinanceiro || false,
    // Tipos configuráveis
    tiposConfig:      demanda?.tiposConfig      || [],
    novoTipo:         "",
    eventosConfig:    demanda?.eventosConfig    || [],
  });

  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  const clienteSel = clientes.find(c=>c.id===form.clienteId);
  const agencias = clienteSel?.agencias || [];

  function selecionarCliente(id) {
    const c = clientes.find(x=>x.id===id);
    set("clienteId", id);
    set("clienteNome", c?.nome||"");
    set("agenciaId", "");
    set("agenciaNome","");
    // Herda tipos de demanda do cliente se já configurados
    set("tiposConfig", c?.tiposDemandaGerenciamento || []);
  }

  function selecionarAgencia(id) {
    const ag = agencias.find(a=>a.id===id);
    set("agenciaId", id);
    set("agenciaNome", ag ? `${ag.numero || ""} ${ag.nome || ""}`.trim() : "");
  }

  function adicionarTipo() {
    const t = form.novoTipo.trim();
    if (!t || form.tiposConfig.includes(t)) return;
    set("tiposConfig", [...form.tiposConfig, t]);
    set("novoTipo","");
  }

  async function salvar() {
    if (!form.clienteId || !form.agenciaId || !form.tipoDemanda || !form.status) {
      alert("Cliente, agência, tipo de demanda e status são obrigatórios."); return;
    }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = {
      clienteId:          form.clienteId,
      clienteNome:        form.clienteNome,
      agenciaId:          form.agenciaId,
      agenciaNome:        form.agenciaNome,
      tipoDemanda:        form.tipoDemanda,
      tiposConfig:        form.tiposConfig,
      status:             form.status,
      responsavel:        form.responsavel,
      gestorCliente:      form.gestorCliente,
      inicio:             form.inicio,
      terminoPrevisto:    form.terminoPrevisto,
      termoChaves:        form.termoChaves,
      construtora:        form.construtora,
      construtoraContato: form.construtoraContato,
      instaladora:        form.instaladora,
      fornecedorACM:      form.fornecedorACM,
      projSAP:            form.projSAP,
      codUPE:             form.codUPE,
      reservaMaterial:    form.reservaMaterial,
      formAutodesk:       form.formAutodesk,
      gmudNumero:         form.gmudNumero,
      gmudData:           form.gmudData,
      gmudStatus:         form.gmudStatus,
      gmudObs:            form.gmudObs,
      orcConstrutora:     form.orcConstrutora,
      orcInstaladora:     form.orcInstaladora,
      medicaoConstrutora: form.medicaoConstrutora,
      docConstrutora:     form.docConstrutora,
      docAfine:           form.docAfine,
      entradaGestor:      form.entradaGestor,
      enviadoFinanceiro:  form.enviadoFinanceiro,
      eventosConfig:      form.eventosConfig,
      updatedAt:          agora,
    };
    try {
      if (isNova) {
        await addComAuditoria("gerenciamento", { ...payload, historico:[], createdAt:agora }, currentUser?.uid, userProfile?.nome);
        addToast("Demanda criada!");
      } else {
        await updateComAuditoria("gerenciamento", demanda.id, payload, currentUser?.uid, userProfile?.nome);
        addToast("Demanda atualizada!");
      }
      onClose();
    } catch(e) { addToast("Erro: "+e.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title={isNova?"➕ Nova demanda":"✏️ Editar demanda"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar} disabled={saving}>{saving?"Salvando...":isNova?"Criar demanda":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        {/* ── BLOCO 1: IDENTIFICAÇÃO ── */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Identificação</div>

        <div className="form-grid">
          <div className="form-group">
            <label className="required">Cliente</label>
            <select value={form.clienteId} onChange={e=>selecionarCliente(e.target.value)}>
              <option value="">Selecione...</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="required">Agência</label>
            <select value={form.agenciaId} onChange={e=>selecionarAgencia(e.target.value)} disabled={!form.clienteId}>
              <option value="">Selecione...</option>
              {agencias.map(ag=><option key={ag.id} value={ag.id}>{ag.numero ? `${ag.numero} — ` : ""}{ag.nome}</option>)}
            </select>
          </div>
        </div>

        {/* Tipos de demanda configuráveis por cliente */}
        <div className="form-group">
          <label className="required">Tipo de demanda</label>
          {form.tiposConfig.length === 0 ? (
            <div style={{fontSize:12,color:"#7A7A7A",background:"#fafafa",border:"1px dashed #ddd",borderRadius:7,padding:"8px 10px"}}>
              ⚠️ Nenhum tipo cadastrado para este cliente. Adicione abaixo.
            </div>
          ) : (
            <select value={form.tipoDemanda} onChange={e=>set("tipoDemanda",e.target.value)}>
              <option value="">Selecione...</option>
              {form.tiposConfig.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* Adicionar novos tipos */}
        <div className="form-group">
          <label style={{color:"#185FA5"}}>+ Tipos de demanda deste cliente</label>
          <div style={{display:"flex",gap:6}}>
            <input value={form.novoTipo} onChange={e=>set("novoTipo",e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&adicionarTipo()}
              placeholder="Ex: Plano Diretor Premium" style={{flex:1}}/>
            <button type="button" className="btn btn-sm btn-primary" onClick={adicionarTipo}>+ Add</button>
          </div>
          {form.tiposConfig.length > 0 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
              {form.tiposConfig.map((t,i)=>(
                <span key={i} style={{background:"#F3F2EF",padding:"2px 8px",borderRadius:10,fontSize:11,display:"flex",alignItems:"center",gap:4}}>
                  {t}
                  <button onClick={()=>set("tiposConfig",form.tiposConfig.filter((_,j)=>j!==i))}
                    style={{background:"none",border:"none",cursor:"pointer",color:"#BD3838",fontSize:12,padding:0,lineHeight:1}}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label className="required">Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}>
              {STATUS_LIST.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="required">Responsável interno</label>
            <input value={form.responsavel} onChange={e=>set("responsavel",e.target.value)} placeholder="Nome do responsável"/>
          </div>
        </div>

        <div className="form-group">
          <label>Gestor do cliente</label>
          <input value={form.gestorCliente} onChange={e=>set("gestorCliente",e.target.value)} placeholder="Nome do gestor no cliente"/>
        </div>

        {/* ── BLOCO 2: DATAS ── */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>Datas</div>
        <div className="form-grid">
          <div className="form-group"><label className="required">Início</label><input type="date" value={form.inicio} onChange={e=>set("inicio",e.target.value)}/></div>
          <div className="form-group"><label className="required">Término previsto</label><input type="date" value={form.terminoPrevisto} onChange={e=>set("terminoPrevisto",e.target.value)}/></div>
        </div>
        <div className="form-group">
          <label>Termo de Chaves / Vigilante</label>
          <input value={form.termoChaves} onChange={e=>set("termoChaves",e.target.value)} placeholder="Ex: 22/05 a 26/06 / vigilante 22 a 24/05"/>
        </div>

        {/* ── BLOCO 3: EMPRESAS ── */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>Empresas envolvidas</div>
        <div className="form-grid">
          <div className="form-group"><label>Construtora</label><input value={form.construtora} onChange={e=>set("construtora",e.target.value)} placeholder="Nome da construtora"/></div>
          <div className="form-group"><label>Contato construtora</label><input value={form.construtoraContato} onChange={e=>set("construtoraContato",e.target.value)} placeholder="Tel / e-mail / nome"/></div>
        </div>
        <div className="form-grid">
          <div className="form-group"><label>Instaladora</label><input value={form.instaladora} onChange={e=>set("instaladora",e.target.value)}/></div>
          <div className="form-group"><label>Fornecedor ACM / Portal</label><input value={form.fornecedorACM} onChange={e=>set("fornecedorACM",e.target.value)}/></div>
        </div>

        {/* ── BLOCO 4: CÓDIGOS ── */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>Códigos do cliente</div>
        <div className="form-grid">
          <div className="form-group"><label>Proj SAP</label><input value={form.projSAP} onChange={e=>set("projSAP",e.target.value)}/></div>
          <div className="form-group"><label>COD UPE</label><input value={form.codUPE} onChange={e=>set("codUPE",e.target.value)}/></div>
        </div>
        <div className="form-grid">
          <div className="form-group"><label>Reserva de Material</label><input value={form.reservaMaterial} onChange={e=>set("reservaMaterial",e.target.value)}/></div>
          <div className="form-group" style={{display:"flex",alignItems:"center",gap:8,paddingTop:20}}>
            <input type="checkbox" id="formAutodesk" checked={form.formAutodesk} onChange={e=>set("formAutodesk",e.target.checked)} style={{width:16,height:16,accentColor:"#1A1A1A"}}/>
            <label htmlFor="formAutodesk" style={{cursor:"pointer",fontSize:13,fontWeight:600}}>Form enviado na Autodesk</label>
          </div>
        </div>

        {/* ── BLOCO 5: GMUD ── */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>GMUD (Janela de Mudança)</div>
        <div className="form-grid">
          <div className="form-group"><label>Número da GMUD</label><input value={form.gmudNumero} onChange={e=>set("gmudNumero",e.target.value)} placeholder="Ex: GMUD-2026-001"/></div>
          <div className="form-group"><label>Data da janela</label><input type="date" value={form.gmudData} onChange={e=>set("gmudData",e.target.value)}/></div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Status GMUD</label>
            <select value={form.gmudStatus} onChange={e=>set("gmudStatus",e.target.value)}>
              {STATUS_GMUD.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Observação GMUD</label><input value={form.gmudObs} onChange={e=>set("gmudObs",e.target.value)} placeholder="Detalhes da janela"/></div>
        </div>

        {/* ── BLOCO 6: FINANCEIRO ── */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>Financeiro</div>
        <div className="form-grid">
          <div className="form-group"><label>Orç. Construtora (R$)</label><input type="number" value={form.orcConstrutora} onChange={e=>set("orcConstrutora",e.target.value)}/></div>
          <div className="form-group"><label>Orç. Instaladora (R$)</label><input type="number" value={form.orcInstaladora} onChange={e=>set("orcInstaladora",e.target.value)}/></div>
        </div>
        <div className="form-grid">
          <div className="form-group"><label>Medição construtora</label><input value={form.medicaoConstrutora} onChange={e=>set("medicaoConstrutora",e.target.value)}/></div>
          <div className="form-group" style={{display:"flex",alignItems:"center",gap:8,paddingTop:20}}>
            <input type="checkbox" id="envFin" checked={form.enviadoFinanceiro} onChange={e=>set("enviadoFinanceiro",e.target.checked)} style={{width:16,height:16,accentColor:"#1A1A1A"}}/>
            <label htmlFor="envFin" style={{cursor:"pointer",fontSize:13,fontWeight:600}}>Enviado ao financeiro</label>
          </div>
        </div>

        {/* ── BLOCO 7: DOCUMENTAÇÃO ── */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginTop:4}}>Documentação</div>
        <div className="form-grid">
          <div className="form-group"><label>Doc. Construtora</label><input value={form.docConstrutora} onChange={e=>set("docConstrutora",e.target.value)}/></div>
          <div className="form-group"><label>Doc. AFINE</label><input value={form.docAfine} onChange={e=>set("docAfine",e.target.value)}/></div>
        </div>
        <div className="form-group"><label>Entrada Gestor</label><input value={form.entradaGestor} onChange={e=>set("entradaGestor",e.target.value)}/></div>
      </div>
    </Modal>
  );
}

// ── DRAWER DE DETALHES ────────────────────────────────────────────────────────
function DrawerDetalhes({ demanda, onClose, onEdit, onRegistrarAtualizacao, onConfigurarEventos, addToast, isGestor }) {
  const { userProfile, currentUser } = useAuth();
  const historico = [...(demanda.historico || [])].reverse();

  async function excluirEntrada(idx) {
    if (!window.confirm("Remover esta entrada do histórico?")) return;
    const novoHist = [...(demanda.historico||[])];
    // idx é do array original (não invertido)
    const idxOriginal = (demanda.historico||[]).length - 1 - idx;
    novoHist.splice(idxOriginal, 1);
    try {
      await updateComAuditoria("gerenciamento", demanda.id, { historico: novoHist, updatedAt: new Date().toISOString() }, currentUser?.uid, userProfile?.nome);
    } catch(e) {}
  }

  const fmtMoeda = v => v ? `R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})}` : "–";

  return (
    <div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(520px,96vw)",background:"#fff",zIndex:200,boxShadow:"-4px 0 24px rgba(0,0,0,.18)",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{background:"#1A1A1A",padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <div style={{color:"#F5C400",fontWeight:700,fontSize:13}}>{demanda.agenciaNome}</div>
          <div style={{color:"rgba(255,255,255,.6)",fontSize:11,marginTop:2}}>{demanda.tipoDemanda}</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span className={`badge ${statusGerBadge(demanda.status)}`} style={{fontSize:10}}>{demanda.status}</span>
          {isGestor && <button onClick={onEdit} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:6,padding:"5px 10px",color:"#fff",cursor:"pointer",fontSize:12}}>✏️ Editar</button>}
          <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:20,padding:"0 2px",lineHeight:1}}>×</button>
        </div>
      </div>

      {/* Conteúdo rolável */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 18px"}}>

        {/* Resumo rápido */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          {[
            ["📅 Início", fmtDate(demanda.inicio)],
            ["📅 Término prev.", fmtDate(demanda.terminoPrevisto)],
            ["👤 Responsável", demanda.responsavel],
            ["🏢 Gestor cliente", demanda.gestorCliente||"–"],
            ["🏗️ Construtora", demanda.construtora||"–"],
            ["🔧 Instaladora", demanda.instaladora||"–"],
          ].map(([l,v])=>(
            <div key={l} style={{background:"#F3F2EF",borderRadius:7,padding:"7px 10px"}}>
              <div style={{fontSize:10,color:"#7A7A7A",marginBottom:2}}>{l}</div>
              <div style={{fontSize:12,fontWeight:600,color:"#1A1A1A"}}>{v||"–"}</div>
            </div>
          ))}
        </div>

        {/* Códigos */}
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>Códigos</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {demanda.projSAP && <span style={{background:"#EAF1FB",color:"#185FA5",padding:"2px 8px",borderRadius:8,fontSize:11,fontWeight:600}}>SAP: {demanda.projSAP}</span>}
          {demanda.codUPE && <span style={{background:"#F3F2EF",color:"#555",padding:"2px 8px",borderRadius:8,fontSize:11,fontWeight:600}}>UPE: {demanda.codUPE}</span>}
          {demanda.reservaMaterial && <span style={{background:"#FFFBEA",color:"#C9A200",padding:"2px 8px",borderRadius:8,fontSize:11,fontWeight:600}}>Reserva: {demanda.reservaMaterial}</span>}
          {demanda.formAutodesk && <span style={{background:"#EAF7EE",color:"#1E7A3C",padding:"2px 8px",borderRadius:8,fontSize:11,fontWeight:600}}>✓ Autodesk</span>}
        </div>

        {/* GMUD */}
        {(demanda.gmudNumero || demanda.gmudData) && (
          <>
            <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>GMUD</div>
            <div style={{background:"#FFFBEA",border:"1px solid #F5C400",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                {demanda.gmudNumero&&<span style={{fontSize:12}}><b>Nº:</b> {demanda.gmudNumero}</span>}
                {demanda.gmudData&&<span style={{fontSize:12}}><b>Data:</b> {fmtDate(demanda.gmudData)}</span>}
                <span style={{fontSize:12}}><b>Status:</b> {demanda.gmudStatus}</span>
              </div>
              {demanda.gmudObs&&<div style={{fontSize:11,color:"#7A7A7A",marginTop:4}}>{demanda.gmudObs}</div>}
            </div>
          </>
        )}

        {/* Financeiro */}
        {(demanda.orcConstrutora||demanda.orcInstaladora||demanda.enviadoFinanceiro) && (
          <>
            <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>Financeiro</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
              {demanda.orcConstrutora&&<span style={{background:"#F3F2EF",padding:"4px 10px",borderRadius:7,fontSize:12}}><b>Orç. Const.:</b> {fmtMoeda(demanda.orcConstrutora)}</span>}
              {demanda.orcInstaladora&&<span style={{background:"#F3F2EF",padding:"4px 10px",borderRadius:7,fontSize:12}}><b>Orç. Inst.:</b> {fmtMoeda(demanda.orcInstaladora)}</span>}
              {demanda.enviadoFinanceiro&&<span style={{background:"#EAF7EE",color:"#1E7A3C",padding:"4px 10px",borderRadius:7,fontSize:12,fontWeight:600}}>✓ Enviado ao financeiro</span>}
            </div>
          </>
        )}

        {/* Termo de Chaves */}
        {demanda.termoChaves && (
          <div style={{background:"#EAF1FB",border:"1px solid #185FA5",borderRadius:8,padding:"8px 12px",marginBottom:14,fontSize:12}}>
            🔑 <b>Termo de Chaves / Vigilante:</b> {demanda.termoChaves}
          </div>
        )}

        {/* Histórico */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em"}}>Histórico de atualizações</div>
          {isGestor && (
            <div style={{display:"flex",gap:4}}>
              <button onClick={onConfigurarEventos} style={{fontSize:11,padding:"3px 8px",background:"#F3F2EF",border:"1px solid #ddd",borderRadius:5,cursor:"pointer",color:"#555"}}>⚙️ Eventos</button>
              <button onClick={onRegistrarAtualizacao} style={{fontSize:11,padding:"3px 8px",background:"#1A1A1A",border:"none",borderRadius:5,cursor:"pointer",color:"#F5C400",fontWeight:700}}>+ Atualizar</button>
            </div>
          )}
        </div>

        {historico.length === 0 && (
          <div style={{textAlign:"center",color:"#aaa",fontSize:12,padding:"20px 0"}}>Nenhuma atualização registrada.</div>
        )}

        {historico.map((h,idx)=>(
          <div key={idx} style={{borderLeft:"3px solid #F5C400",paddingLeft:10,marginBottom:12,position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <div style={{fontSize:11,color:"#7A7A7A"}}>
                <b style={{color:"#1A1A1A"}}>{h.autor}</b> — {h.data ? new Date(h.data).toLocaleString("pt-BR") : ""}
              </div>
              {isGestor && (
                <button onClick={()=>excluirEntrada(idx)} style={{background:"none",border:"none",cursor:"pointer",color:"#BD3838",fontSize:12,padding:0}}>✕</button>
              )}
            </div>
            {(h.eventos||[]).map((ev,i)=>(
              <span key={i} style={{display:"inline-block",background:"#F3F2EF",padding:"1px 7px",borderRadius:8,fontSize:11,fontWeight:600,marginRight:4,marginBottom:3}}>✓ {ev}</span>
            ))}
            {h.nota && <div style={{fontSize:12,color:"#333",marginTop:4,lineHeight:1.5}}>{h.nota}</div>}
          </div>
        ))}
      </div>

      {/* Footer */}
      {!isGestor && (
        <div style={{padding:"10px 18px",borderTop:"1px solid #E2DFD8",background:"#fafafa"}}>
          <button onClick={onRegistrarAtualizacao} style={{width:"100%",padding:"10px",background:"#1A1A1A",border:"none",borderRadius:8,color:"#F5C400",fontWeight:700,fontSize:13,cursor:"pointer"}}>
            + Registrar atualização
          </button>
        </div>
      )}
    </div>
  );
}

// ── CARD DA DEMANDA ───────────────────────────────────────────────────────────
function CardDemanda({ d, onAbrir, onEdit, onExcluir, isGestor }) {
  const ultimaAtualizacao = d.historico?.length > 0
    ? d.historico[d.historico.length-1]
    : null;

  return (
    <div className="rdo-card" style={{borderLeft:`4px solid ${d.status==="CONCLUÍDA"?"var(--verde)":d.status==="EXECUÇÃO"?"#185FA5":d.status==="SUSPENSA"||d.status==="CANCELADA"?"var(--vermelho)":"#C9A200"}`,cursor:"pointer",marginBottom:8}} onClick={onAbrir}>
      <div className="rdo-header">
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{d.agenciaNome}</div>
          <div style={{fontSize:11,color:"#7A7A7A"}}>{d.tipoDemanda} · {d.clienteNome}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
            {d.responsavel&&<span style={{fontSize:11,color:"#555"}}>👤 {d.responsavel}</span>}
            {d.construtora&&<span style={{fontSize:11,color:"#555"}}>🏗️ {d.construtora}</span>}
            {d.terminoPrevisto&&<span style={{fontSize:11,color:"#555"}}>📅 {fmtDate(d.terminoPrevisto)}</span>}
          </div>
          {ultimaAtualizacao && (
            <div style={{fontSize:10,color:"#aaa",marginTop:4}}>
              Última atualização: {new Date(ultimaAtualizacao.data).toLocaleDateString("pt-BR")} por {ultimaAtualizacao.autor}
            </div>
          )}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <span className={`badge ${statusGerBadge(d.status)}`} style={{fontSize:10}}>{d.status}</span>
          {d.gmudNumero&&<span style={{background:"#FFFBEA",color:"#C9A200",fontSize:10,padding:"1px 6px",borderRadius:8,fontWeight:600}}>GMUD: {d.gmudStatus}</span>}
          <div style={{display:"flex",gap:4}}>
            <button className="btn btn-sm btn-icon" onClick={()=>onEdit(d)} title="Editar">✏️</button>
            {isGestor&&<button className="btn btn-sm btn-icon" onClick={()=>onExcluir(d)} title="Excluir" style={{color:"var(--vermelho)"}}>🗑️</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────
export default function Gerenciamento() {
  const { userProfile, currentUser } = useAuth();
  const isGestor = isGestorOuAdm(userProfile);
  const isCampoUser = isCampoHelper(userProfile);
  const { toasts, addToast } = useToast();

  const [demandas, setDemandas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState("lista");
  const [search, setSearch] = useState("");
  const [clienteExpandido, setClienteExpandido] = useState(null);

  // Modais
  const [modalDemanda, setModalDemanda] = useState(null);  // null | {demanda?}
  const [drawerAberto, setDrawerAberto] = useState(null);  // demanda selecionada
  const [modalAtualizacao, setModalAtualizacao] = useState(null);
  const [modalEventos, setModalEventos] = useState(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(null);

  // Dados
  useEffect(()=>{
    const u1 = onSnapshot(collection(db,"gerenciamento"), snap=>{
      setDemandas(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db,"clientes"), snap=>{
      setClientes(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return ()=>{u1();u2();};
  },[]);

  // Filtro por permissão Campo (só vê demandas onde está alocado como responsável)
  const demandasVisiveis = useMemo(()=>{
    if (isCampoUser) {
      const nome = userProfile?.nome||"";
      return demandas.filter(d=>d.responsavel?.includes(nome));
    }
    return demandas;
  },[demandas, isCampoUser, userProfile]);

  const hoje = new Date().toISOString().split("T")[0];

  // Separa ativas x concluídas/canceladas
  const demandasAtivas    = useMemo(()=>demandasVisiveis.filter(d=>!["CONCLUÍDA","CANCELADA","FINALIZADA — EXEC. DOCUMENTAÇÃO"].includes(d.status)),[demandasVisiveis]);
  const demandasConcluidas = useMemo(()=>demandasVisiveis.filter(d=>["CONCLUÍDA","CANCELADA","FINALIZADA — EXEC. DOCUMENTAÇÃO"].includes(d.status)),[demandasVisiveis]);

  // KPIs
  const kpiExecucao    = demandasAtivas.filter(d=>["EXECUÇÃO","ANDAMENTO DEMANDA EXTRA"].includes(d.status)).length;
  const kpiAgendamento = demandasAtivas.filter(d=>["AGENDAMENTO","SOLICITAÇÃO MATERIAL"].includes(d.status)).length;
  const kpiSuspenso    = demandasAtivas.filter(d=>d.status==="SUSPENSA").length;
  const kpiConcluidoMes= demandasConcluidas.filter(d=>{
    const u = d.updatedAt||"";
    const mesAtual = new Date().toISOString().slice(0,7);
    return u.startsWith(mesAtual);
  }).length;

  // Filtered lista ativa
  const filtered = useMemo(()=>{
    const q = search.toLowerCase();
    return demandasAtivas.filter(d=>
      !q || d.agenciaNome?.toLowerCase().includes(q) || d.clienteNome?.toLowerCase().includes(q) ||
      d.tipoDemanda?.toLowerCase().includes(q) || d.responsavel?.toLowerCase().includes(q)
    );
  },[demandasAtivas, search]);

  // Agrupamento por cliente
  function buildPorCliente(lista) {
    const map = {};
    lista.forEach(d=>{
      const cli = d.clienteNome||"Sem cliente";
      if(!map[cli]) map[cli]={nome:cli,agencias:{}};
      const ag = d.agenciaNome||"Sem agência";
      if(!map[cli].agencias[ag]) map[cli].agencias[ag]=[];
      map[cli].agencias[ag].push(d);
    });
    return Object.values(map).sort((a,b)=>a.nome.localeCompare(b.nome));
  }

  const porCliente           = useMemo(()=>buildPorCliente(demandasAtivas),    [demandasAtivas]);
  const porClienteConcluidas = useMemo(()=>buildPorCliente(demandasConcluidas),[demandasConcluidas]);

  async function excluir(id, nome) {
    try {
      await deleteDoc(doc(db,"gerenciamento",id));
      addToast(`"${nome}" excluída.`);
      if (drawerAberto?.id===id) setDrawerAberto(null);
    } catch(e) { addToast("Erro: "+e.message,"error"); }
    setConfirmarExclusao(null);
  }

  // Sincroniza drawer com dados atualizados
  useEffect(()=>{
    if (drawerAberto) {
      const atualizado = demandas.find(d=>d.id===drawerAberto.id);
      if (atualizado) setDrawerAberto(atualizado);
    }
  },[demandas]);

  return (
    <div className="page">
      {/* Toast */}
      <div className="toast-container">
        {toasts.map(t=><div key={t.id} className={`toast toast-${t.type||"success"}`}>{t.message}</div>)}
      </div>

      {/* Header */}
      <div className="panel-header">
        <div>
          <h1>Gerenciamento</h1>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{demandasVisiveis.length} demanda(s) · {demandasAtivas.length} em andamento</div>
        </div>
        {isGestor && (
          <button className="btn btn-primary" onClick={()=>setModalDemanda({})}>+ Nova demanda</button>
        )}
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:16}}>
        <div className="metric" style={{borderLeft:"3px solid #185FA5"}}>
          <div className="metric-label">Em execução</div>
          <div className="metric-value blue">{kpiExecucao}</div>
        </div>
        <div className="metric" style={{borderLeft:"3px solid #C9A200"}}>
          <div className="metric-label">Agendamentos</div>
          <div className="metric-value amber">{kpiAgendamento}</div>
        </div>
        <div className="metric" style={{borderLeft:"3px solid var(--vermelho)"}}>
          <div className="metric-label">Suspensos</div>
          <div className="metric-value red">{kpiSuspenso}</div>
        </div>
        <div className="metric" style={{borderLeft:"3px solid var(--verde)"}}>
          <div className="metric-label">Concluídos no mês</div>
          <div className="metric-value green">{kpiConcluidoMes}</div>
        </div>
      </div>

      {/* Abas */}
      {!isCampoUser && (
        <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",flexWrap:"wrap"}}>
          {[
            {id:"lista",      label:"📋 Lista completa"},
            {id:"por_cliente",label:"🏢 Por cliente"},
            {id:"concluidas", label:`✅ Concluídas (${demandasConcluidas.length})`},
          ].map((a,i,arr)=>(
            <button key={a.id} onClick={()=>setAba(a.id)}
              style={{flex:"1 1 auto",padding:"9px 10px",border:"none",cursor:"pointer",
                background:aba===a.id?"#1A1A1A":"var(--cinza-lt)",
                color:aba===a.id?"#F5C800":"#4A4A4A",
                borderRight:i<arr.length-1?"1px solid var(--border)":"none",
                fontSize:11,fontWeight:aba===a.id?700:400,whiteSpace:"nowrap"}}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* ── ABA: LISTA ── */}
      {(aba==="lista"||isCampoUser) && (<>
        <div className="search-bar">🔍<input placeholder="Buscar por agência, cliente, tipo ou responsável..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
        {loading && <div className="spinner"/>}
        {!loading && filtered.length===0 && (
          <div className="empty-state"><div className="empty-icon">📋</div><p>Nenhuma demanda encontrada</p></div>
        )}
        {filtered.map(d=>(
          <CardDemanda key={d.id} d={d} isGestor={isGestor}
            onAbrir={()=>setDrawerAberto(d)}
            onEdit={()=>setModalDemanda({demanda:d})}
            onExcluir={()=>setConfirmarExclusao({id:d.id,nome:d.agenciaNome||d.tipoDemanda})}
          />
        ))}
      </>)}

      {/* ── ABA: POR CLIENTE ── */}
      {aba==="por_cliente" && !isCampoUser && (
        <div>
          {porCliente.length===0&&<div className="empty-state"><div className="empty-icon">🏢</div><p>Nenhuma demanda ativa</p></div>}
          {porCliente.map(cli=>(
            <div key={cli.nome} style={{marginBottom:12}}>
              <button onClick={()=>setClienteExpandido(clienteExpandido===cli.nome?null:cli.nome)}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"10px 14px",border:"none",borderRadius:8,cursor:"pointer",
                  background:"#1A1A1A",color:"#fff",textAlign:"left",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16}}>🏢</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#F5C400"}}>{cli.nome}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:1}}>
                      {Object.values(cli.agencias).flat().length} demanda(s) · {Object.keys(cli.agencias).length} agência(s)
                    </div>
                  </div>
                </div>
                <span style={{color:"#F5C400",fontSize:12,transform:clienteExpandido===cli.nome?"rotate(180deg)":"",transition:"transform .2s"}}>▼</span>
              </button>
              {clienteExpandido===cli.nome && Object.entries(cli.agencias).sort((a,b)=>a[0].localeCompare(b[0])).map(([ag,demandas])=>(
                <div key={ag} style={{marginLeft:16,marginBottom:8}}>
                  <div style={{fontWeight:600,fontSize:12,padding:"6px 10px",background:"var(--cinza-lt)",borderRadius:6,marginBottom:4,display:"flex",alignItems:"center",gap:6,borderLeft:"3px solid var(--afine-yellow)"}}>
                    📍 {ag}
                    <span style={{fontSize:11,fontWeight:400,color:"#7A7A7A"}}>({demandas.length} demanda{demandas.length>1?"s":""})</span>
                  </div>
                  <div style={{marginLeft:8}}>
                    {demandas.map(d=>(
                      <CardDemanda key={d.id} d={d} isGestor={isGestor}
                        onAbrir={()=>setDrawerAberto(d)}
                        onEdit={()=>setModalDemanda({demanda:d})}
                        onExcluir={()=>setConfirmarExclusao({id:d.id,nome:d.agenciaNome||d.tipoDemanda})}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── ABA: CONCLUÍDAS ── */}
      {aba==="concluidas" && !isCampoUser && (
        <div>
          <div className="search-bar">🔍<input placeholder="Buscar nas concluídas..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {porClienteConcluidas
            .map(cli=>({
              ...cli,
              agencias: Object.fromEntries(
                Object.entries(cli.agencias).map(([ag,ds])=>[ag,
                  ds.filter(d=>!search||d.agenciaNome?.toLowerCase().includes(search.toLowerCase())||d.tipoDemanda?.toLowerCase().includes(search.toLowerCase()))
                ]).filter(([,ds])=>ds.length>0)
              )
            }))
            .filter(cli=>Object.keys(cli.agencias).length>0)
            .map(cli=>(
            <div key={cli.nome} style={{marginBottom:12}}>
              <button onClick={()=>setClienteExpandido(clienteExpandido===("c_"+cli.nome)?null:("c_"+cli.nome))}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"10px 14px",border:"none",borderRadius:8,cursor:"pointer",
                  background:"#1A1A1A",color:"#fff",textAlign:"left",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span>🏢</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:"#F5C400"}}>{cli.nome}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:1}}>
                      {Object.values(cli.agencias).flat().length} concluída(s)
                    </div>
                  </div>
                </div>
                <span style={{color:"#F5C400",fontSize:12,transform:clienteExpandido===("c_"+cli.nome)?"rotate(180deg)":"",transition:"transform .2s"}}>▼</span>
              </button>
              {clienteExpandido===("c_"+cli.nome) && Object.entries(cli.agencias).map(([ag,ds])=>(
                <div key={ag} style={{marginLeft:16,marginBottom:8}}>
                  <div style={{fontWeight:600,fontSize:12,padding:"6px 10px",background:"var(--cinza-lt)",borderRadius:6,marginBottom:4,borderLeft:"3px solid var(--verde)"}}>
                    📍 {ag} <span style={{fontSize:11,fontWeight:400,color:"#7A7A7A"}}>({ds.length})</span>
                  </div>
                  <div style={{marginLeft:8}}>
                    {ds.map(d=>(
                      <CardDemanda key={d.id} d={d} isGestor={isGestor}
                        onAbrir={()=>setDrawerAberto(d)}
                        onEdit={()=>setModalDemanda({demanda:d})}
                        onExcluir={()=>setConfirmarExclusao({id:d.id,nome:d.agenciaNome||d.tipoDemanda})}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── DRAWER DE DETALHES ── */}
      {drawerAberto && (
        <>
          <DrawerDetalhes
            demanda={drawerAberto}
            isGestor={isGestor}
            onClose={()=>setDrawerAberto(null)}
            onEdit={()=>setModalDemanda({demanda:drawerAberto})}
            onRegistrarAtualizacao={()=>setModalAtualizacao(drawerAberto)}
            onConfigurarEventos={()=>setModalEventos(drawerAberto)}
            addToast={addToast}
          />
          <div onClick={()=>setDrawerAberto(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:199}}/>
        </>
      )}

      {/* ── MODAIS ── */}
      {modalDemanda && (
        <DemandaModal
          demanda={modalDemanda.demanda}
          clientes={clientes}
          onClose={()=>setModalDemanda(null)}
          addToast={addToast}
        />
      )}
      {modalAtualizacao && (
        <ModalAtualizacao
          demanda={modalAtualizacao}
          onClose={()=>setModalAtualizacao(null)}
          addToast={addToast}
        />
      )}
      {modalEventos && (
        <ModalConfigurarEventos
          demanda={modalEventos}
          onClose={()=>setModalEventos(null)}
          addToast={addToast}
        />
      )}
      {confirmarExclusao && (
        <ModalExclusao
          nome={confirmarExclusao.nome}
          onCancelar={()=>setConfirmarExclusao(null)}
          onConfirmar={()=>excluir(confirmarExclusao.id,confirmarExclusao.nome)}
        />
      )}
    </div>
  );
}
