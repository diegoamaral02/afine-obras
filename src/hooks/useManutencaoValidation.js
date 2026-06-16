// src/hooks/useManutencaoValidation.js
import { useMemo } from "react";

const MIN_FOTOS = 15;

export function useManutencaoValidation(form, fotos, osDigital) {
  return useMemo(() => {
    const isItau = /ita[uú]/i.test(form.cliente || "");
    const otOk   = !isItau || form.semOT || (form.numeroOT || "").trim().length > 0;
    const fotosOk = (fotos || []).length >= MIN_FOTOS;
    const osOk    = !!osDigital;
    const endOk   = !!(form.logradouro && form.numero && form.cep);
    const matOk   = (form.materiais || []).length > 0;
    const podeConcluir = fotosOk && osOk && otOk && endOk && matOk;
    const erros = [];
    if (!fotosOk)   erros.push(`• ${MIN_FOTOS} fotos obrigatórias (você tem ${(fotos||[]).length})`);
    if (!osOk)      erros.push("• OS digital assinada");
    if (!otOk)      erros.push("• Número da OT ou S/OT");
    if (!endOk)     erros.push("• Endereço completo (CEP, logradouro, número)");
    if (!matOk)     erros.push("• Ao menos 1 material utilizado");
    return { isItau, otOk, fotosOk, osOk, endOk, matOk, podeConcluir, erros, MIN_FOTOS };
  }, [form, fotos, osDigital]);
}
