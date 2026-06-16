// src/pages/Compras.js — v4: etapas isoladas, campos específicos por etapa, botões de avanço
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { useToast } from "../hooks/useToast";
import { getAcesso } from "../constants/departamentos";

// ── Definição das etapas ──────────────────────────────────────────────────────
const ETAPAS = [
  { id:"SOLICITAÇÃO",     label:"Solicitação",      icone:"📝", cor:"#4A4A4A", proximaLabel:"Enviar para Cotação",       proxima:"COTAÇÃO" },
  { id:"COTAÇÃO",         label:"Cotação",           icone:"💬", cor:"#185FA5", proximaLabel:"Enviar para Aprovação",     proxima:"APROVADA" },
  { id:"APROVADA",        label:"Aprovada",          icone:"✅", cor:"#C9A200", proximaLabel:"Gerar Ordem de Compra",     proxima:"ORDEM DE COMPRA" },
  { id:"ORDEM DE COMPRA", label:"Ordem de Compra",   icone:"📋", cor:"#7B4F00", proximaLabel:"Confirmar Recebimento",    proxima:"RECEBIDO" },
  { id:"RECEBIDO",        label:"Recebido",          icone:"📦", cor:"#2D6A1F", proximaLabel:"Enviar para Aguard. NF",   proxima:"AGUARD. NF" },
  { id:"AGUARD. NF",      label:"Aguard. NF",        icone:"🧾", cor:"#1A5A10", proximaLabel:"Concluir",                proxima:"NF VINCULADA" },
  { id:"NF VINCULADA",    label:"NF Vinculada",      icone:"✔️", cor:"#0F3D0A", proximaLabel:null,                      proxima:null },
];

const STATUS_COR = {
  "SOLICITAÇÃO":    "badge-gray",
  "COTAÇÃO":        "badge-blue",
  "APROVADA":       "badge-yellow",
  "ORDEM DE COMPRA":"badge-purple",
  "RECEBIDO":       "badge-green",
  "AGUARD. NF":     "badge-amber",
  "NF VINCULADA":   "badge-green",
};

