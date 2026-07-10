// src/hooks/useFinanceiroKPIs.js — KPIs financeiros memoizados
import { useMemo } from "react";

export function useFinanceiroKPIs(lancs) {
  const hoje = new Date().toISOString().split("T")[0];
  return useMemo(() => {
    // "em aberto" = ABERTO ou VENCIDO (ainda não pago/recebido)
    const emAberto = s => ["ABERTO","VENCIDO"].includes(s);
    const pago     = s => ["PAGO","RECEBIDO"].includes(s);

    const totalRec  = lancs.filter(l=>l.tipo==="RECEBER"&&emAberto(l.status)).reduce((s,l)=>s+(l.valor||0),0);
    const totalPag  = lancs.filter(l=>l.tipo==="PAGAR"  &&emAberto(l.status)).reduce((s,l)=>s+(l.valor||0),0);
    const totalPago = lancs.filter(l=>l.tipo==="PAGAR"  &&pago(l.status)).reduce((s,l)=>s+(l.valor||0),0);
    // Vencidos: status VENCIDO OU ABERTO com data de vencimento passada
    const vencidos  = lancs.filter(l=>emAberto(l.status)&&(l.status==="VENCIDO"||(l.vencimento&&l.vencimento<hoje)));
    const saldo     = totalRec - totalPag;
    const fluxo6m   = Array.from({length:6},(_,i)=>{
      const d=new Date(); d.setMonth(d.getMonth()+i);
      const m=d.toISOString().slice(0,7);
      const rec=lancs.filter(l=>l.tipo==="RECEBER"&&emAberto(l.status)&&(l.vencimento||"").startsWith(m)).reduce((s,l)=>s+(l.valor||0),0);
      const pag=lancs.filter(l=>l.tipo==="PAGAR"  &&emAberto(l.status)&&(l.vencimento||"").startsWith(m)).reduce((s,l)=>s+(l.valor||0),0);
      const meses=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      return {label:meses[d.getMonth()],valor:rec-pag,rec,pag};
    });
    return { totalRec, totalPag, totalPago, saldo, vencidos, vencidosCount: vencidos.length, fluxo6m };
  }, [lancs, hoje]);
}
