// src/components/OSDigital.js — recebe descritivos pré-preenchidos da manutenção
import React, { useState } from "react";
import AssinaturaDigital from "./AssinaturaDigital";

const SERVICOS_OBRA = [
  "Execução de alvenaria / drywall","Instalação elétrica — infraestrutura","Instalação elétrica — fiação",
  "Instalação hidráulica","Aplicação de revestimento / piso","Pintura — massa corrida e tinta",
  "Instalação de forro","Montagem de mobiliário","Instalação de cabeamento",
  "Instalação de AC","Instalação de controle de acesso / CFTV","Limpeza grossa","Limpeza fina",
];
const SERVICOS_MANUT = [
  "Substituição de lâmpadas queimadas","Troca de tomadas/interruptores defeituosos",
  "Reparo no quadro elétrico","Manutenção de ar-condicionado — filtros",
  "Reparo de vazamento hidráulico","Substituição de torneiras/metais",
  "Reparo em forro/gesso danificado","Fixação de revestimentos soltos",
  "Reparo em porta/fechadura/dobradiça","Manutenção de cabeamento estruturado",
  "Reparo em câmera CFTV","Substituição de equipamento de acesso",
  "Pintura corretiva","Rejunte e silicone em banheiros","Revisão geral preventiva",
];

export default function OSDigital({ manutencao, descritivos, descExtra, funcionario, onSalvar, onFechar }) {
  const lista = manutencao ? SERVICOS_MANUT : SERVICOS_OBRA;
  // Pré-seleciona os descritivos vindos da manutenção
  const [servicosSel,    setServicosSel]    = useState(descritivos && descritivos.length > 0 ? [...descritivos] : []);
  const [descricaoExtra, setDescricaoExtra] = useState(descExtra || "");
  const [assinPrestador, setAssinPrestador] = useState(null);
  const [assinGerente,   setAssinGerente]   = useState(null);
  const [geoGerente,     setGeoGerente]     = useState(null);
  const [nomeGerente,    setNomeGerente]    = useState("");
  const [passo, setPasso] = useState(1);

  function toggleServico(s) { setServicosSel(p => p.includes(s)?p.filter(x=>x!==s):[...p,s]); }

  function avancar() {
    if (passo===1 && servicosSel.length===0 && !descricaoExtra.trim()) { alert("Selecione pelo menos um serviço."); return; }
    if (passo===2 && !assinPrestador) { alert("O prestador precisa assinar."); return; }
    setPasso(p=>p+1);
  }

  function finalizar() {
    if (!assinGerente) { alert("O gerente precisa assinar."); return; }
    if (!geoGerente) { alert("É necessário confirmar a localização do dispositivo para validar a assinatura do gerente."); return; }
    if (!nomeGerente.trim()) { alert("Informe o nome do gerente."); return; }
    onSalvar({
      numero: `OS-${Date.now()}`,
      data: new Date().toLocaleString("pt-BR"),
      funcionario: funcionario||{},
      servicos: servicosSel,
      descricaoExtra,
      assinPrestador,
      assinGerente,
      geoGerente,
      nomeGerente,
      geradaEm: new Date().toISOString(),
    });
  }

  const dataHora = new Date().toLocaleString("pt-BR");

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Cabeçalho */}
      <div style={{background:"var(--azul)",borderRadius:8,padding:12,color:"#fff"}}>
        <div style={{fontWeight:700,fontSize:15}}>ORDEM DE SERVIÇO DIGITAL</div>
        <div style={{fontSize:10,opacity:.7,marginTop:2}}>AFINE – A.F. Nery Arquitetura e Construção · {dataHora}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:8,fontSize:12}}>
          <div><span style={{opacity:.7}}>Prestador:</span><br/><strong>{funcionario?.nome||"–"}</strong></div>
          <div><span style={{opacity:.7}}>Função:</span><br/><strong>{funcionario?.funcao||"–"}</strong></div>
        </div>
      </div>

      {/* Indicador de passo */}
      <div style={{display:"flex",gap:4}}>
        {["Serviços","Assin. Prestador","Assin. Gerente"].map((l,i)=>(
          <div key={i} style={{flex:1,textAlign:"center",fontSize:10,padding:"4px",borderRadius:6,
            background:passo===i+1?"var(--azul)":passo>i+1?"var(--verde-lt)":"var(--cinza-lt)",
            color:passo===i+1?"#fff":passo>i+1?"var(--verde)":"var(--cinza-med)",fontWeight:500}}>
            {passo>i+1?"✓ ":""}{l}
          </div>
        ))}
      </div>

      {/* PASSO 1 */}
      {passo===1 && (
        <>
          <div style={{fontSize:12,fontWeight:600,color:"#185FA5"}}>
            SERVIÇOS EXECUTADOS
            {descritivos?.length>0 && <span style={{fontSize:11,fontWeight:400,color:"var(--verde)",marginLeft:8}}>✓ Pré-preenchido da manutenção</span>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:200,overflowY:"auto"}}>
            {lista.map(s=>(
              <label key={s} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,cursor:"pointer",padding:"4px 8px",borderRadius:6,
                background:servicosSel.includes(s)?"var(--azul-claro)":"var(--cinza-lt)"}}>
                <input type="checkbox" checked={servicosSel.includes(s)} onChange={()=>toggleServico(s)} style={{width:14,height:14}}/>
                <span style={{color:servicosSel.includes(s)?"var(--azul)":"inherit",fontWeight:servicosSel.includes(s)?500:400}}>{s}</span>
              </label>
            ))}
          </div>
          <div className="form-group">
            <label>Descrição adicional / observações</label>
            <textarea value={descricaoExtra} onChange={e=>setDescricaoExtra(e.target.value)} rows={3} placeholder="Detalhes adicionais..."/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn" onClick={onFechar}>Cancelar</button>
            <button className="btn btn-primary" style={{flex:1,justifyContent:"center"}} onClick={avancar}>Próximo →</button>
          </div>
        </>
      )}

      {/* PASSO 2 — Assinatura prestador */}
      {passo===2 && (
        <>
          <div style={{background:"var(--cinza-lt)",borderRadius:6,padding:10,fontSize:12}}>
            <strong>Resumo:</strong>
            {servicosSel.map((s,i)=><div key={i}>• {s}</div>)}
            {descricaoExtra&&<div style={{fontStyle:"italic",marginTop:4}}>{descricaoExtra}</div>}
          </div>
          <AssinaturaDigital label="Assinatura do prestador de serviço" assinatura={assinPrestador} onChange={setAssinPrestador}/>
          <div style={{display:"flex",gap:8}}>
            <button className="btn" onClick={()=>setPasso(1)}>← Voltar</button>
            <button className="btn btn-primary" style={{flex:1,justifyContent:"center"}} onClick={avancar}>Próximo →</button>
          </div>
        </>
      )}

      {/* PASSO 3 — Assinatura gerente */}
      {passo===3 && (
        <>
          <div className="alert alert-warning" style={{fontSize:12}}>
            📱 <strong>Entregue o celular ao gerente da agência</strong> para assinar. A localização do dispositivo será solicitada para autenticar a identidade do responsável.
          </div>
          <div className="form-group">
            <label className="required">Nome do gerente</label>
            <input value={nomeGerente} onChange={e=>setNomeGerente(e.target.value)} placeholder="Nome completo"/>
          </div>
          <AssinaturaDigital
            label="Assinatura do gerente da agência"
            assinatura={assinGerente}
            onChange={setAssinGerente}
            requererLocalizacao
            geoInicial={geoGerente}
            onGeoChange={setGeoGerente}
          />
          <div style={{display:"flex",gap:8}}>
            <button className="btn" onClick={()=>setPasso(2)}>← Voltar</button>
            <button className="btn btn-primary" style={{flex:1,justifyContent:"center"}} onClick={finalizar}>✓ Finalizar OS</button>
          </div>
        </>
      )}
    </div>
  );
}