// ── MODAL POR ETAPA ───────────────────────────────────────────────────────────
function CompraModal({ compra, etapaForcar, obras, manutencoes, fornecedores, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const ac = getAcesso(userProfile);
  const isNova = !compra?.id;
  const etapaAtual = isNova ? "SOLICITAÇÃO" : (etapaForcar || compra?.status || "SOLICITAÇÃO");
  const etapaInfo = ETAPAS.find(e => e.id === etapaAtual);

  // Estado do formulário — só os campos necessários
  const [titulo,          setTitulo]          = useState(compra?.titulo          || "");
  const [demandaTipo,     setDemandaTipo]      = useState(compra?.demandaTipo     || "obra");
  const [demandaId,       setDemandaId]        = useState(compra?.demandaId       || "");
  const [urgencia,        setUrgencia]         = useState(compra?.urgencia        || "normal");
  const [obs,             setObs]              = useState(compra?.obs             || "");
  const [itens,           setItens]            = useState(compra?.itens           || []);
  // Cotação
  const [fornecedorId,    setFornecedorId]     = useState(compra?.fornecedorId    || "");
  const [valorCotado,     setValorCotado]      = useState(compra?.valorCotado     || "");
  const [prazoEntrega,    setPrazoEntrega]      = useState(compra?.prazoEntrega    || "");
  const [obsCotacao,      setObsCotacao]       = useState(compra?.obsCotacao      || "");
  // Aprovação
  const [valorAprovado,   setValorAprovado]    = useState(compra?.valorAprovado   || "");
  const [formaPagamento,  setFormaPagamento]   = useState(compra?.formaPagamento  || "");
  const [obsAprovacao,    setObsAprovacao]     = useState(compra?.obsAprovacao    || "");
  // OC
  const [numeroPedido,    setNumeroPedido]     = useState(compra?.numeroPedido    || "");
  const [prazoOC,         setPrazoOC]          = useState(compra?.prazoOC         || "");
  const [obsOC,           setObsOC]            = useState(compra?.obsOC           || "");
  // Recebimento
  const [tipoReceb,       setTipoReceb]        = useState(compra?.tipoReceb       || "conforme");
  const [dataRecebimento, setDataRecebimento]  = useState(compra?.dataRecebimento || new Date().toISOString().split("T")[0]);
  const [obsReceb,        setObsReceb]         = useState(compra?.obsReceb        || "");
  // NF
  const [numeroNF,        setNumeroNF]         = useState(compra?.numeroNF        || "");
  const [valorNF,         setValorNF]          = useState(compra?.valorNF         || "");
  const [dataNF,          setDataNF]           = useState(compra?.dataNF          || "");
  const [obsNF,           setObsNF]            = useState(compra?.obsNF           || "");
  // Itens add
  const [itemNome, setItemNome] = useState("");
  const [itemQtd,  setItemQtd]  = useState("");
  const [itemUn,   setItemUn]   = useState("un");
  const [saving,   setSaving]   = useState(false);

  const demandas = demandaTipo === "obra" ? obras : manutencoes;
  const fornSel  = fornecedores.find(f => f.id === fornecedorId);

  function addItem() {
    if (!itemNome||!itemQtd) { alert("Informe o item e a quantidade."); return; }
    setItens(p=>[...p,{nome:itemNome,qtd:Number(itemQtd),un:itemUn}]);
    setItemNome(""); setItemQtd("");
  }

  function payload(novoStatus) {
    return {
      titulo, demandaTipo, demandaId, urgencia, obs, itens,
      demandaNome: demandas.find(d=>d.id===demandaId)?.nome||demandas.find(d=>d.id===demandaId)?.titulo||"",
      fornecedorId, fornecedorNome: fornSel?.razaoSocial||"",
      valorCotado: Number(valorCotado)||0, prazoEntrega, obsCotacao,
      valorAprovado: Number(valorAprovado)||0, formaPagamento, obsAprovacao,
      numeroPedido, prazoOC, obsOC,
      tipoReceb, dataRecebimento, obsReceb,
      numeroNF, valorNF: Number(valorNF)||0, dataNF, obsNF,
      status: novoStatus,
      autorNome: userProfile?.nome||currentUser?.email,
      updatedAt: new Date().toISOString(),
    };
  }

  async function salvar(novoStatus) {
    if (!titulo) { alert("Informe o título."); return; }
    if (isNova && !itens.length) { alert("Adicione pelo menos 1 item."); return; }
    setSaving(true);
    try {
      const data = payload(novoStatus || etapaAtual);
      if (compra?.id) {
        await updateDoc(doc(db,"compras",compra.id), data);
        addToast(novoStatus && novoStatus !== etapaAtual ? `✓ Avançado para: ${novoStatus}` : "Salvo!");
      } else {
        data.createdAt = new Date().toISOString();
        await addDoc(collection(db,"compras"), data);
        addToast("Solicitação criada!");
      }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  const podeAvancar = ac.compras_etapas?.includes(etapaAtual) || ac.isAdm;
  const fmt = v => v ? `R$ ${Number(v).toLocaleString("pt-BR",{minimumFractionDigits:2})}` : "–";

  return (
    <Modal
      title={isNova ? "Nova solicitação de compra" : compra.titulo}
      onClose={onClose}
      footer={
        <div style={{display:"flex",gap:8,width:"100%",justifyContent:"space-between"}}>
          <button className="btn" onClick={onClose}>Fechar</button>
          <div style={{display:"flex",gap:8}}>
            {/* Salvar sem avançar (exceto na criação nova) */}
            {!isNova && (
              <button className="btn" onClick={()=>salvar(etapaAtual)} disabled={saving}>
                {saving?"Salvando...":"Salvar rascunho"}
              </button>
            )}
            {/* Botão principal: avançar ou criar */}
            {isNova ? (
              <button className="btn btn-primary" onClick={()=>salvar("SOLICITAÇÃO")} disabled={saving}>
                {saving?"Criando...":"✓ Criar solicitação"}
              </button>
            ) : etapaInfo?.proxima && podeAvancar ? (
              <button className="btn btn-primary" onClick={()=>salvar(etapaInfo.proxima)} disabled={saving}
                style={{gap:6}}>
                {saving?"Salvando...":etapaInfo.proximaLabel+" →"}
              </button>
            ) : null}
          </div>
        </div>
      }
    >
      <div style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* Badge da etapa atual */}
        {!isNova && (
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",
            background:etapaInfo?.cor||"#4A4A4A",borderRadius:8,color:"#fff"}}>
            <span style={{fontSize:18}}>{etapaInfo?.icone}</span>
            <div>
              <div style={{fontSize:12,fontWeight:700}}>{etapaInfo?.label}</div>
              {etapaInfo?.proxima && podeAvancar && (
                <div style={{fontSize:10,opacity:.7}}>Próximo: {etapaInfo.proxima}</div>
              )}
            </div>
            {!podeAvancar && <span style={{marginLeft:"auto",fontSize:10,opacity:.6}}>🔒 sem permissão para avançar</span>}
          </div>
        )}

        {/* ── ETAPA: SOLICITAÇÃO ─────────────────────────────── */}
        {(isNova || etapaAtual === "SOLICITAÇÃO") && (
          <>
            <div className="form-group">
              <label className="required">Título da compra</label>
              <input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Ex: Cabos elétricos — AG 0442"/>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Vinculado a</label>
                <select value={demandaTipo} onChange={e=>{setDemandaTipo(e.target.value);setDemandaId("");}}>
                  <option value="obra">Obra</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="geral">Estoque geral</option>
                </select>
              </div>
              {demandaTipo !== "geral" && (
                <div className="form-group">
                  <label>Qual {demandaTipo==="obra"?"obra":"manutenção"}?</label>
                  <select value={demandaId} onChange={e=>setDemandaId(e.target.value)}>
                    <option value="">Selecione...</option>
                    {demandas.map(d=><option key={d.id} value={d.id}>{d.nome||d.titulo}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Urgência</label>
                <select value={urgencia} onChange={e=>setUrgencia(e.target.value)}>
                  {["baixa","normal","alta","urgente"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Itens */}
            <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Itens solicitados</div>
            <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
              <div className="form-group" style={{flex:2}}><label>Item</label><input value={itemNome} onChange={e=>setItemNome(e.target.value)} placeholder="Ex: Cabo 10mm²"/></div>
              <div className="form-group" style={{width:80}}><label>Qtd.</label><input type="number" min="1" value={itemQtd} onChange={e=>setItemQtd(e.target.value)}/></div>
              <div className="form-group" style={{width:80}}><label>Un.</label>
                <select value={itemUn} onChange={e=>setItemUn(e.target.value)}>
                  {["un","m","m²","kg","saco","cx","rolo","litro"].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" onClick={addItem} style={{marginBottom:1}}>+ Add</button>
            </div>
            {itens.length > 0 && (
              <div className="table-wrap">
                <table><thead><tr><th>Item</th><th>Qtd.</th><th>Un.</th><th></th></tr></thead>
                  <tbody>{itens.map((it,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:500}}>{it.nome}</td><td>{it.qtd}</td><td>{it.un}</td>
                      <td><button className="btn btn-sm" style={{color:"var(--vermelho)"}} onClick={()=>setItens(p=>p.filter((_,j)=>j!==i))}>✕</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <div className="form-group"><label>Observações</label><textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}/></div>
          </>
        )}

        {/* ── ETAPA: COTAÇÃO ──────────────────────────────────── */}
        {!isNova && etapaAtual === "COTAÇÃO" && (
          <>
            {/* Resumo do pedido */}
            <ResumoItens itens={compra.itens} titulo={compra.titulo} demandaNome={compra.demandaNome}/>
            <div style={{fontSize:11,fontWeight:700,color:"#185FA5",textTransform:"uppercase",letterSpacing:".06em"}}>Dados da cotação</div>
            <div className="form-grid">
              <div className="form-group span-2">
                <label className="required">Fornecedor</label>
                <select value={fornecedorId} onChange={e=>setFornecedorId(e.target.value)}>
                  <option value="">Selecione o fornecedor...</option>
                  {fornecedores.filter(f=>f.status!=="BLOQUEADO").map(f=><option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="required">Valor cotado (R$)</label>
                <input type="number" value={valorCotado} onChange={e=>setValorCotado(e.target.value)} placeholder="0,00"/>
              </div>
              <div className="form-group">
                <label>Prazo de entrega</label>
                <input type="date" value={prazoEntrega} onChange={e=>setPrazoEntrega(e.target.value)}/>
              </div>
            </div>
            <div className="form-group"><label>Observações da cotação</label><textarea value={obsCotacao} onChange={e=>setObsCotacao(e.target.value)} rows={2} placeholder="Condições negociadas, validade da cotação..."/></div>
          </>
        )}

        {/* ── ETAPA: APROVADA ─────────────────────────────────── */}
        {!isNova && etapaAtual === "APROVADA" && (
          <>
            <ResumoItens itens={compra.itens} titulo={compra.titulo} demandaNome={compra.demandaNome}/>
            <ResumoCotacao valorCotado={compra.valorCotado} fornecedorNome={compra.fornecedorNome} prazoEntrega={compra.prazoEntrega}/>
            <div className="alert alert-warning" style={{fontSize:12}}>
              ⚠️ Ao avançar para Ordem de Compra, o valor comprometido será registrado no financeiro.
            </div>
            <div style={{fontSize:11,fontWeight:700,color:"#C9A200",textTransform:"uppercase",letterSpacing:".06em"}}>Dados da aprovação</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="required">Valor aprovado (R$)</label>
                <input type="number" value={valorAprovado} onChange={e=>setValorAprovado(e.target.value)} placeholder={valorCotado||"0,00"}/>
                {valorCotado && valorAprovado && Number(valorAprovado) !== Number(valorCotado) && (
                  <span style={{fontSize:11,color:Number(valorAprovado)<Number(valorCotado)?"var(--verde)":"var(--vermelho)",fontWeight:600}}>
                    {Number(valorAprovado)<Number(valorCotado)?"▼ Economia:":"▲ Acréscimo:"} R$ {Math.abs(Number(valorAprovado)-Number(valorCotado)).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>Forma de pagamento</label>
                <select value={formaPagamento} onChange={e=>setFormaPagamento(e.target.value)}>
                  <option value="">Selecione...</option>
                  {["À vista","30 dias","30/60","30/60/90","Boleto","PIX"].map(f=><option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label>Observações da aprovação</label><textarea value={obsAprovacao} onChange={e=>setObsAprovacao(e.target.value)} rows={2}/></div>
          </>
        )}

        {/* ── ETAPA: ORDEM DE COMPRA ─────────────────────────── */}
        {!isNova && etapaAtual === "ORDEM DE COMPRA" && (
          <>
            <ResumoItens itens={compra.itens} titulo={compra.titulo} demandaNome={compra.demandaNome}/>
            <ResumoCotacao valorCotado={compra.valorCotado} fornecedorNome={compra.fornecedorNome} prazoEntrega={compra.prazoEntrega}/>
            {compra.valorAprovado && (
              <div style={{background:"var(--verde-lt)",borderRadius:8,padding:10,fontSize:12}}>
                ✅ Valor aprovado: <strong style={{color:"var(--verde)"}}>R$ {Number(compra.valorAprovado).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong>
                {compra.formaPagamento && <> · {compra.formaPagamento}</>}
              </div>
            )}
            <div style={{fontSize:11,fontWeight:700,color:"#7B4F00",textTransform:"uppercase",letterSpacing:".06em"}}>Ordem de Compra</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Número do pedido / OC</label>
                <input value={numeroPedido} onChange={e=>setNumeroPedido(e.target.value)} placeholder="OC-2025-001"/>
              </div>
              <div className="form-group">
                <label>Prazo de entrega confirmado</label>
                <input type="date" value={prazoOC} onChange={e=>setPrazoOC(e.target.value)}/>
              </div>
            </div>
            <div className="form-group"><label>Observações</label><textarea value={obsOC} onChange={e=>setObsOC(e.target.value)} rows={2}/></div>
          </>
        )}

        {/* ── ETAPA: RECEBIDO ─────────────────────────────────── */}
        {!isNova && etapaAtual === "RECEBIDO" && (
          <>
            <ResumoItens itens={compra.itens} titulo={compra.titulo} demandaNome={compra.demandaNome}/>
            {compra.numeroPedido && (
              <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:10,fontSize:12}}>
                📋 OC: <strong>{compra.numeroPedido}</strong>
                {compra.prazoOC && <> · Prazo: {fmtDate(compra.prazoOC)}</>}
                {compra.fornecedorNome && <> · {compra.fornecedorNome}</>}
              </div>
            )}
            <div style={{fontSize:11,fontWeight:700,color:"#2D6A1F",textTransform:"uppercase",letterSpacing:".06em"}}>Conferência do recebimento</div>
            <div className="form-group">
              <label className="required">Resultado da conferência</label>
              <select value={tipoReceb} onChange={e=>setTipoReceb(e.target.value)}
                style={{fontWeight:600,
                  background:tipoReceb==="conforme"?"var(--verde-lt)":tipoReceb==="troca"?"var(--afine-yellow-lt)":"var(--vermelho-lt)",
                  color:tipoReceb==="conforme"?"var(--verde)":tipoReceb==="troca"?"var(--afine-yellow-dk)":"var(--vermelho)"}}>
                <option value="conforme">✅ Concluído — tudo conforme</option>
                <option value="troca">🔄 Troca — material incorreto ou com defeito</option>
                <option value="devolucao">↩️ Devolução — material não aceito</option>
              </select>
            </div>
            <div className="form-group">
              <label className="required">Data de recebimento</label>
              <input type="date" value={dataRecebimento} onChange={e=>setDataRecebimento(e.target.value)}/>
            </div>
            {/* Campos condicionais */}
            {tipoReceb === "troca" && (
              <div className="form-group">
                <label className="required" style={{color:"var(--afine-yellow-dk)"}}>Motivo da troca</label>
                <textarea value={obsReceb} onChange={e=>setObsReceb(e.target.value)} rows={3}
                  placeholder="Descreva o motivo da troca, o problema identificado e o que foi solicitado ao fornecedor..."
                  style={{borderColor:"var(--afine-yellow-dk)"}}/>
              </div>
            )}
            {tipoReceb === "devolucao" && (
              <div className="form-group">
                <label className="required" style={{color:"var(--vermelho)"}}>Motivo da devolução</label>
                <textarea value={obsReceb} onChange={e=>setObsReceb(e.target.value)} rows={3}
                  placeholder="Descreva o motivo da devolução, não conformidade identificada e próximos passos..."
                  style={{borderColor:"var(--vermelho)"}}/>
              </div>
            )}
            {tipoReceb === "conforme" && (
              <div className="form-group"><label>Observações (opcional)</label><textarea value={obsReceb} onChange={e=>setObsReceb(e.target.value)} rows={2} placeholder="Registre qualquer observação sobre o recebimento..."/></div>
            )}
            {tipoReceb !== "conforme" && (
              <div className="alert alert-warning" style={{fontSize:12}}>
                {tipoReceb==="troca"?"🔄 O pedido voltará ao fornecedor para troca. Registre os detalhes acima.":"↩️ O material será devolvido. Registre o motivo e os próximos passos."}
              </div>
            )}
          </>
        )}

        {/* ── ETAPA: AGUARD. NF ───────────────────────────────── */}
        {!isNova && etapaAtual === "AGUARD. NF" && (
          <>
            <ResumoItens itens={compra.itens} titulo={compra.titulo} demandaNome={compra.demandaNome}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12,marginBottom:4}}>
              {compra.fornecedorNome&&<div><span style={{color:"#7A7A7A"}}>Fornecedor:</span> <strong>{compra.fornecedorNome}</strong></div>}
              {compra.valorAprovado&&<div><span style={{color:"#7A7A7A"}}>Valor aprovado:</span> <strong style={{color:"var(--verde)"}}>R$ {Number(compra.valorAprovado).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></div>}
              {compra.numeroPedido&&<div><span style={{color:"#7A7A7A"}}>OC:</span> <strong>{compra.numeroPedido}</strong></div>}
              {compra.dataRecebimento&&<div><span style={{color:"#7A7A7A"}}>Recebido em:</span> <strong>{fmtDate(compra.dataRecebimento)}</strong></div>}
            </div>
            <div style={{fontSize:11,fontWeight:700,color:"#1A5A10",textTransform:"uppercase",letterSpacing:".06em"}}>Nota Fiscal</div>
            <div className="form-grid">
              <div className="form-group">
                <label className="required">Número da NF</label>
                <input value={numeroNF} onChange={e=>setNumeroNF(e.target.value)} placeholder="NF-4521"/>
              </div>
              <div className="form-group">
                <label className="required">Valor da NF (R$)</label>
                <input type="number" value={valorNF} onChange={e=>setValorNF(e.target.value)} placeholder="0,00"/>
                {compra.valorAprovado && valorNF && Math.abs(Number(valorNF)-Number(compra.valorAprovado)) > 0.01 && (
                  <span style={{fontSize:11,color:Number(valorNF)>Number(compra.valorAprovado)?"var(--vermelho)":"var(--verde)",fontWeight:600}}>
                    {Number(valorNF)>Number(compra.valorAprovado)?"⚠ Acima do aprovado":"✓ Abaixo do aprovado"}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>Data de emissão da NF</label>
                <input type="date" value={dataNF} onChange={e=>setDataNF(e.target.value)}/>
              </div>
            </div>
            <div className="form-group"><label>Observações</label><textarea value={obsNF} onChange={e=>setObsNF(e.target.value)} rows={2}/></div>
          </>
        )}

        {/* ── ETAPA: NF VINCULADA (concluído) ─────────────────── */}
        {!isNova && etapaAtual === "NF VINCULADA" && (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--verde)",marginBottom:8}}>Compra concluída!</div>
            <div style={{fontSize:13,color:"#7A7A7A",marginBottom:20}}>Esta compra está finalizada e arquivada.</div>
            <div style={{background:"var(--cinza-lt)",borderRadius:10,padding:16,textAlign:"left",fontSize:12}}>
              {compra.fornecedorNome&&<div style={{marginBottom:6}}><span style={{color:"#7A7A7A"}}>Fornecedor:</span> <strong>{compra.fornecedorNome}</strong></div>}
              {compra.valorNF&&<div style={{marginBottom:6}}><span style={{color:"#7A7A7A"}}>Valor NF:</span> <strong>R$ {Number(compra.valorNF).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></div>}
              {compra.numeroNF&&<div style={{marginBottom:6}}><span style={{color:"#7A7A7A"}}>NF:</span> <strong>{compra.numeroNF}</strong></div>}
              {compra.dataRecebimento&&<div><span style={{color:"#7A7A7A"}}>Recebido:</span> <strong>{fmtDate(compra.dataRecebimento)}</strong></div>}
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}

// ── Sub-componentes de resumo ─────────────────────────────────────────────────
function ResumoItens({ itens, titulo, demandaNome }) {
  if (!itens?.length) return null;
  return (
    <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:10,marginBottom:4}}>
      <div style={{fontSize:11,color:"#7A7A7A",marginBottom:4}}>{demandaNome||"Pedido"}</div>
      {itens.slice(0,4).map((it,i)=>(
        <div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"2px 0"}}>
          <span style={{flex:1,fontWeight:500}}>{it.nome}</span>
          <span style={{color:"#7A7A7A"}}>{it.qtd} {it.un}</span>
        </div>
      ))}
      {itens.length>4&&<div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>+{itens.length-4} itens</div>}
    </div>
  );
}

function ResumoCotacao({ valorCotado, fornecedorNome, prazoEntrega }) {
  if (!valorCotado && !fornecedorNome) return null;
  return (
    <div style={{background:"rgba(24,95,165,.06)",border:"1px solid rgba(24,95,165,.2)",borderRadius:8,padding:10,fontSize:12,display:"flex",gap:16,flexWrap:"wrap"}}>
      {fornecedorNome&&<span>🤝 <strong>{fornecedorNome}</strong></span>}
      {valorCotado&&<span>💬 Cotado: <strong>R$ {Number(valorCotado).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></span>}
      {prazoEntrega&&<span>📅 Prazo: <strong>{fmtDate(prazoEntrega)}</strong></span>}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function Compras() {
  const { userProfile } = useAuth();
  const { toasts, addToast } = useToast();
  const ac = getAcesso(userProfile);

  const [compras,      setCompras]      = useState([]);
  const [obras,        setObras]        = useState([]);
  const [manutencoes,  setManutencoes]  = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [etapaAtiva,   setEtapaAtiva]   = useState("SOLICITAÇÃO");
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState(null);

  useEffect(()=>{
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

  const etapasVisiveis = useMemo(()=> ETAPAS,[]);

  const comprasFiltradas = useMemo(()=>{
    const q=search.toLowerCase();
    return compras.filter(c=>{
      const naEtapa=c.status===etapaAtiva;
      const ok=!q||c.titulo?.toLowerCase().includes(q)||c.demandaNome?.toLowerCase().includes(q)||c.fornecedorNome?.toLowerCase().includes(q);
      return naEtapa&&ok;
    });
  },[compras,etapaAtiva,search]);

  const kpis = useMemo(()=>({
    solicit:      compras.filter(c=>c.status==="SOLICITAÇÃO").length,
    cotacao:      compras.filter(c=>c.status==="COTAÇÃO").length,
    aprovadas:    compras.filter(c=>c.status==="APROVADA").length,
    oc:           compras.filter(c=>c.status==="ORDEM DE COMPRA").length,
    aguardNF:     compras.filter(c=>c.status==="AGUARD. NF").length,
    comprometido: compras.filter(c=>["APROVADA","ORDEM DE COMPRA"].includes(c.status)).reduce((s,c)=>s+(c.valorAprovado||0),0),
  }),[compras]);

  const etapaInfo = ETAPAS.find(e=>e.id===etapaAtiva);
  const fmt = v=>`R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:0})}`;

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Compras</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{compras.length} pedidos totais</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setModal({compra:null})}>+ Nova solicitação</button>
      </div>

      {/* KPIs */}
      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="metric"><div className="metric-label">Solicitações</div><div className="metric-value amber">{kpis.solicit}</div></div>
        <div className="metric"><div className="metric-label">Em cotação</div><div className="metric-value" style={{color:"#185FA5"}}>{kpis.cotacao}</div></div>
        <div className="metric"><div className="metric-label">Aguard. aprovação</div><div className="metric-value yellow">{kpis.aprovadas}</div></div>
        <div className="metric"><div className="metric-label">Em OC</div><div className="metric-value" style={{color:"#7B4F00"}}>{kpis.oc}</div></div>
        <div className="metric"><div className="metric-label">Aguard. NF</div><div className="metric-value amber">{kpis.aguardNF}</div></div>
        <div className="metric"><div className="metric-label">Comprometido</div><div className="metric-value red" style={{fontSize:15}}>{fmt(kpis.comprometido)}</div></div>
      </div>

      {/* Barra de etapas */}
      <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:10,overflow:"hidden",border:"1px solid var(--border)"}}>
        {etapasVisiveis.map((e,i)=>{
          const count=compras.filter(c=>c.status===e.id).length;
          const ativa=etapaAtiva===e.id;
          return (
            <button key={e.id} onClick={()=>setEtapaAtiva(e.id)}
              style={{flex:1,padding:"10px 6px",border:"none",cursor:"pointer",
                background:ativa?e.cor:"var(--cinza-lt)",color:ativa?"#fff":"#4A4A4A",
                borderRight:i<etapasVisiveis.length-1?"1px solid var(--border)":"none",
                transition:"all .15s",position:"relative"}}>
              <div style={{fontSize:14,marginBottom:2}}>{e.icone}</div>
              <div style={{fontSize:9,fontWeight:700,lineHeight:1.2}}>{e.label}</div>
              {count>0&&(
                <div style={{position:"absolute",top:5,right:5,
                  background:ativa?"rgba(255,255,255,.3)":e.cor,color:"#fff",
                  fontSize:9,fontWeight:700,borderRadius:10,padding:"1px 5px"}}>
                  {count}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Busca */}
      <div className="search-bar">
        🔍<input placeholder={`Buscar em ${etapaInfo?.label}...`} value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"#7A7A7A"}}>✕</button>}
      </div>

      {loading&&<div className="spinner"/>}
      {!loading&&comprasFiltradas.length===0&&(
        <div className="empty-state">
          <div className="empty-icon">{etapaInfo?.icone}</div>
          <p>Nenhuma compra em <strong>{etapaInfo?.label}</strong></p>
          {etapaAtiva==="SOLICITAÇÃO"&&<button className="btn btn-primary" style={{marginTop:12}} onClick={()=>setModal({compra:null})}>+ Criar primeira solicitação</button>}
        </div>
      )}

      {!loading&&comprasFiltradas.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {comprasFiltradas.map(c=>{
            const ei=ETAPAS.find(e=>e.id===c.status);
            return (
              <div key={c.id} className="rdo-card" style={{borderLeft:`4px solid ${ei?.cor||"#ccc"}`}}>
                <div className="rdo-header">
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{c.titulo}</div>
                    <div style={{fontSize:12,color:"#7A7A7A",marginTop:2}}>
                      {c.demandaNome||c.demandaTipo}
                      {c.fornecedorNome&&<> · <strong>{c.fornecedorNome}</strong></>}
                      {c.autorNome&&<> · {c.autorNome}</>}
                    </div>
                    {/* Info resumida por etapa */}
                    <div style={{display:"flex",gap:12,marginTop:5,flexWrap:"wrap",fontSize:12}}>
                      {c.urgencia&&c.urgencia!=="normal"&&<span className={`badge ${c.urgencia==="urgente"?"badge-red":c.urgencia==="alta"?"badge-amber":"badge-gray"}`} style={{fontSize:10}}>{c.urgencia}</span>}
                      {c.valorCotado>0&&<span>💬 {fmt(c.valorCotado)}</span>}
                      {c.valorAprovado>0&&<span style={{color:"var(--verde)"}}>✅ {fmt(c.valorAprovado)}</span>}
                      {c.numeroPedido&&<span>📋 {c.numeroPedido}</span>}
                      {c.prazoOC&&<span style={{color:c.prazoOC<new Date().toISOString().split("T")[0]?"var(--vermelho)":"inherit"}}>📅 {fmtDate(c.prazoOC)}</span>}
                      {c.tipoReceb&&c.tipoReceb!=="conforme"&&<span className="badge badge-amber" style={{fontSize:10}}>⚠ {c.tipoReceb}</span>}
                      {c.numeroNF&&<span>🧾 NF {c.numeroNF}</span>}
                    </div>
                    {/* Itens resumidos */}
                    {c.itens?.length>0&&<div style={{marginTop:5,fontSize:11,color:"#7A7A7A"}}>{c.itens.slice(0,3).map(it=>`${it.nome} (${it.qtd}${it.un})`).join(" · ")}{c.itens.length>3&&` +${c.itens.length-3}`}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                    <button className="btn btn-sm btn-primary" onClick={()=>setModal({compra:c})}>
                      {c.status==="NF VINCULADA"?"👁️ Ver":"✏️ Abrir"}
                    </button>
                    <span style={{fontSize:10,color:"#7A7A7A"}}>{fmtDate(c.updatedAt||c.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal&&(
        <CompraModal
          compra={modal.compra}
          etapaForcar={modal.compra?.status}
          obras={obras} manutencoes={manutencoes} fornecedores={fornecedores}
          onClose={()=>setModal(null)} addToast={addToast}
        />
      )}
    </div>
  );
}
