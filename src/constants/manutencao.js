// src/constants/manutencao.js
export const CHECKLIST_ITENS = [
  "Elétrica — tomadas e interruptores","Elétrica — quadro de distribuição","Elétrica — iluminação",
  "Hidráulica — torneiras e metais","Hidráulica — vasos e louças","Hidráulica — tubulação visível",
  "Ar-condicionado — filtros limpos","Ar-condicionado — funcionamento","Cabeamento — pontos de rede",
  "Cabeamento — rack e patch panel","Pintura — paredes e teto","Piso — estado geral",
  "Forro — estado geral","Portas e fechaduras","Controle de acesso","CFTV — câmeras",
  "Sinalização de emergência","Extintores — validade","Limpeza geral",
];

export const DESCRITIVOS_PRONTOS = [
  "Substituição de lâmpadas queimadas","Troca de tomadas/interruptores defeituosos",
  "Reparo no quadro elétrico","Manutenção de ar-condicionado — filtros",
  "Reparo de vazamento hidráulico","Substituição de torneiras/metais",
  "Reparo em forro/gesso danificado","Fixação de revestimentos soltos",
  "Reparo em porta/fechadura/dobradiça","Manutenção de cabeamento estruturado",
  "Reparo em câmera CFTV","Substituição de equipamento de acesso",
  "Pintura corretiva","Rejunte e silicone em banheiros","Revisão geral preventiva",
];

export const STATUS_MANUTENCAO = ["ABERTA","EM ANDAMENTO","CONCLUÍDA","CANCELADA","AGUARDANDO PEÇAS"];
export const TIPOS_MANUTENCAO  = ["corretiva","preventiva","preditiva","emergencial"];
export const PRIORIDADES       = ["baixa","normal","alta","urgente"];

export const CAMPOS_CUSTOM_PADRAO = { protocolo:"", centroCusto:"", ref:"" };
