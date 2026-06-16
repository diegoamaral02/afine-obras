// src/pages/Compras.js — v3: por etapa filtrada + permissões granulares + UX fluida
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { ACESSO, getAcesso } from "../constants/departamentos";

// ── Perfis e permissões por etapa ─────────────────────────────────────────────
// Perfis disponíveis: gestor | encarregado | campo | adm | financeiro | compras | fiscal
// No sistema atual mapeamos:
//   adm       → perfil "gestor" com flag adm: true  (ou seta em usuarios)
//   financeiro → perfil "encarregado" + departamento "financeiro"
//   compras    → perfil "encarregado" + departamento "compras"
//   fiscal     → perfil "campo"
//   campo      → perfil "campo"

const ETAPAS = [
  {
    id: "SOLICITAÇÃO",
    label: "Solicitação",
    icone: "📝",
    cor: "#4A4A4A",
    desc: "Pedido de material aberto pela equipe",
    // Quem VÊ esta aba
    podeVer: () => true, // todos
    // Quem pode EDITAR (criar / avançar status) nesta etapa
    podeEditar: (p) => true, // todos
    // Campos visíveis nesta etapa
    campos: ["titulo","demandaTipo","demandaId","urgencia","obs","itens"],
  },
  {
    id: "COTAÇÃO",
    label: "Cotação",
    icone: "💬",
    cor: "#185FA5",
    desc: "Buscando preços com fornecedores",
    podeVer: (p) => ["gestor","encarregado"].includes(p.perfil) || p.adm,
    podeEditar: (p) => ["gestor","encarregado"].includes(p.perfil) || p.adm,
    campos: ["fornecedorId","valorCotado","prazoEntrega","obs"],
  },
  {
    id: "APROVADA",
    label: "Aprovada",
    icone: "✅",
    cor: "#C9A200",
    desc: "Compra aprovada para emissão de OC",
    podeVer: (p) => p.adm || (p.perfil==="gestor" && p.podeAprovar),
    podeEditar: (p) => p.adm || (p.perfil==="gestor" && p.podeAprovar),
    campos: ["valorAprovado","formaPagamento","obs"],
    alertaAprovacao: true,
  },
  {
    id: "ORDEM DE COMPRA",
    label: "Ordem de Compra",
    icone: "📋",
    cor: "#7B4F00",
    desc: "OC emitida ao fornecedor",
    podeVer: (p) => p.adm || p.departamento==="financeiro" || p.departamento==="compras" || p.perfil==="gestor",
    podeEditar: (p) => p.adm || p.departamento==="financeiro" || p.departamento==="compras",
    campos: ["numeroPedido","prazoEntrega","obs"],
  },
  {
    id: "RECEBIDO",
    label: "Recebido",
    icone: "📦",
    cor: "#2D6A1F",
    desc: "Material entregue e conferido",
    podeVer: (p) => p.departamento==="compras" || p.adm || p.perfil==="gestor",
    podeEditar: (p) => p.departamento==="compras" || p.adm,
    campos: ["dataRecebimento","obs"],
  },
  {
    id: "NF VINCULADA",
    label: "NF Vinculada",
    icone: "🧾",
    cor: "#1A5A10",
    desc: "Nota fiscal recebida e vinculada",
    podeVer: (p) => p.adm || p.departamento==="financeiro" || p.departamento==="compras",
    podeEditar: (p) => p.adm || p.departamento==="financeiro" || p.departamento==="compras",
    campos: ["numeroNF","valorNF","dataRecebimento","obs"],
  },
];

const STATUS_COR = {
  "SOLICITAÇÃO":    "badge-gray",
  "COTAÇÃO":        "badge-blue",
  "APROVADA":       "badge-yellow",
  "ORDEM DE COMPRA":"badge-purple",
  "RECEBIDO":       "badge-green",
  "NF VINCULADA":   "badge-green",
};

