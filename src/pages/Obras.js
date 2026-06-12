// src/pages/Obras.js — versão completa com todos os campos solicitados
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";

const TIPOS_OBRA = [
  "Reforma geral","Layout","Adequação","Retrofit","Manutenção preventiva",
  "Manutenção corretiva","Instalação","Ampliação","Outro"
];

function ObraModal({ obra, onClose, addToast }) {
  const [form, setForm] = useState({
    nome:            obra?.nome            || "",
    tipo:            obra?.tipo            || "",
    cliente:         obra?.cliente         || "",
    gerenciadora:    obra?.gerenciadora    || "",
    responsavel:     obra?.responsavel     || "",
    endereco:        obra?.endereco        || "",
    contrato:        obra?.contrato        || "",
    area:            obra?.area            || "",
    inicio:          obra?.inicio          || "",
    termino:         obra?.termino         || "",
    conclusaoReal:   obra?.conclusaoReal   || "",
    dataVistoria:    obra?.dataVistoria    || "",
    status:          obra?.status          || "EM ANDAMENTO",
    progresso:       obra?.progresso       || 0,
    orcamentoEnviado:obra?.orcamentoEnviado|| "NÃO",
    valorOrcamento:  obra?.valorOrcamento  || "",
    relatorioEnviado:obra?.relatorioEnviado|| "NÃO",
    obs:             obra?.obs             || "",
  });
  const [saving, setSaving] = useState(false);
  function set(f, v) { setForm(p => ({ ...p, [f]: v })); }

  async function save() {
    if (!form.nome || !form.cliente) { alert("Nome e cliente são obrigatórios."); return; }
    setSaving(true);
    const agora = new Date().toISOString();
    const payload = {
      nome: form.nome, tipo: form.tipo, cliente: form.cliente,
      gerenciadora: form.gerenciadora, responsavel: form.responsavel,
      endereco: form.endereco, contrato: form.contrato, area: form.area,
      inicio: form.inicio, termino: form.termino,
      conclusaoReal: form.conclusaoReal, dataVistoria: form.dataVistoria,
      status: form.status, progresso: Number(form.progresso) || 0,
      orcamentoEnviado: form.orcamentoEnviado,
      valorOrcamento: form.valorOrcamento,
      relatorioEnviado: form.relatorioEnviado,
      obs: form.obs, updatedAt: agora,
    };
    try {
      if (obra?.id) {
        await updateDoc(doc(db, "obras", obra.id), payload);
        addToast("Obra atualizada!");
      } else {
        payload.createdAt = agora;
        await addDoc(collection(db, "obras"), payload);
        addToast("Obra criada!");
      }
      onClose();
    } catch (err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  const SIM_NAO = ["NÃO","SIM","PENDENTE"];

  return (
    <Modal title={obra?.id ? "Editar obra" : "Nova obra"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>

        <div style={{fontSize:12,fontWeight:600,color:"#185FA5",marginBottom:-4}}>IDENTIFICAÇÃO</div>
        <div className="form-grid">
          <div className="form-group span-2"><label className="required">Nome da obra</label><input value={form.nome} onChange={e=>set("nome",e.target.value)} placeholder="AG-0500 · São Paulo Centro"/></div>
          <div className="form-group"><label className="required">Cliente</label><input value={form.cliente} onChange={e=>set("cliente",e.target.value)} placeholder="Bradesco, Itaú..."/></div>
          <div className="form-group"><label className="required">Tipo de obra</label>
            <select value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
              <option value="">Selecione...</option>
              {TIPOS_OBRA.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Gerenciadora</label><input value={form.gerenciadora} onChange={e=>set("gerenciadora",e.target.value)}/></div>
          <div className="form-group"><label>Responsável técnico</label><input value={form.responsavel} onChange={e=>set("responsavel",e.target.value)}/></div>
          <div className="form-group span-2"><label>Endereço</label><input value={form.endereco} onChange={e=>set("endereco",e.target.value)}/></div>
          <div className="form-group"><label>Contrato Nº</label><input value={form.contrato} onChange={e=>set("contrato",e.target.value)}/></div>
          <div className="form-group"><label>Área (m²)</label><input type="number" value={form.area} onChange={e=>set("area",e.target.value)}/></div>
        </div>

        <div style={{fontSize:12,fontWeight:600,color:"#185FA5",marginBottom:-4}}>DATAS E STATUS</div>
        <div className="form-grid">
          <div className="form-group"><label>Data de início</label><input type="date" value={form.inicio} onChange={e=>set("inicio",e.target.value)}/></div>
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

        <div style={{fontSize:12,fontWeight:600,color:"#185FA5",marginBottom:-4}}>ORÇAMENTO E RELATÓRIO</div>
        <div className="form-grid">
          <div className="form-group"><label>Orçamento enviado?</label>
            <select value={form.orcamentoEnviado} onChange={e=>set("orcamentoEnviado",e.target.value)}>
              {SIM_NAO.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Valor do orçamento (R$)</label><input type="number" value={form.valorOrcamento} onChange={e=>set("valorOrcamento",e.target.value)} placeholder="0,00"/></div>
          <div className="form-group"><label>Relatório enviado?</label>
            <select value={form.relatorioEnviado} onChange={e=>set("relatorioEnviado",e.target.value)}>
              {SIM_NAO.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} placeholder="Observações gerais sobre a obra..." rows={3}/></div>
      </div>
    </Modal>
  );
}

export default function Obras({ onObraSelect }) {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [modal, setModal] = useState(null);
  const isGestor = userProfile?.perfil === "gestor";

  useEffect(() => {
    return onSnapshot(collection(db, "obras"), snap => {
      setObras(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const filtered = obras.filter(o => {
    const q = search.toLowerCase();
    const matchQ = !q || o.nome?.toLowerCase().includes(q) || o.cliente?.toLowerCase().includes(q) || o.contrato?.toLowerCase().includes(q);
    const matchS = filtroStatus === "todos" || o.status === filtroStatus;
    return matchQ && matchS;
  });

  const statusList = ["EM ANDAMENTO","CONCLUÍDA","PARALISADA","PLANEJAMENTO","AGUARDANDO APROVAÇÃO"];

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div>
          <div className="panel-title">Obras</div>
          <div style={{fontSize:12,color:"var(--cinza-med)"}}>{obras.length} obras · {obras.filter(o=>o.status==="EM ANDAMENTO").length} em andamento</div>
        </div>
        {isGestor && <button className="btn btn-primary" onClick={()=>setModal({obra:null})}>+ Nova obra</button>}
      </div>

      <div className="chip-row">
        {["todos",...statusList].map(s=>(
          <button key={s} className={`chip ${filtroStatus===s?"active":""}`} onClick={()=>setFiltroStatus(s)}>
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
            <thead><tr><th>Obra</th><th>Tipo</th><th>Cliente</th><th>Vistoria</th><th>Término</th><th>Orçamento</th><th>Relatório</th><th>Progresso</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map(o=>(
                <tr key={o.id}>
                  <td><div style={{fontWeight:600}}>{o.nome}</div><div style={{fontSize:11,color:"var(--cinza-med)"}}>{o.contrato}</div></td>
                  <td style={{fontSize:11}}><span className="badge badge-gray">{o.tipo||"–"}</span></td>
                  <td style={{fontSize:12}}>{o.cliente}</td>
                  <td style={{fontSize:12}}>{fmtDate(o.dataVistoria)}</td>
                  <td style={{fontSize:12}}>{fmtDate(o.conclusaoReal||o.termino)}</td>
                  <td><span className={`badge ${o.orcamentoEnviado==="SIM"?"badge-green":o.orcamentoEnviado==="PENDENTE"?"badge-amber":"badge-red"}`}>{o.orcamentoEnviado||"NÃO"}</span></td>
                  <td><span className={`badge ${o.relatorioEnviado==="SIM"?"badge-green":"badge-red"}`}>{o.relatorioEnviado||"NÃO"}</span></td>
                  <td style={{minWidth:90}}>
                    <div className="progress-bar" style={{marginBottom:3}}><div className={`progress-fill ${o.progresso>=100?"green":"blue"}`} style={{width:`${o.progresso||0}%`}}/></div>
                    <span style={{fontSize:11}}>{o.progresso||0}%</span>
                  </td>
                  <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                  <td style={{display:"flex",gap:6}}>
                    <button className="btn btn-sm" onClick={()=>onObraSelect(o.id)} title="Selecionar">🔀</button>
                    {isGestor && <button className="btn btn-sm btn-icon" onClick={()=>setModal({obra:o})}>✏️</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <ObraModal obra={modal.obra} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
