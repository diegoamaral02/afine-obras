// src/hooks/useDRE.js — lógica de DRE memoizada
import { useMemo } from "react";

export function useDRE(lancs, obraId) {
  return useMemo(() => {
    const l = obraId ? lancs.filter(x => x.obraId === obraId) : lancs;
    const receita    = l.filter(x=>x.tipo==="RECEBER"&&x.status==="PAGO").reduce((s,x)=>s+(x.valor||0),0);
    const custoDir   = l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
    const custInd    = l.filter(x=>x.tipo==="PAGAR"&&x.status==="PAGO"&&!["Materiais","Mão de obra","Subempreiteiro"].includes(x.categoria)).reduce((s,x)=>s+(x.valor||0),0);
    const margBruta  = receita - custoDir;
    const margLiq    = margBruta - custInd;
    const recAbert   = l.filter(x=>x.tipo==="RECEBER"&&x.status==="ABERTO").reduce((s,x)=>s+(x.valor||0),0);
    const pagAbert   = l.filter(x=>x.tipo==="PAGAR"&&x.status==="ABERTO").reduce((s,x)=>s+(x.valor||0),0);
    const margBrutaPct = receita>0 ? Math.round(margBruta/receita*100) : 0;
    const margLiqPct   = receita>0 ? Math.round(margLiq/receita*100)   : 0;
    return { receita, custoDir, custInd, margBruta, margLiq, recAbert, pagAbert, margBrutaPct, margLiqPct };
  }, [lancs, obraId]);
}
