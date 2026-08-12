// src/pages/AuditLog.js — Registro de auditoria do sistema
import React, { useState } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import { isGestorOuAdm } from "../constants/departamentos";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatarDataHora(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const aa = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  return `${dd}/${mm}/${aa} ${hh}:${mi}`;
}

function dataParaISO(dataStr, fim) {
  if (!dataStr) return null;
  const d = new Date(dataStr + (fim ? "T23:59:59" : "T00:00:00"));
  return d.toISOString();
}

function padraoDE() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0,10);
}
function padraoATE() {
  return new Date().toISOString().slice(0,10);
}

const COLECOES = [
  "obras","manutencoes","gerenciamento","compras","despesas",
  "financeiro","contratos","clientes","fornecedores","usuarios",
  "pontos","garantias",
];

const ACOES_LABEL = { create:"Criação", update:"Atualização", delete:"Exclusão" };

const BADGE_ACAO = {
  create: { background:"#D1FAE5", color:"#065F46" },
  update: { background:"#DBEAFE", color:"#1E3A8A" },
  delete: { background:"#FEE2E2", color:"#991B1B" },
};

function badgeAcao(acao) {
  const style = BADGE_ACAO[acao] || { background:"#F3F4F6", color:"#374151" };
  return (
    <span style={{
      ...style, fontSize:11, fontWeight:700, borderRadius:4,
      padding:"2px 8px", display:"inline-block",
    }}>
      {ACOES_LABEL[acao] || acao}
    </span>
  );
}

function camposStr(campos) {
  if (!campos || !Array.isArray(campos) || campos.length === 0) return "–";
  const joined = campos.join(", ");
  return joined.length > 60 ? joined.slice(0,60) + "…" : joined;
}

