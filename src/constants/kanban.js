// src/constants/kanban.js
export const COLUNAS_FUNIL = [
  { id:"PROSPECTO",      titulo:"Prospecto",        cor:"#4A4A4A", icone:"👁️" },
  { id:"NEGOCIACAO",     titulo:"Negociação",        cor:"#185FA5", icone:"🤝" },
  { id:"PROPOSTA",       titulo:"Proposta enviada",  cor:"#C9A200", icone:"📄" },
  { id:"CONTRATO",       titulo:"Contrato fechado",  cor:"#2D6A1F", icone:"✅" },
  { id:"PERDIDO",        titulo:"Perdido",           cor:"#B83232", icone:"❌" },
];

export const COLUNAS_COMPRAS = [
  { id:"SOLICITAÇÃO",     titulo:"Solicitação",      cor:"#4A4A4A", icone:"📝" },
  { id:"COTAÇÃO",         titulo:"Em cotação",        cor:"#185FA5", icone:"💬" },
  { id:"APROVADA",        titulo:"Aprovada",          cor:"#C9A200", icone:"✅" },
  { id:"ORDEM DE COMPRA", titulo:"Ordem de Compra",  cor:"#7B4F00", icone:"📋" },
  { id:"RECEBIDO",        titulo:"Recebido",          cor:"#2D6A1F", icone:"📦" },
  { id:"NF VINCULADA",    titulo:"NF Vinculada",      cor:"#1A5A10", icone:"🧾" },
];

export const COLUNAS_OBRAS = [
  { id:"A FAZER",        titulo:"A fazer",           cor:"#4A4A4A", icone:"📋" },
  { id:"EM ANDAMENTO",   titulo:"Em andamento",      cor:"#185FA5", icone:"⚡" },
  { id:"IMPEDIMENTO",    titulo:"Impedimento",       cor:"#B83232", icone:"🚫" },
  { id:"CONCLUÍDO",      titulo:"Concluído",         cor:"#2D6A1F", icone:"✅" },
];
