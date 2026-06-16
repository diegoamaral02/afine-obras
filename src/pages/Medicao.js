// src/pages/Medicao.js — Boletim de Medição + FVS integrados
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { addComAuditoria } from "../services/auditoria";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";

// Checklist padrão FVS por tipo de serviço
const FVS_CHECKLISTS = {
  "Elétrica":      ["Eletrodutos instalados corretamente","Cabos passados sem emendas","Caixas fixadas e niveladas","Disjuntores corretos","Teste de continuidade realizado","Identificação dos circuitos"],
  "Hidráulica":    ["Tubulações sem vazamento","Inclinações corretas","Registros funcionando","Teste de pressão realizado","Soldas/conexões verificadas"],
  "Drywall":       ["Guias fixadas no prumo","Montantes no espaçamento correto","Placas sem trincas","Fitas e massa aplicadas","Superfície lixada e pronta"],
  "Pintura":       ["Superfície limpa e lixada","Massa corrida aplicada","1ª demão aplicada","2ª demão aplicada","Acabamentos e rodapés","Sem manchas ou escorrimentos"],
  "Revestimento":  ["Argamassa na espessura correta","Peças alinhadas e niveladas","Rejunte uniforme","Cantos e bordas acabados","Limpeza final realizada"],
  "Cabeamento":    ["Infraestrutura instalada","Cabos passados corretamente","Conectores certificados","Teste de enlace realizado","Patch panel organizado","Identificação dos pontos"],
  "Forro":         ["Estrutura metálica alinhada","Placas sem danos","Juntas regulares","Bordas acabadas","Iluminação integrada"],
  "Geral":         ["Serviço dentro do escopo","Qualidade aceitável","Limpeza realizada","Materiais conforme especificação","Sem não-conformidades visíveis"],
};

