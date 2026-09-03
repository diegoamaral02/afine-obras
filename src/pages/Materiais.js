// src/pages/Materiais.js — controle global de estoque + por demanda
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { isCampo, isGestorOuAdm, isNivelIntermediario } from "../constants/departamentos";
import { addComAuditoria, updateComAuditoria, deleteComAuditoria } from "../services/auditoria";
import { enviarNotificacao } from "../hooks/useNotificacoes";
import { exportarExcel } from "../utils/exportExcel";

// Formatador de moeda — definido fora dos componentes para reuso
const fmt = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;

// Modal de movimentação (entrada ou saída)
function MovimentacaoModal({ item, tipo, obras, manutencoes, onClose, addToast }) {
  const { currentUser, userProfile } = useAuth();
  const [form, setForm] = useState({
    quantidade: "",
    demandaTipo: "obra",
    demandaId: "",
    obs: "",
    data: new Date().toISOString().split("T")[0],
    colaboradorNome: "",
    custoUnitario: "",
  });
  const [saving, setSaving] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [buscaColab, setBuscaColab] = useState("");
  const [dropColab, setDropColab] = useState(false);
  const [buscaDemanda, setBuscaDemanda] = useState("");
  const [dropDemanda, setDropDemanda] = useState(false);
  // Calculadora de rendimento (tinta, rejunte, impermeabilizante, etc.)
  const [modoArea, setModoArea] = useState(false);
  const [area, setArea] = useState("");
  const [demãos, setDemãos] = useState(item.demaosPadrao || 2);
  function set(f, v) { setForm(p => ({...p, [f]: v})); }

  const temRendimento = !!(item.rendimento && Number(item.rendimento) > 0);

  // Recalcula quantidade automaticamente ao mudar área ou demãos
  React.useEffect(() => {
    if (!modoArea || !area || !temRendimento) return;
    const qtd = (Number(area) * Number(demãos)) / Number(item.rendimento);
    set("quantidade", Math.ceil(qtd * 1000) / 1000); // arredonda para cima com 3 casas
  }, [area, demãos, modoArea]); // eslint-disable-line

  // Carrega lista de colaboradores (leitura única)
  useEffect(() => {
    getDocs(collection(db, "usuarios")).then(snap => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.nome));
    }).catch(() => {});
  }, []);

  const demandas = form.demandaTipo === "obra" ? obras : manutencoes;

  const usuariosFiltrados = usuarios.filter(u =>
    u.nome.toLowerCase().includes(buscaColab.toLowerCase())
  );
  const colabSelecionado = form.colaboradorNome;

  async function save() {
    if (!form.quantidade || Number(form.quantidade) <= 0) { alert("Informe uma quantidade válida."); return; }
    if (tipo === "saida" && Number(form.quantidade) > item.saldo) {
      alert(`Saldo insuficiente. Disponível: ${item.saldo} ${item.un}`); return;
    }
    setSaving(true);
    const custoUnitarioMov = Number(form.custoUnitario) || 0;
    const mov = {
      materialId: item.id,
      materialNome: item.nome,
      tipo,
      quantidade: Number(form.quantidade),
      custoUnitario: custoUnitarioMov || null,
      demandaTipo: form.demandaTipo,
      demandaId: form.demandaId,
      demandaNome: demandas.find(d=>d.id===form.demandaId)?.nome || demandas.find(d=>d.id===form.demandaId)?.titulo || "",
      colaboradorNome: form.colaboradorNome || "",
      obs: form.obs,
      data: form.data,
      usuario: userProfile?.nome || "–",
      createdAt: new Date().toISOString(),
    };
    try {
      await addComAuditoria("movimentacoes", mov, currentUser?.uid, userProfile?.nome);
      const novoSaldo = tipo === "entrada"
        ? item.saldo + Number(form.quantidade)
        : item.saldo - Number(form.quantidade);
      const totalEntradas = tipo === "entrada" ? item.totalEntradas + Number(form.quantidade) : item.totalEntradas;
      const totalSaidas   = tipo === "saida"   ? item.totalSaidas   + Number(form.quantidade) : item.totalSaidas;

      // Custo médio ponderado na entrada
      const updateData = { saldo: novoSaldo, totalEntradas, totalSaidas };
      if (tipo === "entrada" && custoUnitarioMov > 0) {
        const saldoAtual = item.saldo;
        const custoAtual = item.custoMedio || item.custoUnitario || 0;
        const qtdEntrada = Number(form.quantidade);
        const novoSaldoCalc = saldoAtual + qtdEntrada;
        const custoMedio = novoSaldoCalc > 0
          ? (saldoAtual * custoAtual + qtdEntrada * custoUnitarioMov) / novoSaldoCalc
          : custoUnitarioMov;
        updateData.custoMedio = Math.round(custoMedio * 100) / 100;
      }

      await updateComAuditoria("materiais_estoque", item.id, updateData, currentUser?.uid, userProfile?.nome);

      // Alerta de reposição automática após saída abaixo do mínimo
      if (tipo === "saida" && item.estoqueMin > 0 && novoSaldo <= item.estoqueMin) {
        try {
          const snapUsers = await getDocs(collection(db, "usuarios"));
          const destinatarios = snapUsers.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(u => u.id !== currentUser?.uid && (
              u.adm === true ||
              ["gestao","compras","financeiro"].includes(u.departamento || u.perfil)
            ));
          for (const u of destinatarios) {
            await enviarNotificacao(u.id, {
              titulo: "⚠️ Estoque baixo",
              corpo: `${item.nome}: saldo ${novoSaldo} ${item.un} atingiu o mínimo (${item.estoqueMin})`,
              tipo: "warning",
              link: "/materiais",
            });
          }
        } catch(e) { /* silencioso */ }
      }

      addToast(tipo === "entrada" ? "Entrada registrada!" : "Saída registrada!");
      onClose();
    } catch(err) { addToast("Erro: " + err.message, "error"); }
    setSaving(false);
  }

  return (
    <Modal title={tipo==="entrada" ? "📥 Registrar entrada" : "📤 Registrar saída"} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className={`btn ${tipo==="entrada"?"btn-primary":"btn-danger"}`} onClick={save} disabled={saving || (tipo==="saida" && form.quantidade && Number(form.quantidade) > item.saldo)}>{saving?"Salvando...":"Confirmar"}</button></>}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:tipo==="entrada"?"var(--verde-lt)":"var(--vermelho-lt)",borderRadius:8,padding:10,fontSize:13,fontWeight:500}}>
          {tipo==="entrada"?"📥 Entrada em estoque":"📤 Saída do estoque"} — <strong>{item.nome}</strong>
          <div style={{fontSize:12,fontWeight:400,marginTop:2}}>Saldo atual: <strong>{item.saldo} {item.un}</strong></div>
        </div>

        {/* Calculadora de rendimento — apenas na saída de materiais com rendimento cadastrado */}
        {tipo === "saida" && temRendimento && (
          <div style={{background:"#FFFBEA",border:"1px solid #F5C800",borderRadius:8,padding:10}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:700,color:"#7A4F00"}}>
                🎨 Calculadora por rendimento
              </span>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12}}>
                <input type="checkbox" checked={modoArea} onChange={e=>{ setModoArea(e.target.checked); if(!e.target.checked) set("quantidade",""); }}/>
                Calcular pela área
              </label>
            </div>
            {modoArea && (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <div className="form-group" style={{margin:0}}>
                  <label style={{fontSize:11}}>Área (m²)</label>
                  <input type="number" min="0.01" step="0.01" value={area} onChange={e=>setArea(e.target.value)} placeholder="Ex: 25"/>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label style={{fontSize:11}}>Demãos</label>
                  <input type="number" min="1" max="10" value={demãos} onChange={e=>setDemãos(e.target.value)}/>
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label style={{fontSize:11}}>Rendimento ({item.un}/m²)</label>
                  <input type="number" value={item.rendimento} disabled style={{background:"var(--cinza-lt)",color:"#7A7A7A"}}/>
                </div>
              </div>
            )}
            {modoArea && area && temRendimento && (
              <div style={{marginTop:8,fontSize:12,color:"#7A4F00"}}>
                Necessário: <strong>{form.quantidade} {item.un}</strong>
                {" "}({area} m² × {demãos} demão(s) ÷ {item.rendimento} {item.un}/m²)
              </div>
            )}
          </div>
        )}

        <div className="form-grid">
          <div className="form-group">
            <label className="required">Quantidade ({item.un})</label>
            <input type="number" min="0.001" step="0.001" value={form.quantidade}
              onChange={e=>{ if(modoArea) setModoArea(false); set("quantidade",e.target.value); }}
              placeholder="0"
              style={{ borderColor: tipo==="saida" && form.quantidade && Number(form.quantidade) > item.saldo ? "var(--vermelho)" : tipo==="saida" && form.quantidade && Number(form.quantidade) > 0 ? "var(--verde)" : undefined }}
            />
            {tipo==="saida" && form.quantidade && Number(form.quantidade) > item.saldo && (
              <div style={{marginTop:5,padding:"7px 11px",borderRadius:7,background:"#fff0f0",
                border:"1px solid var(--vermelho)",fontSize:12,color:"var(--vermelho)",fontWeight:600,
                display:"flex",alignItems:"center",gap:6}}>
                ⚠️ Quantidade indisponível. Saldo atual é de <strong>{item.saldo} {item.un}</strong>.
              </div>
            )}
          </div>
          <div className="form-group"><label>Data</label>
            <input type="date" value={form.data} onChange={e=>set("data",e.target.value)}/>
          </div>
        </div>

        {/* Custo unitário — só na entrada */}
        {tipo === "entrada" && (
          <div className="form-group">
            <label>Custo unitário (R$) <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>(para custo médio)</span></label>
            <input type="number" step="0.01" min="0" value={form.custoUnitario}
              onChange={e=>set("custoUnitario",e.target.value)} placeholder="0,00"/>
          </div>
        )}

        <div className="form-grid">
          <div className="form-group"><label>Vincular a</label>
            <select value={form.demandaTipo} onChange={e=>{set("demandaTipo",e.target.value);set("demandaId","");setBuscaDemanda("");}}>
              <option value="obra">Obra</option>
              <option value="manutencao">Manutenção</option>
              <option value="estoque">Estoque local (sem demanda)</option>
            </select>
          </div>
          {form.demandaTipo !== "estoque" && (
            <div className="form-group" style={{position:"relative"}}>
              <label>Qual {form.demandaTipo==="obra"?"obra":"manutenção"}?</label>
              <div style={{position:"relative"}}>
                <input type="text" value={buscaDemanda}
                  onChange={e=>{ setBuscaDemanda(e.target.value); set("demandaId",""); setDropDemanda(true); }}
                  onFocus={()=>setDropDemanda(true)}
                  onBlur={()=>setTimeout(()=>setDropDemanda(false),150)}
                  placeholder={`🔍 Buscar ${form.demandaTipo==="obra"?"obra":"manutenção"}...`}
                  autoComplete="off"
                  style={{width:"100%",boxSizing:"border-box",
                    borderColor: form.demandaId ? "var(--verde)" : undefined}}
                />
                {buscaDemanda && (
                  <button type="button" onClick={()=>{ setBuscaDemanda(""); set("demandaId",""); }}
                    style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
                      background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:16}}>×</button>
                )}
              </div>
              {dropDemanda && (
                <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,
                  background:"#fff",border:"1px solid #ddd",borderRadius:8,
                  boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:180,overflowY:"auto",marginTop:2}}>
                  {demandas.filter(d=>(d.nome||d.titulo||"").toLowerCase().includes(buscaDemanda.toLowerCase())).length === 0
                    ? <div style={{padding:"12px 14px",fontSize:13,color:"#aaa"}}>Nenhum resultado.</div>
                    : demandas.filter(d=>(d.nome||d.titulo||"").toLowerCase().includes(buscaDemanda.toLowerCase())).map(d=>(
                      <div key={d.id}
                        onMouseDown={()=>{ set("demandaId",d.id); setBuscaDemanda(d.nome||d.titulo||""); setDropDemanda(false); }}
                        style={{padding:"9px 14px",fontSize:13,cursor:"pointer",borderBottom:"1px solid #f0f0f0",
                          fontWeight: d.id===form.demandaId?600:400}}
                        onMouseEnter={e=>e.currentTarget.style.background="#f8f7f4"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                      >
                        {form.demandaTipo==="obra"?"🏗️":"🔧"} {d.nome||d.titulo}
                      </div>
                    ))
                  }
                </div>
              )}
              {form.demandaId && <span style={{fontSize:11,color:"var(--verde)",fontWeight:600}}>✓ Selecionado</span>}
            </div>
          )}
        </div>

        {/* Colaborador — só na saída */}
        {tipo === "saida" && (
          <div className="form-group" style={{position:"relative"}}>
            <label>👷 Alocado para colaborador <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>(opcional)</span></label>
            <div style={{position:"relative"}}>
              <input
                type="text"
                value={buscaColab}
                onChange={e => { setBuscaColab(e.target.value); set("colaboradorNome",""); setDropColab(true); }}
                onFocus={() => setDropColab(true)}
                onBlur={() => setTimeout(() => setDropColab(false), 150)}
                placeholder="🔍 Buscar colaborador..."
                autoComplete="off"
                style={{ width:"100%", boxSizing:"border-box",
                  borderColor: colabSelecionado ? "var(--verde)" : undefined }}
              />
              {buscaColab && (
                <button type="button" onClick={() => { setBuscaColab(""); set("colaboradorNome",""); }}
                  style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
                    background:"none",border:"none",cursor:"pointer",color:"#aaa",fontSize:16}}>×</button>
              )}
            </div>
            {dropColab && buscaColab && (
              <div style={{
                position:"absolute",top:"100%",left:0,right:0,zIndex:50,
                background:"#fff",border:"1px solid #ddd",borderRadius:8,
                boxShadow:"0 8px 24px rgba(0,0,0,.12)",maxHeight:180,overflowY:"auto",marginTop:2,
              }}>
                {usuariosFiltrados.length === 0
                  ? <div style={{padding:"12px 14px",fontSize:13,color:"#aaa"}}>Nenhum colaborador encontrado.</div>
                  : usuariosFiltrados.map(u => (
                    <div key={u.id}
                      onMouseDown={() => { set("colaboradorNome", u.nome); setBuscaColab(u.nome); setDropColab(false); }}
                      style={{padding:"9px 14px",fontSize:13,cursor:"pointer",borderBottom:"1px solid #f0f0f0",
                        display:"flex",alignItems:"center",gap:8}}
                      onMouseEnter={e=>e.currentTarget.style.background="#f8f7f4"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                    >
                      <span style={{width:28,height:28,borderRadius:"50%",background:"#1A1A1A",
                        color:"#F5C400",display:"inline-flex",alignItems:"center",justifyContent:"center",
                        fontSize:11,fontWeight:700,flexShrink:0}}>
                        {u.nome.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
                      </span>
                      <div>
                        <div style={{fontWeight:500}}>{u.nome}</div>
                        {u.departamento && <div style={{fontSize:11,color:"#aaa"}}>{u.departamento}</div>}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
            {colabSelecionado && (
              <span style={{fontSize:11,color:"var(--verde)",fontWeight:600}}>✓ {colabSelecionado}</span>
            )}
          </div>
        )}

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
      ? (manutencoes || []).filter(m => !["CONCLUÍDA","CANCELADA"].includes(m.status))
      : []; // estoque não precisa de destino específico

  // Label e ícone por tipo
  const TIPOS = [
    { id:"obra",       label:"🏗️ Obra",       placeholder:"Selecione a obra..." },
    { id:"manutencao", label:"🔧 Manutenção",  placeholder:"Selecione a manutenção..." },
    { id:"estoque",    label:"📦 Estoque",     placeholder:null },
  ];

  async function salvar() {
    if (tipoDestino !== "estoque" && !destinoId) {
      addToast(`Selecione a ${tipoDestino === "obra" ? "obra" : "manutenção"} de destino.`,"error"); return;
    }
    if (!qtd || Number(qtd) <= 0) { addToast("Informe uma quantidade válida.","error"); return; }
    if (Number(qtd) > saldo) { addToast(`Saldo disponível é de apenas ${saldo} ${material.un}.`,"error"); return; }

    setSaving(true);
    try {
      let destinoNome = "Estoque geral";
      if (tipoDestino === "obra") {
        destinoNome = obras.find(o => o.id === destinoId)?.nome || destinoId;
      } else if (tipoDestino === "manutencao") {
        const m = (manutencoes||[]).find(m => m.id === destinoId);
        destinoNome = m?.titulo || m?.descricao || destinoId;
      }

      // Para transferências "obra→estoque", credita saldo no materiais_estoque
      if (tipoDestino === "estoque") {
        const qMat = query(collection(db,"materiais_estoque"), where("nome","==",material.nome));
        const snap = await getDocs(qMat);
        if (!snap.empty) {
          const matDoc = snap.docs[0];
          const d = matDoc.data();
          await updateComAuditoria("materiais_estoque", matDoc.id, {
            saldo:         (d.saldo||0) + Number(qtd),
            totalEntradas: (d.totalEntradas||0) + Number(qtd),
          }, currentUser?.uid, userProfile?.nome);
        }
      }

      await addComAuditoria("transferencias_material", {
        materialNome:    material.nome,
        un:              material.un,
        qtd:             Number(qtd),
        obraOrigemId:    origem.obraId,
        obraOrigemNome:  origem.obraNome,
        tipoDestino,
        obraDestinoId:   tipoDestino === "obra" ? destinoId : null,
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
          <button className="btn btn-primary" onClick={salvar} disabled={saving || !qtd || Number(qtd) <= 0 || Number(qtd) > saldo}>
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
          <input
            type="number" min="1" max={saldo} value={qtd}
            onChange={e => setQtd(e.target.value)}
            placeholder={`Máx. ${saldo}`}
            style={{ borderColor: qtd && Number(qtd) > saldo ? "var(--vermelho)" : qtd && Number(qtd) > 0 ? "var(--verde)" : undefined }}
          />
          {qtd && Number(qtd) > saldo && (
            <div style={{
              marginTop:6, padding:"8px 12px", borderRadius:7,
              background:"#fff0f0", border:"1px solid var(--vermelho)",
              fontSize:12, color:"var(--vermelho)", fontWeight:600,
              display:"flex", alignItems:"center", gap:6,
            }}>
              ⚠️ Quantidade indisponível. Saldo atual é de <strong>{saldo} {material.un}</strong>.
            </div>
          )}
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

// Modal de cadastro / edição de material
// Quando `material` é passado, opera em modo edição — saldo não é editável
// (para ajuste de saldo usam-se as movimentações de entrada/saída)
function NovoMaterialModal({ onClose, addToast, material }) {
  const editando = !!material;
  const { currentUser, userProfile } = useAuth();
  const [form, setForm] = useState({
    nome:         material?.nome         || "",
    categoria:    material?.categoria    || "",
    un:           material?.un           || "un",
    estoqueMin:   material?.estoqueMin   ?? 0,
    saldo:        material?.saldo        ?? 0,
    fornecedor:   material?.fornecedor   || "",
    custoUnitario:material?.custoUnitario|| "",
    localizacao:  material?.localizacao  || "",
    validade:     material?.validade     || "",
    rendimento:   material?.rendimento   || "",
    demaosPadrao: material?.demaosPadrao || 2,
  });
  const [saving, setSaving] = useState(false);
  const [imagemBase64, setImagemBase64] = useState(material?.imagemReferencia || null);
  const [carregandoImg, setCarregandoImg] = useState(false);
  const imgInputRef = React.useRef();
  function set(f,v) { setForm(p=>({...p,[f]:v})); }

  function handleImagem(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCarregandoImg(true);
    const reader = new FileReader();
    const img = new Image();
    reader.onload = ev => {
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        setImagemBase64(canvas.toDataURL("image/jpeg", 0.80));
        setCarregandoImg(false);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function save() {
    if (!form.nome) { addToast("Informe o nome do material.","error"); return; }
    setSaving(true);
    const extraFields = {
      fornecedor:    form.fornecedor    || "",
      custoUnitario: Number(form.custoUnitario) || 0,
      localizacao:   form.localizacao   || "",
      validade:      form.validade      || "",
      rendimento:    Number(form.rendimento) || 0,
      demaosPadrao:  Number(form.demaosPadrao) || 2,
    };
    try {
      if (editando) {
        await updateComAuditoria("materiais_estoque", material.id, {
          nome:       form.nome,
          categoria:  form.categoria,
          un:         form.un,
          estoqueMin: Number(form.estoqueMin)||0,
          imagemReferencia: imagemBase64 || null,
          ...extraFields,
        }, currentUser?.uid, userProfile?.nome);
        addToast("Material atualizado!");
      } else {
        await addComAuditoria("materiais_estoque", {
          ...form, estoqueMin:Number(form.estoqueMin)||0, saldo:Number(form.saldo)||0,
          totalEntradas:Number(form.saldo)||0, totalSaidas:0,
          imagemReferencia: imagemBase64 || null,
          custoUnitario: Number(form.custoUnitario) || 0,
        }, currentUser?.uid, userProfile?.nome);
        addToast("Material cadastrado!");
      }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  return (
    <Modal title={editando ? "✏️ Editar material" : "Cadastrar material"} onClose={onClose}
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
          {!editando && <div className="form-group"><label>Saldo inicial</label><input type="number" min="0" value={form.saldo} onChange={e=>set("saldo",e.target.value)}/></div>}
          {editando && <div className="form-group"><label>Saldo atual</label><input type="number" value={form.saldo} disabled title="Ajuste o saldo via entradas/saídas" style={{background:"var(--cinza-lt)",color:"#7A7A7A",cursor:"not-allowed"}}/></div>}
          <div className="form-group"><label>Estoque mínimo (alerta)</label><input type="number" min="0" value={form.estoqueMin} onChange={e=>set("estoqueMin",e.target.value)}/></div>
        </div>

        {/* Campos novos */}
        <div className="form-grid">
          <div className="form-group"><label>Fornecedor padrão</label>
            <input value={form.fornecedor} onChange={e=>set("fornecedor",e.target.value)} placeholder="Ex: Leroy Merlin"/>
          </div>
          <div className="form-group"><label>Custo unitário (R$)</label>
            <input type="number" step="0.01" min="0" value={form.custoUnitario} onChange={e=>set("custoUnitario",e.target.value)} placeholder="0,00"/>
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group"><label>Localização física</label>
            <input value={form.localizacao} onChange={e=>set("localizacao",e.target.value)} placeholder="Ex: Almoxarifado A, Prateleira 3"/>
          </div>
          <div className="form-group"><label>Validade <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>(opcional)</span></label>
            <input type="date" value={form.validade} onChange={e=>set("validade",e.target.value)}/>
          </div>
        </div>

        {/* Rendimento — apenas para litros */}
        {form.un === "L" && (
          <div className="form-grid">
            <div className="form-group">
              <label>Rendimento <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>(m²/L — cobertura por litro)</span></label>
              <input type="number" min="0" step="0.001" value={form.rendimento}
                onChange={e=>set("rendimento",e.target.value)}
                placeholder="Ex: 10 (1L cobre 10m²)"/>
            </div>
            <div className="form-group">
              <label>Demãos padrão <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>(padrão 2)</span></label>
              <input type="number" min="1" max="10" step="1" value={form.demaosPadrao}
                onChange={e=>set("demaosPadrao",e.target.value)}/>
            </div>
          </div>
        )}

        {/* Imagem de referência */}
        <div className="form-group">
          <label>Imagem de referência <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>(opcional)</span></label>
          {imagemBase64 ? (
            <div style={{display:"flex",alignItems:"flex-start",gap:10,marginTop:4}}>
              <img src={imagemBase64} alt="referência"
                style={{width:90,height:90,objectFit:"cover",borderRadius:8,border:"1px solid var(--border)",flexShrink:0}}/>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <button type="button" onClick={()=>imgInputRef.current.click()}
                  style={{padding:"5px 12px",border:"1px solid var(--border)",borderRadius:6,background:"#fff",fontSize:12,cursor:"pointer"}}>
                  Trocar imagem
                </button>
                <button type="button" onClick={()=>setImagemBase64(null)}
                  style={{padding:"5px 12px",border:"1px solid var(--vermelho)",borderRadius:6,background:"#fff",color:"var(--vermelho)",fontSize:12,cursor:"pointer"}}>
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={()=>imgInputRef.current.click()} disabled={carregandoImg}
              style={{
                marginTop:4,width:"100%",padding:"18px 0",border:"2px dashed var(--border)",
                borderRadius:8,background:"var(--cinza-lt)",cursor:"pointer",
                fontSize:13,color:"#7A7A7A",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
              }}>
              {carregandoImg ? "Processando..." : <><span style={{fontSize:20}}>📷</span> Selecionar imagem</>}
            </button>
          )}
          <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImagem} style={{display:"none"}}/>
          <span style={{fontSize:11,color:"#aaa",marginTop:4,display:"block"}}>Foto do produto, embalagem ou equipamento para referência visual.</span>
        </div>
      </div>
    </Modal>
  );
}

// Modal de extrato por item
function ExtratoModal({ item, movs, onClose }) {
  const hoje = new Date().toISOString().split("T")[0];
  const trintaDiasAtras = new Date(Date.now() - 30*24*60*60*1000).toISOString().split("T")[0];
  const [dataInicio, setDataInicio] = useState(trintaDiasAtras);
  const [dataFim, setDataFim] = useState(hoje);

  const movsItem = movs.filter(m => {
    if (m.materialId !== item.id && m.materialNome !== item.nome) return false;
    if (dataInicio && m.data < dataInicio) return false;
    if (dataFim && m.data > dataFim) return false;
    return true;
  }).sort((a,b) => (b.data||"").localeCompare(a.data||""));

  function exportar() {
    const dados = movsItem.map(m => ({
      data: fmtDate(m.data),
      tipo: m.tipo === "entrada" ? "Entrada" : "Saída",
      quantidade: m.tipo === "entrada" ? `+${m.quantidade}` : `-${m.quantidade}`,
      custoUnitario: m.custoUnitario ? fmt(m.custoUnitario) : "–",
      demanda: m.demandaNome || m.demandaTipo || "–",
      usuario: m.usuario || "–",
      obs: m.obs || "–",
    }));
    exportarExcel(dados, `Extrato_${item.nome}`, [
      { header:"Data",        key:"data" },
      { header:"Tipo",        key:"tipo" },
      { header:"Qtd.",        key:"quantidade" },
      { header:"Custo unit.", key:"custoUnitario" },
      { header:"Demanda",     key:"demanda" },
      { header:"Usuário",     key:"usuario" },
      { header:"Obs.",        key:"obs" },
    ]);
  }

  return (
    <Modal title={`📋 Extrato — ${item.nome}`} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Fechar</button>
          <button className="btn btn-primary" onClick={exportar} disabled={movsItem.length===0}>Exportar Excel</button>
        </>
      }>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div className="form-grid">
          <div className="form-group"><label>Data início</label>
            <input type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)}/>
          </div>
          <div className="form-group"><label>Data fim</label>
            <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)}/>
          </div>
        </div>
        {movsItem.length === 0
          ? <div className="empty-state"><div className="empty-icon">📋</div><p>Nenhuma movimentação no período</p></div>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Tipo</th><th>Qtd.</th><th>Custo unit.</th><th>Demanda</th><th>Usuário</th><th>Obs.</th></tr></thead>
                <tbody>
                  {movsItem.map(m=>(
                    <tr key={m.id}>
                      <td style={{fontSize:12}}>{fmtDate(m.data)}</td>
                      <td>{m.tipo==="entrada"?<span className="badge badge-green">📥 Entrada</span>:<span className="badge badge-red">📤 Saída</span>}</td>
                      <td style={{fontWeight:700,color:m.tipo==="entrada"?"var(--verde)":"var(--vermelho)"}}>{m.tipo==="entrada"?"+":"-"}{m.quantidade}</td>
                      <td style={{fontSize:12}}>{m.custoUnitario ? fmt(m.custoUnitario) : "–"}</td>
                      <td style={{fontSize:12}}>{m.demandaNome||m.demandaTipo||"–"}</td>
                      <td style={{fontSize:12}}>{m.usuario}</td>
                      <td style={{fontSize:11,color:"var(--cinza-med)"}}>{m.obs||"–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </Modal>
  );
}

export default function MateriaisGlobal() {
  const { userProfile, currentUser } = useAuth();
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
  const [modalEdit,  setModalEdit]  = useState(null); // material a editar
  const [modalTransf, setModalTransf] = useState(null); // {origem, material}
  const [modalExtrato, setModalExtrato] = useState(null); // item

  // Inventário
  const [contagens, setContagens] = useState({}); // { [materialId]: string }
  const [salvandoInventario, setSalvandoInventario] = useState(false);
  const inventarioData = useMemo(() => new Date().toLocaleString("pt-BR"), []);

  const canEdit = !isCampo(userProfile);
  // Editar e excluir: adm master (adm===true), gestão, financeiro, comercial e compras
  // adm===true garante acesso total independente do departamento configurado
  const canManage = userProfile?.adm === true || isGestorOuAdm(userProfile) || isNivelIntermediario(userProfile);

  async function excluirMaterial(m) {
    if (!window.confirm(`Excluir "${m.nome}" do estoque?\n\nAtenção: o histórico de movimentações não será apagado.`)) return;
    try {
      await deleteComAuditoria("materiais_estoque", m.id, currentUser?.uid, userProfile?.nome, m);
      addToast(`"${m.nome}" excluído.`);
    } catch(err) { addToast("Erro ao excluir: "+err.message,"error"); }
  }

  useEffect(() => {
    const u1 = onSnapshot(collection(db,"materiais_estoque"), snap => {
      setMateriais(snap.docs.map(d=>({id:d.id,...d.data()})));
      setLoading(false);
    });
    const u2 = onSnapshot(query(collection(db,"movimentacoes"),limit(1000)), snap => {
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

    // Transferências: entra como "comprado" na obra destino (obra→obra), sai como "usado" na obra origem
    transferencias.forEach(t => {
      if (t.obraDestinoId) add(t.obraDestinoId, t.materialNome, t.un, "comprado", Number(t.qtd)||0);
      add(t.obraOrigemId, t.materialNome, t.un, "usado", Number(t.qtd)||0);
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

  // KPI: Valor total do estoque
  const valorTotalEstoque = useMemo(() => {
    return materiais.reduce((acc, m) => {
      const custo = m.custoMedio || m.custoUnitario || 0;
      return acc + (m.saldo * custo);
    }, 0);
  }, [materiais]);

  // KPI: Giro do mês (saídas do mês / saldo médio)
  const giroMes = useMemo(() => {
    const agora = new Date();
    const anoMes = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,"0")}`;
    const saidasMes = movs
      .filter(m => m.tipo === "saida" && (m.data||"").startsWith(anoMes))
      .reduce((acc, m) => acc + (m.quantidade || 0), 0);
    const saldoMedio = materiais.length > 0
      ? materiais.reduce((acc, m) => acc + m.saldo, 0) / materiais.length
      : 0;
    return saldoMedio > 0 ? (saidasMes / saldoMedio).toFixed(1) : "–";
  }, [movs, materiais]);

  // Confirmar inventário
  async function confirmarInventario() {
    const ajustes = materiais.filter(m => {
      const c = contagens[m.id];
      return c !== undefined && c !== "" && Number(c) !== m.saldo;
    });
    if (ajustes.length === 0) { addToast("Nenhum ajuste necessário."); return; }
    if (!window.confirm(`Confirmar ajuste de ${ajustes.length} item(ns)?`)) return;
    setSalvandoInventario(true);
    const dataHoje = new Date().toISOString().split("T")[0];
    try {
      for (const m of ajustes) {
        const contagem = Number(contagens[m.id]);
        const diff = contagem - m.saldo;
        const tipoMov = diff > 0 ? "entrada" : "saida";
        const qtdAjuste = Math.abs(diff);
        await addComAuditoria("movimentacoes", {
          materialId: m.id,
          materialNome: m.nome,
          tipo: tipoMov,
          quantidade: qtdAjuste,
          demandaTipo: "estoque",
          demandaId: "",
          demandaNome: "",
          colaboradorNome: "",
          obs: "Ajuste de inventário",
          data: dataHoje,
          usuario: userProfile?.nome || "–",
          createdAt: new Date().toISOString(),
        }, currentUser?.uid, userProfile?.nome);
        await updateComAuditoria("materiais_estoque", m.id, {
          saldo: contagem,
          totalEntradas: tipoMov === "entrada" ? (m.totalEntradas||0) + qtdAjuste : (m.totalEntradas||0),
          totalSaidas:   tipoMov === "saida"   ? (m.totalSaidas||0)   + qtdAjuste : (m.totalSaidas||0),
        }, currentUser?.uid, userProfile?.nome);
      }
      setContagens({});
      addToast(`Inventário confirmado! ${ajustes.length} item(ns) ajustado(s).`);
    } catch(err) { addToast("Erro: "+err.message, "error"); }
    setSalvandoInventario(false);
  }

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
        <div className="metric"><div className="metric-label">Valor total estoque</div><div className="metric-value" style={{fontSize:14}}>{fmt(valorTotalEstoque)}</div></div>
        <div className="metric"><div className="metric-label">Giro do mês</div><div className="metric-value">{giroMes === "–" ? "–" : `${giroMes}×`}</div></div>
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
        {canManage && <button className={`tab ${aba==="inventario"?"active":""}`} onClick={()=>setAba("inventario")}>🗂️ Inventário</button>}
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
                <thead><tr>
                  <th>Material</th><th>Categoria</th><th>Un.</th><th>Saldo</th><th>Mínimo</th>
                  <th>Total entradas</th><th>Total saídas</th><th>Sobra em obras</th>
                  <th>Custo médio</th><th>Valor total</th><th>Localização</th><th>Validade</th>
                  <th>Status</th>{canEdit&&<th></th>}
                </tr></thead>
                <tbody>
                  {filtered.map(m=>{
                    const critico = m.estoqueMin>0 && m.saldo<=m.estoqueMin;
                    const zerado  = m.saldo<=0;
                    const sobraObras = saldoEmObrasPara(m.nome);
                    const custoExib = m.custoMedio || m.custoUnitario;
                    const valorTotal = m.saldo * (custoExib || 0);
                    const hoje = new Date().toISOString().split("T")[0];
                    const em30dias = new Date(Date.now()+30*24*60*60*1000).toISOString().split("T")[0];
                    const validadeVencida = m.validade && m.validade < hoje;
                    const validadeProxima = m.validade && m.validade >= hoje && m.validade <= em30dias;
                    return (
                      <tr key={m.id}>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            {m.imagemReferencia && (
                              <img src={m.imagemReferencia} alt={m.nome}
                                style={{width:36,height:36,objectFit:"cover",borderRadius:6,border:"1px solid var(--border)",flexShrink:0,cursor:"pointer"}}
                                onClick={()=>window.open(m.imagemReferencia,"_blank")}
                                title="Ver imagem de referência"/>
                            )}
                            <strong>{m.nome}</strong>
                          </div>
                        </td>
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
                        <td style={{fontSize:12}}>{custoExib ? fmt(custoExib) : "–"}</td>
                        <td style={{fontSize:12}}>{valorTotal > 0 ? fmt(valorTotal) : "–"}</td>
                        <td style={{fontSize:11,color:"var(--cinza-med)"}}>{m.localizacao||"–"}</td>
                        <td style={{fontSize:12}}>
                          {m.validade ? (
                            <span style={{
                              padding:"2px 7px",borderRadius:10,fontSize:11,fontWeight:600,
                              background: validadeVencida ? "var(--vermelho-lt)" : validadeProxima ? "#fff3e0" : "var(--cinza-lt)",
                              color: validadeVencida ? "var(--vermelho)" : validadeProxima ? "#e65100" : "#555",
                            }}>
                              {validadeVencida ? "⚠️ " : validadeProxima ? "⚠ " : ""}{fmtDate(m.validade)}
                            </span>
                          ) : "–"}
                        </td>
                        <td>
                          {zerado ? <span className="badge badge-red">Zerado</span>
                           : critico ? <span className="badge badge-amber">Crítico</span>
                           : <span className="badge badge-green">OK</span>}
                        </td>
                        {canEdit && (
                          <td style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            <button className="btn btn-sm" style={{background:"var(--verde-lt)",color:"var(--verde)",border:"none"}} onClick={()=>setModalMov({item:m,tipo:"entrada"})} title="Registrar entrada">📥</button>
                            <button className="btn btn-sm" style={{background:"var(--vermelho-lt)",color:"var(--vermelho)",border:"none"}} onClick={()=>setModalMov({item:m,tipo:"saida"})} title="Registrar saída">📤</button>
                            <button className="btn btn-sm" style={{background:"#f0f4ff",color:"#4F46E5",border:"none"}} onClick={()=>setModalExtrato(m)} title="Ver extrato">📋</button>
                            {canManage && <>
                              <button className="btn btn-sm" style={{background:"#EEF2FF",color:"#4F46E5",border:"none"}} onClick={()=>setModalEdit(m)} title="Editar material">✏️</button>
                              <button className="btn btn-sm" style={{background:"var(--vermelho-lt)",color:"var(--vermelho)",border:"none"}} onClick={()=>excluirMaterial(m)} title="Excluir material">🗑️</button>
                            </>}
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
                <thead><tr><th>Data</th><th>Tipo</th><th>Material</th><th>Qtd.</th><th>Custo unit.</th><th>Demanda</th><th>Usuário</th><th>Obs.</th></tr></thead>
                <tbody>
                  {movs.map(m=>(
                    <tr key={m.id}>
                      <td style={{fontSize:12}}>{fmtDate(m.data)}</td>
                      <td>{m.tipo==="entrada"?<span className="badge badge-green">📥 Entrada</span>:<span className="badge badge-red">📤 Saída</span>}</td>
                      <td style={{fontWeight:500}}>{m.materialNome}</td>
                      <td style={{fontWeight:700,color:m.tipo==="entrada"?"var(--verde)":"var(--vermelho)"}}>{m.tipo==="entrada"?"+":"-"}{m.quantidade}</td>
                      <td style={{fontSize:12}}>{m.custoUnitario ? fmt(m.custoUnitario) : "–"}</td>
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

      {/* ABA INVENTÁRIO */}
      {aba==="inventario" && canManage && (
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>Inventário periódico</div>
              <div style={{fontSize:12,color:"var(--cinza-med)"}}>Iniciado em: {inventarioData}</div>
            </div>
            <button className="btn btn-primary" onClick={confirmarInventario} disabled={salvandoInventario}>
              {salvandoInventario ? "Salvando..." : "✓ Confirmar inventário"}
            </button>
          </div>
          {materiais.length === 0
            ? <div className="empty-state"><div className="empty-icon">🗂️</div><p>Nenhum material cadastrado</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Material</th><th>Localização</th><th>Saldo sistema</th><th>Contagem física</th><th>Diferença</th></tr></thead>
                  <tbody>
                    {[...materiais].sort((a,b)=>a.nome.localeCompare(b.nome)).map(m=>{
                      const cStr = contagens[m.id];
                      const c = cStr !== undefined && cStr !== "" ? Number(cStr) : null;
                      const diff = c !== null ? c - m.saldo : null;
                      return (
                        <tr key={m.id}>
                          <td style={{fontWeight:500}}>{m.nome}</td>
                          <td style={{fontSize:12,color:"var(--cinza-med)"}}>{m.localizacao||"–"}</td>
                          <td style={{fontWeight:700,color:m.saldo<=0?"var(--vermelho)":"var(--verde)"}}>{m.saldo} {m.un}</td>
                          <td>
                            <input
                              type="number" min="0" placeholder="—"
                              value={cStr !== undefined ? cStr : ""}
                              onChange={e=>setContagens(p=>({...p,[m.id]:e.target.value}))}
                              style={{width:90,textAlign:"center",
                                borderColor: diff !== null && diff !== 0 ? (diff>0?"var(--verde)":"var(--vermelho)") : undefined}}
                            />
                          </td>
                          <td style={{fontWeight:600,
                            color: diff === null ? "#aaa" : diff > 0 ? "var(--verde)" : diff < 0 ? "var(--vermelho)" : "#7A7A7A"}}>
                            {diff === null ? "–" : diff > 0 ? `+${diff}` : diff === 0 ? "OK" : diff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}

      {modalTransf && (
        <TransferenciaModal origem={modalTransf.origem} material={modalTransf.material}
          obras={obras} manutencoes={manut}
          onClose={()=>setModalTransf(null)} addToast={addToast}/>
      )}

      {modalMov  && <MovimentacaoModal item={modalMov.item} tipo={modalMov.tipo} obras={obras} manutencoes={manut} onClose={()=>setModalMov(null)} addToast={addToast}/>}
      {modalNovo && <NovoMaterialModal onClose={()=>setModalNovo(false)} addToast={addToast}/>}
      {modalEdit && <NovoMaterialModal material={modalEdit} onClose={()=>setModalEdit(null)} addToast={addToast}/>}
      {modalExtrato && <ExtratoModal item={modalExtrato} movs={movs} onClose={()=>setModalExtrato(null)}/>}
    </div>
  );
}
