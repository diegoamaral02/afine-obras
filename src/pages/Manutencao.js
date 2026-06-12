// src/pages/Manutencao.js — versão completa com todas as melhorias
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { statusBadge, fmtDate } from "../utils/helpers";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import PhotoUploader from "../components/PhotoUploader";
import OSDigital from "../components/OSDigital";
import { exportarOSParaPDF } from "../utils/exportPDF";
import { useToast } from "../hooks/useToast";

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

// Busca CEP via ViaCEP
async function buscarCEP(cep) {
  const c = cep.replace(/\D/g,"");
  if (c.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${c}/json/`);
    const d = await r.json();
    if (d.erro) return null;
    return d;
  } catch { return null; }
}

function ManutencaoModal({ manut, obraId, funcionarios, onClose, addToast }) {
  const { userProfile } = useAuth();
  const isCampo = userProfile?.perfil === "campo";
  const [passo, setPasso] = useState(1);

  const [form, setForm] = useState({
    titulo: manut?.titulo||"", cliente: manut?.cliente||"",
    agencia: manut?.agencia||"", tipo: manut?.tipo||"corretiva",
    prioridade: manut?.prioridade||"normal",
    numeroOT: manut?.numeroOT||"", semOT: manut?.semOT||false,
    responsavelId: manut?.responsavelId||"",
    responsavel: manut?.responsavel||"",
    // Endereço
    cep: manut?.cep||"", logradouro: manut?.logradouro||"",
    numero: manut?.numero||"", bairro: manut?.bairro||"",
    cidade: manut?.cidade||"", uf: manut?.uf||"",
    // Datas
    dataAbertura: manut?.dataAbertura||new Date().toISOString().split("T")[0],
    dataPrevista: manut?.dataPrevista||"", dataConclusao: manut?.dataConclusao||"",
    status: manut?.status||"ABERTA",
    garantia: manut?.garantia||"NÃO", vencGarantia: manut?.vencGarantia||"",
    descProntas: manut?.descProntas||[], descExtra: manut?.descExtra||"",
    obs: manut?.obs||"",
    camposCustom: manut?.camposCustom||{},
    materiais: manut?.materiais||[],
  });
  const [checklist,  setChecklist]  = useState(manut?.checklist||{});
  const [fotos,      setFotos]      = useState(manut?.fotos||[]);
  const [osDigital,  setOsDigital]  = useState(manut?.osDigital||null);
  const [showOS,     setShowOS]     = useState(false);
  const [buscandoCEP,setBuscandoCEP]= useState(false);
  const [saving,     setSaving]     = useState(false);
  // Materiais da manutenção
  const [matNome,    setMatNome]    = useState("");
  const [matQtd,     setMatQtd]     = useState("");
  const [matUn,      setMatUn]      = useState("un");

  function set(f,v) { setForm(p=>({...p,[f]:v})); }
  function setCustom(f,v) { setForm(p=>({...p,camposCustom:{...p.camposCustom,[f]:v}})); }
  function toggleDesc(s) { setForm(p=>({...p,descProntas:p.descProntas.includes(s)?p.descProntas.filter(x=>x!==s):[...p.descProntas,s]})); }
  function toggleCheck(item) { setChecklist(p=>({...p,[item]:!p[item]})); }

  function handleFuncChange(e) {
    const id = e.target.value;
    const f = funcionarios.find(x=>x.id===id||x.uid===id);
    set("responsavelId",id); set("responsavel",f?.nome||"");
  }

  async function handleCEP(cep) {
    set("cep",cep);
    if (cep.replace(/\D/g,"").length === 8) {
      setBuscandoCEP(true);
      const d = await buscarCEP(cep);
      if (d) {
        set("logradouro",d.logradouro||"");
        set("bairro",d.bairro||"");
        set("cidade",d.localidade||"");
        set("uf",d.uf||"");
      }
      setBuscandoCEP(false);
    }
  }

  function enderecoCompleto() {
    const e = form;
    if (!e.logradouro) return "";
    return `${e.logradouro}, ${e.numero} — ${e.bairro}, ${e.cidade}/${e.uf}`;
  }

  function abrirNavegacao() {
    const end = encodeURIComponent(enderecoCompleto());
    if (!end) { alert("Preencha o endereço primeiro."); return; }
    // Abre Google Maps / Apple Maps dependendo do dispositivo
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.open(`maps://maps.apple.com/?q=${end}`);
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${end}`, "_blank");
    }
  }

  function adicionarMaterial() {
    if (!matNome.trim() || !matQtd) { alert("Informe nome e quantidade."); return; }
    const novo = { nome: matNome, qtd: Number(matQtd), un: matUn };
    setForm(p=>({...p, materiais:[...p.materiais, novo]}));
    setMatNome(""); setMatQtd("");
  }

  function removerMaterial(idx) {
    setForm(p=>({...p, materiais:p.materiais.filter((_,i)=>i!==idx)}));
  }

  const isItau = form.cliente?.toLowerCase().includes("itaú")||form.cliente?.toLowerCase().includes("itau");
  const otOk   = !isItau || form.semOT || form.numeroOT.trim();
  const fotosOk = fotos.length >= MIN_FOTOS;
  const osOk    = !!osDigital;
  const endOk   = form.logradouro && form.numero && form.cep;
  const matOk   = form.materiais.length > 0;
  const podeConc = fotosOk && osOk && otOk && endOk && matOk;

  const funcResponsavel = funcionarios.find(f=>f.id===form.responsavelId||f.uid===form.responsavelId);

  async function save() {
    if (!form.titulo || !form.cliente) { alert("Título e cliente são obrigatórios."); return; }
    if (!endOk) { alert("CEP, logradouro e número são obrigatórios."); return; }
    if (!matOk && (form.status==="CONCLUÍDA"||form.status==="EM ANDAMENTO")) {
      alert("Informe pelo menos um material utilizado."); return;
    }
    if (isItau && !form.semOT && !form.numeroOT.trim()) { alert("Para Itaú: informe OT ou marque S/OT."); return; }
    if (form.status==="CONCLUÍDA" && !podeConc) {
      const msgs=[];
      if(!fotosOk) msgs.push(`• ${MIN_FOTOS} fotos (você tem ${fotos.length})`);
      if(!osOk)    msgs.push("• OS digital assinada");
      if(!otOk)    msgs.push("• Número da OT ou S/OT");
      if(!endOk)   msgs.push("• Endereço completo");
      if(!matOk)   msgs.push("• Materiais utilizados");
      alert("Para concluir:\n"+msgs.join("\n")); return;
    }
    setSaving(true);
    const agora = new Date().toISOString();
    // Preenche data de conclusão automaticamente ao finalizar
    const dataConclusao = form.status==="CONCLUÍDA" && !form.dataConclusao
      ? new Date().toISOString().split("T")[0]
      : form.dataConclusao;
    const payload = { ...form, dataConclusao, checklist, fotos, osDigital: osDigital||null, obraId: obraId||null, updatedAt: agora };
    try {
      if (manut?.id) { await updateDoc(doc(db,"manutencoes",manut.id),payload); addToast("Atualizado!"); }
      else { payload.createdAt=agora; await addDoc(collection(db,"manutencoes"),payload); addToast("Criado!"); }
      onClose();
    } catch(err) { addToast("Erro: "+err.message,"error"); }
    setSaving(false);
  }

  const checkOk = Object.values(checklist).filter(Boolean).length;
  const PASSOS = ["Dados","Endereço","Materiais","Fotos & Checklist","OS Digital"];

  return (
    <Modal title={manut?.id?"Editar manutenção":"Nova manutenção"} onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          {passo>1 && <button className="btn" onClick={()=>setPasso(p=>p-1)}>← Anterior</button>}
          {passo<5
            ? <button className="btn btn-primary" onClick={()=>setPasso(p=>p+1)}>Próximo →</button>
            : <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?"Salvando...":"Salvar"}</button>
          }
        </>
      }>

      {/* Indicador de passos */}
      <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
        {PASSOS.map((label,i)=>(
          <div key={i} onClick={()=>(!isCampo||i>0)&&setPasso(i+1)}
            style={{flex:1,padding:"5px 4px",textAlign:"center",fontSize:10,fontWeight:500,borderRadius:6,
              cursor:(!isCampo||i>0)?"pointer":"default",minWidth:60,
              background:passo===i+1?"var(--azul)":passo>i+1?"var(--verde-lt)":"var(--cinza-lt)",
              color:passo===i+1?"#fff":passo>i+1?"var(--verde)":"var(--cinza-med)"}}>
            {passo>i+1?"✓ ":""}{label}
          </div>
        ))}
      </div>

      {/* PASSO 1 — DADOS */}
      {passo===1 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {isCampo && (
            <div className="alert alert-info" style={{fontSize:12}}>
              ℹ️ Você pode visualizar os dados mas não editá-los. Use as abas seguintes para registrar materiais, fotos e OS.
            </div>
          )}
          <div className="form-grid">
            <div className="form-group span-2"><label className="required">Título</label>
              <input value={form.titulo} onChange={e=>set("titulo",e.target.value)} disabled={isCampo} style={{opacity:isCampo?.7:1}}/></div>
            <div className="form-group"><label className="required">Cliente</label>
              <input value={form.cliente} onChange={e=>set("cliente",e.target.value)} disabled={isCampo} style={{opacity:isCampo?.7:1}}/></div>
            <div className="form-group"><label>Agência / local</label>
              <input value={form.agencia} onChange={e=>set("agencia",e.target.value)} disabled={isCampo} style={{opacity:isCampo?.7:1}}/></div>
            <div className="form-group"><label>Tipo</label>
              <select value={form.tipo} onChange={e=>set("tipo",e.target.value)} disabled={isCampo}>
                {["corretiva","preventiva","preditiva","emergencial"].map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div className="form-group"><label>Prioridade</label>
              <select value={form.prioridade} onChange={e=>set("prioridade",e.target.value)} disabled={isCampo}>
                {["baixa","normal","alta","urgente"].map(t=><option key={t}>{t}</option>)}
              </select></div>
            <div className="form-group"><label>Responsável</label>
              <select value={form.responsavelId} onChange={handleFuncChange} disabled={isCampo}>
                <option value="">Selecione...</option>
                {funcionarios.map(f=><option key={f.id} value={f.id}>{f.nome} — {f.funcao}</option>)}
              </select></div>
            <div className="form-group"><label>Status</label>
              <select value={form.status} onChange={e=>set("status",e.target.value)}>
                {["ABERTA","EM ANDAMENTO","CONCLUÍDA","CANCELADA","AGUARDANDO PEÇAS"].map(s=><option key={s}>{s}</option>)}
              </select></div>
          </div>

          {isItau && !isCampo && (
            <div style={{background:"#FFF2CC",border:"1px solid #F0C040",borderRadius:8,padding:12}}>
              <div style={{fontSize:12,fontWeight:600,color:"#854F0B",marginBottom:8}}>⚠️ ITAÚ — Número da OT obrigatório</div>
              <div className="form-grid">
                <div className="form-group"><label className="required">Número da OT</label>
                  <input value={form.numeroOT} onChange={e=>set("numeroOT",e.target.value)} placeholder="OT-2025-00123" disabled={form.semOT} style={{opacity:form.semOT?.4:1}}/></div>
                <div className="form-group" style={{justifyContent:"flex-end"}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:20}}>
                    <input type="checkbox" checked={form.semOT} onChange={e=>{set("semOT",e.target.checked);if(e.target.checked)set("numeroOT","S/OT");}} style={{width:16,height:16}}/>
                    <span style={{fontSize:13}}>S/OT (sem número ainda)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {!isItau && form.cliente && !isCampo && (
            <div style={{background:"var(--cinza-lt)",borderRadius:8,padding:12}}>
              <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Campos específicos — {form.cliente}</div>
              <div className="form-grid">
                <div className="form-group"><label>Protocolo / Nº documento</label><input value={form.camposCustom?.protocolo||""} onChange={e=>setCustom("protocolo",e.target.value)}/></div>
                <div className="form-group"><label>Centro de custo</label><input value={form.camposCustom?.centroCusto||""} onChange={e=>setCustom("centroCusto",e.target.value)}/></div>
                <div className="form-group span-2"><label>Referência adicional</label><input value={form.camposCustom?.ref||""} onChange={e=>setCustom("ref",e.target.value)}/></div>
              </div>
            </div>
          )}

          {/* Descritivos — pré-selecionados + campo livre */}
          {!isCampo && (
            <>
              <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>DESCRITIVOS DO SERVIÇO</div>
              <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:180,overflowY:"auto"}}>
                {DESCRITIVOS_PRONTOS.map(d=>(
                  <label key={d} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,background:form.descProntas.includes(d)?"var(--azul-claro)":"var(--cinza-lt)"}}>
                    <input type="checkbox" checked={form.descProntas.includes(d)} onChange={()=>toggleDesc(d)} style={{width:15,height:15}}/>
                    <span>{d}</span>
                  </label>
                ))}
              </div>
              <div className="form-group">
                <label>Descrição adicional</label>
                <textarea value={form.descExtra} onChange={e=>set("descExtra",e.target.value)} placeholder="Detalhe o serviço..." rows={3}/>
              </div>
            </>
          )}

          {/* Datas */}
          {!isCampo && (
            <div className="form-grid">
              <div className="form-group"><label>Abertura</label><input type="date" value={form.dataAbertura} onChange={e=>set("dataAbertura",e.target.value)}/></div>
              <div className="form-group"><label>Previsão</label><input type="date" value={form.dataPrevista} onChange={e=>set("dataPrevista",e.target.value)}/></div>
              <div className="form-group"><label>Conclusão real</label>
                <input type="date" value={form.dataConclusao} onChange={e=>set("dataConclusao",e.target.value)}
                  placeholder="Preenchida automaticamente ao finalizar"/>
              </div>
              <div className="form-group"><label>Garantia?</label>
                <select value={form.garantia} onChange={e=>set("garantia",e.target.value)}><option>NÃO</option><option>SIM</option></select>
              </div>
              {form.garantia==="SIM" && <div className="form-group"><label>Vencimento</label><input type="date" value={form.vencGarantia} onChange={e=>set("vencGarantia",e.target.value)}/></div>}
            </div>
          )}
          <div className="form-group"><label>Observações</label><textarea value={form.obs} onChange={e=>set("obs",e.target.value)} rows={2}/></div>
        </div>
      )}

      {/* PASSO 2 — ENDEREÇO */}
      {passo===2 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>ENDEREÇO DO LOCAL DE ATENDIMENTO</div>
          <div style={{fontSize:12,color:"var(--cinza-med)"}}>CEP, logradouro e número são obrigatórios para gerar o link de navegação.</div>

          <div className="form-grid">
            <div className="form-group">
              <label className="required">CEP</label>
              <div style={{display:"flex",gap:6}}>
                <input value={form.cep} onChange={e=>handleCEP(e.target.value)} placeholder="00000-000" maxLength={9} style={{flex:1}}/>
                {buscandoCEP && <span style={{fontSize:12,color:"var(--cinza-med)",alignSelf:"center"}}>Buscando...</span>}
              </div>
              {form.cep&&!buscandoCEP&&!form.logradouro&&<span style={{fontSize:11,color:"var(--vermelho)"}}>CEP não encontrado</span>}
            </div>
            <div className="form-group"><label className="required">Número</label>
              <input value={form.numero} onChange={e=>set("numero",e.target.value)} placeholder="123"/></div>
            <div className="form-group span-2"><label className="required">Logradouro</label>
              <input value={form.logradouro} onChange={e=>set("logradouro",e.target.value)} placeholder="Preenchido automaticamente pelo CEP"/></div>
            <div className="form-group"><label>Bairro</label>
              <input value={form.bairro} onChange={e=>set("bairro",e.target.value)}/></div>
            <div className="form-group"><label>Cidade</label>
              <input value={form.cidade} onChange={e=>set("cidade",e.target.value)}/></div>
            <div className="form-group"><label>UF</label>
              <input value={form.uf} onChange={e=>set("uf",e.target.value)} maxLength={2}/></div>
          </div>

          {enderecoCompleto() && (
            <div style={{background:"var(--azul-claro)",borderRadius:8,padding:12}}>
              <div style={{fontSize:12,color:"var(--azul)",marginBottom:8}}>📍 {enderecoCompleto()}</div>
              <button className="btn btn-primary" onClick={abrirNavegacao} style={{fontSize:12}}>
                🗺️ Abrir no mapa / Iniciar navegação
              </button>
              <div style={{fontSize:11,color:"var(--cinza-med)",marginTop:6}}>
                Abre Google Maps (Android) ou Apple Maps (iPhone) com rota até o endereço.
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASSO 3 — MATERIAIS */}
      {passo===3 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>MATERIAIS UTILIZADOS <span style={{color:"var(--vermelho)"}}>*</span></div>
          <div style={{fontSize:12,color:"var(--cinza-med)"}}>Obrigatório informar todos os materiais usados nesta manutenção.</div>

          <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
            <div className="form-group" style={{flex:2}}>
              <label>Material</label>
              <input value={matNome} onChange={e=>setMatNome(e.target.value)} placeholder="Ex: Cabo UTP Cat.6"/>
            </div>
            <div className="form-group" style={{width:80}}>
              <label>Qtd.</label>
              <input type="number" min="0" value={matQtd} onChange={e=>setMatQtd(e.target.value)}/>
            </div>
            <div className="form-group" style={{width:80}}>
              <label>Un.</label>
              <select value={matUn} onChange={e=>setMatUn(e.target.value)}>
                {["un","m","m²","kg","saco","cx","rolo","litro"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={adicionarMaterial} style={{marginBottom:1}}>+ Add</button>
          </div>

          {form.materiais.length===0 && (
            <div className="alert alert-warning" style={{fontSize:12}}>Adicione pelo menos 1 material.</div>
          )}

          {form.materiais.length>0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Material</th><th>Qtd.</th><th>Un.</th><th></th></tr></thead>
                <tbody>
                  {form.materiais.map((m,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:500}}>{m.nome}</td>
                      <td>{m.qtd}</td>
                      <td>{m.un}</td>
                      <td><button className="btn btn-sm" style={{color:"var(--vermelho)"}} onClick={()=>removerMaterial(i)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PASSO 4 — FOTOS & CHECKLIST */}
      {passo===4 && (
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <PhotoUploader fotos={fotos} onChange={setFotos}/>
          <div className="divider"/>
          <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>CHECKLIST DE VISTORIA ({checkOk}/{CHECKLIST_ITENS.length})</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {CHECKLIST_ITENS.map(item=>(
              <label key={item} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,cursor:"pointer",padding:"4px 0"}}>
                <input type="checkbox" checked={!!checklist[item]} onChange={()=>toggleCheck(item)} style={{width:14,height:14}}/>
                <span style={{color:checklist[item]?"var(--verde)":"inherit"}}>{item}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* PASSO 5 — OS DIGITAL */}
      {passo===5 && (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {osDigital ? (
            <div>
              <div style={{background:"var(--verde-lt)",border:"1px solid var(--verde)",borderRadius:8,padding:12,marginBottom:12}}>
                <div style={{fontWeight:600,color:"var(--verde)",marginBottom:6}}>✓ OS Digital emitida e assinada</div>
                <div style={{fontSize:12}}>Nº {osDigital.numero} · {new Date(osDigital.geradaEm).toLocaleString("pt-BR")}</div>
                <div style={{fontSize:12}}>Prestador: {osDigital.funcionario?.nome} · Gerente: {osDigital.nomeGerente}</div>
                {osDigital.assinGerente && <img src={osDigital.assinGerente} alt="Assinatura gerente" style={{maxHeight:60,marginTop:6,border:"1px solid #ddd",borderRadius:4,background:"#fff"}}/>}
              </div>
              <div style={{display:"flex",gap:8"}}>
                <button className="btn btn-sm" onClick={()=>setShowOS(true)}>Refazer OS</button>
                <button className="btn btn-sm btn-primary" onClick={()=>exportarOSParaPDF(osDigital,{...form,materiais:form.materiais})}>
                  📄 Exportar PDF
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="alert alert-info" style={{fontSize:12,marginBottom:12}}>
                A OS digital é preenchida agora com os serviços, assinada pelo prestador e pelo gerente da agência.
                A data de conclusão será preenchida automaticamente.
              </div>
              <button className="btn btn-primary" style={{width:"100%",justifyContent:"center"}} onClick={()=>setShowOS(true)}>
                📄 Criar OS Digital agora
              </button>
            </div>
          )}

          {showOS && (
            <div style={{background:"var(--cinza-lt)",borderRadius:10,padding:14}}>
              {/* Passa os descritivos preenchidos para a OS */}
              <OSDigital
                manutencao={true}
                descritivos={form.descProntas}
                descExtra={form.descExtra}
                funcionario={funcResponsavel||{nome:form.responsavel,funcao:"Prestador"}}
                onSalvar={os=>{ setOsDigital(os); setShowOS(false); }}
                onFechar={()=>setShowOS(false)}
              />
            </div>
          )}

          {form.status==="CONCLUÍDA" && !podeConc && (
            <div className="alert alert-danger" style={{fontSize:12}}>
              <strong>Para concluir:</strong>
              {!fotosOk&&<div>• {MIN_FOTOS} fotos (você tem {fotos.length})</div>}
              {!osOk&&<div>• OS digital assinada</div>}
              {!otOk&&<div>• OT ou S/OT</div>}
              {!endOk&&<div>• Endereço completo</div>}
              {!matOk&&<div>• Materiais utilizados</div>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function HistoricoCard({ manut }) {
  const [open, setOpen] = useState(false);
  const checkOk = Object.values(manut.checklist||{}).filter(Boolean).length;
  const enderecoCompleto = manut.logradouro ? `${manut.logradouro}, ${manut.numero} — ${manut.bairro}, ${manut.cidade}/${manut.uf}` : null;

  function abrirMapa() {
    if (!enderecoCompleto) return;
    const enc = encodeURIComponent(enderecoCompleto);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && /iPhone|iPad|iPod/i.test(navigator.userAgent)) window.open(`maps://maps.apple.com/?q=${enc}`);
    else window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
  }

  return (
    <div className="rdo-card" style={{marginBottom:10}}>
      <div className="rdo-header">
        <div style={{flex:1}}>
          <div style={{fontWeight:600,fontSize:13}}>{manut.titulo}</div>
          <div style={{fontSize:11,color:"var(--cinza-med)"}}>{manut.agencia} · {fmtDate(manut.dataAbertura)}</div>
          {enderecoCompleto && (
            <button onClick={abrirMapa} style={{background:"none",border:"none",color:"var(--azul-med)",fontSize:11,cursor:"pointer",padding:0,marginTop:2}}>
              🗺️ {enderecoCompleto}
            </button>
          )}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span className={`badge ${manut.prioridade==="urgente"?"badge-red":manut.prioridade==="alta"?"badge-amber":"badge-blue"}`}>{manut.prioridade}</span>
          <span className={`badge ${statusBadge(manut.status)}`}>{manut.status}</span>
          <button className="btn btn-sm" onClick={()=>setOpen(!open)}>{open?"▲":"▼"}</button>
        </div>
      </div>
      {open && (
        <div style={{marginTop:10,fontSize:12,display:"flex",flexDirection:"column",gap:6}}>
          {manut.numeroOT&&<div><strong>OT:</strong> {manut.numeroOT}</div>}
          {manut.responsavel&&<div><strong>Resp:</strong> {manut.responsavel}</div>}
          {manut.descProntas?.length>0&&<div><strong>Serviços:</strong>{manut.descProntas.map((d,i)=><span key={i} style={{display:"block",paddingLeft:8}}>• {d}</span>)}</div>}
          {manut.descExtra&&<div style={{fontStyle:"italic"}}>{manut.descExtra}</div>}
          {manut.materiais?.length>0&&<div><strong>Materiais:</strong>{manut.materiais.map((m,i)=><span key={i} style={{display:"block",paddingLeft:8}}>• {m.nome} — {m.qtd} {m.un}</span>)}</div>}
          {manut.dataConclusao&&<div><strong>Concluída:</strong> {fmtDate(manut.dataConclusao)}</div>}
          {manut.garantia==="SIM"&&<div style={{color:"var(--verde)"}}><strong>Garantia até:</strong> {fmtDate(manut.vencGarantia)}</div>}
          <div><strong>Checklist:</strong> {checkOk}/{CHECKLIST_ITENS.length} itens</div>
          {manut.osDigital&&(
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{background:"var(--verde-lt)",color:"var(--verde)",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600}}>✓ OS {manut.osDigital.numero}</span>
              <button className="btn btn-sm" onClick={()=>exportarOSParaPDF(manut.osDigital,manut)} style={{fontSize:11}}>📄 PDF</button>
            </div>
          )}
          {manut.fotos?.length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
              {manut.fotos.slice(0,6).map((f,i)=><img key={i} src={f.base64} alt="" style={{width:56,height:56,objectFit:"cover",borderRadius:4,border:"1px solid #ddd"}}/>)}
              {manut.fotos.length>6&&<div style={{width:56,height:56,borderRadius:4,background:"#eee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>+{manut.fotos.length-6}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Manutencao({ obraAtual }) {
  const { toasts, addToast } = useToast();
  const [manuts,       setManuts]       = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filtro,       setFiltro]       = useState("todas");
  const [aba,          setAba]          = useState("lista");
  const [modal,        setModal]        = useState(null);

  useEffect(()=>{
    const col = obraAtual
      ? query(collection(db,"manutencoes"),where("obraId","==",obraAtual))
      : collection(db,"manutencoes");
    return onSnapshot(col, snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()}));
      data.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
      setManuts(data); setLoading(false);
    });
  },[obraAtual]);

  useEffect(()=>{
    return onSnapshot(collection(db,"usuarios_lista"), snap=>{
      setFuncionarios(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="ATIVO"||!f.status));
    });
  },[]);

  const filtered = manuts.filter(m=>{
    const q=search.toLowerCase();
    const mQ=!q||m.titulo?.toLowerCase().includes(q)||m.cliente?.toLowerCase().includes(q)||m.agencia?.toLowerCase().includes(q)||(m.numeroOT||"").toLowerCase().includes(q);
    const mF=filtro==="todas"||m.status===filtro;
    return mQ&&mF;
  });

  const abertas =manuts.filter(m=>m.status==="ABERTA"||m.status==="EM ANDAMENTO").length;
  const concl   =manuts.filter(m=>m.status==="CONCLUÍDA").length;
  const garantia=manuts.filter(m=>m.garantia==="SIM").length;
  const semOT   =manuts.filter(m=>m.semOT).length;

  const porAgencia=manuts.reduce((acc,m)=>{
    const ag=m.agencia||"Sem agência";
    if(!acc[ag])acc[ag]=[];
    acc[ag].push(m);
    return acc;
  },{});

  return (
    <div>
      <div className="toast-container">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
      <div className="panel-header">
        <div><div className="panel-title">Manutenções</div><div style={{fontSize:12,color:"var(--cinza-med)"}}>{manuts.length} registros</div></div>
        <button className="btn btn-primary" onClick={()=>setModal({manut:null})}>+ Nova manutenção</button>
      </div>

      <div className="metrics-grid" style={{marginBottom:16}}>
        <div className="metric"><div className="metric-label">Em aberto</div><div className="metric-value red">{abertas}</div></div>
        <div className="metric"><div className="metric-label">Concluídas</div><div className="metric-value green">{concl}</div></div>
        <div className="metric"><div className="metric-label">Em garantia</div><div className="metric-value blue">{garantia}</div></div>
        <div className="metric"><div className="metric-label">S/OT pendente</div><div className="metric-value amber">{semOT}</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${aba==="lista"?"active":""}`} onClick={()=>setAba("lista")}>Lista</button>
        <button className={`tab ${aba==="historico"?"active":""}`} onClick={()=>setAba("historico")}>Por agência</button>
        <button className={`tab ${aba==="garantia"?"active":""}`} onClick={()=>setAba("garantia")}>Garantias</button>
        <button className={`tab ${aba==="semOT"?"active":""}`} onClick={()=>setAba("semOT")}>S/OT pendente{semOT>0&&<span className="nav-badge red" style={{marginLeft:4}}>{semOT}</span>}</button>
      </div>

      {aba==="lista"&&(
        <>
          <div className="chip-row">
            {["todas","ABERTA","EM ANDAMENTO","CONCLUÍDA","CANCELADA","AGUARDANDO PEÇAS"].map(s=>(
              <button key={s} className={`chip ${filtro===s?"active":""}`} onClick={()=>setFiltro(s)}>
                {s==="todas"?"Todas":s} ({s==="todas"?manuts.length:manuts.filter(m=>m.status===s).length})
              </button>
            ))}
          </div>
          <div className="search-bar">🔍<input placeholder="Buscar por título, cliente, agência ou OT..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          {loading&&<div className="spinner"/>}
          {!loading&&filtered.length===0&&<div className="empty-state"><div className="empty-icon">🔧</div><p>Nenhuma manutenção encontrada</p></div>}
          {!loading&&filtered.length>0&&(
            <div className="table-wrap">
              <table>
                <thead><tr><th>Título</th><th>Cliente</th><th>Agência</th><th>Endereço</th><th>OT</th><th>Resp.</th><th>Prior.</th><th>OS</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(m=>{
                    const end = m.logradouro?`${m.logradouro}, ${m.numero}`:null;
                    return(
                    <tr key={m.id}>
                      <td style={{fontWeight:600,maxWidth:150,fontSize:13}}>{m.titulo}</td>
                      <td style={{fontSize:12}}>{m.cliente}</td>
                      <td style={{fontSize:12}}>{m.agencia||"–"}</td>
                      <td style={{fontSize:11}}>
                        {end ? (
                          <button onClick={()=>{
                            const enc=encodeURIComponent(`${m.logradouro}, ${m.numero}, ${m.cidade}`);
                            window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`,"_blank");
                          }} style={{background:"none",border:"none",color:"var(--azul-med)",cursor:"pointer",fontSize:11}}>
                            🗺️ {end}
                          </button>
                        ):"–"}
                      </td>
                      <td style={{fontSize:11}}>{m.semOT?<span className="badge badge-amber">S/OT</span>:m.numeroOT||"–"}</td>
                      <td style={{fontSize:12}}>{m.responsavel||"–"}</td>
                      <td><span className={`badge ${m.prioridade==="urgente"?"badge-red":m.prioridade==="alta"?"badge-amber":"badge-blue"}`} style={{fontSize:10}}>{m.prioridade}</span></td>
                      <td>{m.osDigital?<span className="badge badge-green" style={{fontSize:10}}>✓ OS</span>:<span className="badge badge-gray" style={{fontSize:10}}>Pendente</span>}</td>
                      <td><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></td>
                      <td style={{display:"flex",gap:4}}>
                        <button className="btn btn-sm btn-icon" onClick={()=>setModal({manut:m})}>✏️</button>
                        {m.osDigital&&<button className="btn btn-sm" title="Exportar PDF" onClick={()=>exportarOSParaPDF(m.osDigital,m)} style={{fontSize:11}}>📄</button>}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aba==="historico"&&(
        <div>
          {Object.keys(porAgencia).length===0&&<div className="empty-state"><div className="empty-icon">🏢</div><p>Nenhum histórico</p></div>}
          {Object.entries(porAgencia).map(([ag,items])=>(
            <div key={ag} style={{marginBottom:20}}>
              <div style={{fontWeight:600,fontSize:14,color:"var(--azul)",marginBottom:8,borderBottom:"2px solid var(--azul-claro)",paddingBottom:4}}>
                🏢 {ag} <span style={{fontSize:12,fontWeight:400,color:"var(--cinza-med)"}}>({items.length})</span>
              </div>
              {items.map(m=><HistoricoCard key={m.id} manut={m}/>)}
            </div>
          ))}
        </div>
      )}

      {aba==="garantia"&&(
        <div>
          {manuts.filter(m=>m.garantia==="SIM").length===0&&<div className="empty-state"><div className="empty-icon">🛡️</div><p>Nenhum item em garantia</p></div>}
          {manuts.filter(m=>m.garantia==="SIM").map(m=>(
            <div key={m.id} className="rdo-card" style={{borderLeft:"3px solid var(--verde)"}}>
              <div className="rdo-header">
                <div><div style={{fontWeight:600}}>{m.titulo}</div><div style={{fontSize:11,color:"var(--cinza-med)"}}>{m.agencia}</div></div>
                <div><div style={{fontSize:12,color:"var(--verde)",fontWeight:600}}>Garantia até {fmtDate(m.vencGarantia)}</div><span className={`badge ${statusBadge(m.status)}`}>{m.status}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {aba==="semOT"&&(
        <div>
          <div className="alert alert-warning" style={{marginBottom:12}}>⚠️ Atualize o número da OT quando disponível.</div>
          {manuts.filter(m=>m.semOT).length===0&&<div className="empty-state"><div className="empty-icon">✅</div><p>Nenhuma S/OT pendente</p></div>}
          {manuts.filter(m=>m.semOT).map(m=>(
            <div key={m.id} className="rdo-card" style={{borderLeft:"3px solid var(--laranja)"}}>
              <div className="rdo-header">
                <div><div style={{fontWeight:600}}>{m.titulo}</div><div style={{fontSize:11,color:"var(--cinza-med)"}}>{m.cliente} · {m.agencia}</div></div>
                <button className="btn btn-sm btn-primary" onClick={()=>setModal({manut:m})}>Informar OT</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal&&<ManutencaoModal manut={modal.manut} obraId={obraAtual} funcionarios={funcionarios} onClose={()=>setModal(null)} addToast={addToast}/>}
    </div>
  );
}
