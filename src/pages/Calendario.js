// src/pages/Calendario.js — Hub de agendamento visual
import React, { useState } from "react";
import { useAgenda } from "../contexts/AgendaContext";
import { useAuth } from "../contexts/AuthContext";
import { isCampo } from "../constants/departamentos";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { initials } from "../utils/helpers";

// Paleta de cores por tipo de demanda
const CORES_DEMANDA = [
  "#1A1A1A","#185FA5","#2D6A1F","#8A1F1F","#7B4F00",
  "#1A4A6E","#4A1A6E","#006E4A","#6E1A3A","#4A4A00",
];
function corDemanda(id="") {
  let h=0; for(let c of id) h=(h*31+c.charCodeAt(0))%CORES_DEMANDA.length;
  return CORES_DEMANDA[h];
}

// Gera todos os dias de um mês
function diasDoMes(ano, mes) {
  const dias = [];
  const total = new Date(ano, mes+1, 0).getDate();
  for (let d=1; d<=total; d++) dias.push(new Date(ano,mes,d));
  return dias;
}

function toISO(date) {
  return date.toISOString().split("T")[0];
}

// Modal de novo agendamento
function AgendaModal({ diaInicial, onClose, addToast }) {
  const { obras, manutencoes, funcionarios, criarAgendamento, atualizarAgendamento, funcOcupado } = useAgenda();
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    titulo: "", demandaTipo: "obra", demandaId: "",
    dataInicio: diaInicial || new Date().toISOString().split("T")[0],
    dataFim:    diaInicial || new Date().toISOString().split("T")[0],
    turno: "integral", obs: "",
    funcionarios: [],
  });
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  const demandas = form.demandaTipo==="obra" ? obras : manutencoes;
  const demandaSel = demandas.find(d=>d.id===form.demandaId);

  function handleDemanda(id) {
    const d = demandas.find(x=>x.id===id);
    set("demandaId",id);
    if (d) set("titulo", d.nome||d.titulo||"");
  }

  function toggleFunc(id) {
    setForm(p=>({...p,
      funcionarios: p.funcionarios.includes(id)
        ? p.funcionarios.filter(x=>x!==id)
        : [...p.funcionarios,id]
    }));
  }

  async function save() {
    if (!form.demandaId) { alert("Selecione a demanda."); return; }
    if (!form.dataInicio||!form.dataFim) { alert("Informe as datas."); return; }
    if (form.dataFim < form.dataInicio) { alert("Data fim anterior à data início."); return; }
    setSaving(true);
    const demanda = demandas.find(d=>d.id===form.demandaId);
    const payload = {
      ...form,
      demandaNome: demanda?.nome||demanda?.titulo||"",
      autor: userProfile?.nome||"–",
    };
    try {
      await criarAgendamento(payload);
      addToast("Agendamento criado!");
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  // Verifica conflitos
  const conflitos = form.funcionarios.filter(id =>
    funcOcupado(id, form.dataInicio, form.dataFim)
  );

  return (
    <Modal title="Novo agendamento" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar agendamento"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        <div className="form-grid">
          <div className="form-group"><label className="required">Tipo de demanda</label>
            <select value={form.demandaTipo} onChange={e=>{set("demandaTipo",e.target.value);set("demandaId","");}}>
              <option value="obra">Obra</option>
              <option value="manutencao">Manutenção</option>
            </select>
          </div>
          <div className="form-group"><label className="required">Demanda</label>
            <select value={form.demandaId} onChange={e=>handleDemanda(e.target.value)}>
              <option value="">Selecione...</option>
              {demandas.map(d=><option key={d.id} value={d.id}>{d.nome||d.titulo}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="required">Data início</label>
            <input type="date" value={form.dataInicio} onChange={e=>set("dataInicio",e.target.value)}/>
          </div>
          <div className="form-group"><label className="required">Data fim</label>
            <input type="date" value={form.dataFim} onChange={e=>set("dataFim",e.target.value)}/>
          </div>
          <div className="form-group"><label>Turno</label>
            <select value={form.turno} onChange={e=>set("turno",e.target.value)}>
              {["integral","manhã","tarde","noturno","fim de semana"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Seleção de funcionários */}
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
            Funcionários alocados
          </div>
          {conflitos.length>0 && (
            <div className="alert alert-warning" style={{marginBottom:8,fontSize:12}}>
              ⚠️ <strong>{conflitos.length} funcionário(s)</strong> já têm agendamento neste período — verifique antes de salvar.
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:200,overflowY:"auto"}}>
            {funcionarios.map(f => {
              const ocupado = funcOcupado(f.id||f.uid, form.dataInicio, form.dataFim);
              const sel = form.funcionarios.includes(f.id||f.uid);
              return (
                <label key={f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",borderRadius:6,cursor:"pointer",
                  background:sel?"var(--afine-yellow-lt)":ocupado?"rgba(184,50,50,.06)":"var(--cinza-lt)",
                  border:`1px solid ${sel?"var(--afine-yellow-dk)":ocupado?"rgba(184,50,50,.2)":"var(--border)"}`,
                  transition:".15s"}}>
                  <input type="checkbox" checked={sel} onChange={()=>toggleFunc(f.id||f.uid)} style={{width:15,height:15}}/>
                  <div className="user-avatar" style={{width:28,height:28,fontSize:10,flexShrink:0}}>{initials(f.nome)}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500}}>{f.nome}</div>
                    <div style={{fontSize:11,color:"#7A7A7A"}}>{f.funcao}</div>
                  </div>
                  {ocupado && <span className="badge badge-amber" style={{fontSize:9}}>⚠ Ocupado</span>}
                  {sel && !ocupado && <span className="badge badge-green" style={{fontSize:9}}>✓ Alocado</span>}
                </label>
              );
            })}
          </div>
          {form.funcionarios.length>0 && (
            <div style={{fontSize:12,color:"var(--verde)",marginTop:6}}>
              ✓ {form.funcionarios.length} funcionário(s) selecionado(s)
            </div>
          )}
        </div>

        <div className="form-group"><label>Observações</label>
          <textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/>
        </div>
      </div>
    </Modal>
  );
}

// Card de evento no calendário
function EventoCard({ ag, funcionarios }) {
  const [open, setOpen] = useState(false);
  const cor = corDemanda(ag.demandaId);
  const funcs = funcionarios.filter(f=>
    (ag.funcionarios||[]).includes(f.id)||
    (ag.funcionarios||[]).includes(f.uid)
  );
  return (
    <div
      onClick={e=>{e.stopPropagation();setOpen(!open);}}
      style={{background:cor,color:"#fff",borderRadius:4,padding:"2px 6px",
        marginBottom:2,fontSize:11,cursor:"pointer",position:"relative",
        userSelect:"none",transition:".1s",opacity:.92}}>
      <div style={{fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>
        {ag.demandaNome||ag.titulo}
      </div>
      {funcs.length>0&&<div style={{fontSize:9,opacity:.8}}>{funcs.map(f=>f.nome.split(" ")[0]).join(", ")}</div>}
      {open&&(
        <div onClick={e=>e.stopPropagation()}
          style={{position:"absolute",top:"100%",left:0,zIndex:50,background:"#1A1A1A",color:"#fff",borderRadius:8,
            padding:10,minWidth:200,boxShadow:"0 8px 30px rgba(0,0,0,.4)",marginTop:4}}>
          <div style={{fontWeight:700,marginBottom:6}}>{ag.demandaNome}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginBottom:6}}>
            {ag.dataInicio} → {ag.dataFim} · {ag.turno}
          </div>
          {funcs.length>0&&(
            <div>
              <div style={{fontSize:10,color:"var(--afine-yellow)",marginBottom:4,fontWeight:600}}>EQUIPE ALOCADA</div>
              {funcs.map(f=>(
                <div key={f.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                  <div className="user-avatar" style={{width:20,height:20,fontSize:8,flexShrink:0,background:"var(--afine-yellow)",color:"#1A1A1A"}}>{initials(f.nome)}</div>
                  <span style={{fontSize:12}}>{f.nome}</span>
                  <span style={{fontSize:10,opacity:.5}}>· {f.funcao}</span>
                </div>
              ))}
            </div>
          )}
          {ag.obs&&<div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:6,borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:6}}>{ag.obs}</div>}
        </div>
      )}
    </div>
  );
}

