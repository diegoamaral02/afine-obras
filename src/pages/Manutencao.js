// src/pages/Manutencao.js — v2: sub-abas, alocação de campo, rastreio de criador, demandas filtradas
import { buscarCEP } from "../utils/cep";
import React, { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate, initials } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import OSDigital from "../components/OSDigital";
import AssinaturaDigital from "../components/AssinaturaDigital";
import CustosDemanda from "../components/CustosDemanda";
import { exportarOSParaPDF, exportarTermoChavesParaPDF } from "../utils/exportPDF";
import { useToast } from "../hooks/useToast";
import { exportarExcel, BtnExcel } from "../utils/exportExcel";
import FiltroAvancado, { dentroPeriodo } from "../components/FiltroAvancado";
import { isGestorOuAdm } from "../constants/departamentos";
import { addComAuditoria, updateComAuditoria } from "../services/auditoria";
import { salvarComFallbackOffline } from "../utils/offlineQueue";
import { registrarExecutorOffline } from "../hooks/useFilaOffline";

registrarExecutorOffline("manutencao:update", async ({ id, payload, uid, nome }) => {
  await updateComAuditoria("manutencoes", id, payload, uid, nome);
});
registrarExecutorOffline("manutencao:create", async ({ payload, uid, nome }) => {
  await addComAuditoria("manutencoes", payload, uid, nome);
});

const MIN_FOTOS = 15;
const CHECKLIST_ITENS = [
  "Elétrica — tomadas e interruptores","Elétrica — quadro de distribuição","Elétrica — iluminação",
  "Hidráulica — torneiras e metais","Hidráulica — vasos e louças","Hidráulica — tubulação visível",
  "Ar-condicionado — filtros limpos","Ar-condicionado — funcionamento","Cabeamento — pontos de rede",
  "Cabeamento — rack e patch panel","Pintura — paredes e teto","Piso — estado geral",
  "Forro — estado geral","Portas e fechaduras","Controle de acesso","CFTV — câmeras",
  "Sinalização de emergência","Extintores — validade","Limpeza geral",
];
const DESCRITIVOS_PRONTOS = [
  "Substituição de lâmpadas queimadas","Troca de tomadas/interruptores defeituosos",
  "Reparo no quadro elétrico","Manutenção de ar-condicionado — filtros",
  "Reparo de vazamento hidráulico","Substituição de torneiras/metais",
  "Reparo em forro/gesso danificado","Fixação de revestimentos soltos",
  "Reparo em porta/fechadura/dobradiça","Manutenção de cabeamento estruturado",
  "Reparo em câmera CFTV","Substituição de equipamento de acesso",
  "Pintura corretiva","Rejunte e silicone em banheiros","Revisão geral preventiva",
];

