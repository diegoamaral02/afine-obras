// src/constants/departamentos.js
// Definição completa de departamentos, permissões de menu e acesso por módulo

export const DEPARTAMENTOS = [
  { id:"gestao",      label:"Gestão",      cor:"#1A1A1A", icone:"👑" },
  { id:"financeiro",  label:"Financeiro",  cor:"#2D6A1F", icone:"💰" },
  { id:"comercial",   label:"Comercial",   cor:"#185FA5", icone:"📈" },
  { id:"compras",     label:"Compras",     cor:"#7B4F00", icone:"🛒" },
  { id:"fiscal",      label:"Fiscal",      cor:"#C9A200", icone:"🔍" },
  { id:"campo",       label:"Campo",       cor:"#4A4A4A", icone:"🏗️" },
  { id:"adm",         label:"ADM (Master)",cor:"#B83232", icone:"🔐" },
];

// ─── Mapa de acesso por departamento ─────────────────────────────────────────
// Estrutura: { ver: bool, editar: bool } por módulo
// Módulos: painel | comercial | clientes | fornecedores | obras | medicao |
//          manutencao | diario | ocorrencias | compras | materiais |
//          financeiro | dre | equipe | funcionarios | calendario

export const ACESSO = {

  adm: {
    // ADM: acesso master a tudo
    painel:true, comercial:true, clientes:true, fornecedores:true,
    obras:true, medicao:true, manutencao:true, diario:true, ocorrencias:true,
    compras:true, materiais:true,
    financeiro:true, dre:true, despesas:true,
    equipe:true, funcionarios:true, calendario:true,
    // Compras: pode fazer tudo
    compras_etapas: ["SOLICITAÇÃO","COTAÇÃO","APROVADA","ORDEM DE COMPRA","RECEBIDO","NF VINCULADA"],
    podeAprovarCompra: true,
    isAdm: true,
  },

  gestao: {
    // Gestão: ver e editar principal / comercial / operação / suprimentos / financeiro / pessoas
    painel:true, comercial:true, clientes:true, fornecedores:true,
    obras:true, medicao:true, manutencao:true, diario:true, ocorrencias:true,
    compras:true, materiais:true,
    financeiro:true, dre:true, despesas:true,
    equipe:true, funcionarios:true, calendario:true,
    compras_etapas: ["SOLICITAÇÃO","COTAÇÃO","APROVADA","ORDEM DE COMPRA","RECEBIDO","NF VINCULADA"],
    podeAprovarCompra: true,
    isAdm: false,
  },

  financeiro: {
    // Financeiro: vê tudo, edita só financeiro e compras
    painel:true,    comercial:"ver",  clientes:"ver",  fornecedores:"ver",
    obras:"ver",    medicao:"ver",    manutencao:"ver", diario:"ver",    ocorrencias:"ver",
    compras:true,   materiais:"ver",
    financeiro:true, dre:true, despesas:true,
    equipe:"ver",   funcionarios:"ver", calendario:"ver",
    compras_etapas: ["COTAÇÃO","ORDEM DE COMPRA","NF VINCULADA"],
    podeAprovarCompra: false,
    isAdm: false,
  },

  comercial: {
    // Comercial: vê tudo, edita comercial / operação / suprimentos / lançamentos
    painel:true,    comercial:true,   clientes:true,   fornecedores:true,
    obras:true,     medicao:true,     manutencao:true, diario:true,     ocorrencias:true,
    compras:true,   materiais:true,
    financeiro:true, dre:"ver", despesas:"ver",
    equipe:true,    funcionarios:"ver", calendario:true,
    compras_etapas: ["SOLICITAÇÃO","COTAÇÃO","RECEBIDO"],
    podeAprovarCompra: false,
    isAdm: false,
  },

  fiscal: {
    // Fiscal: ver e editar principal / comercial / operação / suprimentos / financeiro (lançamentos) / pessoas
    painel:true,    comercial:true,   clientes:true,   fornecedores:true,
    obras:true,     medicao:true,     manutencao:true, diario:true,     ocorrencias:true,
    compras:"ver",  materiais:true,
    financeiro:true, dre:"ver", despesas:"ver",
    equipe:true,    funcionarios:"ver", calendario:true,
    compras_etapas: ["SOLICITAÇÃO"], // fiscal só abre solicitação
    podeAprovarCompra: false,
    isAdm: false,
  },

  campo: {
    // Campo: ver e editar o que já se aplica (operação básica)
    painel:true,    comercial:"ver",  clientes:"ver",  fornecedores:"ver",
    obras:"ver",    medicao:"ver",    manutencao:true, diario:true,     ocorrencias:true,
    compras:"ver",  materiais:"ver",
    financeiro:"ver", dre:"ver",
    equipe:"ver",   funcionarios:"ver", calendario:"ver",
    compras_etapas: ["SOLICITAÇÃO"],
    podeAprovarCompra: false,
    isAdm: false,
  },

  compras: {
    // Compras: operação de suprimentos
    painel:true,    comercial:"ver",  clientes:"ver",  fornecedores:true,
    obras:"ver",    medicao:"ver",    manutencao:"ver", diario:"ver",   ocorrencias:"ver",
    compras:true,   materiais:true,
    financeiro:"ver", dre:"ver",
    equipe:"ver",   funcionarios:"ver", calendario:"ver",
    compras_etapas: ["SOLICITAÇÃO","COTAÇÃO","ORDEM DE COMPRA","RECEBIDO","NF VINCULADA"],
    podeAprovarCompra: false,
    isAdm: false,
  },
};

