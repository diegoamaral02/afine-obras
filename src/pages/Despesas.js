// src/pages/Despesas.js — Controle de gastos / reembolsos por funcionário
// (migrado da antiga aba "Controle de Gasto" da planilha)
import React, { useEffect, useState, useMemo, useRef } from "react";
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
import OCRViewer from "../components/OCRViewer";

const METODOS = ["Cartão","PIX","Transferência","Dinheiro","Boleto","Outro"];

// Converte imagem para efeito de documento escaneado (escala de cinza + contraste)
async function aplicarFiltroEscaneado(file) {
  return new Promise((resolve) => {
    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onload = e => resolve({ tipo: "pdf", data: e.target.result, nome: file.name });
      reader.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 1000;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        // Escala de cinza
        const g = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114;
        // Boost de contraste (fator 1.5) + leve clareamento (simula scanner)
        const c = Math.min(255, Math.max(0, (g - 128) * 1.5 + 148));
        d[i] = d[i+1] = d[i+2] = c;
      }
      ctx.putImageData(imgData, 0, 0);
      URL.revokeObjectURL(url);
      resolve({ tipo: "imagem", data: canvas.toDataURL("image/jpeg", 0.82), nome: file.name });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
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
    reembolsoEscolha: despesa?.id ? (despesa?.reembolso ? "sim" : "nao") : "",
    reembolsado:     despesa?.reembolsado     || false,
    dataReembolso:   despesa?.dataReembolso   || "",
    revisado:        despesa?.revisado        || false,
    funcionarioId:   despesa?.funcionarioId   || currentUser?.uid || "",
    funcionarioNome: despesa?.funcionarioNome || nomeUser,
    vinculoTipo:     vinculoInicial(),
    obraId:          despesa?.obraId          || "",
    obraNome:        despesa?.obraNome        || "",
    manutencaoId:    despesa?.manutencaoId    || "",
    manutencaoTitulo:despesa?.manutencaoTitulo|| "",
    obs:             despesa?.obs             || "",
    comprovante:     despesa?.comprovante     || null,
  });
  const [saving,      setSaving]      = useState(false);
  const [processando, setProcessando] = useState(false);
  const [ocrAberto,   setOcrAberto]   = useState(false);
  const fotoRef    = useRef(null);
  const arquivoRef = useRef(null);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  async function handleComprovante(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessando(true);
    const resultado = await aplicarFiltroEscaneado(file);
    if (resultado) set("comprovante", resultado);
    setProcessando(false);
    e.target.value = "";
  }

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

  function handleOCRResultado(texto, dadosExtraidos) {
    setOcrAberto(false);
    // Preenche valor
    if (dadosExtraidos?.valorTotal) {
      set("valor", dadosExtraidos.valorTotal);
    }
    // Preenche data (converte DD/MM/AAAA -> YYYY-MM-DD)
    if (dadosExtraidos?.data) {
      const d = dadosExtraidos.data;
      if (d.includes("/")) {
        const [dia, mes, ano] = d.split("/");
        set("data", `${ano}-${mes}-${dia}`);
      } else {
        set("data", d);
      }
    }
    // Preenche descrição com a linha mais longa não numérica (até 60 chars)
    if (texto) {
      const linhas = texto.split("\n").map(l => l.trim()).filter(l => l.length > 3 && !/^\d[\d\s\.,\/\-:]*$/.test(l));
      if (linhas.length > 0) {
        const maisLonga = linhas.reduce((a, b) => b.length > a.length ? b : a, "");
        set("descricao", maisLonga.slice(0, 60));
      }
    }
    addToast("✓ Dados preenchidos pelo OCR — revise antes de salvar");
  }

  async function save() {
    if (!form.descricao || !form.valor || !form.data) { alert("Informe data, descrição e valor."); return; }
    if (!form.vinculoTipo) { alert("Escolha o vínculo: Obra, Manutenção ou Nenhum vínculo."); return; }
    if (form.vinculoTipo==="obra" && !form.obraId) { alert("Selecione a obra."); return; }
    if (form.vinculoTipo==="manutencao" && !form.manutencaoId) { alert("Selecione a manutenção."); return; }
    if (!form.reembolsoEscolha) { alert("Escolha se necessita reembolso ao funcionário ou não."); return; }
    if (!form.comprovante && !despesa?.id) { alert("Anexe o comprovante (foto da nota ou arquivo)."); return; }

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

        {/* Comprovante — foto da nota ou arquivo */}
        <div className="form-group span-2">
          <label className="required">Comprovante (nota / recibo)</label>
          <input ref={fotoRef}    type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleComprovante}/>
          <input ref={arquivoRef} type="file" accept="image/*,application/pdf"       style={{display:"none"}} onChange={handleComprovante}/>

          {processando && (
            <div style={{border:"1px solid var(--border)",borderRadius:8,padding:20,textAlign:"center",color:"#7A7A7A",fontSize:12}}>
              ⏳ Processando imagem...
            </div>
          )}

          {!processando && !form.comprovante && (
            <div style={{border:"2px dashed var(--border)",borderRadius:8,padding:20,textAlign:"center",background:"var(--cinza-lt)"}}>
              <div style={{fontSize:12,color:"#7A7A7A",marginBottom:12}}>
                📎 Anexe a foto da nota fiscal ou comprovante de pagamento
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
                <button type="button" className="btn" onClick={()=>fotoRef.current.click()}>📸 Tirar foto</button>
                <button type="button" className="btn" onClick={()=>arquivoRef.current.click()}>📁 Subir arquivo</button>
                <button type="button" className="btn" onClick={()=>setOcrAberto(true)}>🔍 Ler com OCR</button>
              </div>
              {!despesa?.id && (
                <div style={{fontSize:11,color:"var(--vermelho)",marginTop:8}}>Obrigatório para registrar a despesa.</div>
              )}
              {despesa?.id && (
                <div style={{fontSize:11,color:"var(--afine-yellow-dk)",marginTop:8}}>⚠️ Esta despesa ainda não tem comprovante.</div>
              )}
            </div>
          )}

          {!processando && form.comprovante && (
            <div style={{border:"1px solid var(--verde)",borderRadius:8,padding:10,background:"var(--verde-lt)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:12,color:"var(--verde)",fontWeight:600}}>✓ Comprovante anexado — efeito escaneado aplicado</span>
                <button type="button" className="btn btn-sm" onClick={()=>set("comprovante",null)}>Trocar</button>
              </div>
              {form.comprovante.tipo==="imagem" ? (
                <img src={form.comprovante.data} alt="Comprovante" style={{maxWidth:"100%",maxHeight:220,borderRadius:4,border:"1px solid #ddd",display:"block"}}/>
              ) : (
                <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                  📄 <span style={{fontWeight:600}}>{form.comprovante.nome}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="form-group span-2"><label>Observações</label><textarea rows={2} value={form.obs} onChange={e=>set("obs",e.target.value)}/></div>
      </div>
      {ocrAberto && (
        <OCRViewer
          titulo="Ler nota fiscal"
          onResultado={handleOCRResultado}
          onFechar={()=>setOcrAberto(false)}
        />
      )}
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
  const [preview,       setPreview]      = useState(null);

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
      <div className="search-bar" style={{marginBottom:8,position:"relative",display:"flex",alignItems:"center"}}>
        🔍<input placeholder="Buscar por descrição, funcionário, obra ou manutenção..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingRight:search?28:undefined}}/>
        {search && <button onClick={()=>setSearch("")} title="Limpar busca" style={{position:"absolute",right:8,background:"none",border:"none",cursor:"pointer",color:"#7A7A7A",fontSize:16,lineHeight:1,padding:0}}>✕</button>}
      </div>

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
                <th>Nota</th><th></th>
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
                  <td>
                    {d.comprovante ? (
                      <button className="btn btn-sm btn-icon" title="Ver comprovante" onClick={()=>setPreview(d.comprovante)}>🧾</button>
                    ) : (
                      <span style={{fontSize:11,color:"#B8B6AE"}} title="Sem comprovante">—</span>
                    )}
                  </td>
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

      {/* Modal de visualização do comprovante */}
      {preview && (
        <div onClick={()=>setPreview(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:16,maxWidth:640,width:"100%",maxHeight:"90vh",overflow:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontWeight:700,fontSize:14}}>🧾 Comprovante</span>
              <button className="btn btn-sm" onClick={()=>setPreview(null)}>✕ Fechar</button>
            </div>
            {preview.tipo==="imagem" ? (
              <img src={preview.data} alt="Comprovante" style={{width:"100%",borderRadius:6,border:"1px solid #ddd"}}/>
            ) : (
              <div style={{textAlign:"center",padding:32}}>
                <div style={{fontSize:48,marginBottom:12}}>📄</div>
                <div style={{fontWeight:600,marginBottom:16}}>{preview.nome}</div>
                <a href={preview.data} download={preview.nome} className="btn btn-primary">⬇️ Baixar PDF</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
