import React, { useState, useCallback } from "react";

// Hook que retorna um modal de confirmação estilizado + função confirm()
// Uso: const { confirmModal, confirm } = useConfirm();
//      const ok = await confirm({ titulo, mensagem, confirmLabel?, tipo? });
//      if (ok) { ... }

export function useConfirm() {
  const [cfg, setCfg] = useState(null);
  const resolveRef = React.useRef(null);

  const confirm = useCallback(({ titulo, mensagem, confirmLabel = "Confirmar", tipo = "danger" }) => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setCfg({ titulo, mensagem, confirmLabel, tipo });
    });
  }, []);

  function responder(ok) {
    setCfg(null);
    resolveRef.current?.(ok);
  }

  const corBtn   = tipo => tipo === "danger" ? "var(--vermelho)" : tipo === "warning" ? "#C9A200" : "var(--afine-yellow)";
  const corBtnTx = tipo => tipo === "danger" ? "#fff" : "#1A1A1A";

  const confirmModal = cfg ? (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"var(--branco)",borderRadius:12,padding:24,maxWidth:380,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,.18)"}}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:8,color:"var(--afine-black)"}}>{cfg.titulo}</div>
        <div style={{fontSize:14,color:"var(--cinza-med)",marginBottom:20,lineHeight:1.5}}>{cfg.mensagem}</div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button className="btn" onClick={()=>responder(false)}>Cancelar</button>
          <button className="btn" onClick={()=>responder(true)}
            style={{background:corBtn(cfg.tipo),color:corBtnTx(cfg.tipo),border:"none",fontWeight:700}}>
            {cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmModal };
}
