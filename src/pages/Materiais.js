// src/pages/Materiais.js — controle global de estoque + por demanda
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { isCampo } from "../constants/departamentos";
import { addComAuditoria } from "../services/auditoria";

// Modal de movimentação (entrada ou saída)
function MovimentacaoModal({ item, tipo, obras, manutencoes, onClose, addToast }) {
  const { userProfile } = useAuth();
  const [form, setForm] = useState({
    quantidade: "",
    demandaTipo: "obra",
    demandaId: "",
    obs: "",
    data: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);
  function set(f, v) { setForm(p => ({...p, [f]: v})); }

  const demandas = form.demandaTipo === "obra" ? obras : manutencoes;

  async function save() {
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe uma quantidade válida."); return; }
    if (tipo === "saida" && Number(form.quantidade) > item.saldo) {
      alert(`Saldo insuficiente. Disponível: ${item.saldo} ${item.un}`); return;
    }
    setSaving(true);
    const mov = {
      materialId: item.id,
      materialNome: item.nome,
      tipo, // "entrada" | "saida"
      quantidade: Number(form.quantidade),
      demandaTipo: form.demandaTipo,
      demandaId: form.demandaId,
      demandaNome: demandas.find(d=>d.id===form.demandaId)?.nome || demandas.find(d=>d.id===form.demandaId)?.titulo || "",
      obs: form.obs,
      data: form.data,
      usuario: userProfile?.nome || "–",
      createdAt: new Date().toISOString(),
    };
    try {
      // Registra movimentação
      await addDoc(collection(db, "movimentacoes"), mov);
      // Atualiza saldo no item
      const novoSaldo = tipo === "entrada"
        ? item.saldo + Number(form.quantidade)
        : item.saldo - Number(form.quantidade);
      const totalEntradas = tipo === "entrada" ? item.totalEntradas + Number(form.quantidade) : item.totalEntradas;
      const totalSaidas   = tipo === "saida"   ? item.totalSaidas   + Number(form.quantidade) : item.totalSaidas;
      await updateDoc(doc(db, "materiais_estoque", item.id), { saldo: novoSaldo, totalEntradas, totalSaidas, updatedAt: new Date().toISOString() });
      addToast(tipo === "entrada" ? "Entrada registrada!" : "Saída registrada!");
      onClose();
    } catch(err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title={tipo==="entrada" ? "📥 Registrar entrada" : "📤 Registrar saída"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className={`btn ${tipo==="entrada"?"btn-primary":"btn-danger"}`} onClick={save} disabled={saving}>{saving?"Salvando...":"Confirmar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:tipo==="entrada"?"var(--verde-lt)":"var(--vermelho-lt)",borderRadius:8,padding:10,fontSize:13,fontWeight:500}}>
          {tipo==="entrada"?"📥 Entrada em estoque":"📤 Saída do estoque"} — <strong>{item.nome}</strong>
          <div style={{fontSize:12,fontWeight:400,marginTop:2}}>Saldo atual: <strong>{item.saldo} {item.un}</strong></div>
        </div>

        <div className="form-grid">
          <div className="form-group"><label className="required">Quantidade ({item.un})</label>
            <input type="number" min="1" value={form.quantidade} onChange={e=>set("quantidade",e.target.value)} placeholder="0"/>
          </div>
          <div className="form-group"><label>Data</label>
            <input type="date" value={form.data} onChange={e=>set("data",e.target.value)}/>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group"><label>Vincular a</label>
            <select value={form.demandaTipo} onChange={e=>{set("demandaTipo",e.target.value);set("demandaId","");}}>
              <option value="obra">Obra</option>
              <option value="manutencao">Manutenção</option>
              <option value="estoque">Estoque local (sem demanda)</option>
            </select>
          </div>
          {form.demandaTipo !== "estoque" && (
            <div className="form-group"><label>Qual {form.demandaTipo==="obra"?"obra":"manutenção"}?</label>
              <select value={form.demandaId} onChange={e=>set("demandaId",e.target.value)}>
                <option value="">Selecione...</option>
                {demandas.map(d=><option key={d.id} value={d.id}>{d.nome||d.titulo}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="form-group"><label>Observações</label>
          <input value={form.obs} onChange={e=>set("obs",e.target.value)} placeholder="Ex: NF 4521, Fornecedor Leroy..."/>
        </div>
      </div>
    </Modal>
  );
}

// Busca com input + dropdown filtrável para selecionar obra ou manutenção
function BuscaDestino({ tipo, lista, destinoId, onChange }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const getNome = (d) => tipo === "obra" ? d.nome : (d.titulo || d.descricao || d.id);
  const filtrados = lista.filter(d => getNome(d).toLowerCase().includes(busca.toLowerCase()));
  const selecionado = lista.find(d => d.id === destinoId);

  function selecionar(d) {
    onChange(d.id);
    setBusca(getNome(d));
    setAberto(false);
  }
  function handleBlur() { setTimeout(() => setAberto(false), 150); }

  return (
    <div className="form-group" style={{ position: "relative" }}>
      <label className="required">
        {tipo === "obra" ? "Obra de destino" : "Manutenção de destino"}
      </label>
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={busca}
          onChange={e => { setBusca(e.target.value); onChange(""); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={handleBlur}
          placeholder={`🔍 Buscar ${tipo === "obra" ? "obra" : "manutenção"}...`}
          style={{ width:"100%", boxSizing:"border-box", borderColor: selecionado ? "var(--verde)" : undefined }}
          autoComplete="off"
        />
        {busca && (
          <button type="button" onClick={() => { setBusca(""); onChange(""); setAberto(true); }}
            style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
              background:"none", border:"none", cursor:"pointer", color:"#aaa", fontSize:16 }}>×</button>
        )}
      </div>
      {aberto && (
        <div style={{
          position:"absolute", top:"100%", left:0, right:0, zIndex:50,
          background:"#fff", border:"1px solid #ddd", borderRadius:8,
          boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:200, overflowY:"auto", marginTop:2,
        }}>
          {filtrados.length === 0
            ? <div style={{ padding:"12px 14px", fontSize:13, color:"#aaa" }}>Nenhum resultado.</div>
            : filtrados.map(d => (
              <div key={d.id} onMouseDown={() => selecionar(d)}
                style={{
                  padding:"10px 14px", fontSize:13, cursor:"pointer",
                  background: d.id === destinoId ? "#fffbea" : "transparent",
                  borderBottom:"1px solid #f0f0f0",
                  fontWeight: d.id === destinoId ? 600 : 400,
                }}
                onMouseEnter={e => e.currentTarget.style.background="#f8f7f4"}
                onMouseLeave={e => e.currentTarget.style.background = d.id===destinoId?"#fffbea":"transparent"}
              >
                {tipo === "obra" ? "🏗️" : "🔧"} {getNome(d)}
                {tipo === "manutencao" && d.cliente && (
                  <span style={{ fontSize:11, color:"#aaa", marginLeft:6 }}>— {d.cliente}</span>
                )}
              </div>
            ))
          }
        </div>
      )}
      {selecionado && <span style={{ fontSize:11, color:"var(--verde)", fontWeight:600 }}>✓ {getNome(selecionado)}</span>}
      {lista.length === 0 && <span style={{ fontSize:11, color:"var(--vermelho)" }}>Nenhuma {tipo==="obra"?"obra":"manutenção em aberto"} disponível.</span>}
    </div>
  );
}

// Modal de transferência de saldo — Obra → Obra | Manutenção | Estoque
function TransferenciaModal({ origem, material, obras, manutencoes, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const [tipoDestino, setTipoDestino] = useState("obra");   // "obra" | "manutencao" | "estoque"
  const [destinoId,   setDestinoId]   = useState("");
  const [qtd,         setQtd]         = useState("");
  const [obs,         setObs]         = useState("");
  const [saving,      setSaving]      = useState(false);

  const saldo = material.comprado - material.usado;

  // Lista de destinos conforme tipo selecionado
  const listaDestinos = tipoDestino === "obra"
    ? obras.filter(o => o.id !== origem.obraId)
    : tipoDestino === "manutencao"
      ? (manutencoes || []).filter(m => !["concluida","cancelada"].includes(m.status))
      : []; // estoque não precisa de destino específico

  // Label e ícone por tipo
  const TIPOS = [
    { id:"obra",       label:"🏗️ Obra",       placeholder:"Selecione a obra..." },
    { id:"manutencao", label:"🔧 Manutenção",  placeholder:"Selecione a manutenção..." },
    { id:"estoque",    label:"📦 Estoque",     placeholder:null },
  ];

  async function salvar() {
    if (tipoDestino !== "estoque" && !destinoId) {
      alert(`Selecione a ${tipoDestino === "obra" ? "obra" : "manutenção"} de destino.`); return;
    }
    if (!qtd || Number(qtd) <= 0) { alert("Informe uma quantidade válida."); return; }
    if (Number(qtd) > saldo) { alert(`Saldo disponível é de apenas ${saldo} ${material.un}.`); return; }

    setSaving(true);
    try {
      let destinoNome = "Estoque geral";
      if (tipoDestino === "obra") {
        destinoNome = obras.find(o => o.id === destinoId)?.nome || destinoId;
      } else if (tipoDestino === "manutencao") {
        const m = (manutencoes||[]).find(m => m.id === destinoId);
        destinoNome = m?.titulo || m?.descricao || destinoId;
      }

      await addComAuditoria("transferencias_material", {
        materialNome:    material.nome,
        un:              material.un,
        qtd:             Number(qtd),
        obraOrigemId:    origem.obraId,
        obraOrigemNome:  origem.obraNome,
        tipoDestino,                       // "obra" | "manutencao" | "estoque"
        destinoId:       destinoId || "estoque",
        destinoNome,
        obs,
        usuario:         userProfile?.nome || "–",
        data:            new Date().toISOString().split("T")[0],
      }, currentUser?.uid, userProfile?.nome);

      addToast(`✓ ${qtd} ${material.un} de "${material.nome}" transferido(s) para ${destinoNome}!`);
      onClose();
    } catch(err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title="🔄 Transferir material" onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar transferência"}
          </button>
        </>
      }
    >
      <div style={{display:"flex", flexDirection:"column", gap:14}}>

        {/* Info do material */}
        <div style={{background:"var(--cinza-lt)", borderRadius:8, padding:10, fontSize:13}}>
          <div><strong>{material.nome}</strong> ({material.un})</div>
          <div style={{fontSize:12, color:"#7A7A7A", marginTop:2}}>Saindo de: <strong>🏗️ {origem.obraNome}</strong></div>
          <div style={{fontSize:12, color:"var(--verde)", fontWeight:600, marginTop:2}}>Saldo disponível: {saldo} {material.un}</div>
        </div>

        {/* Tipo de destino — 3 botões */}
        <div className="form-group">
          <label className="required">Destino</label>
          <div style={{display:"flex", gap:8}}>
            {TIPOS.map(t => (
              <button key={t.id} type="button"
                onClick={() => { setTipoDestino(t.id); setDestinoId(""); }}
                style={{
                  flex:1, padding:"9px 6px", borderRadius:8, fontSize:12.5, fontWeight:600,
                  cursor:"pointer", transition:"all .15s",
                  border: tipoDestino === t.id ? "2px solid var(--afine-yellow)" : "1px solid #ddd",
                  background: tipoDestino === t.id ? "#1A1A1A" : "#fff",
                  color: tipoDestino === t.id ? "var(--afine-yellow)" : "#555",
                }}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {/* Busca de destino (Obra ou Manutenção) */}
        {tipoDestino !== "estoque" && (
          <BuscaDestino
            tipo={tipoDestino}
            lista={listaDestinos}
            destinoId={destinoId}
            onChange={setDestinoId}
          />
        )}

        {/* Estoque — aviso */}
        {tipoDestino === "estoque" && (
          <div style={{background:"#fffbea", border:"1px solid var(--afine-yellow)", borderRadius:8, padding:10, fontSize:12, color:"#7A7A7A"}}>
            📦 O material será devolvido ao <strong>estoque geral</strong> e ficará disponível para saídas futuras.
          </div>
        )}

        {/* Quantidade */}
        <div className="form-group">
          <label className="required">Quantidade a transferir ({material.un})</label>
          <input type="number" min="1" max={saldo} value={qtd}
            onChange={e => setQtd(e.target.value)} placeholder={`Máx. ${saldo}`}/>
        </div>

        {/* Observações */}
        <div className="form-group">
          <label>Observações</label>
          <input value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Ex: levado por João no dia X"/>
        </div>
      </div>
    </Modal>
  );
}

// Modal de cadastro de novo material
function NovoMaterialModal({ onClose, addToast }) {
  const [form, setForm] = useState({ nome:"", categoria:"", un:"un", estoqueMin:0, saldo:0 });
  const [saving, setSaving] = useState(false);
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  async function save() {
    if (!form.nome) { alert("Informe o nome do material."); return; }
    setSaving(true);
    try {
      await addDoc(collection(db,"materiais_estoque"), {
        ...form, estoqueMin:Number(form.estoqueMin)||0, saldo:Number(form.saldo)||0,
        totalEntradas:Number(form.saldo)||0, totalSaidas:0,
        createdAt: new Date().toISOString(),
      });
      addToast("Material cadastrado!");
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title="Cadastrar material" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="form-group"><label className="required">Nome do material</label><input value={form.nome} onChange={e=>set("nome",e.target.value)} placeholder="Ex: Cabo UTP Cat.6"/></div>
        <div className="form-grid">
          <div className="form-group"><label>Categoria</label>
            <select value={form.categoria} onChange={e=>set("categoria",e.target.value)}>
              {["","Elétrico","Hidráulico","Cabeamento","Acabamento","Pintura","Ferramentas","EPI","Outros"].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Unidade</label>
            <select value={form.un} onChange={e=>set("un",e.target.value)}>
              {["un","m","m²","kg","saco","cx","rolo","litro","par"].map(u=><option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Saldo inicial</label><input type="number" min="0" value={form.saldo} onChange={e=>set("saldo",e.target.value)}/></div>
          <div className="form-group"><label>Estoque mínimo (alerta)</label><input type="number" min="0" value={form.estoqueMin} onChange={e=>set("estoqueMin",e.target.value)}/></div>
        </div>
      </div>
    </Modal>
  );
}

export default function MateriaisGlobal() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const [materiais,  setMateriais]  = useState([]);
  const [movs,       setMovs]       = useState([]);
  const [obras,      setObras]      = useState([]);
  const [manut,      setManut]      = useState([]);
  const [compras,    setCompras]    = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filtroCateg,setFiltroCateg]= useState("todas");
  const [aba,        setAba]        = useState("estoque");
  const [searchCompras, setSearchCompras] = useState("");
  const [obraExpandida, setObraExpandida] = useState(null);
  const [modalMov,   setModalMov]   = useState(null); // {item, tipo}
  const [modalNovo,  setModalNovo]  = useState(false);
  const [modalTransf, setModalTransf] = useState(null); // {origem, material}

  const canEdit = !isCampo(userProfile);

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"materiais_estoque"), snap => {
      setMateriais(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db,"movimentacoes"), snap => {
      const data = snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setMovs(data);
    });
    const u3 = onSnapshot(collection(db,"obras"), snap => setObras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u4 = onSnapshot(collection(db,"manutencoes"), snap => setManut(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u5 = onSnapshot(query(collection(db,"compras"), where("demandaTipo","==","obra")), snap => setCompras(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u6 = onSnapshot(collection(db,"transferencias_material"), snap => setTransferencias(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{ u1(); u2(); u3(); u4(); u5(); u6(); };
  }, []);

  // ── Estoque por Compras: o que foi comprado/recebido (conferido) em cada
  // obra, menos o que já foi utilizado na execução — controle entre obras.
  // Transferências entre obras entram como "entrada" na obra destino e
  // "saída" na obra origem, sem alterar a compra nem o log de execução.
  const estoqueComprasPorObra = useMemo(() => {
    const porObra = {}; // obraId -> { obraNome, materiais: { key: {nome,un,comprado,usado} } }

    obras.forEach(o => { porObra[o.id] = { obraNome: o.nome, materiais: {} }; });

    function add(obraId, nome, un, campo, qtd) {
      const bucket = porObra[obraId]?.materiais;
      if (!bucket) return;
      const key = `${nome.trim().toLowerCase()}|${un}`;
      if (!bucket[key]) bucket[key] = { nome, un, comprado: 0, usado: 0 };
      bucket[key][campo] += qtd;
    }

    compras
      .filter(c => ["RECEBIDO","AGUARD. NF","NF VINCULADA"].includes(c.status) && (c.tipoReceb==="conforme"||!c.tipoReceb) && porObra[c.demandaId])
      .forEach(c => (c.itens||[]).forEach(it => add(c.demandaId, it.nome, it.un, "comprado", Number(it.qtd)||0)));

    obras.forEach(o => (o.materiais||[]).forEach(m => add(o.id, m.nome, m.un, "usado", Number(m.qtd)||0)));

    // Transferências: entra como "comprado" na obra destino, sai como "usado" na obra origem
    transferencias.forEach(t => {
      add(t.obraDestinoId, t.materialNome, t.un, "comprado", Number(t.qtd)||0);
      add(t.obraOrigemId,  t.materialNome, t.un, "usado",    Number(t.qtd)||0);
    });

    // Remove obras sem nenhum material comprado/usado
    return Object.fromEntries(Object.entries(porObra).filter(([,v])=>Object.keys(v.materiais).length>0));
  }, [obras, compras, transferencias]);

  // Totais consolidados de todas as obras (visão global do material)
  const estoqueComprasGlobal = useMemo(() => {
    const mapa = {};
    Object.values(estoqueComprasPorObra).forEach(({materiais}) => {
      Object.entries(materiais).forEach(([key,item]) => {
        if (!mapa[key]) mapa[key] = { nome:item.nome, un:item.un, comprado:0, usado:0 };
        mapa[key].comprado += item.comprado;
        mapa[key].usado    += item.usado;
      });
    });
    return mapa;
  }, [estoqueComprasPorObra]);

  // Cruza por nome com o estoque "vindo de compras de obra" — unifica a
  // visibilidade dos dois sistemas (manual e por compras) sem alterar como
  // cada um é escrito, evitando reescrever os dois fluxos já em uso.
  function saldoEmObrasPara(nomeMaterial) {
    const alvo = (nomeMaterial||"").trim().toLowerCase();
    let total = 0;
    Object.values(estoqueComprasGlobal).forEach(item => {
      if (item.nome.trim().toLowerCase() === alvo) total += (item.comprado - item.usado);
    });
    return total;
  }

  const categorias = ["todas", ...new Set(materiais.map(m=>m.categoria).filter(Boolean))];

  const filtered = materiais.filter(m => {
    const q = search.toLowerCase();
    const mQ = !q || m.nome?.toLowerCase().includes(q) || m.categoria?.toLowerCase().includes(q);
    const mC = filtroCateg==="todas" || m.categoria===filtroCateg;
    return mQ && mC;
  });

  // KPIs
  const abaixoMin = materiais.filter(m=>m.estoqueMin>0 && m.saldo<=m.estoqueMin).length;
  const zerados   = materiais.filter(m=>m.saldo<=0).length;
  const totalItens= materiais.length;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Materiais — Controle global</div>
          <div style={{fontSize:12,color:"var(--cinza-med)"}}>{totalItens} itens cadastrados</div>
        </div>
        {canEdit && <button className="btn btn-primary" onClick={()=>setModalNovo(true)}>+ Cadastrar material</button>}
      </div>

      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="metric"><div className="metric-label">Itens em estoque</div><div className="metric-value blue">{totalItens}</div></div>
        <div className="metric"><div className="metric-label">Abaixo do mínimo</div><div className="metric-value amber">{abaixoMin}</div></div>
        <div className="metric"><div className="metric-label">Zerados</div><div className="metric-value red">{zerados}</div></div>
        <div className="metric"><div className="metric-label">Movimentações</div><div className="metric-value">{movs.length}</div></div>
      </div>

      {abaixoMin > 0 && (
        <div className="alert alert-warning" style={{marginBottom:14,fontSize:12}}>
          ⚠ <strong>{abaixoMin} item(ns)</strong> abaixo do estoque mínimo. Verifique a aba Estoque.
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${aba==="estoque"?"active":""}`} onClick={()=>setAba("estoque")}>Estoque</button>
        <button className={`tab ${aba==="movs"?"active":""}`} onClick={()=>setAba("movs")}>Movimentações</button>
        <button className={`tab ${aba==="porDemanda"?"active":""}`} onClick={()=>setAba("porDemanda")}>Por demanda</button>
        <button className={`tab ${aba==="comprasObras"?"active":""}`} onClick={()=>setAba("comprasObras")}>📦 Comprado em Obras</button>
      </div>

      {/* ABA ESTOQUE */}
      {aba==="estoque" && (
        <>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            {categorias.map(c=>(
              <button key={c} className={`chip ${filtroCateg===c?"active":""}`} onClick={()=>setFiltroCateg(c)}>
                {c==="todas"?"Todas":c}
              </button>
            ))}
          </div>
          <div className="search-bar">🔍<input placeholder="Buscar material..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {loading && <div className="spinner"/>}
          {!loading && filtered.length===0 && <div className="empty-state"><div className="empty-icon">📦</div><p>Nenhum material cadastrado</p></div>}
          {!loading && filtered.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Material</th><th>Categoria</th><th>Un.</th><th>Saldo</th><th>Mínimo</th><th>Total entradas</th><th>Total saídas</th><th>Sobra em obras</th><th>Status</th>{canEdit&&<th></th>}</tr></thead>
                <tbody>
                  {filtered.map(m=>{
                    const critico = m.estoqueMin>0 && m.saldo<=m.estoqueMin;
                    const zerado  = m.saldo<=0;
                    const sobraObras = saldoEmObrasPara(m.nome);
                    return (
                      <tr key={m.id}>
                        <td><strong>{m.nome}</strong></td>
                        <td style={{fontSize:12}}>{m.categoria||"–"}</td>
                        <td style={{fontSize:12}}>{m.un}</td>
                        <td style={{fontWeight:700,color:zerado?"var(--vermelho)":critico?"var(--laranja)":"var(--verde)",fontSize:14}}>{m.saldo}</td>
                        <td style={{fontSize:12,color:"var(--cinza-med)"}}>{m.estoqueMin||"–"}</td>
                        <td style={{fontSize:12}}>{m.totalEntradas||0}</td>
                        <td style={{fontSize:12}}>{m.totalSaidas||0}</td>
                        <td style={{fontSize:12}}>
                          {sobraObras>0 ? (
                            <button className="btn btn-sm" style={{color:"var(--verde)",fontWeight:700,background:"none",border:"none",padding:0}}
                              onClick={()=>{setAba("comprasObras");setSearchCompras(m.nome);}} title="Ver detalhe em Comprado em Obras">
                              📦 +{sobraObras}
                            </button>
                          ) : <span style={{color:"#B8B6AE"}}>–</span>}
                        </td>
                        <td>
                          {zerado ? <span className="badge badge-red">Zerado</span>
                           : critico ? <span className="badge badge-amber">Crítico</span>
                           : <span className="badge badge-green">OK</span>}
                        </td>
                        {canEdit && (
                          <td style={{display:"flex",gap:4}}>
                            <button className="btn btn-sm" style={{background:"var(--verde-lt)",color:"var(--verde)",border:"none"}} onClick={()=>setModalMov({item:m,tipo:"entrada"})}>📥</button>
                            <button className="btn btn-sm" style={{background:"var(--vermelho-lt)",color:"var(--vermelho)",border:"none"}} onClick={()=>setModalMov({item:m,tipo:"saida"})}>📤</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ABA MOVIMENTAÇÕES */}
      {aba==="movs" && (
        <>
          <div style={{fontSize:12,color:"var(--cinza-med)",marginBottom:10}}>Histórico completo de entradas e saídas</div>
          {movs.length===0 && <div className="empty-state"><div className="empty-icon">📋</div><p>Nenhuma movimentação registrada</p></div>}
          {movs.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Tipo</th><th>Material</th><th>Qtd.</th><th>Demanda</th><th>Usuário</th><th>Obs.</th></tr></thead>
                <tbody>
                  {movs.map(m=>(
                    <tr key={m.id}>
                      <td style={{fontSize:12}}>{fmtDate(m.data)}</td>
                      <td>{m.tipo==="entrada"?<span className="badge badge-green">📥 Entrada</span>:<span className="badge badge-red">📤 Saída</span>}</td>
                      <td style={{fontWeight:500}}>{m.materialNome}</td>
                      <td style={{fontWeight:700,color:m.tipo==="entrada"?"var(--verde)":"var(--vermelho)"}}>{m.tipo==="entrada"?"+":"-"}{m.quantidade}</td>
                      <td style={{fontSize:12}}>{m.demandaNome||m.demandaTipo||"–"}</td>
                      <td style={{fontSize:12}}>{m.usuario}</td>
                      <td style={{fontSize:11,color:"var(--cinza-med)"}}>{m.obs||"–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ABA POR DEMANDA */}
      {aba==="porDemanda" && (
        <>
          <div style={{fontSize:12,color:"var(--cinza-med)",marginBottom:12}}>Consumo de materiais agrupado por obra ou manutenção</div>
          {/* Por obra */}
          {obras.map(o=>{
            const movsObra = movs.filter(m=>m.demandaId===o.id && m.tipo==="saida");
            if(movsObra.length===0) return null;
            const totalPorMat = movsObra.reduce((acc,m)=>{
              if(!acc[m.materialNome]) acc[m.materialNome]=0;
              acc[m.materialNome]+=m.quantidade;
              return acc;
            },{});
            return (
              <div key={o.id} style={{marginBottom:16}}>
                <div style={{fontWeight:600,fontSize:13,color:"var(--azul)",marginBottom:6,borderBottom:"2px solid var(--azul-claro)",paddingBottom:4}}>
                  🏗️ {o.nome}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {Object.entries(totalPorMat).map(([nome,qtd])=>(
                    <span key={nome} style={{background:"var(--cinza-lt)",padding:"3px 10px",borderRadius:20,fontSize:12}}>
                      {nome}: <strong>{qtd}</strong>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {/* Por manutenção */}
          {manut.map(m=>{
            const movsManut = movs.filter(mv=>mv.demandaId===m.id && mv.tipo==="saida");
            if(movsManut.length===0) return null;
            const totalPorMat = movsManut.reduce((acc,mv)=>{
              if(!acc[mv.materialNome]) acc[mv.materialNome]=0;
              acc[mv.materialNome]+=mv.quantidade;
              return acc;
            },{});
            return (
              <div key={m.id} style={{marginBottom:16}}>
                <div style={{fontWeight:600,fontSize:13,color:"var(--laranja)",marginBottom:6,borderBottom:"2px solid var(--laranja-lt)",paddingBottom:4}}>
                  🔧 {m.titulo}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {Object.entries(totalPorMat).map(([nome,qtd])=>(
                    <span key={nome} style={{background:"var(--cinza-lt)",padding:"3px 10px",borderRadius:20,fontSize:12}}>
                      {nome}: <strong>{qtd}</strong>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {movs.filter(m=>m.tipo==="saida").length===0 && (
            <div className="empty-state"><div className="empty-icon">📊</div><p>Nenhum consumo registrado ainda</p></div>
          )}
        </>
      )}

      {/* ABA COMPRADO EM OBRAS — controle entre obras (comprado/recebido x usado) */}
      {aba==="comprasObras" && (
        <>
          <div style={{fontSize:12,color:"var(--cinza-med)",marginBottom:12}}>
            Materiais comprados e recebidos (conferidos como "conforme") em cada obra, menos o que já foi utilizado na execução.
            O saldo é o que sobrou e pode ser realocado para outra obra.
          </div>

          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
            Visão consolidada (todas as obras)
          </div>
          {Object.keys(estoqueComprasGlobal).length===0 ? (
            <div className="empty-state"><div className="empty-icon">📦</div><p>Nenhuma compra de obra recebida e conferida ainda.</p></div>
          ) : (
            <div className="table-wrap" style={{marginBottom:24}}>
              <table>
                <thead><tr><th>Material</th><th>Un.</th><th>Comprado</th><th>Usado</th><th>Saldo total</th><th>Estoque manual</th></tr></thead>
                <tbody>
                  {Object.values(estoqueComprasGlobal).sort((a,b)=>a.nome.localeCompare(b.nome)).map((item,i)=>{
                    const saldo = item.comprado-item.usado;
                    const manual = materiais.find(m=>m.nome.trim().toLowerCase()===item.nome.trim().toLowerCase());
                    return (
                      <tr key={i}>
                        <td style={{fontWeight:600}}>{item.nome}</td>
                        <td style={{fontSize:12}}>{item.un}</td>
                        <td style={{fontSize:12}}>{item.comprado}</td>
                        <td style={{fontSize:12}}>{item.usado}</td>
                        <td style={{fontWeight:700,fontSize:14,color:saldo>0?"var(--verde)":saldo<0?"var(--vermelho)":"#7A7A7A"}}>{saldo}</td>
                        <td style={{fontSize:12}}>
                          {manual
                            ? <button className="btn btn-sm" style={{background:"none",border:"none",color:"var(--cinza-med)",padding:0}} onClick={()=>{setAba("estoque");setSearch(item.nome);}} title="Ver no estoque manual">📋 {manual.saldo} (manual)</button>
                            : <span style={{color:"#B8B6AE"}}>não cadastrado</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
            Detalhamento por obra — onde está cada saldo
          </div>
          <div className="search-bar" style={{marginBottom:10}}>🔍<input placeholder="Buscar obra ou material..." value={searchCompras} onChange={e=>setSearchCompras(e.target.value)}/></div>

          {Object.entries(estoqueComprasPorObra)
            .filter(([,v])=>{
              const q=searchCompras.toLowerCase();
              if(!q) return true;
              return v.obraNome?.toLowerCase().includes(q) || Object.values(v.materiais).some(m=>m.nome.toLowerCase().includes(q));
            })
            .map(([obraId,v])=>{
              const aberta = obraExpandida===obraId;
              const itensComSaldo = Object.values(v.materiais).filter(m=>m.comprado-m.usado>0).length;
              return (
                <div key={obraId} style={{marginBottom:8,border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}>
                  <button onClick={()=>setObraExpandida(aberta?null:obraId)}
                    style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",
                      padding:"10px 14px",background:aberta?"#1A1A1A":"var(--cinza-lt)",color:aberta?"#F5C800":"#1A1A1A",
                      border:"none",cursor:"pointer",fontWeight:600,fontSize:13}}>
                    <span>🏗️ {v.obraNome}</span>
                    <span style={{fontSize:11,fontWeight:400}}>
                      {itensComSaldo>0 ? `${itensComSaldo} item(ns) com saldo` : "sem saldo"} {aberta?"▲":"▼"}
                    </span>
                  </button>
                  {aberta && (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Material</th><th>Un.</th><th>Comprado</th><th>Usado</th><th>Saldo</th>{canEdit&&<th></th>}</tr></thead>
                        <tbody>
                          {Object.values(v.materiais).sort((a,b)=>a.nome.localeCompare(b.nome)).map((m,i)=>{
                            const saldo=m.comprado-m.usado;
                            return (
                              <tr key={i}>
                                <td style={{fontWeight:500}}>{m.nome}</td>
                                <td style={{fontSize:12}}>{m.un}</td>
                                <td style={{fontSize:12}}>{m.comprado}</td>
                                <td style={{fontSize:12}}>{m.usado}</td>
                                <td style={{fontWeight:700,color:saldo>0?"var(--verde)":saldo<0?"var(--vermelho)":"#7A7A7A"}}>{saldo}</td>
                                {canEdit && (
                                  <td>
                                    {saldo>0 && (
                                      <button className="btn btn-sm btn-primary" onClick={()=>setModalTransf({origem:{obraId,obraNome:v.obraNome},material:m})}>
                                        🔄 Transferir
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

          {transferencias.length>0 && (
            <div style={{marginTop:24}}>
              <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>
                Histórico de transferências
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Data</th><th>Material</th><th>Qtd.</th><th>De</th><th>Para</th><th>Usuário</th><th>Obs.</th></tr></thead>
                  <tbody>
                    {[...transferencias].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).map(t=>(
                      <tr key={t.id}>
                        <td style={{fontSize:12}}>{fmtDate(t.data)}</td>
                        <td style={{fontWeight:500}}>{t.materialNome}</td>
                        <td style={{fontWeight:700,color:"var(--azul)"}}>{t.qtd} {t.un}</td>
                        <td style={{fontSize:12}}>🏗️ {t.obraOrigemNome}</td>
                        <td style={{fontSize:12}}>🏗️ {t.obraDestinoNome}</td>
                        <td style={{fontSize:12}}>{t.usuario}</td>
                        <td style={{fontSize:11,color:"#7A7A7A"}}>{t.obs||"–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {modalTransf && (
        <TransferenciaModal origem={modalTransf.origem} material={modalTransf.material}
          obras={obras} manutencoes={manut}
          onClose={()=>setModalTransf(null)} addToast={addToast}/>
      )}

      {modalMov && <MovimentacaoModal item={modalMov.item} tipo={modalMov.tipo} obras={obras} manutencoes={manut} onClose={()=>setModalMov(null)} addToast={addToast}/>}
      {modalNovo && <NovoMaterialModal onClose={()=>setModalNovo(false)} addToast={addToast}/>}
    </div>
  );
}