// ─── Modal de Detalhe ─────────────────────────────────────────────────────────
function DetalheModal({ evento, onClose }) {
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.45)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000,
    }} onClick={onClose}>
      <div style={{
        background:"#fff", borderRadius:10, padding:24, maxWidth:640, width:"92%",
        maxHeight:"85vh", overflowY:"auto", boxShadow:"0 8px 32px rgba(0,0,0,.18)",
      }} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <span style={{fontWeight:700,fontSize:15}}>Detalhe do evento</span>
          <button className="btn btn-sm" onClick={onClose} style={{fontSize:16,lineHeight:1}}>✕</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"6px 12px",fontSize:13,marginBottom:16}}>
          <span style={{color:"#7A7A7A",fontWeight:600}}>Data/Hora</span>
          <span>{formatarDataHora(evento.alteradoEm)}</span>

          <span style={{color:"#7A7A7A",fontWeight:600}}>Usuário</span>
          <span>{evento.alteradoPorNome || evento.alteradoPor || "–"}</span>

          <span style={{color:"#7A7A7A",fontWeight:600}}>Ação</span>
          <span>{badgeAcao(evento.acao)}</span>

          <span style={{color:"#7A7A7A",fontWeight:600}}>Coleção</span>
          <span>
            <span className="badge badge-gray" style={{fontSize:11}}>{evento.colecao || "–"}</span>
          </span>

          <span style={{color:"#7A7A7A",fontWeight:600}}>Doc ID</span>
          <span style={{fontFamily:"monospace",fontSize:11,wordBreak:"break-all"}}>{evento.docId || "–"}</span>
        </div>

        {evento.acao === "update" && (
          <>
            <div style={{fontWeight:600,fontSize:12,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:8}}>
              Campos alterados
            </div>
            {Array.isArray(evento.campos) && evento.campos.length > 0 ? (
              <ul style={{margin:0,paddingLeft:18,fontSize:13}}>
                {evento.campos.map((c,i)=><li key={i}>{c}</li>)}
              </ul>
            ) : (
              <span style={{fontSize:12,color:"#7A7A7A"}}>Nenhum campo listado.</span>
            )}
          </>
        )}

        {evento.acao === "delete" && evento.snapshot && (
          <>
            <div style={{fontWeight:600,fontSize:12,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",margin:"16px 0 8px"}}>
              Snapshot (documento antes da exclusão)
            </div>
            <pre style={{
              background:"#1E1E1E", color:"#D4D4D4", borderRadius:6,
              padding:12, fontSize:11, fontFamily:"monospace", overflowX:"auto",
              whiteSpace:"pre-wrap", wordBreak:"break-all", margin:0,
            }}>
              {JSON.stringify(evento.snapshot, null, 2)}
            </pre>
          </>
        )}

        {evento.acao === "create" && (
          <div style={{fontSize:12,color:"#7A7A7A",marginTop:8}}>Documento criado — sem campos adicionais registrados.</div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AuditLog() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();

  const [filtros, setFiltros] = useState({
    de: padraoDE(),
    ate: padraoATE(),
    colecao: "",
    usuario: "",
    acao: "",
  });
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [detalhe, setDetalhe] = useState(null);

  const isGestor = isGestorOuAdm(userProfile);

  function setF(campo, valor) { setFiltros(p=>({...p,[campo]:valor})); }

  async function buscar() {
    if (!filtros.de || !filtros.ate) { addToast("Informe o período completo.","error"); return; }
    setLoading(true);
    setBuscado(false);
    try {
      const de  = dataParaISO(filtros.de, false);
      const ate = dataParaISO(filtros.ate, true);
      const q = query(
        collection(db, "audit_log"),
        where("alteradoEm", ">=", de),
        where("alteradoEm", "<=", ate),
        orderBy("alteradoEm", "desc"),
        limit(500),
      );
      const snap = await getDocs(q);
      let docs = snap.docs.map(d=>({id:d.id,...d.data()}));

      // Filtros em memória
      if (filtros.colecao) docs = docs.filter(d=>d.colecao === filtros.colecao);
      if (filtros.acao)    docs = docs.filter(d=>d.acao === filtros.acao);
      if (filtros.usuario) {
        const u = filtros.usuario.toLowerCase();
        docs = docs.filter(d=>(d.alteradoPorNome||"").toLowerCase().includes(u));
      }

      setEventos(docs);
      setBuscado(true);
      if (docs.length === 0) addToast("Nenhum evento encontrado para os filtros selecionados.","info");
    } catch(err) {
      addToast("Erro ao buscar: " + err.message, "error");
    }
    setLoading(false);
  }

  function handleExcel() {
    exportarExcel(eventos, "audit_log", [
      { key:"alteradoEm",      header:"Data/Hora",       format: v=>formatarDataHora(v) },
      { key:"alteradoPorNome", header:"Usuário" },
      { key:"acao",            header:"Ação",             format: v=>ACOES_LABEL[v]||v },
      { key:"colecao",         header:"Coleção" },
      { key:"docId",           header:"Doc ID" },
      { key:"campos",          header:"Campos alterados", format: v=>Array.isArray(v)?v.join(", "):"" },
    ]);
  }

  // KPIs
  const total    = eventos.length;
  const criacoes = eventos.filter(e=>e.acao==="create").length;
  const exclusoes= eventos.filter(e=>e.acao==="delete").length;

  // ─── Acesso restrito ────────────────────────────────────────────────────────
  if (!isGestor) {
    return (
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 24px",gap:16}}>
        <div style={{fontSize:48}}>🔒</div>
        <div style={{fontWeight:700,fontSize:18}}>Acesso restrito</div>
        <div style={{color:"#7A7A7A",fontSize:13,textAlign:"center",maxWidth:340}}>
          O Audit Log é acessível apenas por usuários com perfil de Gestão ou ADM.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="toast-container">
        {toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-title">Audit Log</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>Registro de alterações no sistema</div>
        </div>
        {buscado && eventos.length > 0 && (
          <BtnExcel onClick={handleExcel} />
        )}
      </div>

      {/* Filtros */}
      <div style={{background:"#fff",borderRadius:8,padding:20,marginBottom:16,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
        <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>
          Filtros
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:12}}>
          <div className="form-group" style={{margin:0}}>
            <label>De</label>
            <input type="date" value={filtros.de} onChange={e=>setF("de",e.target.value)} />
          </div>
          <div className="form-group" style={{margin:0}}>
            <label>Até</label>
            <input type="date" value={filtros.ate} onChange={e=>setF("ate",e.target.value)} />
          </div>
          <div className="form-group" style={{margin:0}}>
            <label>Coleção</label>
            <select value={filtros.colecao} onChange={e=>setF("colecao",e.target.value)}>
              <option value="">Todas</option>
              {COLECOES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{margin:0}}>
            <label>Usuário</label>
            <input
              placeholder="Filtrar por nome..."
              value={filtros.usuario}
              onChange={e=>setF("usuario",e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&buscar()}
            />
          </div>
          <div className="form-group" style={{margin:0}}>
            <label>Ação</label>
            <select value={filtros.acao} onChange={e=>setF("acao",e.target.value)}>
              <option value="">Todas</option>
              <option value="create">Criação</option>
              <option value="update">Atualização</option>
              <option value="delete">Exclusão</option>
            </select>
          </div>
          <div style={{display:"flex",alignItems:"flex-end"}}>
            <button className="btn btn-primary" onClick={buscar} disabled={loading} style={{width:"100%"}}>
              {loading ? "Buscando…" : "🔍 Buscar"}
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && <div className="spinner" />}

      {/* KPIs */}
      {!loading && buscado && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
          {[
            { label:"Total de eventos", valor:total, cor:"#185FA5" },
            { label:"Criações",         valor:criacoes, cor:"#065F46" },
            { label:"Exclusões",        valor:exclusoes, cor:"#991B1B" },
          ].map(kpi=>(
            <div key={kpi.label} style={{
              background:"#fff", borderRadius:8, padding:"14px 18px",
              boxShadow:"0 1px 4px rgba(0,0,0,.07)",
              borderTop:`3px solid ${kpi.cor}`,
            }}>
              <div style={{fontSize:11,color:"#7A7A7A",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>
                {kpi.label}
              </div>
              <div style={{fontSize:26,fontWeight:800,color:kpi.cor}}>{kpi.valor}</div>
            </div>
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {!loading && buscado && eventos.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>Nenhum evento encontrado para os filtros selecionados.</p>
        </div>
      )}

      {/* Tabela */}
      {!loading && eventos.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Coleção</th>
                <th>Campos alterados</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {eventos.map(e=>(
                <tr key={e.id}>
                  <td style={{fontSize:12,whiteSpace:"nowrap"}}>{formatarDataHora(e.alteradoEm)}</td>
                  <td style={{fontSize:12}}>{e.alteradoPorNome || e.alteradoPor || "–"}</td>
                  <td>{badgeAcao(e.acao)}</td>
                  <td>
                    <span className="badge badge-gray" style={{fontSize:10}}>
                      {e.colecao || "–"}
                    </span>
                  </td>
                  <td style={{fontSize:11,color:"#7A7A7A",maxWidth:220}}>
                    {e.acao === "update" ? camposStr(e.campos) : "–"}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-icon"
                      title="Ver detalhe"
                      onClick={()=>setDetalhe(e)}
                    >
                      👁
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {eventos.length === 500 && (
            <div style={{textAlign:"center",padding:"10px 0",fontSize:12,color:"#7A7A7A"}}>
              Exibindo os 500 eventos mais recentes. Refine os filtros para resultados mais específicos.
            </div>
          )}
        </div>
      )}

      {/* Modal de detalhe */}
      {detalhe && <DetalheModal evento={detalhe} onClose={()=>setDetalhe(null)} />}
    </div>
  );
}