function FVSModal({ fvs, obraId, escopoNome, onClose, addToast }) {
  const { userProfile } = useAuth();
  const [tipo, setTipo]           = useState(fvs?.tipo || "Geral");
  const [checks, setChecks]       = useState(fvs?.checks || {});
  const [obs, setObs]             = useState(fvs?.obs || "");
  const [resultado, setResultado] = useState(fvs?.resultado || "APROVADO");
  const [saving, setSaving]       = useState(false);
  const lista = FVS_CHECKLISTS[tipo] || FVS_CHECKLISTS["Geral"];

  // Reset checks when tipo changes
  function handleTipo(t) { setTipo(t); setChecks({}); }
  function toggleCheck(item) { setChecks(p => ({ ...p, [item]: !p[item] })); }

  const totalOk = lista.filter(i => checks[i]).length;
  const pct     = Math.round(totalOk / lista.length * 100);

  async function save() {
    if (totalOk < lista.length && resultado === "APROVADO") {
      if (!window.confirm(`Nem todos os itens foram marcados (${totalOk}/${lista.length}). Confirma como APROVADO mesmo assim?`)) return;
    }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = {
      obraId, escopoNome, tipo, checks, obs, resultado,
      totalItens: lista.length, totalOk, pct,
      inspetor: userProfile?.nome || "–",
      data: agora.split("T")[0],
      updatedAt: agora,
    };
    try {
      if (fvs?.id) { await updateDoc(doc(db, "fvs", fvs.id), payload); addToast("FVS atualizada!"); }
      else { payload.createdAt = agora; await addDoc(collection(db, "fvs"), payload); addToast("FVS registrada!"); }
      onClose();
    } catch (err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title="Ficha de Verificação de Serviço (FVS)" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar FVS"}</button></>}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

        {/* Cabeçalho */}
        <div style={{ background:"#1A1A1A", borderRadius:8, padding:12, color:"#fff" }}>
          <div style={{ fontWeight:600, fontSize:14 }}>FVS — {escopoNome}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,.5)", marginTop:2 }}>Inspetor: {userProfile?.nome} · {new Date().toLocaleDateString("pt-BR")}</div>
        </div>

        <div className="form-grid">
          <div className="form-group"><label>Tipo de serviço</label>
            <select value={tipo} onChange={e => handleTipo(e.target.value)}>
              {Object.keys(FVS_CHECKLISTS).map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Resultado</label>
            <select value={resultado} onChange={e => setResultado(e.target.value)}
              style={{ background: resultado==="APROVADO"?"var(--verde-lt)":resultado==="REPROVADO"?"var(--vermelho-lt)":"var(--amarelo-lt)", fontWeight:600 }}>
              <option>APROVADO</option>
              <option>APROVADO COM RESSALVAS</option>
              <option>REPROVADO</option>
            </select>
          </div>
        </div>

        {/* Progresso */}
        <div style={{ background:"var(--cinza-lt)", borderRadius:8, padding:10 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
            <span>Itens verificados</span>
            <strong style={{ color: pct===100?"var(--verde)":pct>50?"var(--afine-yellow-dk)":"var(--vermelho)" }}>{totalOk}/{lista.length} ({pct}%)</strong>
          </div>
          <div className="progress-bar" style={{ height:8 }}>
            <div className="progress-fill" style={{ width:`${pct}%`, background: pct===100?"var(--verde)":pct>50?"var(--afine-yellow-dk)":"var(--vermelho)" }}/>
          </div>
        </div>

        {/* Checklist */}
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {lista.map(item => (
            <label key={item} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:6, cursor:"pointer",
              background: checks[item] ? "var(--verde-lt)" : "var(--cinza-lt)",
              border:`1px solid ${checks[item] ? "rgba(45,106,31,.2)" : "var(--border)"}`, transition:".15s" }}>
              <input type="checkbox" checked={!!checks[item]} onChange={() => toggleCheck(item)} style={{ width:16, height:16 }}/>
              <span style={{ fontSize:13, color: checks[item] ? "var(--verde)" : "#1A1A1A", fontWeight: checks[item] ? 500 : 400 }}>{item}</span>
              {checks[item] && <span style={{ marginLeft:"auto", fontSize:16 }}>✓</span>}
            </label>
          ))}
        </div>

        <div className="form-group"><label>Observações / ressalvas</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Registre qualquer ressalva ou não-conformidade..." rows={3}/>
        </div>
      </div>
    </Modal>
  );
}

function BoletiModal({ bm, obraId, escopos, onClose, addToast }) {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    numero: bm?.numero || "",
    periodo: bm?.periodo || "",
    obs: bm?.obs || "",
    status: bm?.status || "RASCUNHO",
  });
  const [itens, setItens] = useState(bm?.itens || []);
  const [saving, setSaving] = useState(false);
  function set(f, v) { setForm(p => ({...p, [f]: v})); }

  function addItem(esc) {
    if (itens.find(i => i.escopoId === esc.id)) return;
    setItens(p => [...p, { escopoId: esc.id, descricao: esc.descricao||esc.cod, pctAnterior: 0, pctAtual: 0, valor: "" }]);
  }
  function updateItem(idx, field, val) {
    setItens(p => p.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  const totalValor = itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);

  async function save() {
    if (!form.numero) { alert("Informe o número do BM."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = {
      ...form, itens, obraId, totalValor,
      autor: userProfile?.nome || "–",
      updatedAt: agora,
    };
    try {
      if (bm?.id) { await updateDoc(doc(db, "boletins", bm.id), payload); addToast("BM atualizado!"); }
      else { payload.createdAt = agora; await addDoc(collection(db, "boletins"), payload); addToast("BM criado!"); }
      onClose();
    } catch (err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title="Boletim de Medição (BM)" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar BM"}</button></>}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div className="form-grid">
          <div className="form-group"><label className="required">Número do BM</label><input value={form.numero} onChange={e=>set("numero",e.target.value)} placeholder="BM-001"/></div>
          <div className="form-group"><label>Período de medição</label><input value={form.periodo} onChange={e=>set("periodo",e.target.value)} placeholder="Ex: 01/06 a 30/06/2025"/></div>
          <div className="form-group"><label>Status</label>
            <select value={form.status} onChange={e=>set("status",e.target.value)}
              style={{ background:form.status==="APROVADO"?"var(--verde-lt)":form.status==="PENDENTE"?"var(--amarelo-lt)":"var(--cinza-lt)" }}>
              {["RASCUNHO","PENDENTE","APROVADO","PAGO"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Adicionar escopos ao BM */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Escopos medidos</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
            {escopos.filter(e => !itens.find(i => i.escopoId === e.id)).map(e => (
              <button key={e.id} className="btn btn-sm" onClick={() => addItem(e)} style={{ fontSize:11 }}>
                + {e.descricao || e.cod}
              </button>
            ))}
          </div>
        </div>

        {itens.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Serviço</th><th>% Anterior</th><th>% Atual</th><th>Δ%</th><th>Valor (R$)</th><th></th></tr></thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={i}>
                    <td style={{ fontSize:12, fontWeight:500 }}>{it.descricao}</td>
                    <td><input type="number" min="0" max="100" value={it.pctAnterior} onChange={e=>updateItem(i,"pctAnterior",e.target.value)} style={{ width:70, padding:"4px 6px", textAlign:"center" }}/></td>
                    <td><input type="number" min="0" max="100" value={it.pctAtual} onChange={e=>updateItem(i,"pctAtual",e.target.value)} style={{ width:70, padding:"4px 6px", textAlign:"center" }}/></td>
                    <td style={{ fontWeight:700, color:"var(--verde)", textAlign:"center" }}>{Math.max(0,(it.pctAtual||0)-(it.pctAnterior||0))}%</td>
                    <td><input type="number" value={it.valor} onChange={e=>updateItem(i,"valor",e.target.value)} style={{ width:110, padding:"4px 6px" }} placeholder="0,00"/></td>
                    <td><button className="btn btn-sm" style={{ color:"var(--vermelho)" }} onClick={()=>setItens(p=>p.filter((_,j)=>j!==i))}>✕</button></td>
                  </tr>
                ))}
                <tr style={{ background:"var(--cinza-lt)", fontWeight:700 }}>
                  <td colSpan={4}>Total do BM</td>
                  <td style={{ color:"var(--verde)", fontSize:14 }}>R$ {totalValor.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/></div>
      </div>
    </Modal>
  );
}


// Integração BM → Financeiro: aprovação gera lançamento a receber
async function aprovarBM(bm, obraInfo, uid, userName) {
  if (bm.status === "APROVADO") return; // já aprovado
  await updateDoc(doc(db,"boletins",bm.id),{
    status:"APROVADO", aprovadoEm: new Date().toISOString(), aprovadoPor: userName
  });
  // Gera lançamento financeiro automático
  await addComAuditoria("financeiro", {
    tipo:"RECEBER", descricao:`BM ${bm.numero} — ${obraInfo?.nome||""}`,
    categoria:"Medição", valor: bm.totalValor||0,
    obraId: bm.obraId, obraNome: obraInfo?.nome||"",
    vencimento: new Date(Date.now()+30*86400000).toISOString().split("T")[0],
    status:"ABERTO", tipoValor:"realizado",
    origem:"boletim", boletimId: bm.id,
  }, uid, userName);
}

export default function Medicao({ obraAtual }) {
  const { toasts, addToast } = useToast();
  const [boletins, setBoletins] = useState([]);
  const [fvsList,  setFvsList]  = useState([]);
  const [escopos,  setEscopos]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [aba,      setAba]      = useState("bm");
  const [modalBM,  setModalBM]  = useState(null);
  const [modalFVS, setModalFVS] = useState(null);

  useEffect(() => {
    if (!obraAtual) return;
    const q1 = query(collection(db,"boletins"),where("obraId","==",obraAtual));
    const q2 = query(collection(db,"fvs"),where("obraId","==",obraAtual));
    const q3 = query(collection(db,"escopos"),where("obraId","==",obraAtual));
    const u1 = onSnapshot(q1,snap=>{setBoletins(snap.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2 = onSnapshot(q2,snap=>setFvsList(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3 = onSnapshot(q3,snap=>setEscopos(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();};
  },[obraAtual]);

  const totalBMs    = boletins.reduce((s,b)=>s+(b.totalValor||0),0);
  const bmAprovados = boletins.filter(b=>b.status==="APROVADO"||b.status==="PAGO").length;
  const fvsAprov    = fvsList.filter(f=>f.resultado==="APROVADO").length;
  const fvsReprov   = fvsList.filter(f=>f.resultado==="REPROVADO").length;

  const bmCols = [
    {key:"numero",header:"Número BM"},
    {key:"periodo",header:"Período"},
    {key:"totalValor",header:"Valor Total",format:v=>`R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`},
    {key:"status",header:"Status"},
    {key:"autor",header:"Autor"},
  ];

  if (!obraAtual) return <div className="alert alert-warning">Selecione uma obra no menu.</div>;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div><div className="panel-title">Medições e Qualidade</div><div style={{fontSize:12,color:"#7A7A7A"}}>BM + FVS vinculados à obra</div></div>
        <div style={{display:"flex",gap:8}}>
          {aba==="bm" && (
            <>
              <BtnExcel onClick={()=>exportarExcel(boletins,"Boletins_Medicao",bmCols)}/>
              <button className="btn btn-primary" onClick={()=>setModalBM({bm:null})}>+ Novo BM</button>
            </>
          )}
          {aba==="fvs" && <button className="btn btn-primary" onClick={()=>setModalFVS({fvs:null,escopoNome:"Serviço"})}>+ Nova FVS</button>}
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric"><div className="metric-label">Total medido</div><div className="metric-value green" style={{fontSize:16}}>R$ {totalBMs.toLocaleString("pt-BR",{minimumFractionDigits:0})}</div></div>
        <div className="metric"><div className="metric-label">BMs aprovados</div><div className="metric-value yellow">{bmAprovados}/{boletins.length}</div></div>
        <div className="metric"><div className="metric-label">FVS aprovadas</div><div className="metric-value green">{fvsAprov}</div></div>
        <div className="metric"><div className="metric-label">FVS reprovadas</div><div className="metric-value red">{fvsReprov}</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${aba==="bm"?"active":""}`} onClick={()=>setAba("bm")}>Boletins de Medição</button>
        <button className={`tab ${aba==="fvs"?"active":""}`} onClick={()=>setAba("fvs")}>FVS — Verificação de Serviço</button>
      </div>

      {aba==="bm" && (
        <>
          {loading && <div className="spinner"/>}
          {!loading && boletins.length===0 && <div className="empty-state"><div className="empty-icon">📋</div><p>Nenhum boletim de medição criado</p></div>}
          {!loading && boletins.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nº BM</th><th>Período</th><th>Serviços</th><th>Valor total</th><th>Status</th><th>Autor</th><th></th></tr></thead>
                <tbody>
                  {boletins.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).map(b=>(
                    <tr key={b.id}>
                      <td style={{fontWeight:700}}>{b.numero}</td>
                      <td style={{fontSize:12}}>{b.periodo||"–"}</td>
                      <td style={{fontSize:12}}>{b.itens?.length||0} serviços</td>
                      <td style={{fontWeight:700,color:"var(--verde)"}}>R$ {Number(b.totalValor||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td>
                      <td><span className={`badge ${b.status==="APROVADO"||b.status==="PAGO"?"badge-green":b.status==="PENDENTE"?"badge-amber":"badge-gray"}`}>{b.status}</span></td>
                      <td style={{fontSize:12}}>{b.autor}</td>
                      <td><button className="btn btn-sm btn-icon" onClick={()=>setModalBM({bm:b})}>✏️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aba==="fvs" && (
        <>
          {fvsList.length===0 && <div className="empty-state"><div className="empty-icon">🔍</div><p>Nenhuma FVS registrada</p></div>}
          {fvsList.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Serviço</th><th>Tipo</th><th>Itens OK</th><th>%</th><th>Resultado</th><th>Inspetor</th><th>Data</th><th></th></tr></thead>
                <tbody>
                  {fvsList.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).map(f=>(
                    <tr key={f.id}>
                      <td style={{fontWeight:500}}>{f.escopoNome}</td>
                      <td><span className="badge badge-gray" style={{fontSize:10}}>{f.tipo}</span></td>
                      <td style={{fontSize:12}}>{f.totalOk}/{f.totalItens}</td>
                      <td>
                        <div className="progress-bar" style={{marginBottom:2,width:60}}>
                          <div className="progress-fill" style={{width:`${f.pct||0}%`,background:f.pct===100?"var(--verde)":f.pct>50?"var(--afine-yellow-dk)":"var(--vermelho)"}}/>
                        </div>
                        <span style={{fontSize:10}}>{f.pct||0}%</span>
                      </td>
                      <td><span className={`badge ${f.resultado==="APROVADO"?"badge-green":f.resultado==="REPROVADO"?"badge-red":"badge-amber"}`}>{f.resultado}</span></td>
                      <td style={{fontSize:12}}>{f.inspetor}</td>
                      <td style={{fontSize:12}}>{fmtDate(f.data)}</td>
                      <td><button className="btn btn-sm btn-icon" onClick={()=>setModalFVS({fvs:f,escopoNome:f.escopoNome})}>✏️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modalBM && <BoletiModal bm={modalBM.bm} obraId={obraAtual} escopos={escopos} onClose={()=>setModalBM(null)} addToast={addToast}/>}
      {modalFVS && <FVSModal fvs={modalFVS.fvs} obraId={obraAtual} escopoNome={modalFVS.escopoNome} onClose={()=>setModalFVS(null)} addToast={addToast}/>}
    </div>
  );
}
