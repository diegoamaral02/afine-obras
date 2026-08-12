// src/utils/sla.js

export function calcularSLA(manutencao, regras) {
  const regra = regras?.find(r => r.urgencia === manutencao.urgencia);
  if (!regra) return null;

  const inicio = new Date(manutencao.createdAt || manutencao.dataAbertura || Date.now());
  const deadline = new Date(inicio.getTime() + regra.horasMaximas * 3600000);
  const agora = new Date();

  const totalMs = deadline - inicio;
  const restanteMs = deadline - agora;
  const percentual = Math.max(0, Math.min(100, (restanteMs / totalMs) * 100));
  const horasRestantes = restanteMs / 3600000;

  let status;
  if (["CONCLUÍDA", "CANCELADA"].includes(manutencao.status)) {
    status = horasRestantes >= 0 ? "cumprido" : "vencido";
  } else if (horasRestantes < 0) {
    status = "vencido";
  } else if (percentual < 20) {
    status = "em_risco";
  } else {
    status = "no_prazo";
  }

  return { status, horasRestantes, percentual, cor: regra.cor, deadline, horasMaximas: regra.horasMaximas };
}

export function formatarTempoSLA(horasRestantes) {
  if (horasRestantes < 0) {
    const h = Math.abs(horasRestantes);
    if (h < 24) return `${Math.round(h)}h atrasado`;
    return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h atrasado`;
  }
  if (horasRestantes < 24) return `${Math.round(horasRestantes)}h restantes`;
  return `${Math.floor(horasRestantes / 24)}d ${Math.round(horasRestantes % 24)}h restantes`;
}

export const SLA_DEFAULTS = [
  { urgencia: "EMERGÊNCIA",  horasMaximas: 4,   cor: "#B83232" },
  { urgencia: "URGENTE",     horasMaximas: 24,  cor: "#E07B00" },
  { urgencia: "NORMAL",      horasMaximas: 72,  cor: "#185FA5" },
  { urgencia: "PROGRAMADA",  horasMaximas: 168, cor: "#2D6A1F" },
];