// ── Modal da manutenção ───────────────────────────────────────────────────────
function ManutencaoModal({ manut, obraId, funcionarios, clientes, criadoPor, onClose, addToast }) {
  const { userProfile, currentUser } = useAuth();
  const isCampo = userProfile?.departamento==="campo" || (userProfile?.perfil==="campo"&&!userProfile?.departamento);
  const isExternoUser = (userProfile?.departamento==="empreiteiro"||userProfile?.departamento==="terceiro");
  const uid     = currentUser?.uid;
  const nomeUser= userProfile?.nome || currentUser?.email || "–";

  const [passo, setPasso] = useState(isCampo ? 3 : 1); // campo começa em Custos

  const [form, setForm] = useState({
    titulo:       manut?.titulo       || "",
    cliente:      manut?.cliente      || "",
    clienteId:    manut?.clienteId    || "",
    agencia:      manut?.agencia      || "",
    agenciaId:    manut?.agenciaId    || "",
    tipo:         manut?.tipo         || "corretiva",
    prioridade:   manut?.prioridade   || "normal",
    numeroOT:     manut?.numeroOT     || "",
    semOT:        manut?.semOT        || false,
    // Responsável / Fiscal da demanda (acompanhamento)
    responsavelId:   manut?.responsavelId   || "",
    responsavelNome: manut?.responsavelNome || "",
    // Alocação de campo (quem executa)
    alocadoIds:   manut?.alocadoIds   || (manut?.alocadoId ? [manut.alocadoId] : []),
    alocadoNomes: manut?.alocadoNomes || (manut?.alocadoNome ? [manut.alocadoNome] : []),
    // Endereço
    cep:          manut?.cep          || "",
    logradouro:   manut?.logradouro   || "",
    numero:       manut?.numero       || "",
    bairro:       manut?.bairro       || "",
    cidade:       manut?.cidade       || "",
    uf:           manut?.uf           || "",
    // Datas
    dataAbertura: manut?.dataAbertura || new Date().toISOString().split("T")[0],
    dataPrevista: manut?.dataPrevista || "",
    dataConclusao:manut?.dataConclusao|| "",
    status:       manut?.status       || "ABERTA",
    garantia:     manut?.garantia     || "NÃO",
    vencGarantia: manut?.vencGarantia || "",
    descProntas:  manut?.descProntas  || [],
    descExtra:    manut?.descExtra    || "",
    obs:          manut?.obs          || "",
    camposCustom: manut?.camposCustom || {},
    // Termo de Entrega de Chaves — disponível para qualquer tipo de manutenção
    termoChaves: manut?.termoChaves || {
      temChaveDevolver: "", quantidadeChaves: "", nomeRecebeu: "", cpf: "", rg: "", assinatura: "", dataDocumento: "",
    },
    materiais:    manut?.materiais    || [],
    semMaterial:       manut?.semMaterial       || false,
    motivoSemMaterial: manut?.motivoSemMaterial || "",
  });
  const [checklist,   setChecklist]   = useState(manut?.checklist || {});
  const [fotos,       setFotos]       = useState(manut?.fotos || []);
  const [osDigital,   setOsDigital]   = useState(manut?.osDigital || null);
  const [showOS,      setShowOS]      = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [matNome,     setMatNome]     = useState("");
  const [matQtd,      setMatQtd]      = useState("");
  const [matUn,       setMatUn]       = useState("un");

  function set(f,v) { setForm(p=>({...p,[f]:v})); }
  function setCustom(f,v) { setForm(p=>({...p,camposCustom:{...p.camposCustom,[f]:v}})); }
  function setTermoChaves(campo,v) { setForm(p=>({...p, termoChaves:{...p.termoChaves,[campo]:v}})); }
  function toggleDesc(s) { setForm(p=>({...p,descProntas:p.descProntas.includes(s)?p.descProntas.filter(x=>x!==s):[...p.descProntas,s]})); }
  function toggleCheck(item) { setChecklist(p=>({...p,[item]:!p[item]})); }

  function handleFunc(field, idField, e) {
    const id=e.target.value;
    const f=funcionarios.find(x=>x.id===id||x.uid===id);
    set(field,f?.nome||""); set(idField,id);
  }

  async function handleCEP(cep) {
    set("cep",cep);
    if (cep.replace(/\D/g,"").length===8) {
      setBuscandoCEP(true);
      const d=await buscarCEP(cep);
      if(d){set("logradouro",d.logradouro||"");set("bairro",d.bairro||"");set("cidade",d.cidade||"");set("uf",d.uf||"");}
      setBuscandoCEP(false);
    }
  }

  function enderecoCompleto() {
    if(!form.logradouro) return "";
    return `${form.logradouro}, ${form.numero}${form.bairro?` — ${form.bairro}`:""}${form.cidade?`, ${form.cidade}`:""}${form.uf?`/${form.uf}`:""}`;
  }

  function abrirNavegacao() {
    const enc=encodeURIComponent(enderecoCompleto());
    if(!enc){alert("Preencha o endereço.");return;}
    const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if(isMobile&&/iPhone|iPad|iPod/i.test(navigator.userAgent)) window.open(`maps://maps.apple.com/?q=${enc}`);
    else window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
  }

  function adicionarMaterial() {
    if(!matNome.trim()||!matQtd){alert("Informe nome e quantidade.");return;}
    setForm(p=>({...p,materiais:[...p.materiais,{nome:matNome,qtd:Number(matQtd),un:matUn}]}));
    setMatNome("");setMatQtd("");
  }

  const isItau = form.cliente?.toLowerCase().includes("itaú")||form.cliente?.toLowerCase().includes("itau");
  const otOk   = !isItau||form.semOT||form.numeroOT.trim();
  const fotosOk = fotos.length>=MIN_FOTOS;
  const osOk    = !!osDigital;
  const endOk   = form.logradouro&&form.numero&&form.cep;
  const matOk   = form.materiais.length>0 || (form.semMaterial && form.motivoSemMaterial?.trim());
  const podeConcluir = fotosOk&&osOk&&otOk&&endOk&&matOk;

  async function save() {
    if(!form.titulo||!form.cliente){alert("Título e cliente são obrigatórios.");return;}
    if(!endOk){alert("CEP, logradouro e número são obrigatórios.");return;}
    if(form.status==="CONCLUÍDA"&&!podeConcluir){
      const msgs=[];
      if(!fotosOk) msgs.push(`• ${MIN_FOTOS} fotos (você tem ${fotos.length})`);
      if(!osOk)    msgs.push("• OS digital assinada");
      if(!otOk)    msgs.push("• Número da OT ou S/OT");
      if(!endOk)   msgs.push("• Endereço completo");
      if(!matOk)   msgs.push("• Materiais utilizados (ou justificar ausência)");
      alert("Para concluir:\n"+msgs.join("\n"));return;
    }
    setSaving(true);
    const agora=new Date().toISOString();
    const dataConclusao=form.status==="CONCLUÍDA"&&!form.dataConclusao?agora.split("T")[0]:form.dataConclusao;
    const payload={
      ...form, dataConclusao, checklist, fotos, osDigital:osDigital||null,
      obraId:obraId||null, updatedAt:agora,
      // Rastreio: quem criou / atualizou
      ultimoAtor: nomeUser, ultimoAtorId: uid,
    };
    // Se for nova manutenção, grava quem criou
    if(!manut?.id){
      payload.createdAt=agora;
      payload.criadoPorNome=criadoPor?.nome||nomeUser;
      payload.criadoPorId=criadoPor?.uid||uid;
    }
    // Ao concluir, remove da visão do campo automaticamente
    if(form.status==="CONCLUÍDA") payload.concluidaEm=agora;
    try {
      const resultado = await salvarComFallbackOffline(
        manut?.id ? "manutencao:update" : "manutencao:create",
        { id: manut?.id, payload, uid, nome: nomeUser },
        async ({ id, payload, uid, nome }) => {
          if (id) await updateComAuditoria("manutencoes", id, payload, uid, nome);
          else    await addComAuditoria("manutencoes", payload, uid, nome);
        }
      );
      if (resultado.ok) {
        addToast(manut?.id ? "✓ Manutenção atualizada!" : "✓ Manutenção criada!");
        onClose();
      } else if (resultado.enfileirado) {
        addToast("📡 Sem conexão — salvo no dispositivo. Será enviado automaticamente quando a internet voltar.", "warning");
        onClose();
      }
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  const PASSOS = isCampo
    ? [...(!isExternoUser?["Custos"]:[]),"Materiais","Fotos & Checklist","Termo de Chaves","OS Digital"]
    : ["Dados","Endereço",...(!isExternoUser?["Custos"]:[]),"Materiais","Fotos & Checklist","Termo de Chaves","OS Digital"];
  const PASSO_BASE = isCampo ? 3 : 1;
  const passoVisual = passo - PASSO_BASE + 1;
  const totalPassos = PASSOS.length;

  return (
    <Modal title={manut?.id?"Editar manutenção":"Nova manutenção"} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Fechar</button>
          {passo>PASSO_BASE&&<button className="btn" onClick={()=>setPasso(p=>p-1)}>← Anterior</button>}
          {passo<(PASSO_BASE+totalPassos-1)
            ?<button className="btn btn-primary" onClick={()=>setPasso(p=>p+1)}>Próximo →</button>
            :<button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"💾 Salvar"}</button>
          }
        </>
      }>

      {/* Stepper */}
      <div style={{display:"flex",gap:3,marginBottom:16}}>
        {PASSOS.map((label,i)=>(
          <div key={i} onClick={()=>setPasso(PASSO_BASE+i)}
            style={{flex:1,padding:"5px 4px",textAlign:"center",fontSize:10,fontWeight:500,borderRadius:6,cursor:"pointer",
              background:passoVisual===i+1?"#1A1A1A":passoVisual>i+1?"var(--verde-lt)":"var(--cinza-lt)",
              color:passoVisual===i+1?"#F5C800":passoVisual>i+1?"var(--verde)":"#7A7A7A"}}>
            {passoVisual>i+1?"✓ ":""}{label}
          </div>
        ))}
      </div>

      {/* ── PASSO 1 — DADOS ─────────────────────────────── */}
      {passo===1 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-grid">
            <div className="form-group span-2"><label className="required">Título</label>
              <input value={form.titulo} onChange={e=>set("titulo",e.target.value)}/></div>
            <div className="form-group"><label className="required">Cliente</label>
              <select value={form.clienteId} onChange={e=>{
                const id=e.target.value;
                const c=(clientes||[]).find(x=>x.id===id);
                set("clienteId",id);
                set("cliente",c?.razaoSocial||"");
                set("agenciaId",""); set("agencia","");
              }}>
                <option value="">Selecione o cliente...</option>
                {(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.razaoSocial}</option>)}
              </select>
              {!form.clienteId && (
                <input value={form.cliente} onChange={e=>set("cliente",e.target.value)} placeholder="Ou digite (cliente não cadastrado)" style={{marginTop:6}}/>
              )}
            </div>
            <div className="form-group"><label>🏢 Agência / Loja / Filial</label>
              {(() => {
                const clienteSel = (clientes||[]).find(c=>c.id===form.clienteId);
                const agencias = clienteSel?.agencias||[];
                if (agencias.length>0) {
                  const aSel = agencias.find(x=>x.id===form.agenciaId);
                  return (
                    <>
                      <select value={form.agenciaId} onChange={e=>{
                        const id=e.target.value;
                        const a=agencias.find(x=>x.id===id);
                        set("agenciaId",id);
                        set("agencia",a?.nome||"");
                        // Auto-preenche o título: "AG-{numero} · {Cidade}"
                        if (a) {
                          const num = a.agenciaFilial ? `AG-${a.agenciaFilial}` : a.nome;
                          const sufixo = a.cidade ? ` · ${a.cidade}` : "";
                          set("titulo", `${num}${sufixo}`);
                          // Auto-preenche o endereço a partir da agência (ANEXO3)
                          set("cep", a.cep||""); set("logradouro", a.endereco||""); set("numero", a.numero||"");
                          set("bairro", a.bairro||""); set("cidade", a.cidade||""); set("uf", a.uf||"");
                        }
                      }}>
                        <option value="">Selecione...</option>
                        {agencias.map(a=><option key={a.id} value={a.id}>{a.nome}{a.cidade?` — ${a.cidade}`:""}</option>)}
                      </select>
                      {aSel?.endereco && (
                        <button type="button" onClick={()=>{
                          const enc=encodeURIComponent(`${aSel.endereco}, ${aSel.numero||""} ${aSel.cidade||""} ${aSel.uf||""}`);
                          window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
                        }} style={{fontSize:11,color:"#185FA5",background:"none",border:"none",cursor:"pointer",padding:0,marginTop:4}}>
                          🗺️ {aSel.endereco}{aSel.numero?`, ${aSel.numero}`:""} — abrir navegação
                        </button>
                      )}
                    </>
                  );
                }
                return <input value={form.agencia} onChange={e=>set("agencia",e.target.value)} placeholder={form.clienteId?"Cliente sem agências cadastradas — digite aqui":"Selecione um cliente primeiro"}/>;
              })()}
            </div>
            <div className="form-group"><label>Tipo</label>
              <select value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
                {["corretiva","preventiva","preditiva","emergencial"].map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div className="form-group"><label>Prioridade</label>
              <select value={form.prioridade} onChange={e=>set("prioridade",e.target.value)}>
                {["baixa","normal","alta","urgente"].map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div className="form-group"><label>Status</label>
              <select value={form.status} onChange={e=>set("status",e.target.value)}
                style={{background:form.status==="CONCLUÍDA"?"var(--verde-lt)":form.status==="ABERTA"?"var(--afine-yellow-lt)":""}}>
                {["ABERTA","EM ANDAMENTO","CONCLUÍDA","CANCELADA","AGUARDANDO PEÇAS"].map(s=><option key={s}>{s}</option>)}
              </select></div>
          </div>

          {/* Responsável / Fiscal — acompanha a demanda */}
          <div style={{background:"rgba(24,95,165,.06)",borderRadius:8,padding:12,border:"1px solid rgba(24,95,165,.2)"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#185FA5",marginBottom:8}}>👤 Responsável (fiscal) pela demanda</div>
            <div style={{fontSize:11,color:"#185FA5",marginBottom:10}}>
              Quem acompanha e responde por esta manutenção perante o cliente. Diferente de quem executa em campo.
            </div>
            <select value={form.responsavelId} onChange={e=>handleFunc("responsavelNome","responsavelId",e)}
              style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid var(--border)",fontSize:13}}>
              <option value="">Sem responsável definido</option>
              {funcionarios.filter(f=>f.status==="ATIVO"||!f.status).map(f=>(
                <option key={f.id} value={f.id}>{f.nome} — {f.funcao||f.departamento||"campo"}</option>
              ))}
            </select>
            {form.responsavelNome&&(
              <div style={{marginTop:6,fontSize:12,color:"#185FA5",fontWeight:600}}>
                ✓ Responsável: {form.responsavelNome}
              </div>
            )}
          </div>

          {/* Alocação de funcionário de campo */}
          <div style={{background:"var(--afine-yellow-lt)",borderRadius:8,padding:12,border:"1px solid rgba(245,200,0,.3)"}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--afine-yellow-dk)",marginBottom:8}}>👷 Alocar equipe de campo (quem executa)</div>
            <div style={{fontSize:11,color:"#8A6000",marginBottom:10}}>
              Os funcionários selecionados verão esta demanda na aba "Minhas demandas". Ao finalizar, sai automaticamente da visão deles.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:180,overflowY:"auto",background:"#fff",borderRadius:6,padding:8}}>
              {funcionarios.filter(f=>f.status==="ATIVO"||!f.status).length===0&&<span style={{fontSize:12,color:"#7A7A7A"}}>Nenhum funcionário cadastrado</span>}
              {funcionarios.filter(f=>f.status==="ATIVO"||!f.status).map(f=>{
                const fid = f.id||f.uid;
                const checked = form.alocadoIds.includes(fid);
                return (
                  <label key={fid} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,background:checked?"var(--afine-yellow-lt)":"transparent"}}>
                    <input type="checkbox" checked={checked} onChange={()=>{
                      setForm(p=>{
                        const jaTem = p.alocadoIds.includes(fid);
                        return {
                          ...p,
                          alocadoIds:   jaTem ? p.alocadoIds.filter(id=>id!==fid)       : [...p.alocadoIds, fid],
                          alocadoNomes: jaTem ? p.alocadoNomes.filter(n=>n!==f.nome)    : [...p.alocadoNomes, f.nome],
                        };
                      });
                    }} style={{width:15,height:15}}/>
                    <span style={{flex:1}}>{f.nome}</span>
                    <span style={{fontSize:11,color:"#7A7A7A"}}>{f.funcao||f.departamento||"campo"}</span>
                  </label>
                );
              })}
            </div>
            {form.alocadoNomes.length>0&&(
              <div style={{marginTop:6,fontSize:12,color:"var(--afine-yellow-dk)",fontWeight:600}}>
                ✓ Executa em campo: {form.alocadoNomes.join(", ")}
              </div>
            )}
          </div>

          {/* OT Itaú */}
          {isItau && (
            <div style={{background:"#FFF2CC",border:"1px solid #F0C040",borderRadius:8,padding:12}}>
              <div style={{fontSize:12,fontWeight:600,color:"#854F0B",marginBottom:8}}>⚠️ ITAÚ — Número da OT obrigatório</div>
              <div className="form-grid">
                <div className="form-group"><label className="required">Número da OT</label>
                  <input value={form.numeroOT} onChange={e=>set("numeroOT",e.target.value)} placeholder="OT-2025-00123" disabled={form.semOT} style={{opacity:form.semOT?.4:1}}/></div>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:20,fontSize:13}}>
                  <input type="checkbox" checked={form.semOT} onChange={e=>{set("semOT",e.target.checked);if(e.target.checked)set("numeroOT","S/OT");}} style={{width:16,height:16}}/>
                  S/OT (sem número ainda)
                </label>
              </div>
            </div>
          )}

          {/* Campos custom */}
          {!isItau&&form.cliente&&(
            <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12}}>
              <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Campos específicos — {form.cliente}</div>
              <div className="form-grid">
                <div className="form-group"><label>Protocolo / Nº documento</label><input value={form.camposCustom?.protocolo||""} onChange={e=>setCustom("protocolo",e.target.value)}/></div>
                <div className="form-group"><label>Centro de custo</label><input value={form.camposCustom?.centroCusto||""} onChange={e=>setCustom("centroCusto",e.target.value)}/></div>
              </div>
            </div>
          )}

          {/* Descritivos */}
          <div style={{fontSize:11,fontWeight:700,color:"#185FA5",textTransform:"uppercase",letterSpacing:".06em"}}>Descritivos do serviço</div>
          <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:160,overflowY:"auto"}}>
            {DESCRITIVOS_PRONTOS.map(d=>(
              <label key={d} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer",padding:"4px 8px",borderRadius:5,background:form.descProntas.includes(d)?"rgba(24,95,165,.08)":"transparent"}}>
                <input type="checkbox" checked={form.descProntas.includes(d)} onChange={()=>toggleDesc(d)} style={{width:14,height:14}}/>
                {d}
              </label>
            ))}
          </div>
          <div className="form-group"><label>Descrição adicional</label>
            <textarea value={form.descExtra} onChange={e=>set("descExtra",e.target.value)} rows={2} placeholder="Detalhe o serviço..."/></div>

          {/* Datas */}
          <div className="form-grid">
            <div className="form-group"><label>Abertura</label><input type="date" value={form.dataAbertura} onChange={e=>set("dataAbertura",e.target.value)}/></div>
            <div className="form-group"><label>Previsão</label><input type="date" value={form.dataPrevista} onChange={e=>set("dataPrevista",e.target.value)}/></div>
            <div className="form-group"><label>Conclusão real</label><input type="date" value={form.dataConclusao} onChange={e=>set("dataConclusao",e.target.value)}/></div>
            <div className="form-group"><label>Garantia?</label>
              <select value={form.garantia} onChange={e=>set("garantia",e.target.value)}><option>NÃO</option><option>SIM</option></select>
            </div>
            {form.garantia==="SIM"&&<div className="form-group"><label>Vencimento garantia</label><input type="date" value={form.vencGarantia} onChange={e=>set("vencGarantia",e.target.value)}/></div>}
          </div>
          <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/></div>
        </div>
      )}

      {/* ── PASSO 2 — ENDEREÇO ──────────────────────────── */}
      {passo===2 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-grid">
            <div className="form-group">
              <label className="required">CEP</label>
              <div style={{display:"flex",gap:6}}>
                <input value={form.cep} onChange={e=>handleCEP(e.target.value)} placeholder="00000-000" maxLength={9} style={{flex:1}}/>
                {buscandoCEP&&<span style={{fontSize:11,color:"#7A7A7A",alignSelf:"center"}}>Buscando...</span>}
              </div>
            </div>
            <div className="form-group"><label className="required">Número</label><input value={form.numero} onChange={e=>set("numero",e.target.value)} placeholder="123"/></div>
            <div className="form-group span-2"><label className="required">Logradouro</label><input value={form.logradouro} onChange={e=>set("logradouro",e.target.value)} placeholder="Preenchido pelo CEP"/></div>
            <div className="form-group"><label>Bairro</label><input value={form.bairro} onChange={e=>set("bairro",e.target.value)}/></div>
            <div className="form-group"><label>Cidade</label><input value={form.cidade} onChange={e=>set("cidade",e.target.value)}/></div>
            <div className="form-group"><label>UF</label><input value={form.uf} onChange={e=>set("uf",e.target.value)} maxLength={2}/></div>
          </div>
          {enderecoCompleto()&&(
            <div style={{background:"rgba(24,95,165,.06)",border:"1px solid rgba(24,95,165,.2)",borderRadius:8,padding:12}}>
              <div style={{fontSize:12,color:"#185FA5",marginBottom:8}}>📍 {enderecoCompleto()}</div>
              <button className="btn btn-primary" onClick={abrirNavegacao} style={{fontSize:12}}>🗺️ Abrir navegação</button>
            </div>
          )}
        </div>
      )}

      {/* ── PASSO 3 — CUSTOS DA DEMANDA ──────────────────── */}
      {passo===3 && manut?.id && (
        <CustosDemanda
          demandaTipo="manutencao"
          demandaId={manut.id}
          demandaNome={manut.titulo||form.titulo}
          orcamento={form.valorServico||0}
        />
      )}

      {/* ── PASSO 4 — MATERIAIS ─────────────────────────── */}
      {passo===4 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {isCampo&&(
            <div style={{background:"#1A1A1A",borderRadius:8,padding:12,color:"#fff"}}>
              <div style={{fontWeight:600,fontSize:14,color:"#F5C800"}}>{manut?.titulo}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginTop:2}}>{manut?.cliente}{manut?.agencia&&` · ${manut.agencia}`}</div>
              {manut?.logradouro&&<button onClick={abrirNavegacao} style={{background:"none",border:"none",color:"#F5C800",cursor:"pointer",fontSize:12,padding:0,marginTop:4}}>🗺️ {manut.logradouro}, {manut.numero}</button>}
            </div>
          )}
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>Materiais utilizados <span style={{color:"var(--vermelho)"}}>*</span></div>
          <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
            <div className="form-group" style={{flex:2}}><label>Material</label><input value={matNome} onChange={e=>setMatNome(e.target.value)} placeholder="Ex: Cabo UTP Cat.6"/></div>
            <div className="form-group" style={{width:80}}><label>Qtd.</label><input type="number" min="0" value={matQtd} onChange={e=>setMatQtd(e.target.value)}/></div>
            <div className="form-group" style={{width:80}}><label>Un.</label>
              <select value={matUn} onChange={e=>setMatUn(e.target.value)}>
                {["un","m","m²","kg","saco","cx","rolo","litro"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={adicionarMaterial} style={{marginBottom:1}}>+ Add</button>
          </div>
          {/* Opção sem materiais */}
          <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:8,cursor:"pointer",
            background:form.semMaterial?"rgba(245,200,0,.08)":"var(--cinza-lt)",
            border:`1px solid ${form.semMaterial?"var(--afine-yellow-dk)":"var(--border)"}`,transition:".15s"}}>
            <input type="checkbox" checked={!!form.semMaterial} onChange={e=>set("semMaterial",e.target.checked)}
              style={{width:17,height:17,marginTop:1,flexShrink:0}}/>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:form.semMaterial?"var(--afine-yellow-dk)":"#4A4A4A"}}>
                Não foi necessário utilizar materiais
              </div>
              <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>
                Marque esta opção e justifique o motivo para liberar a conclusão sem materiais
              </div>
            </div>
          </label>

          {form.semMaterial && (
            <div className="form-group">
              <label className="required" style={{color:"var(--afine-yellow-dk)"}}>
                Justificativa obrigatória — por que não houve uso de materiais?
              </label>
              <textarea
                value={form.motivoSemMaterial}
                onChange={e=>set("motivoSemMaterial",e.target.value)}
                rows={3}
                placeholder="Ex: Serviço de limpeza sem substituição de peças / Regulagem de equipamento existente / Sem necessidade de reposição..."
                style={{borderColor:!form.motivoSemMaterial?.trim()?"var(--afine-yellow-dk)":"var(--verde)"}}
              />
              {form.motivoSemMaterial?.trim() && (
                <span style={{fontSize:11,color:"var(--verde)",fontWeight:600}}>✓ Justificativa registrada</span>
              )}
            </div>
          )}

          {!form.semMaterial && form.materiais.length===0&&<div className="alert alert-warning" style={{fontSize:12}}>Adicione pelo menos 1 material ou marque "Não foi necessário utilizar materiais".</div>}
          {form.materiais.length>0&&(
            <div className="table-wrap"><table><thead><tr><th>Material</th><th>Qtd.</th><th>Un.</th><th></th></tr></thead>
              <tbody>{form.materiais.map((m,i)=>(
                <tr key={i}><td style={{fontWeight:500}}>{m.nome}</td><td>{m.qtd}</td><td>{m.un}</td>
                  <td><button className="btn btn-sm" style={{color:"var(--vermelho)"}} onClick={()=>setForm(p=>({...p,materiais:p.materiais.filter((_,j)=>j!==i)}))}>✕</button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}

      {/* ── PASSO 5 — FOTOS & CHECKLIST ─────────────────── */}
      {passo===5 && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <PhotoUploader fotos={fotos} onChange={setFotos} minFotos={MIN_FOTOS}/>
          <div style={{fontSize:11,fontWeight:700,color:"#7A7A7A",textTransform:"uppercase",letterSpacing:".06em"}}>
            Checklist de vistoria ({Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITENS.length})
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:240,overflowY:"auto"}}>
            {CHECKLIST_ITENS.map(item=>(
              <label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer",padding:"5px 8px",borderRadius:5,
                background:checklist[item]?"var(--verde-lt)":"var(--cinza-lt)",
                border:`1px solid ${checklist[item]?"rgba(45,106,31,.2)":"var(--border)"}`,transition:".15s"}}>
                <input type="checkbox" checked={!!checklist[item]} onChange={()=>toggleCheck(item)} style={{width:15,height:15}}/>
                <span style={{color:checklist[item]?"var(--verde)":"#4A4A4A"}}>{item}</span>
                {checklist[item]&&<span style={{marginLeft:"auto",fontSize:14}}>✓</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── PASSO 7 — OS DIGITAL ────────────────────────── */}
      {passo===7 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Resumo para o técnico */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11}}>
            <div style={{textAlign:"center",background:fotosOk?"var(--verde-lt)":"var(--vermelho-lt)",borderRadius:8,padding:8}}>
              <div style={{fontSize:18,marginBottom:2}}>{fotosOk?"✅":"📷"}</div>
              <div style={{fontWeight:600,color:fotosOk?"var(--verde)":"var(--vermelho)"}}>{fotos.length}/{MIN_FOTOS} fotos</div>
            </div>
            <div style={{textAlign:"center",background:matOk?"var(--verde-lt)":"var(--vermelho-lt)",borderRadius:8,padding:8}}>
              <div style={{fontSize:18,marginBottom:2}}>{matOk?"✅":"📦"}</div>
              <div style={{fontWeight:600,color:matOk?"var(--verde)":"var(--vermelho)"}}>{form.materiais.length} mater.</div>
            </div>
            <div style={{textAlign:"center",background:osOk?"var(--verde-lt)":"var(--cinza-lt)",borderRadius:8,padding:8}}>
              <div style={{fontSize:18,marginBottom:2}}>{osOk?"✅":"✍️"}</div>
              <div style={{fontWeight:600,color:osOk?"var(--verde)":"#7A7A7A"}}>OS {osOk?"assinada":"pendente"}</div>
            </div>
          </div>

          {!osDigital?(
            <button className="btn btn-primary" onClick={()=>setShowOS(true)} style={{padding:"14px",fontSize:14}}>✍️ Assinar OS digital</button>
          ):(
            <div style={{background:"var(--verde-lt)",border:"1px solid rgba(45,106,31,.3)",borderRadius:8,padding:12,textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:4}}>✅</div>
              <div style={{fontWeight:600,color:"var(--verde)"}}>OS assinada!</div>
              <button className="btn btn-sm" onClick={()=>setOsDigital(null)} style={{marginTop:8,fontSize:11}}>Refazer assinatura</button>
            </div>
          )}

          {showOS&&(
            <Modal title="Ordem de Serviço Digital" onClose={()=>setShowOS(false)}>
              <OSDigital
                manutencao={true}
                descritivos={form.descProntas}
                descExtra={form.descExtra}
                funcionario={{ nome: nomeUser, funcao: userProfile?.departamento||userProfile?.perfil||"" }}
                loja={form.agencia||""}
                otTicket={form.semOT?"S/OT":(form.numeroOT||"")}
                onSalvar={(os)=>{setOsDigital(os);setShowOS(false);}}
                onFechar={()=>setShowOS(false)}
              />
            </Modal>
          )}

          {/* Botão concluir manutenção */}
          {podeConcluir&&(
            <button className="btn btn-primary" style={{background:"var(--verde)",borderColor:"var(--verde)",padding:14,fontSize:14,marginTop:4}}
              onClick={()=>{set("status","CONCLUÍDA");setTimeout(save,100);}}>
              🏁 Concluir manutenção
            </button>
          )}
          {!podeConcluir&&(
            <div className="alert alert-warning" style={{fontSize:12}}>
              <strong>Para concluir falta:</strong>
              <ul style={{margin:"6px 0 0 16px",lineHeight:2}}>
                {!fotosOk&&<li>{MIN_FOTOS} fotos (você tem {fotos.length})</li>}
                {!matOk&&<li>Materiais utilizados</li>}
                {!osOk&&<li>OS digital assinada</li>}
                {!endOk&&<li>Endereço completo (passo 2)</li>}
                {!otOk&&<li>Número da OT ou S/OT</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── PASSO 6 — TERMO DE ENTREGA DE CHAVES ──────────── */}
      {passo===6 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="form-group">
            <label className="required">Tem chave a ser devolvida?</label>
            <div style={{display:"flex",gap:6}}>
              {[["sim","Sim, tem chave a devolver"],["nao","Não tem chave a devolver"]].map(([v,l])=>(
                <button key={v} type="button" onClick={()=>setTermoChaves("temChaveDevolver",v)}
                  style={{
                    flex:1, padding:"10px 6px", fontSize:12, borderRadius:8, cursor:"pointer",
                    border:`1px solid ${form.termoChaves.temChaveDevolver===v?"var(--afine-yellow-dk)":"var(--border)"}`,
                    background:form.termoChaves.temChaveDevolver===v?"var(--afine-yellow-lt)":"#fff",
                    fontWeight:form.termoChaves.temChaveDevolver===v?700:400,
                  }}>{l}</button>
              ))}
            </div>
            {!form.termoChaves.temChaveDevolver && <div style={{fontSize:11,color:"var(--vermelho)",marginTop:4}}>Escolha uma opção — campo obrigatório.</div>}
          </div>

          {form.termoChaves.temChaveDevolver==="nao" && (
            <div className="alert alert-info" style={{fontSize:12}}>
              ✓ Sem chave a devolver — não há necessidade de preencher o termo. Pode seguir para a próxima aba.
            </div>
          )}

          {form.termoChaves.temChaveDevolver==="sim" && (
            <>
              <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12,fontSize:12}}>
                <div style={{fontWeight:700,marginBottom:4}}>Imóvel (extraído automaticamente)</div>
                <div>{form.logradouro?`${form.logradouro}, ${form.numero}`:"Endereço não cadastrado"}{form.bairro&&` — ${form.bairro}`}</div>
                <div>{form.agencia&&`${form.agencia} · `}{form.cidade||"–"} - {form.uf||"–"}</div>
              </div>

              <div className="form-grid">
                <div className="form-group"><label className="required">Quantidade de chaves</label>
                  <input type="number" min="1" value={form.termoChaves.quantidadeChaves} onChange={e=>setTermoChaves("quantidadeChaves",e.target.value)}/>
                </div>
                <div className="form-group"><label>Data do documento</label>
                  <input type="date" value={form.termoChaves.dataDocumento||new Date().toISOString().split("T")[0]} onChange={e=>setTermoChaves("dataDocumento",e.target.value)}/>
                </div>
                <div className="form-group span-2"><label className="required">Nome de quem recebeu a(s) chave(s)</label>
                  <input value={form.termoChaves.nomeRecebeu} onChange={e=>setTermoChaves("nomeRecebeu",e.target.value)}/>
                </div>
                <div className="form-group"><label className="required">CPF</label>
                  <input value={form.termoChaves.cpf} onChange={e=>setTermoChaves("cpf",e.target.value)} placeholder="000.000.000-00"/>
                </div>
                <div className="form-group"><label className="required">RG</label>
                  <input value={form.termoChaves.rg} onChange={e=>setTermoChaves("rg",e.target.value)} placeholder="00.000.000-0"/>
                </div>
              </div>

              <AssinaturaDigital
                label="Assinatura de quem recebeu as chaves"
                assinatura={form.termoChaves.assinatura}
                onChange={(b64)=>setTermoChaves("assinatura",b64)}
              />

              {(() => {
                const faltam = !form.termoChaves.nomeRecebeu||!form.termoChaves.quantidadeChaves||!form.termoChaves.cpf||!form.termoChaves.rg||!form.termoChaves.assinatura;
                return (
                  <>
                    <button className="btn btn-primary" style={{padding:14,fontSize:14}}
                      disabled={faltam}
                      onClick={()=>exportarTermoChavesParaPDF({
                        enderecoCompleto: form.logradouro?`${form.logradouro}, ${form.numero}${form.bairro?` — ${form.bairro}`:""}`:"",
                        agenciaNome: form.agencia||"",
                        cidade: form.cidade, estado: form.uf,
                        quantidadeChaves: form.termoChaves.quantidadeChaves,
                        nomeRecebeu: form.termoChaves.nomeRecebeu,
                        cpf: form.termoChaves.cpf, rg: form.termoChaves.rg,
                        assinatura: form.termoChaves.assinatura,
                        dataDocumento: form.termoChaves.dataDocumento,
                      })}>
                      📄 Gerar PDF do Termo de Entrega de Chaves
                    </button>
                    {faltam && (
                      <div style={{fontSize:11,color:"var(--vermelho)"}}>Preencha quantidade, nome, CPF, RG e assinatura para gerar o PDF.</div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Subcomponente card de histórico ───────────────────────────────────────────
function HistoricoCard({ manut, onEdit }) {
  return (
    <div className="rdo-card" style={{marginBottom:8,borderLeft:`3px solid ${manut.status==="CONCLUÍDA"?"var(--verde)":manut.status==="ABERTA"?"var(--afine-yellow-dk)":"var(--cinza-med)"}`}}>
      <div className="rdo-header">
        <div>
          <div style={{fontWeight:600,fontSize:13}}>{manut.titulo}</div>
          <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>
            {manut.tipo} · {manut.prioridade}
            {manut.criadoPorNome&&<> · criado por <strong>{manut.criadoPorNome}</strong></>}
            {manut.alocadoNomes?.length>0&&<> · alocado para <strong style={{color:"var(--afine-yellow-dk)"}}>{manut.alocadoNomes.join(", ")}</strong></>}
          </div>
          <div style={{fontSize:11,color:"#7A7A7A",marginTop:2}}>{fmtDate(manut.dataAbertura)} → {fmtDate(manut.dataConclusao)||"Em aberto"}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
          <span className={`badge ${statusBadge(manut.status)}`}>{manut.status}</span>
          {onEdit&&<button className="btn btn-sm btn-icon" onClick={()=>onEdit(manut)}>✏️</button>}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Manutencao({ obraAtual }) {
  const { userProfile, currentUser } = useAuth();
  const { toasts, addToast } = useToast();
  const [manuts,       setManuts]       = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [clientes,     setClientes]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [aba,          setAba]          = useState("minhas");
  const [filtros,      setFiltros]      = useState({ periodo:{de:"",ate:""}, clienteNome:"", responsavelId:"", status:[] });
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState(null);

  const uid     = currentUser?.uid;
  const isCampo = userProfile?.departamento==="campo"||(userProfile?.perfil==="campo"&&!userProfile?.departamento);
  const isGestor= !isCampo;
  const hoje    = new Date().toISOString().split("T")[0];

  useEffect(()=>{
    const col = obraAtual
      ? query(collection(db,"manutencoes"),where("obraId","==",obraAtual))
      : collection(db,"manutencoes");
    return onSnapshot(col,snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setManuts(data);setLoading(false);
    });
  },[obraAtual]);

  useEffect(()=>{
    return onSnapshot(collection(db,"usuarios"),snap=>{
      setFuncionarios(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="ATIVO"||!f.status));
    });
  },[]);

  useEffect(()=>{
    return onSnapshot(collection(db,"clientes"),snap=>{
      setClientes(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
  },[]);

  // Demandas alocadas para mim (campo) — excluindo concluídas
  const minhasDemandas = useMemo(()=>{
    if(!uid) return [];
    return manuts.filter(m=>
      ((m.alocadoIds||[]).includes(uid)||m.criadoPorId===uid) &&
      !["CONCLUÍDA","CANCELADA"].includes(m.status)
    );
  },[manuts,uid]);

  // Lista filtrada para gestores
  const filtered = useMemo(()=>{
    const q=search.toLowerCase();
    return manuts.filter(m=>{
      const mQ=!q||m.titulo?.toLowerCase().includes(q)||m.cliente?.toLowerCase().includes(q)||m.agencia?.toLowerCase().includes(q)||(m.numeroOT||"").toLowerCase().includes(q);
      const mPeriodo = dentroPeriodo(m.dataAbertura, filtros.periodo);
      const mCliente = !filtros.clienteNome || m.cliente===filtros.clienteNome;
      const mResp = !filtros.responsavelId || m.responsavelId===filtros.responsavelId;
      const mStatus = filtros.status.length===0 || filtros.status.includes(m.status);
      return mQ && mPeriodo && mCliente && mResp && mStatus;
    });
  },[manuts,filtros,search]);

  // KPIs
  const abertas    = manuts.filter(m=>["ABERTA","EM ANDAMENTO"].includes(m.status)).length;
  const concl      = manuts.filter(m=>m.status==="CONCLUÍDA").length;
  const garantia   = manuts.filter(m=>m.garantia==="SIM").length;
  const semOT      = manuts.filter(m=>m.semOT).length;
  const urgentes   = manuts.filter(m=>m.prioridade==="urgente"&&!["CONCLUÍDA","CANCELADA"].includes(m.status)).length;
  const atrasadas  = manuts.filter(m=>m.dataPrevista&&m.dataPrevista<hoje&&!["CONCLUÍDA","CANCELADA"].includes(m.status)).length;

  const porAgencia = useMemo(()=>{
    return manuts.reduce((acc,m)=>{
      const ag=m.agencia||"Sem agência"; if(!acc[ag])acc[ag]=[]; acc[ag].push(m); return acc;
    },{});
  },[manuts]);

  const excelCols=[
    {key:"titulo",header:"Título"},{key:"cliente",header:"Cliente"},{key:"agencia",header:"Agência"},
    {key:"tipo",header:"Tipo"},{key:"prioridade",header:"Prioridade"},{key:"status",header:"Status"},
    {key:"numeroOT",header:"OT"},{key:"responsavelNome",header:"Responsável"},{key:"alocadoNomes",header:"Alocado para",format:v=>(v||[]).join(", ")},
    {key:"criadoPorNome",header:"Criado por"},{key:"dataAbertura",header:"Abertura"},{key:"dataConclusao",header:"Conclusão"},
  ];

  // Sub-abas disponíveis
  const ABAS = [
    ...(isCampo?[{id:"minhas",label:`📋 Minhas demandas (${minhasDemandas.length})`}]:[]),
    ...(!isCampo?[{id:"lista",label:"📋 Lista completa"}]:[]),
    ...(!isCampo?[{id:"por_agencia",label:"🏢 Por agência"}]:[]),
    {id:"garantias",label:"🛡️ Garantias"},
    ...(!isCampo?[{id:"sem_ot",label:`⚠️ S/OT${semOT>0?` (${semOT})`:""}`}]:[]),
    ...(!isCampo?[{id:"historico",label:"📅 Histórico"}]:[]),
  ];

  const STATUS_MANUT = ["ABERTA","EM ANDAMENTO","CONCLUÍDA","CANCELADA","AGUARDANDO PEÇAS"];
  const clientesNomes = [...new Set(manuts.map(m=>m.cliente).filter(Boolean))].sort();
  const responsaveisList = funcionarios.filter(f=>isGestorOuAdm(f));
  const camposFiltroManut = [
    { tipo:"periodo", key:"periodo", label:"Período de abertura" },
    { tipo:"select", key:"clienteNome", label:"Cliente", opcoes: clientesNomes.map(c=>({value:c,label:c})) },
    { tipo:"select", key:"responsavelId", label:"Responsável", opcoes: responsaveisList.map(f=>({value:f.id,label:f.nome})) },
    { tipo:"multi", key:"status", label:"Status", largo:true, opcoes: STATUS_MANUT.map(s=>({value:s,label:s})) },
  ];

  // Auto-selecionar primeira aba correta
  useEffect(()=>{
    if(isCampo) setAba("minhas");
    else setAba("lista");
  },[isCampo]);

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>

      <div className="panel-header">
        <div>
          <div className="panel-title">Manutenções</div>
          <div style={{fontSize:12,color:"#7A7A7A"}}>{manuts.length} registros · {abertas} em aberto</div>
        </div>
        {!isCampo && <button className="btn btn-primary" onClick={()=>setModal({manut:null})}>+ Nova manutenção</button>}
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:16}}>
        <div className="metric" style={{borderLeft:"3px solid var(--vermelho)"}}><div className="metric-label">Em aberto</div><div className="metric-value red">{abertas}</div></div>
        <div className="metric" style={{borderLeft:"3px solid var(--verde)"}}><div className="metric-label">Concluídas</div><div className="metric-value green">{concl}</div></div>
        <div className="metric" style={{borderLeft:"3px solid var(--azul)"}}><div className="metric-label">Em garantia</div><div className="metric-value">{garantia}</div></div>
        {urgentes>0&&<div className="metric" style={{borderLeft:"3px solid var(--vermelho)"}}><div className="metric-label">Urgentes</div><div className="metric-value red">{urgentes}</div></div>}
        {atrasadas>0&&<div className="metric" style={{borderLeft:"3px solid var(--laranja)"}}><div className="metric-label">Atrasadas</div><div className="metric-value amber">{atrasadas}</div></div>}
        {semOT>0&&<div className="metric" style={{borderLeft:"3px solid var(--afine-yellow-dk)"}}><div className="metric-label">S/OT pendente</div><div className="metric-value yellow">{semOT}</div></div>}
      </div>

      {/* Sub-abas */}
      <div style={{display:"flex",gap:0,marginBottom:16,borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",flexWrap:"wrap"}}>
        {ABAS.map((a,i)=>(
          <button key={a.id} onClick={()=>setAba(a.id)}
            style={{flex:"1 1 auto",padding:"9px 10px",border:"none",cursor:"pointer",
              background:aba===a.id?"#1A1A1A":"var(--cinza-lt)",
              color:aba===a.id?"#F5C800":"#4A4A4A",
              borderRight:i<ABAS.length-1?"1px solid var(--border)":"none",
              transition:"all .15s",fontSize:11,fontWeight:aba===a.id?700:400,whiteSpace:"nowrap"}}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ── ABA: MINHAS DEMANDAS (campo) ─────────────────── */}
      {aba==="minhas" && (
        <div>
          {minhasDemandas.length===0?(
            <div className="empty-state"><div className="empty-icon">✅</div><p>Nenhuma demanda pendente alocada para você</p></div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {minhasDemandas.map(m=>{
                const urgente=m.prioridade==="urgente";
                const atrasada=m.dataPrevista&&m.dataPrevista<hoje;
                return (
                  <div key={m.id} className="rdo-card"
                    style={{borderLeft:`4px solid ${urgente?"var(--vermelho)":atrasada?"var(--laranja)":"var(--afine-yellow-dk)"}`,
                      background:urgente?"rgba(184,50,50,.03)":""}}>
                    <div className="rdo-header">
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                          <span className={`badge ${m.prioridade==="urgente"?"badge-red":m.prioridade==="alta"?"badge-amber":"badge-gray"}`} style={{fontSize:10}}>{m.prioridade}</span>
                          <span className={`badge ${statusBadge(m.status)}`} style={{fontSize:10}}>{m.status}</span>
                          {atrasada&&<span className="badge badge-amber" style={{fontSize:10}}>⏱ atrasada</span>}
                        </div>
                        <div style={{fontWeight:700,fontSize:15}}>{m.titulo}</div>
                        <div style={{fontSize:12,color:"#7A7A7A",marginTop:2}}>{m.cliente}{m.agencia&&` · ${m.agencia}`}</div>
                        {m.logradouro&&(
                          <button onClick={()=>{const enc=encodeURIComponent(`${m.logradouro}, ${m.numero}, ${m.cidade}`);window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");}}
                            style={{background:"none",border:"none",color:"var(--afine-yellow-dk)",cursor:"pointer",fontSize:12,padding:0,marginTop:4}}>
                            🗺️ {m.logradouro}, {m.numero}
                          </button>
                        )}
                        {m.dataPrevista&&<div style={{fontSize:11,color:"#7A7A7A",marginTop:4}}>Previsão: {fmtDate(m.dataPrevista)}</div>}
                        {m.descProntas?.length>0&&(
                          <div style={{marginTop:6,fontSize:11,color:"#4A4A4A"}}>
                            {m.descProntas.slice(0,2).join(" · ")}{m.descProntas.length>2&&`... +${m.descProntas.length-2}`}
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                        <button className="btn btn-primary" onClick={()=>setModal({manut:m})}>▶ Executar</button>
                        {m.osDigital&&<button className="btn btn-sm" onClick={()=>exportarOSParaPDF(m.osDigital,m)} style={{fontSize:11}}>📄 OS</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABA: LISTA COMPLETA (gestor) ─────────────────── */}
      {aba==="lista" && (
        <>
          <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
            <FiltroAvancado campos={camposFiltroManut} valores={filtros} onChange={setFiltros}
              onLimpar={()=>setFiltros({ periodo:{de:"",ate:""}, clienteNome:"", responsavelId:"", status:[] })}/>
            <BtnExcel onClick={()=>exportarExcel(filtered,"Manutencoes",excelCols)}/>
          </div>
          <div className="search-bar">🔍<input placeholder="Buscar por título, cliente, agência ou OT..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"#7A7A7A"}}>✕</button>}</div>
          {loading&&<div className="spinner"/>}
          {!loading&&filtered.length===0&&<div className="empty-state"><div className="empty-icon">🔧</div><p>Nenhuma manutenção encontrada</p></div>}
          {!loading&&filtered.length>0&&(
            <div className="table-wrap">
              <table>
                <thead><tr><th>Título</th><th>Cliente</th><th className="col-hide-lg">Agência</th><th>Responsável</th><th className="col-hide-xl">Criado por</th><th className="col-hide-md">Alocado para</th><th className="col-hide-lg">OT</th><th className="col-hide-xl">Prior.</th><th className="col-hide-xl">OS</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(m=>(
                    <tr key={m.id} style={{background:m.prioridade==="urgente"?"rgba(184,50,50,.03)":""}}>
                      <td style={{fontWeight:600,fontSize:13}}>{m.titulo}</td>
                      <td style={{fontSize:12}}>{m.cliente}</td>
                      <td className="col-hide-lg" style={{fontSize:12}}>{m.agencia||"–"}</td>
                      <td>
                        {m.responsavelNome?(
                          <span style={{fontSize:11,color:"#185FA5",fontWeight:600}}>👤 {m.responsavelNome}</span>
                        ):<span style={{color:"#aaa",fontSize:11}}>–</span>}
                      </td>
                      <td className="col-hide-xl">
                        {m.criadoPorNome?(
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div className="user-avatar" style={{width:22,height:22,fontSize:9,flexShrink:0}}>{initials(m.criadoPorNome)}</div>
                            <span style={{fontSize:11}}>{m.criadoPorNome}</span>
                          </div>
                        ):<span style={{color:"#aaa",fontSize:11}}>–</span>}
                      </td>
                      <td className="col-hide-md">
                        {m.alocadoNomes?.length>0?(
                          <span style={{fontSize:11,background:"var(--afine-yellow-lt)",color:"var(--afine-yellow-dk)",padding:"2px 8px",borderRadius:10,fontWeight:600}}>
                            👷 {m.alocadoNomes.join(", ")}
                          </span>
                        ):<span style={{color:"#aaa",fontSize:11}}>Sem alocação</span>}
                      </td>
                      <td className="col-hide-lg" style={{fontSize:11}}>{m.semOT?<span className="badge badge-amber">S/OT</span>:m.numeroOT||"–"}</td>
                      <td className="col-hide-xl"><span className={`badge ${m.prioridade==="urgente"?"badge-red":m.prioridade==="alta"?"badge-amber":"badge-gray"}`} style={{fontSize:10}}>{m.prioridade}</span></td>
                      <td className="col-hide-xl">{m.osDigital?<span className="badge badge-green" style={{fontSize:10}}>✓ OS</span>:<span className="badge badge-gray" style={{fontSize:10}}>Pendente</span>}</td>
                      <td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></td>
                      <td style={{display:"flex",gap:4}}>
                        <button className="btn btn-sm btn-icon" onClick={()=>setModal({manut:m})}>✏️</button>
                        {m.osDigital&&<button className="btn btn-sm" onClick={()=>exportarOSParaPDF(m.osDigital,m)} style={{fontSize:11}}>📄</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Cards responsivos (visíveis em telas < 960px) ── */}
            <div className="rdo-cards-grid">
              {filtered.map(m => (
                <div key={m.id} className="rdo-card-item" style={{borderLeft:`4px solid ${m.prioridade==="urgente"?"var(--vermelho)":m.prioridade==="alta"?"#F5A623":statusBadge(m.status)==="badge-green"?"var(--verde)":"#ccc"}`}}>
                  {/* Título + status */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="card-title">{m.titulo}</div>
                      {m.agencia&&<div className="card-sub">📍 {m.agencia}</div>}
                    </div>
                    <span className={`badge ${statusBadge(m.status)}`} style={{flexShrink:0}}>{m.status}</span>
                  </div>

                  {/* Meta */}
                  <div className="card-meta">
                    {m.cliente&&<span className="card-meta-item">🏢 {m.cliente}</span>}
                    {m.responsavelNome&&<span className="card-meta-item">👤 {m.responsavelNome}</span>}
                    {m.alocadoNomes?.length>0&&(
                      <span style={{fontSize:11,background:"var(--afine-yellow-lt)",color:"var(--afine-yellow-dk)",padding:"2px 8px",borderRadius:10,fontWeight:600}}>
                        👷 {m.alocadoNomes.join(", ")}
                      </span>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="card-meta">
                    {m.prioridade&&<span className={`badge ${m.prioridade==="urgente"?"badge-red":m.prioridade==="alta"?"badge-amber":"badge-gray"}`} style={{fontSize:10}}>{m.prioridade}</span>}
                    {m.semOT?<span className="badge badge-amber" style={{fontSize:10}}>S/OT</span>:m.numeroOT&&<span className="card-meta-item" style={{fontSize:11}}>OT: {m.numeroOT}</span>}
                    {m.osDigital?<span className="badge badge-green" style={{fontSize:10}}>✓ OS</span>:<span className="badge badge-gray" style={{fontSize:10}}>OS Pendente</span>}
                  </div>

                  {/* Criado por */}
                  {m.criadoPorNome&&<div style={{fontSize:11,color:"#aaa"}}>Criado por: {m.criadoPorNome}</div>}

                  {/* Ações */}
                  <div className="card-actions">
                    <button className="btn btn-sm btn-icon" onClick={()=>setModal({manut:m})}>✏️ Editar</button>
                    {m.osDigital&&<button className="btn btn-sm" onClick={()=>exportarOSParaPDF(m.osDigital,m)} style={{fontSize:11}}>📄 OS</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ABA: POR AGÊNCIA ────────────────────────────── */}
      {aba==="por_agencia" && (
        <div>
          {Object.keys(porAgencia).length===0&&<div className="empty-state"><div className="empty-icon">🏢</div><p>Nenhum registro</p></div>}
          {Object.entries(porAgencia).sort((a,b)=>b[1].length-a[1].length).map(([ag,items])=>(
            <div key={ag} style={{marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:8,display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:"2px solid var(--afine-yellow)"}}>
                🏢 {ag}
                <span style={{fontSize:12,fontWeight:400,color:"#7A7A7A"}}>({items.length} chamados)</span>
                <span style={{marginLeft:"auto",fontSize:11,color:"var(--verde)"}}>{items.filter(m=>m.status==="CONCLUÍDA").length} concluídas</span>
              </div>
              {items.map(m=><HistoricoCard key={m.id} manut={m} onEdit={()=>setModal({manut:m})}/>)}
            </div>
          ))}
        </div>
      )}

      {/* ── ABA: GARANTIAS ──────────────────────────────── */}
      {aba==="garantias" && (
        <div>
          {manuts.filter(m=>m.garantia==="SIM").length===0&&<div className="empty-state"><div className="empty-icon">🛡️</div><p>Nenhum item em garantia</p></div>}
          {manuts.filter(m=>m.garantia==="SIM").map(m=>{
            const venceu=m.vencGarantia&&m.vencGarantia<hoje;
            return (
              <div key={m.id} className="rdo-card" style={{borderLeft:`3px solid ${venceu?"var(--vermelho)":"var(--verde)"}`}}>
                <div className="rdo-header">
                  <div>
                    <div style={{fontWeight:600}}>{m.titulo}</div>
                    <div style={{fontSize:11,color:"#7A7A7A"}}>{m.agencia} · {m.cliente}</div>
                    <div style={{fontSize:12,color:venceu?"var(--vermelho)":"var(--verde)",fontWeight:600,marginTop:4}}>
                      {venceu?"⚠️ Garantia vencida em":"✓ Garantia até"} {fmtDate(m.vencGarantia)}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span className={`badge ${statusBadge(m.status)}`}>{m.status}</span>
                    <button className="btn btn-sm btn-icon" onClick={()=>setModal({manut:m})}>✏️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ABA: S/OT PENDENTE ──────────────────────────── */}
      {aba==="sem_ot" && (
        <div>
          <div className="alert alert-warning" style={{marginBottom:12,fontSize:12}}>⚠️ Atualize o número da OT assim que receber do cliente.</div>
          {manuts.filter(m=>m.semOT).length===0&&<div className="empty-state"><div className="empty-icon">✅</div><p>Nenhuma S/OT pendente</p></div>}
          {manuts.filter(m=>m.semOT).map(m=>(
            <div key={m.id} className="rdo-card" style={{borderLeft:"3px solid var(--afine-yellow-dk)"}}>
              <div className="rdo-header">
                <div>
                  <div style={{fontWeight:600}}>{m.titulo}</div>
                  <div style={{fontSize:11,color:"#7A7A7A"}}>{m.cliente} · {m.agencia} · {fmtDate(m.dataAbertura)}</div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={()=>setModal({manut:m})}>Informar OT</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ABA: HISTÓRICO ──────────────────────────────── */}
      {aba==="historico" && (
        <div>
          <div className="search-bar">🔍<input placeholder="Buscar no histórico..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {manuts.filter(m=>m.status==="CONCLUÍDA"&&(!search||m.titulo?.toLowerCase().includes(search.toLowerCase())||m.agencia?.toLowerCase().includes(search.toLowerCase()))).length===0&&(
            <div className="empty-state"><div className="empty-icon">📅</div><p>Nenhum histórico de conclusões</p></div>
          )}
          {manuts.filter(m=>m.status==="CONCLUÍDA"&&(!search||m.titulo?.toLowerCase().includes(search.toLowerCase())||m.agencia?.toLowerCase().includes(search.toLowerCase())))
            .map(m=><HistoricoCard key={m.id} manut={m} onEdit={()=>setModal({manut:m})}/>)
          }
        </div>
      )}

      {modal&&(
        <ManutencaoModal
          manut={modal.manut}
          obraId={obraAtual}
          funcionarios={funcionarios}
          clientes={clientes}
          criadoPor={{ nome:userProfile?.nome||currentUser?.email, uid:currentUser?.uid }}
          onClose={()=>setModal(null)}
          addToast={addToast}
        />
      )}
    </div>
  );
}