// Helper: retorna acesso de um usuário
export function getAcesso(userProfile) {
  if (!userProfile) return ACESSO.campo;
  const dep = userProfile.departamento || userProfile.perfil || "campo";
  if (userProfile.adm === true) return ACESSO.adm;
  return ACESSO[dep] || ACESSO.campo;
}

// Helper: pode editar um módulo?
export function podeEditar(userProfile, modulo) {
  const ac = getAcesso(userProfile);
  return ac[modulo] === true;
}

// Helper: pode ver um módulo?
export function podeVer(userProfile, modulo) {
  const ac = getAcesso(userProfile);
  return ac[modulo] === true || ac[modulo] === "ver";
}

// Helper: o usuário é do departamento Campo? (considera tanto o sistema novo
// "departamento" quanto o legado "perfil" — usado para restringir Home, Equipe
// e criação de manutenção a partir do app móvel de campo)
export function isCampo(userProfile) {
  if (!userProfile) return true;
  if (userProfile.adm === true) return false;
  const dep = userProfile.departamento || userProfile.perfil || "campo";
  return dep === "campo";
}

// Departamento efetivo do usuário, com ADM Master sempre resolvendo para "adm"
// BUG CORRIGIDO: contas antigas usam o campo legado perfil:"gestor" (sem
// "departamento" definido). Sem este mapeamento, "gestor" (legado) não batia
// com "gestao" (novo id), fazendo o checkbox de privacidade e o botão "Só
// minha agenda" não aparecerem para esses usuários.
export function getDepartamentoEfetivo(userProfile) {
  if (!userProfile) return "campo";
  if (userProfile.adm === true) return "adm";
  const dep = userProfile.departamento || userProfile.perfil || "campo";
  if (dep === "gestor") return "gestao";
  return dep;
}

// Regras de agenda por departamento:
// - Gestão, Financeiro e ADM: a agenda que eles criam fica PRIVADA por padrão
//   (só quem criou vê) até que marquem explicitamente "disponibilizar para todos".
// - Fiscal, Gestão e ADM: têm a opção de filtrar a visão do calendário para
//   "mostrar apenas minha agenda" (Campo já é restrito sem opção; Financeiro e
//   Compras sempre veem todas as agendas não-privadas, sem esse filtro).
export function agendaPrivadaPorPadrao(userProfile) {
  return ["gestao","financeiro","adm"].includes(getDepartamentoEfetivo(userProfile));
}
export function temFiltroSoMinhaAgenda(userProfile) {
  return ["fiscal","gestao","adm"].includes(getDepartamentoEfetivo(userProfile));
}

// ─── Classificação em 3 "baldes" usada para organizar o MENU (App.js) ───────
// Fonte única de verdade: tanto o menu quanto as páginas usam estas funções,
// em vez de cada lugar reimplementar sua própria leitura de departamento/perfil
// (foi exatamente essa duplicação que causou bugs como "gestor" não bater com
// "gestao" em telas diferentes).
export function isGestorOuAdm(userProfile) {
  const dep = getDepartamentoEfetivo(userProfile);
  return dep === "gestao" || dep === "adm";
}
export function isNivelIntermediario(userProfile) {
  const dep = getDepartamentoEfetivo(userProfile);
  return ["financeiro","comercial","fiscal","compras","encarregado"].includes(dep);
}
// "gestor" | "encarregado" | "campo" — usado para visibilidade de itens de menu
export function resolverPerfilMenu(userProfile) {
  if (isGestorOuAdm(userProfile)) return "gestor";
  if (isNivelIntermediario(userProfile)) return "encarregado";
  return "campo";
}