// Extrai perfil enriquecido do userProfile
function getPerfilEnriquecido(userProfile) {
  if (!userProfile) return { perfil:"campo", adm:false, departamento:"", podeAprovar:false };
  return {
    perfil:      userProfile.perfil || "campo",
    adm:         userProfile.adm === true,
    departamento:userProfile.departamento || "",
    podeAprovar: userProfile.podeAprovar === true || userProfile.adm === true,
  };
}

// ── Modal de compra com campos dinâmicos por etapa ───────────────────────────
function CompraModal({ compra, etapaAtual, obras, manutencoes, fornecedores, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const p = getPerfilEnriquecido(userProfile);

  const etapa = ETAPAS.find(e => e.id === (etapaAtual || compra?.status || "SOLICITAÇÃO"));
  const isNova = !compra?.id;

  const [form, setForm] = useState({
    titulo:          compra?.titulo          || "",
    demandaTipo:     compra?.demandaTipo     || "obra",
    demandaId:       compra?.demandaId       || "",
    urgencia:        compra?.urgencia        || "normal",
    status:          compra?.status          || "SOLICITAÇÃO",
    fornecedorId:    compra?.fornecedorId    || "",
    valorCotado:     compra?.valorCotado     || "",
    valorAprovado:   compra?.valorAprovado   || "",
    formaPagamento:  compra?.formaPagamento  || "",
    prazoEntrega:    compra?.prazoEntrega    || "",
    numeroPedido:    compra?.numeroPedido    || "",
    numeroNF:        compra?.numeroNF        || "",
    valorNF:         compra?.valorNF         || "",
    dataRecebimento: compra?.dataRecebimento || "",
    obs:             compra?.obs             || "",
  });
  const [itens,    setItens]    = useState(compra?.itens || []);
  const [itemNome, setItemNome] = useState("");
  const [itemQtd,  setItemQtd]  = useState("");
  const [itemUn,   setItemUn]   = useState("un");
  const [saving,   setSaving]   = useState(false);

  function set(f, v) { setForm(p => ({...p, [f]: v})); }

  function addItem() {
    if (!itemNome || !itemQtd) { alert("Informe o item e a quantidade."); return; }
    setItens(p => [...p, { nome:itemNome, qtd:Number(itemQtd), un:itemUn }]);
    setItemNome(""); setItemQtd("");
  }

  // Status possíveis para avançar com base no perfil
  function statusPermitidos() {
    const idx = ETAPAS.findIndex(e => e.id === form.status);
    const permitidos = [form.status];
    // Pode avançar para próxima etapa se tiver permissão
    if (idx < ETAPAS.length - 1) {
      const proxEtapa = ETAPAS[idx + 1];
      if (proxEtapa.podeEditar(p)) permitidos.push(proxEtapa.id);
    }
    // Adm pode mover para qualquer etapa
    if (p.adm) return ETAPAS.map(e => e.id);
    return permitidos;
  }

  const demandas = form.demandaTipo === "obra" ? obras : manutencoes;
  const fornSel  = fornecedores.find(f => f.id === form.fornecedorId);
  const campos   = etapa?.campos || ETAPAS[0].campos;

  async function save() {
    if (!form.titulo || (!itens.length && isNova)) {
      alert("Informe o título e ao menos 1 item."); return;
    }
    setSaving(true);
    const agora = new Date().toISOString();
    const demanda = demandas.find(d => d.id === form.demandaId);
    const payload = {
      ...form, itens,
      demandaNome:     demanda?.nome || demanda?.titulo || "",
      fornecedorNome:  fornSel?.razaoSocial || "",
      autorNome:       userProfile?.nome || currentUser?.email,
      updatedAt:       agora,
    };
    try {
      if (compra?.id) {
        await updateDoc(doc(db,"compras",compra.id), payload);
        addToast("Compra atualizada!");
      } else {
        payload.createdAt = agora;
        await addDoc(collection(db,"compras"), payload);
        addToast("Solicitação criada!");
      }
      onClose();
    } catch(err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  const campoVisivel = (nome) => campos.includes(nome) || isNova;

  return (
    <Modal
      title={isNova ? "Nova solicitação de compra" : `Editar — ${compra?.titulo}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </>
      }>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

        {/* Indicador da etapa atual */}
        {!isNova && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 14px", background:"#1A1A1A", borderRadius:8 }}>
            <span style={{ fontSize:18 }}>{etapa?.icone}</span>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#F5C800" }}>{etapa?.label}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,.5)" }}>{etapa?.desc}</div>
            </div>
          </div>
        )}

        {/* DADOS DA SOLICITAÇÃO — sempre visíveis */}
        <div className="form-grid">
          <div className="form-group span-2">
            <label className="required">Título da compra</label>
            <input value={form.titulo} onChange={e=>set("titulo",e.target.value)}
              placeholder="Ex: Cabos elétricos — AG 0442"
              disabled={!isNova && !p.adm}
              style={{ opacity:!isNova && !p.adm ? .6 : 1 }}/>
          </div>
          {(isNova || campoVisivel("demandaTipo")) && (
            <>
              <div className="form-group">
                <label>Vinculado a</label>
                <select value={form.demandaTipo} onChange={e=>{set("demandaTipo",e.target.value);set("demandaId","");}} disabled={!isNova}>
                  <option value="obra">Obra</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="geral">Estoque geral</option>
                </select>
              </div>
              {form.demandaTipo !== "geral" && (
                <div className="form-group">
                  <label>Qual {form.demandaTipo==="obra"?"obra":"manutenção"}?</label>
                  <select value={form.demandaId} onChange={e=>set("demandaId",e.target.value)} disabled={!isNova}>
                    <option value="">Selecione...</option>
                    {demandas.map(d=><option key={d.id} value={d.id}>{d.nome||d.titulo}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          <div className="form-group">
            <label>Urgência</label>
            <select value={form.urgencia} onChange={e=>set("urgencia",e.target.value)}>
              {["baixa","normal","alta","urgente"].map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
          {/* Status — só mostra opções permitidas */}
          {!isNova && (
            <div className="form-group">
              <label>Avançar para</label>
              <select value={form.status} onChange={e=>set("status",e.target.value)}>
                {statusPermitidos().map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              {!p.adm && statusPermitidos().length === 1 && (
                <span style={{ fontSize:11, color:"#7A7A7A" }}>Sem permissão para avançar esta etapa</span>
              )}
            </div>
          )}
        </div>

        {/* ITENS — só na solicitação ou se adm */}
        {(isNova || p.adm) && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:".06em" }}>
              Itens solicitados
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"flex-end" }}>
              <div className="form-group" style={{ flex:2 }}><label>Item</label><input value={itemNome} onChange={e=>setItemNome(e.target.value)} placeholder="Ex: Cabo 10mm²"/></div>
              <div className="form-group" style={{ width:80 }}><label>Qtd.</label><input type="number" min="1" value={itemQtd} onChange={e=>setItemQtd(e.target.value)}/></div>
              <div className="form-group" style={{ width:80 }}><label>Un.</label>
                <select value={itemUn} onChange={e=>setItemUn(e.target.value)}>
                  {["un","m","m²","kg","saco","cx","rolo"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addItem} style={{ marginBottom:1 }}>+ Add</button>
            </div>
            {itens.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Item</th><th>Qtd.</th><th>Un.</th><th></th></tr></thead>
                  <tbody>
                    {itens.map((it,i)=>(
                      <tr key={i}>
                        <td style={{ fontWeight:500 }}>{it.nome}</td>
                        <td>{it.qtd}</td>
                        <td>{it.un}</td>
                        <td><button className="btn btn-sm" style={{ color:"var(--vermelho)" }} onClick={()=>setItens(p=>p.filter((_,j)=>j!==i))}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {/* Visualização de itens (somente leitura) para quem não pode editar */}
        {!isNova && !p.adm && itens.length > 0 && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"#7A7A7A", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>Itens do pedido</div>
            <div style={{ background:"var(--cinza-lt)", borderRadius:8, padding:10 }}>
              {itens.map((it,i)=>(
                <div key={i} style={{ display:"flex", gap:8, fontSize:12, padding:"3px 0", borderBottom:"1px solid var(--border)" }}>
                  <span style={{ flex:1, fontWeight:500 }}>{it.nome}</span>
                  <span>{it.qtd} {it.un}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COTAÇÃO */}
        {campoVisivel("fornecedorId") && etapa?.podeEditar(p) && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:".06em" }}>Cotação</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Fornecedor</label>
                <select value={form.fornecedorId} onChange={e=>set("fornecedorId",e.target.value)}>
                  <option value="">Selecione...</option>
                  {fornecedores.filter(f=>f.status==="ATIVO").map(f=><option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Valor cotado (R$)</label>
                <input type="number" value={form.valorCotado} onChange={e=>set("valorCotado",e.target.value)}/>
              </div>
              <div className="form-group">
                <label>Prazo de entrega</label>
                <input type="date" value={form.prazoEntrega} onChange={e=>set("prazoEntrega",e.target.value)}/>
              </div>
            </div>
          </>
        )}

        {/* APROVAÇÃO */}
        {campoVisivel("valorAprovado") && etapa?.podeEditar(p) && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:"#C9A200", textTransform:"uppercase", letterSpacing:".06em" }}>Aprovação</div>
            {etapa?.alertaAprovacao && (
              <div className="alert alert-warning" style={{ fontSize:12 }}>
                ⚠️ Ao salvar como <strong>APROVADA</strong>, o valor será comprometido no financeiro e a OC poderá ser emitida.
              </div>
            )}
            <div className="form-grid">
              <div className="form-group">
                <label>Valor aprovado (R$)</label>
                <input type="number" value={form.valorAprovado} onChange={e=>set("valorAprovado",e.target.value)}/>
              </div>
              <div className="form-group">
                <label>Forma de pagamento</label>
                <select value={form.formaPagamento} onChange={e=>set("formaPagamento",e.target.value)}>
                  <option value="">Selecione...</option>
                  {["À vista","30 dias","30/60","30/60/90","Boleto","PIX"].map(f=><option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {/* ORDEM DE COMPRA */}
        {campoVisivel("numeroPedido") && etapa?.podeEditar(p) && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:"#7B4F00", textTransform:"uppercase", letterSpacing:".06em" }}>Ordem de Compra</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Nº do pedido / OC</label>
                <input value={form.numeroPedido} onChange={e=>set("numeroPedido",e.target.value)} placeholder="OC-2025-001"/>
              </div>
              <div className="form-group">
                <label>Prazo de entrega</label>
                <input type="date" value={form.prazoEntrega} onChange={e=>set("prazoEntrega",e.target.value)}/>
              </div>
            </div>
          </>
        )}

        {/* RECEBIMENTO */}
        {campoVisivel("dataRecebimento") && etapa?.podeEditar(p) && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:"#2D6A1F", textTransform:"uppercase", letterSpacing:".06em" }}>Recebimento</div>
            <div className="form-group">
              <label>Data de recebimento</label>
              <input type="date" value={form.dataRecebimento} onChange={e=>set("dataRecebimento",e.target.value)}/>
            </div>
          </>
        )}

        {/* NOTA FISCAL */}
        {campoVisivel("numeroNF") && etapa?.podeEditar(p) && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:"#1A5A10", textTransform:"uppercase", letterSpacing:".06em" }}>Nota Fiscal</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Número da NF</label>
                <input value={form.numeroNF} onChange={e=>set("numeroNF",e.target.value)} placeholder="NF-4521"/>
              </div>
              <div className="form-group">
                <label>Valor da NF (R$)</label>
                <input type="number" value={form.valorNF} onChange={e=>set("valorNF",e.target.value)}/>
              </div>
              <div className="form-group">
                <label>Data de recebimento</label>
                <input type="date" value={form.dataRecebimento} onChange={e=>set("dataRecebimento",e.target.value)}/>
              </div>
            </div>
          </>
        )}

        <div className="form-group">
          <label>Observações</label>
          <textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/>
        </div>
      </div>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Compras() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const p = getPerfilEnriquecido(userProfile);

  const [compras,      setCompras]      = useState([]);
  const [obras,        setObras]        = useState([]);
  const [manutencoes,  setManutencoes]  = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [etapaAtiva,   setEtapaAtiva]   = useState("SOLICITAÇÃO");
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState(null);

  useEffect(() => {
    const u1=onSnapshot(collection(db,"compras"),snap=>{
      const d=snap.docs.map(x=>({id:x.id,...x.data()}));
      d.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setCompras(d); setLoading(false);
    });
    const u2=onSnapshot(collection(db,"obras"),snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(collection(db,"manutencoes"),snap=>setManutencoes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4=onSnapshot(collection(db,"fornecedores"),snap=>setFornecedores(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();u3();u4();};
  },[]);

  // Etapas visíveis para este perfil
  const etapasVisiveis = useMemo(() =>
    ETAPAS.filter(e => e.podeVer(p)),
    [p]
  );

  // Compras filtradas pela etapa ativa + busca
  const comprasFiltradas = useMemo(() => {
    const q = search.toLowerCase();
    return compras.filter(c => {
      const naEtapa = c.status === etapaAtiva;
      const buscaOk = !q ||
        c.titulo?.toLowerCase().includes(q) ||
        c.demandaNome?.toLowerCase().includes(q) ||
        c.fornecedorNome?.toLowerCase().includes(q) ||
        c.numeroPedido?.toLowerCase().includes(q) ||
        c.numeroNF?.toLowerCase().includes(q);
      return naEtapa && buscaOk;
    });
  }, [compras, etapaAtiva, search]);

  // KPIs globais
  const kpis = useMemo(() => ({
    solicit:      compras.filter(c=>c.status==="SOLICITAÇÃO").length,
    cotacao:      compras.filter(c=>c.status==="COTAÇÃO").length,
    aprovadas:    compras.filter(c=>c.status==="APROVADA").length,
    comprometido: compras.filter(c=>["APROVADA","ORDEM DE COMPRA"].includes(c.status)).reduce((s,c)=>s+(Number(c.valorAprovado)||0),0),
    pendNF:       compras.filter(c=>c.status==="RECEBIDO").length,
  }), [compras]);

  const etapaInfo = ETAPAS.find(e => e.id === etapaAtiva);
  const podeEditarEtapa = etapaInfo?.podeEditar(p);
  const podeNovaCompra  = ETAPAS[0].podeEditar(p); // criar = permissão de Solicitação

  const fmt = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0})}`;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      {/* Header */}
      <div className="panel-header">
        <div>
          <div className="panel-title">Compras</div>
          <div style={{ fontSize:12, color:"#7A7A7A" }}>
            {compras.length} pedidos · {etapaInfo?.label}: <strong>{comprasFiltradas.length}</strong>
          </div>
        </div>
        {podeNovaCompra && (
          <button className="btn btn-primary" onClick={()=>setModal({compra:null, etapa:"SOLICITAÇÃO"})}>
            + Nova solicitação
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="metrics-grid" style={{ marginBottom:16 }}>
        <div className="metric"><div className="metric-label">Solicitações abertas</div><div className="metric-value amber">{kpis.solicit}</div></div>
        <div className="metric"><div className="metric-label">Em cotação</div><div className="metric-value" style={{color:"#185FA5"}}>{kpis.cotacao}</div></div>
        <div className="metric"><div className="metric-label">Aguard. aprovação</div><div className="metric-value yellow">{kpis.aprovadas}</div></div>
        <div className="metric"><div className="metric-label">Valor comprometido</div><div className="metric-value red" style={{fontSize:16}}>{fmt(kpis.comprometido)}</div></div>
        <div className="metric"><div className="metric-label">Aguard. NF</div><div className="metric-value amber">{kpis.pendNF}</div></div>
      </div>

      {/* Barra de etapas — só mostra as que o perfil pode ver */}
      <div style={{ display:"flex", gap:0, marginBottom:20, borderRadius:10, overflow:"hidden", border:"1px solid var(--border)" }}>
        {etapasVisiveis.map((etapa, i) => {
          const count   = compras.filter(c=>c.status===etapa.id).length;
          const ativa   = etapaAtiva === etapa.id;
          const anterior = etapasVisiveis.slice(0, i).every(e => compras.filter(c=>c.status===e.id).length === 0);
          return (
            <button key={etapa.id} onClick={() => setEtapaAtiva(etapa.id)}
              style={{
                flex: 1, padding:"10px 8px", border:"none", cursor:"pointer",
                background: ativa ? etapa.cor : "var(--cinza-lt)",
                color: ativa ? "#fff" : "#4A4A4A",
                borderRight: i < etapasVisiveis.length-1 ? "1px solid var(--border)" : "none",
                transition:"all .15s", position:"relative",
              }}>
              <div style={{ fontSize:14, marginBottom:2 }}>{etapa.icone}</div>
              <div style={{ fontSize:10, fontWeight:700, lineHeight:1.2 }}>{etapa.label}</div>
              {count > 0 && (
                <div style={{
                  position:"absolute", top:6, right:6,
                  background: ativa ? "rgba(255,255,255,.3)" : etapa.cor,
                  color: ativa ? "#fff" : "#fff",
                  fontSize:9, fontWeight:700, borderRadius:10,
                  padding:"1px 5px", minWidth:16, textAlign:"center",
                }}>
                  {count}
                </div>
              )}
              {/* Indicador de permissão */}
              {!etapa.podeEditar(p) && (
                <div style={{ fontSize:8, color:ativa?"rgba(255,255,255,.6)":"#aaa", marginTop:2 }}>🔒 somente leitura</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Descrição da etapa ativa */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, padding:"10px 14px", background:"var(--cinza-lt)", borderRadius:8 }}>
        <span style={{ fontSize:20 }}>{etapaInfo?.icone}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:600, fontSize:13 }}>{etapaInfo?.label}</div>
          <div style={{ fontSize:12, color:"#7A7A7A" }}>{etapaInfo?.desc}</div>
        </div>
        {!podeEditarEtapa && (
          <span style={{ fontSize:11, background:"var(--cinza-lt)", border:"1px solid var(--border)", padding:"3px 10px", borderRadius:20, color:"#7A7A7A" }}>
            🔒 Somente leitura nesta etapa
          </span>
        )}
        {podeEditarEtapa && (
          <span style={{ fontSize:11, background:"var(--verde-lt)", border:"1px solid rgba(45,106,31,.2)", padding:"3px 10px", borderRadius:20, color:"var(--verde)", fontWeight:600 }}>
            ✓ Você pode editar
          </span>
        )}
      </div>

      {/* Busca */}
      <div className="search-bar">
        🔍<input placeholder={`Buscar em ${etapaInfo?.label}...`} value={search} onChange={e=>setSearch(e.target.value)}/>
        {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:"#7A7A7A" }}>✕</button>}
      </div>

      {/* Lista de compras da etapa */}
      {loading && <div className="spinner"/>}
      {!loading && comprasFiltradas.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">{etapaInfo?.icone}</div>
          <p>Nenhuma compra em <strong>{etapaInfo?.label}</strong></p>
          {etapaAtiva === "SOLICITAÇÃO" && podeNovaCompra && (
            <button className="btn btn-primary" style={{ marginTop:12 }} onClick={()=>setModal({compra:null,etapa:"SOLICITAÇÃO"})}>
              + Criar primeira solicitação
            </button>
          )}
        </div>
      )}

      {!loading && comprasFiltradas.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {comprasFiltradas.map(c => (
            <div key={c.id} className="rdo-card" style={{ borderLeft:`4px solid ${ETAPAS.find(e=>e.id===c.status)?.cor||"#ccc"}` }}>
              <div className="rdo-header">
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{c.titulo}</div>
                  <div style={{ fontSize:12, color:"#7A7A7A", marginTop:2 }}>
                    {c.demandaNome||c.demandaTipo}
                    {c.fornecedorNome && <> · <strong>{c.fornecedorNome}</strong></>}
                    {c.autorNome && <> · por {c.autorNome}</>}
                  </div>
                  {/* Info específica por etapa */}
                  <div style={{ display:"flex", gap:12, marginTop:6, flexWrap:"wrap" }}>
                    {c.urgencia && c.urgencia !== "normal" && (
                      <span className={`badge ${c.urgencia==="urgente"?"badge-red":c.urgencia==="alta"?"badge-amber":"badge-gray"}`} style={{ fontSize:10 }}>
                        {c.urgencia}
                      </span>
                    )}
                    {c.valorCotado && (
                      <span style={{ fontSize:12 }}>💬 Cotado: <strong style={{ color:"var(--afine-yellow-dk)" }}>{fmt(c.valorCotado)}</strong></span>
                    )}
                    {c.valorAprovado && (
                      <span style={{ fontSize:12 }}>✅ Aprovado: <strong style={{ color:"var(--verde)" }}>{fmt(c.valorAprovado)}</strong></span>
                    )}
                    {c.numeroPedido && (
                      <span style={{ fontSize:12 }}>📋 OC: <strong>{c.numeroPedido}</strong></span>
                    )}
                    {c.prazoEntrega && (
                      <span style={{ fontSize:12 }}>📅 Entrega: {fmtDate(c.prazoEntrega)}</span>
                    )}
                    {c.numeroNF && (
                      <span style={{ fontSize:12 }}>🧾 NF: <strong>{c.numeroNF}</strong> · {fmt(c.valorNF)}</span>
                    )}
                    {c.dataRecebimento && (
                      <span style={{ fontSize:12 }}>📦 Recebido: {fmtDate(c.dataRecebimento)}</span>
                    )}
                  </div>
                  {/* Itens */}
                  {c.itens?.length > 0 && (
                    <div style={{ marginTop:6, fontSize:11, color:"#7A7A7A" }}>
                      {c.itens.slice(0,3).map((it,i)=>`${it.nome} (${it.qtd}${it.un})`).join(" · ")}
                      {c.itens.length > 3 && ` +${c.itens.length-3} itens`}
                    </div>
                  )}
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                  {/* Botão editar — só se tiver permissão */}
                  {podeEditarEtapa ? (
                    <button className="btn btn-sm btn-primary" onClick={()=>setModal({compra:c, etapa:c.status})}>
                      ✏️ Editar
                    </button>
                  ) : (
                    <button className="btn btn-sm" onClick={()=>setModal({compra:c, etapa:c.status})} style={{ opacity:.7 }}>
                      👁️ Ver
                    </button>
                  )}
                  <span style={{ fontSize:10, color:"#7A7A7A" }}>{fmtDate(c.updatedAt||c.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <CompraModal
          compra={modal.compra}
          etapaAtual={modal.etapa}
          obras={obras}
          manutencoes={manutencoes}
          fornecedores={fornecedores}
          onClose={()=>setModal(null)}
          addToast={addToast}
        />
      )}
    </div>
  );
}