export default function Calendario() {
  const { agendamentos, obras, funcionarios, loading } = useAgenda();
  const { userProfile, currentUser } = useAuth();
  const souCampo = isCampo(userProfile);
  const { toasts, addToast } = useToast();
  const hoje = new Date();
  const [mes,  setMes]  = useState(hoje.getMonth());
  const [ano,  setAno]  = useState(hoje.getFullYear());
  const [modal,setModal]= useState(null); // null | { dia: "YYYY-MM-DD" }
  const [vista,setVista]= useState("mes"); // "mes" | "semana"

  // Obras em que o usuário de campo está alocado (via equipeIds[]) — mostrado
  // como informação fixa na agenda, independente de haver agendamento datado
  const minhasObras = souCampo ? obras.filter(o => (o.equipeIds||[]).includes(currentUser?.uid)) : [];

  const dias = diasDoMes(ano, mes);
  const primeiroDia = new Date(ano, mes, 1).getDay(); // 0=dom
  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  function navMes(delta) {
    let m = mes+delta, a = ano;
    if(m<0){m=11;a--;}else if(m>11){m=0;a++;}
    setMes(m); setAno(a);
  }

  // Agendamentos que ocorrem em determinado dia
  function agsNoDia(diaISO) {
    return agendamentos.filter(a => a.dataInicio<=diaISO && a.dataFim>=diaISO);
  }

  const hojeISO = toISO(hoje);

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-title">Calendário</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{agendamentos.length} agendamentos · {MESES[mes]} {ano}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{display:"flex",border:"1px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
            <button className="btn btn-sm" style={{borderRadius:0,border:"none",background:vista==="mes"?"#1A1A1A":"",color:vista==="mes"?"#F5C800":""}} onClick={()=>setVista("mes")}>Mês</button>
            <button className="btn btn-sm" style={{borderRadius:0,border:"none",background:vista==="semana"?"#1A1A1A":"",color:vista==="semana"?"#F5C800":""}} onClick={()=>setVista("semana")}>Semana</button>
          </div>
          <button className="btn btn-primary" onClick={()=>setModal({dia:hojeISO})}>+ Agendar</button>
        </div>
      </div>

      {/* Navegação de mês */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button className="btn btn-sm" onClick={()=>navMes(-1)}>◀</button>
        <div style={{fontSize:16,fontWeight:700,minWidth:180,textAlign:"center"}}>{MESES[mes]} {ano}</div>
        <button className="btn btn-sm" onClick={()=>navMes(1)}>▶</button>
        <button className="btn btn-sm" onClick={()=>{setMes(hoje.getMonth());setAno(hoje.getFullYear());}}>Hoje</button>
      </div>

      {/* Alocação atual em obras — visível só para Campo */}
      {souCampo && minhasObras.length>0 && (
        <div className="alert alert-info" style={{marginBottom:16,display:"flex",flexDirection:"column",gap:6}}>
          <div style={{fontWeight:600,fontSize:13}}>🏗️ Você está alocado em {minhasObras.length} obra(s):</div>
          {minhasObras.map(o=>(
            <div key={o.id} style={{fontSize:12,display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontWeight:600}}>{o.nome}</span>
              {o.cliente && <span style={{color:"#7A7A7A"}}>· {o.cliente}</span>}
              {o.logradouro && <span style={{color:"#7A7A7A"}}>· {o.logradouro}, {o.numero}</span>}
            </div>
          ))}
        </div>
      )}

      {loading && <div className="spinner"/>}

      {/* Grade do calendário */}
      {!loading && (
        <div style={{background:"var(--afine-white)",border:"1px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
          {/* Cabeçalho dias da semana */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"#1A1A1A"}}>
            {SEMANA.map(d=>(
              <div key={d} style={{textAlign:"center",padding:"10px 4px",fontSize:11,fontWeight:700,color:"#F5C800",letterSpacing:".05em"}}>
                {d}
              </div>
            ))}
          </div>

          {/* Grade dias */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {/* Células vazias antes do primeiro dia */}
            {Array.from({length:primeiroDia}).map((_,i)=>(
              <div key={`vazio-${i}`} style={{minHeight:100,padding:6,background:"#FAFAF8",borderRight:"1px solid var(--border)",borderBottom:"1px solid var(--border)"}}/>
            ))}

            {/* Dias do mês */}
            {dias.map(dia=>{
              const dISO = toISO(dia);
              const ags  = agsNoDia(dISO);
              const isHoje = dISO===hojeISO;
              const isFDS  = dia.getDay()===0||dia.getDay()===6;
              return (
                <div key={dISO}
                  onClick={()=>setModal({dia:dISO})}
                  style={{
                    minHeight:100, padding:"6px 4px",
                    borderRight:"1px solid var(--border)",
                    borderBottom:"1px solid var(--border)",
                    background: isHoje?"rgba(245,200,0,.06)":isFDS?"rgba(0,0,0,.015)":"var(--afine-white)",
                    cursor:"pointer", transition:".15s",
                    position:"relative",
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background=isHoje?"rgba(245,200,0,.1)":"rgba(0,0,0,.03)"}
                  onMouseLeave={e=>e.currentTarget.style.background=isHoje?"rgba(245,200,0,.06)":isFDS?"rgba(0,0,0,.015)":"var(--afine-white)"}
                >
                  {/* Número do dia */}
                  <div style={{
                    width:24, height:24, borderRadius:"50%", display:"flex",
                    alignItems:"center", justifyContent:"center",
                    marginBottom:4, fontSize:13, fontWeight:isHoje?700:400,
                    background:isHoje?"#1A1A1A":"transparent",
                    color:isHoje?"#F5C800":isFDS?"#7A7A7A":"#1A1A1A",
                  }}>
                    {dia.getDate()}
                  </div>
                  {/* Eventos */}
                  {ags.slice(0,3).map(ag=>(
                    <EventoCard key={ag.id} ag={ag} funcionarios={funcionarios}/>
                  ))}
                  {ags.length>3&&(
                    <div style={{fontSize:10,color:"#7A7A7A",padding:"1px 4px"}}>+{ags.length-3} mais</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legenda */}
      {agendamentos.length>0&&(
        <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
          {[...new Set(agendamentos.map(a=>a.demandaId))].slice(0,8).map(id=>{
            const ag=agendamentos.find(a=>a.demandaId===id);
            return ag?(
              <div key={id} style={{display:"flex",alignItems:"center",gap:5,fontSize:11}}>
                <div style={{width:10,height:10,borderRadius:2,background:corDemanda(id),flexShrink:0}}/>
                {ag.demandaNome}
              </div>
            ):null;
          })}
        </div>
      )}

      {modal&&(
        <AgendaModal
          diaInicial={modal.dia}
          onClose={()=>setModal(null)}
          addToast={addToast}
        />
      )}
    </div>
  );
}
