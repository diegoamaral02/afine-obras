// src/pages/Despesas.js — Controle de gastos / reembolsos por funcionário
// (migrado da antiga aba "Controle de Gasto" da planilha)
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { podeEditar, isCampo } from "../constants/departamentos";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";
import { exportarDespesasParaPDF } from "../utils/exportPDF";
import FiltroAvancado, { dentroPeriodo } from "../components/FiltroAvancado";
import { addComAuditoria, updateComAuditoria, deleteComAuditoria } from "../services/auditoria";

const METODOS = ["Cartão","PIX","Transferência","Dinheiro","Boleto","Outro"];
// Gastos recorrentes — categorias rápidas para acelerar o lançamento
const CATEGORIAS = [
  "Pedágio","Gasolina","Alimentação","Compra para escritório","Estacionamento",
  "Zona azul","Hospedagem em atendimento","Manutenção do carro","Uniforme e EPI","Caçamba","Outro",
];
const fmt  = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;
const hoje = () => new Date().toISOString().split("T")[0];

// ── Modal de Despesa ─────────────────────────────────────────────────────────
function DespesaModal({ despesa, funcionarios, obras, manutencoes, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const isCampoUser = isCampo(userProfile);
  const nomeUser = userProfile?.nome || currentUser?.email || "–";
  const podeRevisar = !isCampoUser; // Gestão/Financeiro/ADM podem marcar como revisado

  // ANEXO3: vínculo passa a ser uma escolha explícita e obrigatória —
  // Obra / Manutenção / Nenhum vínculo — em vez de só "obra ou geral".
  function vinculoInicial() {
    if (despesa?.manutencaoId) return "manutencao";
    if (despesa?.obraId) return "obra";
    if (despesa?.id) return "nenhum"; // já existia e não tinha vínculo
    return ""; // nova despesa: força escolha
  }

  const [form, setForm] = useState({
    data:            despesa?.data            || hoje(),
    categoria:       despesa?.categoria       || "",
    descricao:       despesa?.descricao       || "",
    valor:           despesa?.valor           || "",
    metodoPagamento: despesa?.metodoPagamento || "Cartão",
    cartao:          despesa?.cartao          || "",
    cartaoPessoal:   despesa?.cartaoPessoal   || false,
    // ANEXO4: reembolso passa a ser uma escolha explícita obrigatória, sem
    // valor padrão — "" força o usuário a decidir sim ou não.
    reembolsoEscolha: despesa?.id ? (despesa?.reembolso ? "sim" : "nao") : "",
    reembolsado:     despesa?.reembolsado     || false,
    dataReembolso:   despesa?.dataReembolso   || "",
    revisado:        despesa?.revisado        || false,
    // ANEXO2: funcionário já vem preenchido com quem está logado (Campo fica
    // travado nisso; os demais podem trocar, por ex. ao lançar em nome de outro)
    funcionarioId:   despesa?.funcionarioId   || currentUser?.uid || "",
    funcionarioNome: despesa?.funcionarioNome || nomeUser,
    vinculoTipo:     vinculoInicial(),
    obraId:          despesa?.obraId          || "",
    obraNome:        despesa?.obraNome        || "",
    manutencaoId:    despesa?.manutencaoId    || "",
    manutencaoTitulo:despesa?.manutencaoTitulo|| "",
    obs:             despesa?.obs             || "",
  });
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  function handleCategoria(cat) {
    // ANEXO1: a descrição sempre acompanha a categoria escolhida (não só quando vazia)
    setForm(p=>({...p, categoria:cat, descricao:cat}));
  }

  function handleFuncComCartao(id) {
    const f = funcionarios.find(x=>x.id===id);
    setForm(p=>({
      ...p, funcionarioId: id, funcionarioNome: f?.nome||"",
      cartao: (p.metodoPagamento==="Cartão" && !p.cartaoPessoal) ? (f?.cartaoCorporativo||"") : p.cartao,
    }));
  }

  function handleMetodo(metodo) {
    setForm(p=>{
      const f = funcionarios.find(x=>x.id===p.funcionarioId);
      const novoCartao = (metodo==="Cartão" && !p.cartaoPessoal) ? (f?.cartaoCorporativo||"") : "";
      return { ...p, metodoPagamento: metodo, cartao: novoCartao };
    });
  }

  function toggleCartaoPessoal(checked) {
    setForm(p=>{
      const f = funcionarios.find(x=>x.id===p.funcionarioId);
      return { ...p, cartaoPessoal: checked, cartao: checked ? "" : (f?.cartaoCorporativo||"") };
    });
  }

  function handleObra(id) {
    const o = obras.find(x=>x.id===id);
    set("obraId", id); set("obraNome", o?.nome||"");
  }
  function handleManutencao(id) {
    const m = manutencoes.find(x=>x.id===id);
    set("manutencaoId", id); set("manutencaoTitulo", m?.titulo||"");
  }

  async function save() {
    if (!form.descricao || !form.valor || !form.data) { alert("Informe data, descrição e valor."); return; }
    // ANEXO3 — obrigatório escolher o vínculo
    if (!form.vinculoTipo) { alert("Escolha o vínculo: Obra, Manutenção ou Nenhum vínculo."); return; }
    if (form.vinculoTipo==="obra" && !form.obraId) { alert("Selecione a obra."); return; }
    if (form.vinculoTipo==="manutencao" && !form.manutencaoId) { alert("Selecione a manutenção."); return; }
    // ANEXO4 — obrigatório decidir sobre reembolso
    if (!form.reembolsoEscolha) { alert("Escolha se necessita reembolso ao funcionário ou não."); return; }

    setSaving(true);
    const reembolso = form.reembolsoEscolha === "sim";
    const payload = {
      ...form, valor: Number(form.valor),
      reembolso,
      reembolsado: reembolso ? form.reembolsado : false,
      dataReembolso: (reembolso && form.reembolsado) ? (form.dataReembolso || hoje()) : "",
      obraId: form.vinculoTipo==="obra" ? form.obraId : "",
      obraNome: form.vinculoTipo==="obra" ? form.obraNome : "",
      manutencaoId: form.vinculoTipo==="manutencao" ? form.manutencaoId : "",
      manutencaoTitulo: form.vinculoTipo==="manutencao" ? form.manutencaoTitulo : "",
    };
    delete payload.reembolsoEscolha;
    try {
      // Lançamento livre: não há etapa de aprovação para salvar — qualquer
      // usuário pode registrar sua própria despesa. O controle acontece depois,
      // via revisão (campo "revisado"), não como bloqueio na hora de lançar.
      if (despesa?.id) { await updateComAuditoria("despesas", despesa.id, payload, currentUser?.uid, nomeUser); addToast("✓ Despesa atualizada!"); }
      else { await addComAuditoria("despesas", payload, currentUser?.uid, nomeUser); addToast("✓ Despesa registrada!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title={despesa?.id ? "Editar despesa" : "Nova despesa"} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button>
      </>}>
      <div className="form-grid">
        <div className="form-group span-2">
          <label>Categoria (gastos recorrentes)</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {CATEGORIAS.map(cat=>{
              const ativo = form.categoria===cat;
              return (
                <button key={cat} type="button" onClick={()=>handleCategoria(cat)}
                  style={{
                    fontSize:11, padding:"5px 10px", borderRadius:14, cursor:"pointer",
                    border:`1px solid ${ativo?"var(--afine-yellow-dk)":"var(--border)"}`,
                    background:ativo?"var(--afine-yellow-lt)":"var(--cinza-lt)",
                    fontWeight:ativo?700:400,
                  }}>
                  {ativo?"✓ ":""}{cat}
                </button>
              );
            })}
          </div>
        </div>
        <div className="form-group"><label className="required">Data</label><input type="date" value={form.data} onChange={e=>set("data",e.target.value)}/></div>
        <div className="form-group"><label className="required">Valor (R$)</label><input type="number" step="0.01" value={form.valor} onChange={e=>set("valor",e.target.value)} placeholder="0,00"/></div>
        <div className="form-group span-2"><label className="required">Descrição</label><input value={form.descricao} onChange={e=>set("descricao",e.target.value)} placeholder="Ex: Material, Combustível, Gasolina..."/></div>

        <div className="form-group">
          <label>Funcionário</label>
          {isCampoUser ? (
            <input value={form.funcionarioNome} disabled style={{background:"var(--cinza-lt)"}}/>
          ) : (
            <>
              <select value={form.funcionarioId} onChange={e=>handleFuncComCartao(e.target.value)}>
                <option value="">Selecione...</option>
                {funcionarios.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              {!form.funcionarioId && (
                <input value={form.funcionarioNome} onChange={e=>set("funcionarioNome",e.target.value)} placeholder="Ou digite o nome (não cadastrado)" style={{marginTop:6}}/>
              )}
            </>
          )}
        </div>
        <div className="form-group">
          <label>Método de pagamento</label>
          <select value={form.metodoPagamento} onChange={e=>handleMetodo(e.target.value)}>
            {METODOS.map(m=><option key={m}>{m}</option>)}
          </select>
        </div>

        {form.metodoPagamento==="Cartão" && (
          <div className="form-group span-2" style={{background:"var(--cinza-lt)",borderRadius:8,padding:10}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:8}}>
              <input type="checkbox" checked={form.cartaoPessoal} onChange={e=>toggleCartaoPessoal(e.target.checked)} style={{width:"auto"}}/>
              Foi usado cartão pessoal (não o corporativo)
            </label>
            <input value={form.cartao} onChange={e=>set("cartao",e.target.value)}
              placeholder={form.cartaoPessoal?"Ex: cartão pessoal do funcionário":"Cartão corporativo cadastrado para este funcionário"}/>
            {!form.cartaoPessoal && !form.cartao && (
              <div style={{fontSize:11,color:"var(--afine-yellow-dk)",marginTop:4}}>
                ⚠️ Este funcionário não tem cartão corporativo cadastrado. Cadastre em Funcionários, ou marque "cartão pessoal".
              </div>
            )}
          </div>
        )}

        {/* ANEXO3 — vínculo obrigatório: Obra, Manutenção ou Nenhum */}
        <div className="form-group span-2">
          <label className="required">Vínculo (centro de custo)</label>
          <div style={{display:"flex",gap:6,marginBottom:form.vinculoTipo?8:0}}>
            {[["obra","🏗️ Obra"],["manutencao","🔧 Manutenção"],["nenhum","— Nenhum vínculo"]].map(([v,l])=>(
              <button key={v} type="button" onClick={()=>set("vinculoTipo",v)}
                style={{
                  flex:1, padding:"8px 6px", fontSize:12, borderRadius:8, cursor:"pointer",
                  border:`1px solid ${form.vinculoTipo===v?"var(--afine-yellow-dk)":"var(--border)"}`,
                  background:form.vinculoTipo===v?"var(--afine-yellow-lt)":"#fff",
                  fontWeight:form.vinculoTipo===v?700:400,
                }}>{l}</button>
            ))}
          </div>
          {!form.vinculoTipo && <div style={{fontSize:11,color:"var(--vermelho)"}}>Escolha uma opção — campo obrigatório.</div>}
          {form.vinculoTipo==="obra" && (
            <select value={form.obraId} onChange={e=>handleObra(e.target.value)}>
              <option value="">Selecione a obra...</option>
              {obras.map(o=><option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          )}
          {form.vinculoTipo==="manutencao" && (
            <select value={form.manutencaoId} onChange={e=>handleManutencao(e.target.value)}>
              <option value="">Selecione a manutenção...</option>
              {manutencoes.map(m=><option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
          )}
        </div>

        {/* ANEXO4 — reembolso obrigatório, sem valor padrão */}
        <div className="form-group span-2" style={{background:"var(--cinza-lt)",borderRadius:8,padding:10}}>
          <label className="required" style={{display:"block",marginBottom:8}}>Necessita reembolso ao funcionário?</label>
          <div style={{display:"flex",gap:6}}>
            {[["sim","Sim, necessita reembolso"],["nao","Não necessita reembolso"]].map(([v,l])=>(
              <button key={v} type="button" onClick={()=>set("reembolsoEscolha",v)}
                style={{
                  flex:1, padding:"8px 6px", fontSize:12, borderRadius:8, cursor:"pointer",
                  border:`1px solid ${form.reembolsoEscolha===v?"var(--afine-yellow-dk)":"var(--border)"}`,
                  background:form.reembolsoEscolha===v?"var(--afine-yellow-lt)":"#fff",
                  fontWeight:form.reembolsoEscolha===v?700:400,
                }}>{l}</button>
            ))}
          </div>
          {!form.reembolsoEscolha && <div style={{fontSize:11,color:"var(--vermelho)",marginTop:6}}>Escolha uma opção — campo obrigatório.</div>}

          {form.reembolsoEscolha==="sim" && (
            <div style={{marginTop:10,paddingLeft:4,display:"flex",flexDirection:"column",gap:6}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={form.reembolsado} onChange={e=>set("reembolsado",e.target.checked)} style={{width:"auto"}}/>
                <span style={{color:form.reembolsado?"var(--verde)":"var(--vermelho)",fontWeight:600}}>
                  {form.reembolsado ? "✓ Já foi reembolsado" : "⏳ Ainda pendente de reembolso"}
                </span>
              </label>
              {form.reembolsado && (
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <label style={{margin:0,fontSize:12}}>Data do reembolso</label>
                  <input type="date" value={form.dataReembolso||hoje()} onChange={e=>set("dataReembolso",e.target.value)} style={{width:160}}/>
                </div>
              )}
            </div>
          )}
        </div>

        {podeRevisar && despesa?.id && (
          <div className="form-group span-2">
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
              <input type="checkbox" checked={form.revisado} onChange={e=>set("revisado",e.target.checked)} style={{width:"auto"}}/>
              ✓ Revisado/conferido pela gestão
            </label>
          </div>
        )}

        <div className="form-group span-2"><label>Observações</label><textarea rows={2} value={form.obs} onChange={e=>set("obs",e.target.value)}/></div>
      </div>
    </Modal>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Despesas() {
  const { userProfile, currentUser } = useAuth();
  const podeEditarDespesas = podeEditar(userProfile, "despesas"); // editar/excluir/revisar = gestão/financeiro/adm
  const souCampo = isCampo(userProfile);
  const nomeUser = userProfile?.nome || currentUser?.email || "–";
  const { toasts, addToast } = useToast();
  const [despesas,     setDespesas]     = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [obras,        setObras]        = useState([]);
  const [manutencoes,  setManutencoes]  = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [search,        setSearch]       = useState("");
  const [filtros,       setFiltros]      = useState({ periodo:{de:"",ate:""}, funcionarioNome:"", metodoPagamento:"", obraId:"", categoria:"", statusReembolso:"", revisado:"" });
  const [qtdMostrar,    setQtdMostrar]   = useState(100);
  const [modal,         setModal]        = useState(null);

  useEffect(()=>{
    const q1 = query(collection(db,"despesas"), orderBy("data","desc"), limit(3000));
    const u1 = onSnapshot(q1, snap=>{ setDespesas(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); }, ()=>setLoading(false));
    const u2 = onSnapshot(collection(db,"usuarios"), snap=>setFuncionarios(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="ATIVO"||!f.status)));
    const u3 = onSnapshot(collection(db,"obras"), snap=>setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4 = onSnapshot(collection(db,"manutencoes"), snap=>setManutencoes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();u3();u4();};
  },[]);

  const nomesFuncionarios = useMemo(()=>[...new Set(despesas.map(d=>d.funcionarioNome).filter(Boolean))].sort(),[despesas]);

  // Campo só vê as próprias despesas (compatível com registros antigos sem
  // funcionarioId, via nome) — mesmo padrão usado em Compras/Calendário.
  const despesasVisiveis = useMemo(()=>{
    if (!souCampo) return despesas;
    return despesas.filter(d => d.funcionarioId ? d.funcionarioId===currentUser?.uid : d.funcionarioNome===nomeUser);
  },[despesas, souCampo, currentUser, nomeUser]);

  function statusReembolsoDe(d) {
    if (!d.reembolso) return "nao_precisa";
    return d.reembolsado ? "reembolsado" : "pendente";
  }

  const filtradas = useMemo(()=>{
    const q = search.toLowerCase();
    return despesasVisiveis.filter(d=>{
      const mQ = !q || d.descricao?.toLowerCase().includes(q) || d.funcionarioNome?.toLowerCase().includes(q) || d.obraNome?.toLowerCase().includes(q) || d.manutencaoTitulo?.toLowerCase().includes(q);
      const mPeriodo = dentroPeriodo(d.data, filtros.periodo);
      const mFunc = !filtros.funcionarioNome || d.funcionarioNome===filtros.funcionarioNome;
      const mMetodo = !filtros.metodoPagamento || d.metodoPagamento===filtros.metodoPagamento;
      const mObra = !filtros.obraId || d.obraId===filtros.obraId;
      const mCategoria = !filtros.categoria || d.categoria===filtros.categoria;
      const mReemb = !filtros.statusReembolso || statusReembolsoDe(d)===filtros.statusReembolso;
      const mRevisado = filtros.revisado==="" || (filtros.revisado===true ? !!d.revisado : !d.revisado);
      return mQ && mPeriodo && mFunc && mMetodo && mObra && mCategoria && mReemb && mRevisado;
    });
  },[despesas,search,filtros]);

  const kpis = useMemo(()=>({
    total: filtradas.reduce((s,d)=>s+(d.valor||0),0),
    qtd: filtradas.length,
    pendentesReembolso: filtradas.filter(d=>d.reembolso&&!d.reembolsado).reduce((s,d)=>s+(d.valor||0),0),
    qtdPendentes: filtradas.filter(d=>d.reembolso&&!d.reembolsado).length,
    naoRevisadas: filtradas.filter(d=>!d.revisado).length,
  }),[filtradas]);

  async function excluir(d) {
    if (!window.confirm(`Excluir a despesa "${d.descricao}" (${fmt(d.valor)})?`)) return;
    try { await deleteComAuditoria("despesas", d.id, currentUser?.uid, nomeUser, d); addToast("✓ Excluída"); }
    catch(err) { addToast("Erro: "+err.message,"error"); }
  }

  async function alternarRevisado(d) {
    try { await updateComAuditoria("despesas", d.id, { revisado: !d.revisado }, currentUser?.uid, nomeUser); }
    catch(err) { addToast("Erro: "+err.message,"error"); }
  }

  function exportar() {
    exportarExcel(filtradas, "despesas", [
      { key:"data", header:"Data" },
      { key:"categoria", header:"Categoria" },
      { key:"descricao", header:"Descrição" },
      { key:"valor", header:"Valor", format:v=>Number(v||0).toFixed(2) },
      { key:"metodoPagamento", header:"Método" },
      { key:"cartao", header:"Cartão" },
      { key:"reembolso", header:"Necessita reembolso", format:v=>v?"Sim":"Não" },
      { key:"reembolsado", header:"Já reembolsado", format:v=>v?"Sim":"Não" },
      { key:"revisado", header:"Revisado", format:v=>v?"Sim":"Não" },
      { key:"funcionarioNome", header:"Funcionário" },
      { key:"obraNome", header:"Obra (centro de custo)" },
      { key:"manutencaoTitulo", header:"Manutenção" },
      { key:"obs", header:"Observações" },
    ]);
  }

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Despesas</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{despesasVisiveis.length} registro(s){souCampo?" seu(s)":""} · {filtradas.length} exibido(s) no filtro atual</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <BtnExcel onClick={exportar} disabled={filtradas.length===0}/>
          <button className="btn btn-sm" disabled={filtradas.length===0} onClick={()=>exportarDespesasParaPDF(filtradas)}>📄 PDF</button>
          {/* Qualquer usuário pode lançar sua própria despesa — sem aprovação prévia */}
          <button className="btn btn-primary" onClick={()=>setModal({despesa:null})}>+ Nova despesa</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-label">TOTAL NO FILTRO</div><div className="kpi-value">{fmt(kpis.total)}</div></div>
        <div className="kpi-card"><div className="kpi-label">LANÇAMENTOS</div><div className="kpi-value">{kpis.qtd}</div></div>
        <div className="kpi-card" style={{borderLeftColor:"var(--vermelho)"}}>
          <div className="kpi-label">A REEMBOLSAR (PENDENTE)</div>
          <div className="kpi-value" style={{color:"var(--vermelho)"}}>{fmt(kpis.pendentesReembolso)}</div>
          <div style={{fontSize:11,color:"#7A7A7A"}}>{kpis.qtdPendentes} lançamento(s)</div>
        </div>
        {podeEditarDespesas && (
          <div className="kpi-card" style={{borderLeftColor:"var(--afine-yellow-dk)"}}>
            <div className="kpi-label">AINDA NÃO REVISADAS</div>
            <div className="kpi-value" style={{color:"var(--afine-yellow-dk)"}}>{kpis.naoRevisadas}</div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="search-bar" style={{marginBottom:8}}>🔍<input placeholder="Buscar por descrição, funcionário, obra ou manutenção..." value={search} onChange={e=>setSearch(e.target.value)}/></div>

      <FiltroAvancado
        campos={[
          { tipo:"periodo", key:"periodo", label:"Período" },
          { tipo:"select", key:"obraId", label:"Obra (centro de custo)", opcoes: obras.map(o=>({value:o.id,label:o.nome})) },
          { tipo:"select", key:"funcionarioNome", label:"Funcionário", opcoes: nomesFuncionarios.map(n=>({value:n,label:n})) },
          { tipo:"select", key:"categoria", label:"Categoria", opcoes: CATEGORIAS.map(c=>({value:c,label:c})) },
          { tipo:"select", key:"metodoPagamento", label:"Método de pagamento", opcoes: METODOS.map(m=>({value:m,label:m})) },
          { tipo:"select", key:"statusReembolso", label:"Status do reembolso", opcoes: [
              {value:"nao_precisa",label:"Não precisa"},{value:"pendente",label:"Pendente"},{value:"reembolsado",label:"Já reembolsado"},
          ]},
          ...(podeEditarDespesas ? [{ tipo:"bool", key:"revisado", label:"Revisado" }] : []),
        ]}
        valores={filtros} onChange={setFiltros}
        onLimpar={()=>setFiltros({ periodo:{de:"",ate:""}, funcionarioNome:"", metodoPagamento:"", obraId:"", categoria:"", statusReembolso:"", revisado:"" })}
      />

      {loading && <div className="spinner"/>}
      {!loading && filtradas.length===0 && (
        <div className="empty-state"><div className="empty-icon">💰</div><p>Nenhuma despesa encontrada para esse filtro.</p></div>
      )}

      {!loading && filtradas.length>0 && (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th><th>Categoria</th><th>Descrição</th><th>Funcionário</th><th>Vínculo</th><th>Método</th>
                <th>Reembolso</th>{podeEditarDespesas && <th>Revisado</th>}<th style={{textAlign:"right"}}>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.slice(0,qtdMostrar).map(d=>{
                const stReemb = statusReembolsoDe(d);
                return (
                <tr key={d.id}>
                  <td>{d.data?.split("-").reverse().join("/")}</td>
                  <td>{d.categoria?<span className="badge badge-gray" style={{fontSize:10}}>{d.categoria}</span>:"–"}</td>
                  <td>{d.descricao}</td>
                  <td>{d.funcionarioNome||"–"}</td>
                  <td>
                    {d.obraNome && <span className="badge badge-blue" style={{fontSize:10}}>🏗️ {d.obraNome}</span>}
                    {d.manutencaoTitulo && <span className="badge badge-amber" style={{fontSize:10}}>🔧 {d.manutencaoTitulo}</span>}
                    {!d.obraNome && !d.manutencaoTitulo && <span style={{color:"#B8B6AE",fontSize:12}}>Sem vínculo</span>}
                  </td>
                  <td>{d.metodoPagamento||"–"}{d.cartao&&<div style={{fontSize:10,color:"#7A7A7A"}}>{d.cartaoPessoal?"💳 pessoal: ":"💳 "}{d.cartao}</div>}</td>
                  <td>
                    {stReemb==="nao_precisa" && "Não"}
                    {stReemb==="pendente" && <span style={{color:"var(--vermelho)",fontWeight:600}}>⏳ Pendente</span>}
                    {stReemb==="reembolsado" && <span style={{color:"var(--verde)",fontWeight:600}}>✓ Reembolsado</span>}
                  </td>
                  {podeEditarDespesas && (
                    <td>
                      <button className="btn btn-sm" onClick={()=>alternarRevisado(d)}
                        style={{background:d.revisado?"var(--verde-lt)":"var(--cinza-lt)",color:d.revisado?"var(--verde)":"#7A7A7A",border:"none"}}>
                        {d.revisado?"✓ Revisado":"Revisar"}
                      </button>
                    </td>
                  )}
                  <td style={{textAlign:"right",fontWeight:600}}>{fmt(d.valor)}</td>
                  <td style={{whiteSpace:"nowrap"}}>
                    {podeEditarDespesas && (
                      <>
                        <button className="btn btn-sm" onClick={()=>setModal({despesa:d})}>✏️</button>
                        <button className="btn btn-sm" onClick={()=>excluir(d)} style={{color:"var(--vermelho)"}}>🗑️</button>
                      </>
                    )}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
          {filtradas.length>qtdMostrar && (
            <div style={{textAlign:"center",marginTop:12}}>
              <button className="btn" onClick={()=>setQtdMostrar(q=>q+200)}>Carregar mais ({filtradas.length-qtdMostrar} restante(s))</button>
            </div>
          )}
        </>
      )}

      {modal && (
        <DespesaModal despesa={modal.despesa} funcionarios={funcionarios} obras={obras} manutencoes={manutencoes} onClose={()=>setModal(null)} addToast={addToast}/>
      )}
    </div>
  );
}
