// src/pages/SeedPage.js — Página de seed de dados de teste (só acessível em NODE_ENV=development)
import React, { useState } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const agora = () => new Date().toISOString();
const d = (offset) => {
  const x = new Date();
  x.setDate(x.getDate() + offset);
  return x.toISOString().split("T")[0];
};

// ── DADOS DE SEED ─────────────────────────────────────────────────────────────

function gerarObras() {
  return [
    { nome:"Reforma Agência Centro SP", tipo:"Reforma geral", cliente:"Banco AFINE", clienteId:"test-cliente-1", agenciaId:"test-ag-1", agenciaNome:"0001 Centro SP", responsavelNome:"Diego Amaral", contrato:"CTR-2024-001", area:850, status:"EM ANDAMENTO", progresso:65, inicio:d(-45), termino:d(30), valorOrcamento:280000, orcamentoEnviado:"SIM", relatorioEnviado:"PENDENTE", cep:"01310-100", logradouro:"Av. Paulista", numero:"1000", bairro:"Bela Vista", cidade:"São Paulo", uf:"SP", obs:"Obra em andamento conforme cronograma.", materiais:[], semMaterial:false, fotos:[], checklist:{}, createdAt:agora(), updatedAt:agora() },
    { nome:"Retrofit Agência Paulista", tipo:"Retrofit", cliente:"Banco AFINE", clienteId:"test-cliente-1", agenciaId:"test-ag-2", agenciaNome:"0002 Paulista", responsavelNome:"Ana Lima", contrato:"CTR-2024-002", area:620, status:"CONCLUÍDA", progresso:100, inicio:d(-120), termino:d(-15), conclusaoReal:d(-12), valorOrcamento:195000, orcamentoEnviado:"SIM", relatorioEnviado:"SIM", cep:"01311-200", logradouro:"Av. Paulista", numero:"2000", bairro:"Bela Vista", cidade:"São Paulo", uf:"SP", obs:"Obra concluída e entregue ao cliente.", materiais:[], semMaterial:true, motivoSemMaterial:"Retrofit sem reposição de materiais.", fotos:[], checklist:{}, createdAt:agora(), updatedAt:agora() },
    { nome:"Adequação Agência Campinas", tipo:"Adequação", cliente:"Banco AFINE", clienteId:"test-cliente-1", agenciaId:"test-ag-3", agenciaNome:"0003 Campinas Centro", responsavelNome:"Carlos Silva", contrato:"CTR-2024-003", area:430, status:"PARALISADA", progresso:38, inicio:d(-60), termino:d(-10), valorOrcamento:142000, orcamentoEnviado:"SIM", relatorioEnviado:"NÃO", cep:"13010-110", logradouro:"Rua Marechal Deodoro", numero:"590", bairro:"Centro", cidade:"Campinas", uf:"SP", obs:"Paralisada por pendência documental com a prefeitura.", materiais:[], semMaterial:false, fotos:[], checklist:{}, createdAt:agora(), updatedAt:agora() },
    { nome:"Instalação Agência Santos", tipo:"Instalação", cliente:"Banco AFINE", clienteId:"test-cliente-1", agenciaId:"test-ag-4", agenciaNome:"0004 Santos Gonzaga", responsavelNome:"Diego Amaral", contrato:"CTR-2024-004", area:310, status:"PLANEJAMENTO", progresso:0, inicio:d(15), termino:d(90), valorOrcamento:98000, orcamentoEnviado:"PENDENTE", relatorioEnviado:"NÃO", cep:"11060-200", logradouro:"Av. Ana Costa", numero:"300", bairro:"Gonzaga", cidade:"Santos", uf:"SP", obs:"Projeto aprovado — aguardando mobilização.", materiais:[], semMaterial:false, fotos:[], checklist:{}, createdAt:agora(), updatedAt:agora() },
    { nome:"Ampliação Agência Ribeirão Preto", tipo:"Ampliação", cliente:"Banco AFINE", clienteId:"test-cliente-1", agenciaId:"test-ag-5", agenciaNome:"0005 Ribeirão Preto", responsavelNome:"Ana Lima", contrato:"CTR-2024-005", area:1100, status:"AGUARDANDO APROVAÇÃO", progresso:0, inicio:d(30), termino:d(150), valorOrcamento:520000, orcamentoEnviado:"SIM", relatorioEnviado:"NÃO", cep:"14010-100", logradouro:"Av. Jerônimo Gonçalves", numero:"800", bairro:"Centro", cidade:"Ribeirão Preto", uf:"SP", obs:"Orçamento enviado, aguardando aprovação da diretoria.", materiais:[], semMaterial:false, fotos:[], checklist:{}, createdAt:agora(), updatedAt:agora() },
  ];
}

function gerarManutencoes(obraIds) {
  return [
    { titulo:"Vazamento hidráulico cozinha", cliente:"Banco AFINE", clienteId:"test-cliente-1", agencia:"0001 Centro SP", agenciaId:"test-ag-1", tipo:"corretiva", prioridade:"urgente", status:"ABERTA", numeroOT:"OT-2024-001", responsavelNome:"Diego Amaral", alocadoIds:[], alocadoNomes:[], cep:"01310-100", logradouro:"Av. Paulista", numero:"1000", bairro:"Bela Vista", cidade:"São Paulo", uf:"SP", dataAbertura:d(-3), dataPrevista:d(2), garantia:"NÃO", descProntas:["Verificação do sistema hidráulico"], descExtras:[], descExtra:"Vazamento na tubulação sob a pia da copa.", obs:"Urgente — área interditada.", materiais:[], semMaterial:false, fotos:[], checklist:{}, obraId:obraIds[0]||null, createdAt:agora(), updatedAt:agora() },
    { titulo:"Substituição ar condicionado split", cliente:"Banco AFINE", clienteId:"test-cliente-1", agencia:"0002 Paulista", agenciaId:"test-ag-2", tipo:"corretiva", prioridade:"alta", status:"EM ANDAMENTO", numeroOT:"OT-2024-002", responsavelNome:"Ana Lima", alocadoIds:[], alocadoNomes:["Carlos Técnico"], cep:"01311-200", logradouro:"Av. Paulista", numero:"2000", bairro:"Bela Vista", cidade:"São Paulo", uf:"SP", dataAbertura:d(-7), dataPrevista:d(1), garantia:"NÃO", descProntas:["Instalação de ar condicionado"], descExtras:[], descExtra:"Split 12.000 BTUs com instalação e carga de gás.", obs:"Equipamento já entregue.", materiais:[{nome:"Split 12k BTU",qtd:1,un:"un"},{nome:"Cano cobre 3/8",qtd:4,un:"m"}], semMaterial:false, fotos:[], checklist:{}, obraId:obraIds[1]||null, createdAt:agora(), updatedAt:agora() },
    { titulo:"Reparo rede elétrica - disjuntores", cliente:"Banco AFINE", clienteId:"test-cliente-1", agencia:"0003 Campinas Centro", agenciaId:"test-ag-3", tipo:"corretiva", prioridade:"normal", status:"CONCLUÍDA", numeroOT:"OT-2024-003", responsavelNome:"Carlos Silva", alocadoIds:[], alocadoNomes:["João Eletricista"], cep:"13010-110", logradouro:"Rua Marechal Deodoro", numero:"590", bairro:"Centro", cidade:"Campinas", uf:"SP", dataAbertura:d(-30), dataPrevista:d(-22), dataConclusao:d(-23), garantia:"SIM", vencGarantia:d(335), descProntas:["Reparo elétrico geral"], descExtras:[], descExtra:"Substituição de 4 disjuntores do QDL principal.", obs:"Serviço concluído com teste de carga aprovado.", materiais:[{nome:"Disjuntor 25A",qtd:4,un:"un"}], semMaterial:false, fotos:[], checklist:{}, obraId:obraIds[2]||null, concluidaEm:agora(), createdAt:agora(), updatedAt:agora() },
    { titulo:"Pintura fachada externa", cliente:"Banco AFINE", clienteId:"test-cliente-1", agencia:"0004 Santos Gonzaga", agenciaId:"test-ag-4", tipo:"preventiva", prioridade:"baixa", status:"CANCELADA", semOT:true, numeroOT:"", responsavelNome:"Diego Amaral", alocadoIds:[], alocadoNomes:[], cep:"11060-200", logradouro:"Av. Ana Costa", numero:"300", bairro:"Gonzaga", cidade:"Santos", uf:"SP", dataAbertura:d(-50), dataPrevista:d(-35), garantia:"NÃO", descProntas:["Pintura fachada"], descExtras:[], descExtra:"Pintura externa com tinta acrílica premium.", obs:"Cancelado — cliente optou por escopo reduzido.", materiais:[], semMaterial:false, fotos:[], checklist:{}, obraId:null, concluidaEm:agora(), createdAt:agora(), updatedAt:agora() },
    { titulo:"Troca de bomba de recalque", cliente:"Banco AFINE", clienteId:"test-cliente-1", agencia:"0005 Ribeirão Preto", agenciaId:"test-ag-5", tipo:"corretiva", prioridade:"alta", status:"AGUARDANDO PEÇAS", numeroOT:"OT-2024-005", responsavelNome:"Ana Lima", alocadoIds:[], alocadoNomes:[], cep:"14010-100", logradouro:"Av. Jerônimo Gonçalves", numero:"800", bairro:"Centro", cidade:"Ribeirão Preto", uf:"SP", dataAbertura:d(-10), dataPrevista:d(5), garantia:"NÃO", descProntas:["Reparo hidráulico"], descExtras:[], descExtra:"Bomba de recalque 1CV com kit de vedação.", obs:"Aguardando chegada da bomba — fornecedor em 5 dias.", materiais:[], semMaterial:false, fotos:[], checklist:{}, obraId:null, createdAt:agora(), updatedAt:agora() },
  ];
}

function gerarCompras(obraIds, manutIds) {
  return [
    { titulo:"Materiais elétricos básicos QDL", demandaTipo:"obra", demandaId:obraIds[0]||"", demandaNome:"Reforma Agência Centro SP", urgencia:"alta", status:"SOLICITAÇÃO", itens:[{nome:"Cabo 2.5mm²",qtd:100,un:"m"},{nome:"Disjuntor 16A",qtd:10,un:"un"},{nome:"Tomada 10A",qtd:20,un:"un"}], obs:"Necessário para 1ª fase elétrica.", autorNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { titulo:"Cabo UTP Cat.6 infraestrutura", demandaTipo:"obra", demandaId:obraIds[0]||"", demandaNome:"Reforma Agência Centro SP", urgencia:"normal", status:"APROVADA", itens:[{nome:"Cabo UTP Cat.6",qtd:500,un:"m"},{nome:"Patch panel 24p",qtd:2,un:"un"},{nome:"Conector RJ45",qtd:200,un:"un"}], fornecedorNome:"TecnoRede Distribuidora", valorCotado:4800, prazoEntrega:d(7), obsCotacao:"Melhor preço com prazo OK.", valorAprovado:4800, formaPagamento:"30 dias", obsAprovacao:"Aprovado — alinhado com budget.", autorNome:"Ana Lima", atorSolicitacao:"Diego Amaral", solicitadoEm:agora(), atorCotacao:"Ana Lima", cotadoEm:agora(), atorAprovacao:"Diego Amaral", aprovadoEm:agora(), createdAt:agora(), updatedAt:agora() },
    { titulo:"Tomadas e interruptores ambientes", demandaTipo:"manutencao", demandaId:manutIds[0]||"", demandaNome:"Vazamento hidráulico cozinha", urgencia:"urgente", status:"ORDEM DE COMPRA", itens:[{nome:"Tomada dupla 20A",qtd:15,un:"un"},{nome:"Interruptor simples",qtd:10,un:"un"},{nome:"Placa 4x2",qtd:25,un:"un"}], fornecedorNome:"Elétrica Total", valorCotado:1250, prazoEntrega:d(3), valorAprovado:1250, formaPagamento:"À vista", numeroPedido:"OC-2024-003", prazoOC:d(3), obsOC:"Entrega expressa confirmada.", autorNome:"Carlos Silva", atorSolicitacao:"Carlos Silva", solicitadoEm:agora(), atorCotacao:"Ana Lima", cotadoEm:agora(), atorAprovacao:"Diego Amaral", aprovadoEm:agora(), atorOC:"Diego Amaral", ocEm:agora(), createdAt:agora(), updatedAt:agora() },
    { titulo:"Tintas e solventes acabamento", demandaTipo:"obra", demandaId:obraIds[1]||"", demandaNome:"Retrofit Agência Paulista", urgencia:"normal", status:"RECEBIDO", itens:[{nome:"Tinta Branca Acrilux 18L",qtd:10,un:"cx"},{nome:"Massa corrida PVA 25kg",qtd:5,un:"saco"},{nome:"Solvente 5L",qtd:3,un:"litro"}], fornecedorNome:"Tintas Master", valorCotado:3200, prazoEntrega:d(-10), valorAprovado:3200, formaPagamento:"30/60", numeroPedido:"OC-2024-004", tipoReceb:"conforme", dataRecebimento:d(-8), obsReceb:"Recebido conforme pedido — sem avarias.", estoqueLancado:true, autorNome:"Ana Lima", atorSolicitacao:"Ana Lima", solicitadoEm:agora(), atorCotacao:"Carlos Silva", cotadoEm:agora(), atorAprovacao:"Diego Amaral", aprovadoEm:agora(), atorOC:"Diego Amaral", ocEm:agora(), atorRecebimento:"Ana Lima", recebidoEm:agora(), createdAt:agora(), updatedAt:agora() },
    { titulo:"NF vinculada — parafusos e ferragens", demandaTipo:"obra", demandaId:obraIds[2]||"", demandaNome:"Adequação Agência Campinas", urgencia:"baixa", status:"NF VINCULADA", itens:[{nome:"Parafuso M6x30",qtd:500,un:"un"},{nome:"Bucha S8",qtd:500,un:"un"},{nome:"Abraçadeira 1/2",qtd:100,un:"un"}], fornecedorNome:"Ferragens Silva", valorCotado:890, prazoEntrega:d(-20), valorAprovado:890, formaPagamento:"PIX", numeroPedido:"OC-2024-005", tipoReceb:"conforme", dataRecebimento:d(-18), obsReceb:"OK.", numeroNF:"NF-45210", dataNF:d(-17), valorNF:890, obsNF:"NF vinculada ao pedido OC-2024-005.", estoqueLancado:true, autorNome:"Carlos Silva", atorNFVinculada:"Diego Amaral", nfVinculadaEm:agora(), createdAt:agora(), updatedAt:agora() },
  ];
}

function gerarFinanceiro(obraIds) {
  return [
    // PAGAR
    { tipo:"PAGAR", descricao:"Material elétrico — Fase 1 Reforma Centro", categoria:"Materiais", obraId:obraIds[0]||"", obraNome:"Reforma Agência Centro SP", valor:18500, valorPago:0, vencimento:d(10), competencia:new Date().toISOString().slice(0,7), status:"ABERTO", fornecedor:"Elétrica Total Distribuidora", cnpj:"12.345.678/0001-99", numeroNF:"NF-8821", formaPag:"Boleto", tipoValor:"comprometido", autorNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { tipo:"PAGAR", descricao:"Mão de obra subempreiteiro — reforma geral", categoria:"Mão de obra", obraId:obraIds[0]||"", obraNome:"Reforma Agência Centro SP", valor:32000, valorPago:32000, vencimento:d(-20), pagamento:d(-18), competencia:new Date().toISOString().slice(0,7), status:"PAGO", fornecedor:"Alpha Serviços ME", cnpj:"98.765.432/0001-11", formaPag:"PIX", tipoValor:"realizado", obs:"Parcela única quitada via PIX.", autorNome:"Ana Lima", createdAt:agora(), updatedAt:agora() },
    { tipo:"PAGAR", descricao:"Aluguel de andaime tubular 30 dias", categoria:"Aluguel equipamentos", obraId:obraIds[2]||"", obraNome:"Adequação Agência Campinas", valor:4800, valorPago:0, vencimento:d(-8), competencia:new Date().toISOString().slice(0,7), status:"VENCIDO", fornecedor:"Andaimes Express", formaPag:"Boleto", tipoValor:"comprometido", obs:"Nota vencida — acionar fornecedor para renegociação.", autorNome:"Carlos Silva", createdAt:agora(), updatedAt:agora() },
    { tipo:"PAGAR", descricao:"Subempreiteiro hidráulico — 2ª parcela", categoria:"Subempreiteiro", obraId:obraIds[0]||"", obraNome:"Reforma Agência Centro SP", valor:12000, valorPago:6000, vencimento:d(-5), competencia:new Date().toISOString().slice(0,7), status:"PARCIAL", fornecedor:"HidroTec Serviços", cnpj:"55.123.456/0001-44", formaPag:"Transferência", tipoValor:"realizado", obs:"Pago parcialmente — saldo de R$ 6.000 pendente.", autorNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { tipo:"PAGAR", descricao:"Serviço de pintura externa — cancelado", categoria:"Serviços terceiros", obraId:obraIds[1]||"", obraNome:"Retrofit Agência Paulista", valor:8200, valorPago:0, vencimento:d(-30), competencia:new Date().toISOString().slice(0,7), status:"CANCELADO", fornecedor:"Pinturas Rápidas", tipoValor:"orcado", obs:"Serviço não realizado — obra concluída sem este item.", autorNome:"Ana Lima", createdAt:agora(), updatedAt:agora() },
    // RECEBER
    { tipo:"RECEBER", descricao:"Medição BM-01 — Reforma Centro SP", categoria:"Medição / BM", obraId:obraIds[0]||"", obraNome:"Reforma Agência Centro SP", valor:85000, valorPago:0, vencimento:d(15), competencia:new Date().toISOString().slice(0,7), status:"ABERTO", fornecedor:"Banco AFINE", formaPag:"Transferência", tipoValor:"realizado", autorNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { tipo:"RECEBER", descricao:"Adiantamento contratual — Ampliação Ribeirão", categoria:"Adiantamento contratual", obraId:obraIds[4]||"", obraNome:"Ampliação Agência Ribeirão Preto", valor:130000, valorPago:130000, vencimento:d(-15), pagamento:d(-12), competencia:new Date().toISOString().slice(0,7), status:"RECEBIDO", fornecedor:"Banco AFINE", formaPag:"PIX", tipoValor:"realizado", obs:"30% do contrato recebido conforme cronograma.", autorNome:"Ana Lima", createdAt:agora(), updatedAt:agora() },
    { tipo:"RECEBER", descricao:"Saldo contratual BM-02 — Retrofit Paulista", categoria:"Saldo contratual", obraId:obraIds[1]||"", obraNome:"Retrofit Agência Paulista", valor:48000, valorPago:0, vencimento:d(-10), competencia:new Date().toISOString().slice(0,7), status:"VENCIDO", fornecedor:"Banco AFINE", formaPag:"Boleto", tipoValor:"realizado", obs:"Faturamento em aberto — cobrar departamento financeiro do cliente.", autorNome:"Carlos Silva", createdAt:agora(), updatedAt:agora() },
    { tipo:"RECEBER", descricao:"Reembolso despesas — equipe campo Campinas", categoria:"Reembolso despesas", obraId:obraIds[2]||"", obraNome:"Adequação Agência Campinas", valor:3200, valorPago:1600, vencimento:d(-5), competencia:new Date().toISOString().slice(0,7), status:"PARCIAL", fornecedor:"Banco AFINE", formaPag:"PIX", tipoValor:"realizado", obs:"Reembolso parcial recebido — aguardando aprovação da 2ª parcela.", autorNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { tipo:"RECEBER", descricao:"Faturamento serviço extra — cancelado", categoria:"Outros", obraId:obraIds[3]||"", obraNome:"Instalação Agência Santos", valor:15000, valorPago:0, vencimento:d(-45), competencia:new Date().toISOString().slice(0,7), status:"CANCELADO", fornecedor:"Banco AFINE", tipoValor:"orcado", obs:"Escopo extra cancelado pelo cliente na fase de planejamento.", autorNome:"Ana Lima", createdAt:agora(), updatedAt:agora() },
  ];
}

function gerarDespesas(obraIds, manutIds) {
  return [
    { data:d(-1), categoria:"Gasolina", descricao:"Abastecimento visita obra Reforma Centro", valor:180.50, metodoPagamento:"Cartão", cartao:"Cartão AFINE", cartaoPessoal:false, reembolso:false, reembolsado:false, revisado:false, vinculoTipo:"obra", obraId:obraIds[0]||"", obraNome:"Reforma Agência Centro SP", funcionarioNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { data:d(-3), categoria:"Alimentação", descricao:"Almoço equipe manutenção Santos", valor:95.00, metodoPagamento:"PIX", cartaoPessoal:true, reembolso:true, reembolsado:false, revisado:false, vinculoTipo:"manutencao", manutencaoId:manutIds[4]||"", manutencaoTitulo:"Troca de bomba de recalque", funcionarioNome:"Carlos Silva", obs:"3 técnicos — nota fiscal anexada.", createdAt:agora(), updatedAt:agora() },
    { data:d(-5), categoria:"Pedágio", descricao:"Pedágio SP-Interior ida e volta", valor:32.80, metodoPagamento:"Cartão", cartao:"Cartão Vale Pedágio", cartaoPessoal:false, reembolso:false, reembolsado:false, revisado:true, vinculoTipo:"nenhum", funcionarioNome:"Ana Lima", createdAt:agora(), updatedAt:agora() },
    { data:d(-7), categoria:"Hospedagem em atendimento", descricao:"Hotel 2 noites Campinas — adequação agência", valor:420.00, metodoPagamento:"Cartão", cartao:"Cartão AFINE", cartaoPessoal:false, reembolso:false, reembolsado:false, revisado:false, vinculoTipo:"obra", obraId:obraIds[2]||"", obraNome:"Adequação Agência Campinas", funcionarioNome:"Carlos Silva", obs:"Nota fiscal hotel emitida.", createdAt:agora(), updatedAt:agora() },
    { data:d(-10), categoria:"Uniforme e EPI", descricao:"Capacete e luvas para novos técnicos", valor:210.00, metodoPagamento:"PIX", cartaoPessoal:false, reembolso:false, reembolsado:false, revisado:true, vinculoTipo:"manutencao", manutencaoId:manutIds[1]||"", manutencaoTitulo:"Substituição ar condicionado split", funcionarioNome:"Diego Amaral", obs:"EPIs para equipe de campo.", createdAt:agora(), updatedAt:agora() },
  ];
}

function gerarAgendamentos(obraIds, obraNomes, manutIds, manutTitulos) {
  return [
    { titulo:"Vistoria inicial — Reforma Centro SP", demandaTipo:"obra", demandaId:obraIds[0]||"", demandaNome:obraNomes[0]||"", dataInicio:d(2), dataFim:d(2), turno:"manhã", obs:"Vistoria com cliente presente.", funcionarios:[], privado:false, criadorNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { titulo:"Execução elétrica fase 2", demandaTipo:"obra", demandaId:obraIds[0]||"", demandaNome:obraNomes[0]||"", dataInicio:d(5), dataFim:d(7), turno:"integral", obs:"Equipe: João e Pedro.", funcionarios:[], privado:false, criadorNome:"Ana Lima", createdAt:agora(), updatedAt:agora() },
    { titulo:"Manutenção ar condicionado", demandaTipo:"manutencao", demandaId:manutIds[1]||"", demandaNome:manutTitulos[1]||"", dataInicio:d(1), dataFim:d(1), turno:"tarde", obs:"Levar kit de gás R410A.", funcionarios:[], privado:false, criadorNome:"Carlos Silva", createdAt:agora(), updatedAt:agora() },
    { titulo:"Entrega de obra Retrofit Paulista", demandaTipo:"obra", demandaId:obraIds[1]||"", demandaNome:obraNomes[1]||"", dataInicio:d(-12), dataFim:d(-12), turno:"manhã", obs:"Entrega formal com presença do cliente.", funcionarios:[], privado:false, criadorNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { titulo:"Reunião de planejamento — Ribeirão Preto", demandaTipo:"obra", demandaId:obraIds[4]||"", demandaNome:obraNomes[4]||"", dataInicio:d(10), dataFim:d(10), turno:"manhã", obs:"Reunião de kick-off com construtora.", funcionarios:[], privado:false, criadorNome:"Ana Lima", createdAt:agora(), updatedAt:agora() },
  ];
}

function gerarMateriais() {
  return [
    { nome:"Cabo UTP Cat.6", categoria:"Cabeamento", un:"m", saldo:500, estoqueMin:100, totalEntradas:500, totalSaidas:0, createdAt:agora() },
    { nome:"Tomada 10A bipolar", categoria:"Elétrico", un:"un", saldo:80, estoqueMin:20, totalEntradas:100, totalSaidas:20, createdAt:agora() },
    { nome:"Tinta Branca 18L Acrílica", categoria:"Pintura", un:"cx", saldo:15, estoqueMin:5, totalEntradas:20, totalSaidas:5, createdAt:agora() },
    { nome:"Disjuntor Monopolar 16A", categoria:"Elétrico", un:"un", saldo:30, estoqueMin:10, totalEntradas:50, totalSaidas:20, createdAt:agora() },
    { nome:"Cano PVC Soldável 50mm", categoria:"Hidráulico", un:"m", saldo:40, estoqueMin:10, totalEntradas:60, totalSaidas:20, createdAt:agora() },
  ];
}

function gerarMovimentacoes(materialIds, materialNomes) {
  const pick = (arr, i) => arr[i % arr.length] || "";
  return [
    { materialId:pick(materialIds,0), materialNome:pick(materialNomes,0), tipo:"entrada", quantidade:500, demandaTipo:"compra", demandaNome:"Compra inicial estoque", obs:"Entrada inicial de estoque.", data:d(-30), usuario:"Diego Amaral", createdAt:agora() },
    { materialId:pick(materialIds,1), materialNome:pick(materialNomes,1), tipo:"entrada", quantidade:100, demandaTipo:"compra", demandaNome:"Compra inicial estoque", obs:"Entrada via compra aprovada.", data:d(-28), usuario:"Ana Lima", createdAt:agora() },
    { materialId:pick(materialIds,0), materialNome:pick(materialNomes,0), tipo:"saida", quantidade:80, demandaTipo:"obra", demandaNome:"Reforma Agência Centro SP", obs:"Cabeamento estruturado fase 1.", data:d(-10), usuario:"Carlos Silva", createdAt:agora() },
    { materialId:pick(materialIds,3), materialNome:pick(materialNomes,3), tipo:"saida", quantidade:10, demandaTipo:"manutencao", demandaNome:"Reparo rede elétrica", obs:"Substituição disjuntores QDL.", data:d(-23), usuario:"Diego Amaral", createdAt:agora() },
    { materialId:pick(materialIds,2), materialNome:pick(materialNomes,2), tipo:"entrada", quantidade:20, demandaTipo:"compra", demandaNome:"Tintas e solventes acabamento", obs:"Recebimento conforme NF-45210.", data:d(-8), usuario:"Ana Lima", createdAt:agora() },
  ];
}

function gerarOcorrencias(obraIds) {
  return [
    { data:d(-3), tipo:"NÃO-CONFORMIDADE", descricao:"Execução de alvenaria fora de esquadro — desvio de 3cm identificado na vistoria.", acao:"Demolição e reexecução do trecho com acompanhamento do encarregado.", responsavel:"Carlos Silva", prazo:d(5), status:"ABERTA", obraId:obraIds[0]||"", fotos:[], autorNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { data:d(-12), tipo:"ACIDENTE", descricao:"Técnico sofreu corte superficial ao manusear chapa de gesso sem luvas EPI.", acao:"Primeiros socorros prestados no local. CAT emitida. Reforço no uso de EPIs.", responsavel:"Ana Lima", prazo:d(-7), status:"EM TRATAMENTO", obraId:obraIds[0]||"", fotos:[], autorNome:"Diego Amaral", createdAt:agora(), updatedAt:agora() },
    { data:d(-25), tipo:"ATRASO", descricao:"Entrega de materiais elétricos atrasada em 5 dias pelo fornecedor.", acao:"Fornecedor acionado. Replanejamento de cronograma realizado.", responsavel:"Diego Amaral", prazo:d(-20), status:"CONCLUÍDA", obraId:obraIds[2]||"", fotos:[], autorNome:"Carlos Silva", createdAt:agora(), updatedAt:agora() },
    { data:d(-8), tipo:"FALTA DE MATERIAL", descricao:"Estoque de parafusos M6 zerado antes do previsto — consumo maior que o estimado.", acao:"Solicitação de compra emergencial aberta. Material chegou em D+2.", responsavel:"Carlos Silva", prazo:d(-6), status:"CONCLUÍDA", obraId:obraIds[0]||"", fotos:[], autorNome:"Ana Lima", createdAt:agora(), updatedAt:agora() },
    { data:d(-1), tipo:"SEGURANÇA", descricao:"Identificada ausência de sinalização de piso escorregadio na área de obras.", acao:"Fitas de sinalização e cones instalados imediatamente.", responsavel:"Diego Amaral", prazo:d(1), status:"EM TRATAMENTO", obraId:obraIds[1]||"", fotos:[], autorNome:"Carlos Silva", createdAt:agora(), updatedAt:agora() },
  ];
}

function gerarOportunidades() {
  return [
    { titulo:"Retrofit completo Banco BB SP", cliente:"Banco do Brasil", contato:"Marcos Ferreira — (11) 3001-0001", valor:450000, prazo:d(60), coluna:"PROSPECTO", responsavel:"Diego Amaral", tags:["retrofit","SP"], obs:"Primeiro contato realizado. Aguardando brief técnico.", createdAt:agora(), updatedAt:agora() },
    { titulo:"Reforma rede agências Caixa — lote Sul", cliente:"Caixa Econômica Federal", contato:"Patrícia Lima — (11) 3002-0002", valor:1200000, prazo:d(90), coluna:"NEGOCIACAO", responsavel:"Ana Lima", tags:["reforma","lote","sul"], obs:"Em negociação — 3ª reunião agendada.", createdAt:agora(), updatedAt:agora() },
    { titulo:"Adequação layout Itaú Premium 15 agências", cliente:"Itaú Unibanco", contato:"Roberto Souza — (11) 3003-0003", valor:780000, prazo:d(45), coluna:"PROPOSTA", responsavel:"Diego Amaral", tags:["adequação","itaú","layout"], obs:"Proposta técnica enviada. Aguardando análise.", createdAt:agora(), updatedAt:agora() },
    { titulo:"Manutenção preventiva rede Bradesco SP", cliente:"Bradesco", contato:"Fernanda Costa — (11) 3004-0004", valor:320000, prazo:d(30), coluna:"CONTRATO", responsavel:"Carlos Silva", tags:["manutenção","bradesco","preventiva"], obs:"Contrato assinado. Início em 15 dias.", createdAt:agora(), updatedAt:agora() },
    { titulo:"Reforma agências Santander interior", cliente:"Santander", contato:"Eduardo Neves — (11) 3005-0005", valor:650000, prazo:d(-20), coluna:"PERDIDO", responsavel:"Ana Lima", tags:["reforma","santander","interior"], obs:"Perdido para concorrente — preço 12% abaixo.", createdAt:agora(), updatedAt:agora() },
  ];
}

function gerarFornecedores() {
  return [
    { razaoSocial:"Elétrica Total Distribuidora Ltda", nomeFantasia:"Elétrica Total", cnpj:"12.345.678/0001-99", categoria:"Materiais elétricos", contato:"João Silva", email:"joao@eletricatotal.com.br", tel:"(11) 3200-0001", cidade:"São Paulo", uf:"SP", prazoEntrega:"3-5 dias úteis", formaPagamento:"30 dias", status:"ATIVO", obs:"Fornecedor preferencial para materiais elétricos.", createdAt:agora(), updatedAt:agora() },
    { razaoSocial:"TecnoRede Distribuidora ME", nomeFantasia:"TecnoRede", cnpj:"98.765.432/0001-11", categoria:"Cabeamento estruturado", contato:"Carla Mendes", email:"carla@tecnorede.com.br", tel:"(11) 3200-0002", cidade:"São Paulo", uf:"SP", prazoEntrega:"2-4 dias úteis", formaPagamento:"À vista / 30 dias", status:"ATIVO", obs:"Especialista em cabeamento Cat.6 e fibra óptica.", createdAt:agora(), updatedAt:agora() },
    { razaoSocial:"Tintas Master Indústria e Comércio Ltda", nomeFantasia:"Tintas Master", cnpj:"55.123.456/0001-44", categoria:"Pintura e acabamento", contato:"Paulo Andrade", email:"paulo@tintasmaster.com.br", tel:"(11) 3200-0003", cidade:"Guarulhos", uf:"SP", prazoEntrega:"5-7 dias úteis", formaPagamento:"30/60", status:"ATIVO", obs:"Preços competitivos em grandes volumes.", createdAt:agora(), updatedAt:agora() },
    { razaoSocial:"Ferragens Silva & Cia ME", nomeFantasia:"Ferragens Silva", cnpj:"77.234.567/0001-22", categoria:"Ferragens e fixação", contato:"Roberto Silva", email:"roberto@ferragenssilva.com.br", tel:"(11) 3200-0004", cidade:"Santo André", uf:"SP", prazoEntrega:"1-3 dias úteis", formaPagamento:"PIX / Boleto", status:"ATIVO", obs:"Entrega expressa disponível para urgências.", createdAt:agora(), updatedAt:agora() },
    { razaoSocial:"HidroTec Serviços Hidráulicos Ltda", nomeFantasia:"HidroTec", cnpj:"33.456.789/0001-55", categoria:"Hidráulica", contato:"Marcos Lima", email:"marcos@hidrotec.com.br", tel:"(11) 3200-0005", cidade:"Diadema", uf:"SP", prazoEntrega:"Sob demanda", formaPagamento:"30 dias", status:"INATIVO", obs:"Fornecedor suspenso — revisão cadastral pendente.", createdAt:agora(), updatedAt:agora() },
  ];
}

function gerarGerenciamento(clientes) {
  const STATUS_LIST = ["AGENDAMENTO","SOLICITAÇÃO MATERIAL","EXECUÇÃO","ANDAMENTO DEMANDA EXTRA","SUSPENSA","FINALIZADA — EXEC. DOCUMENTAÇÃO","CONCLUÍDA","CANCELADA"];
  const tipos = ["Reforma Geral","Manutenção Predial","Instalação Elétrica","Adequação de Layout","Cabeamento Estruturado"];
  const resps = ["Diego Amaral","Ana Lima","Carlos Silva"];
  const gestores = ["Marcelo Gomes","Fernanda Costa","Rafael Souza","Luciana Pereira","Pedro Almeida"];
  const construtoras = ["Alpha Construções","Beta Engenharia","Gama Obras","Delta Reformas","Ômega Construções"];
  const pick = (a, i) => a[i % a.length];

  // Pool de cliente/agência — usa reais se existirem, senão placeholder
  const pool = [];
  clientes.forEach(c => (c.agencias||[]).forEach(a => pool.push({ clienteId:c.id, clienteNome:c.nome||c.razaoSocial||c.nomeFantasia||"Cliente Teste", agenciaId:a.id, agenciaNome:`${a.numero||""} ${a.nome||""}`.trim() })));
  if (!pool.length) pool.push({ clienteId:"test-cliente-1", clienteNome:"Banco AFINE", agenciaId:"test-ag-1", agenciaNome:"0001 Agência Central" });

  const STATUS_CONCL = new Set(["CONCLUÍDA","CANCELADA","FINALIZADA — EXEC. DOCUMENTAÇÃO"]);
  const result = [];
  let idx = 0;
  STATUS_LIST.forEach(status => {
    for (let i = 0; i < 5; i++) {
      const slot = pick(pool, idx);
      const offsetInicio = -30 - (i * 5);
      const offsetFim = STATUS_CONCL.has(status) ? -5 - (i * 3) : 10 + (i * 7);
      const isEncerrada = STATUS_CONCL.has(status);
      result.push({
        ...slot,
        tipoDemanda: pick(tipos, idx),
        tiposConfig: [], status,
        responsavel: pick(resps, idx),
        gestorCliente: pick(gestores, idx),
        inicio: d(offsetInicio),
        terminoPrevisto: d(offsetFim),
        termoChaves: "", construtora: pick(construtoras, idx),
        construtoraContato: `(11) 9900${idx}-00${i}`,
        instaladora: "", fornecedorACM: "",
        projSAP: `SAP-T${String(idx+1).padStart(3,"0")}`,
        codUPE: `UPE-T${String(idx+1).padStart(3,"0")}`,
        reservaMaterial: status === "SOLICITAÇÃO MATERIAL" ? `RM-SEED-${idx+1}` : "",
        formAutodesk: false,
        gmudNumero: status === "ANDAMENTO DEMANDA EXTRA" ? `GMUD-SEED-${i+1}` : "",
        gmudStatus: "PENDENTE", gmudData: "", gmudObs: "",
        orcConstrutora: "", orcInstaladora: "",
        medicaoConstrutora: isEncerrada ? `R$ ${(30000 + idx * 5000).toLocaleString("pt-BR")},00` : "",
        docConstrutora: isEncerrada ? `NF-SEED-${1000+idx}` : "",
        docAfine: isEncerrada ? `AF-SEED-${2024000+idx}` : "",
        entradaGestor: status === "CONCLUÍDA" ? "Demanda seed concluída para teste do sistema." : "",
        enviadoFinanceiro: status === "CONCLUÍDA" && i % 2 === 0,
        eventosConfig: [], historico: [],
        ...(isEncerrada ? { concluidaEm: new Date(new Date().setDate(new Date().getDate() - 5 - (i*2))).toISOString() } : {}),
        createdAt: agora(), updatedAt: agora(),
      });
      idx++;
    }
  });
  return result;
}

// ── COMPONENTE ─────────────────────────────────────────────────────────────────

const SECOES = [
  { id:"obras",         label:"Obras",          icon:"🏗️", col:"gerenciamento" },
  { id:"manutencoes",   label:"Manutenções",     icon:"🔧", col:"manutencoes" },
  { id:"compras",       label:"Compras",         icon:"🛒", col:"compras" },
  { id:"financeiro",    label:"Financeiro",      icon:"💰", col:"financeiro" },
  { id:"despesas",      label:"Despesas",        icon:"🧾", col:"despesas" },
  { id:"agendamentos",  label:"Agendamentos",    icon:"📅", col:"agendamentos" },
  { id:"materiais",     label:"Materiais",       icon:"📦", col:"materiais_estoque" },
  { id:"movimentacoes", label:"Movimentações",   icon:"↕️", col:"movimentacoes" },
  { id:"ocorrencias",   label:"Ocorrências",     icon:"⚠️", col:"ocorrencias" },
  { id:"oportunidades", label:"Oportunidades",   icon:"📈", col:"oportunidades" },
  { id:"fornecedores",  label:"Fornecedores",    icon:"🤝", col:"fornecedores" },
  { id:"gerenciamento", label:"Gerenciamento",   icon:"📋", col:"gerenciamento" },
];

export default function SeedPage() {
  const { userProfile } = useAuth();
  const [status, setStatus] = useState({}); // secaoId → "idle"|"running"|"done"|"error"
  const [logs,   setLogs]   = useState([]);
  const [rodando, setRodando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [selecionadas, setSelecionadas] = useState(() => {
    const s = {};
    SECOES.forEach(x => { s[x.id] = true; });
    return s;
  });

  const log = (msg, tipo = "info") => setLogs(p => [...p, { msg, tipo, ts: new Date().toLocaleTimeString("pt-BR") }]);
  const setS = (id, v) => setStatus(p => ({ ...p, [id]: v }));

  async function criarLote(id, label, docs, colNome) {
    setS(id, "running");
    const ids = [], nomes = [];
    try {
      for (const d of docs) {
        const ref = await addDoc(collection(db, colNome), { ...d, _seed: true });
        ids.push(ref.id);
        nomes.push(d.nome || d.titulo || d.descricao || d.razaoSocial || "");
      }
      setS(id, "done");
      log(`✓ ${label}: ${docs.length} criados`, "ok");
    } catch (e) {
      setS(id, "error");
      log(`✗ ${label}: ${e.message}`, "err");
    }
    return { ids, nomes };
  }

  async function rodarSeed() {
    setRodando(true);
    setLogs([]);
    setStatus({});
    log("🌱 Iniciando seed completo...");

    // Lê clientes existentes para Gerenciamento
    const clientesSnap = await getDocs(collection(db, "clientes"));
    const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    log(`📋 ${clientes.length} cliente(s) encontrado(s) para Gerenciamento`);

    let obraIds = [], obraNomes = [], manutIds = [], manutTitulos = [], matIds = [], matNomes = [];

    if (selecionadas.obras) {
      const r = await criarLote("obras", "Obras", gerarObras(), "obras");
      obraIds = r.ids; obraNomes = r.nomes;
    }
    if (selecionadas.manutencoes) {
      const manutDocs = gerarManutencoes(obraIds);
      const r = await criarLote("manutencoes", "Manutenções", manutDocs, "manutencoes");
      manutIds = r.ids; manutTitulos = manutDocs.map(x => x.titulo);
    }
    if (selecionadas.compras)
      await criarLote("compras", "Compras", gerarCompras(obraIds, manutIds), "compras");
    if (selecionadas.financeiro)
      await criarLote("financeiro", "Financeiro", gerarFinanceiro(obraIds), "financeiro");
    if (selecionadas.despesas)
      await criarLote("despesas", "Despesas", gerarDespesas(obraIds, manutIds), "despesas");
    if (selecionadas.agendamentos)
      await criarLote("agendamentos", "Agendamentos", gerarAgendamentos(obraIds, obraNomes, manutIds, manutTitulos), "agendamentos");
    if (selecionadas.materiais) {
      const matDocs = gerarMateriais();
      const r = await criarLote("materiais", "Materiais", matDocs, "materiais_estoque");
      matIds = r.ids; matNomes = matDocs.map(x => x.nome);
    }
    if (selecionadas.movimentacoes)
      await criarLote("movimentacoes", "Movimentações", gerarMovimentacoes(matIds, matNomes), "movimentacoes");
    if (selecionadas.ocorrencias)
      await criarLote("ocorrencias", "Ocorrências", gerarOcorrencias(obraIds), "ocorrencias");
    if (selecionadas.oportunidades)
      await criarLote("oportunidades", "Oportunidades", gerarOportunidades(), "oportunidades");
    if (selecionadas.fornecedores)
      await criarLote("fornecedores", "Fornecedores", gerarFornecedores(), "fornecedores");
    if (selecionadas.gerenciamento)
      await criarLote("gerenciamento", "Gerenciamento", gerarGerenciamento(clientes), "gerenciamento");

    log("🎉 Seed concluído! Navegue pelas abas para verificar os dados.");
    setRodando(false);
  }

  async function limparSeeds() {
    setLimpando(true);
    setLogs([]);
    log("🧹 Removendo todos os documentos com _seed: true...");
    const cols = ["obras","manutencoes","compras","financeiro","despesas","agendamentos","materiais_estoque","movimentacoes","ocorrencias","oportunidades","fornecedores","gerenciamento"];
    let total = 0;
    for (const col of cols) {
      try {
        const snap = await getDocs(query(collection(db, col), where("_seed","==",true)));
        for (const d of snap.docs) { await deleteDoc(doc(db, col, d.id)); total++; }
        if (snap.size) log(`🗑️ ${col}: ${snap.size} removidos`, "ok");
      } catch(e) { log(`✗ ${col}: ${e.message}`, "err"); }
    }
    log(`✓ ${total} documentos seed removidos.`, "ok");
    setLimpando(false);
    setStatus({});
  }

  const sel = (id) => setSelecionadas(p => ({ ...p, [id]: !p[id] }));
  const selTodas = () => setSelecionadas(() => { const s = {}; SECOES.forEach(x => { s[x.id] = true; }); return s; });
  const deselTodas = () => setSelecionadas(() => { const s = {}; SECOES.forEach(x => { s[x.id] = false; }); return s; });

  const COR = { idle:"#7A7A7A", running:"#C9A200", done:"var(--verde)", error:"var(--vermelho)" };
  const ICON = { idle:"○", running:"⏳", done:"✓", error:"✗" };

  return (
    <div style={{ maxWidth:860, margin:"0 auto", padding:24 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>🌱 Seed de Dados de Teste</h1>
        <div style={{ fontSize:13, color:"#7A7A7A" }}>
          Cria 5 registros por módulo cobrindo todos os status/ações possíveis do sistema. Todos os documentos são marcados com <code>_seed: true</code> para remoção fácil.
        </div>
        {process.env.NODE_ENV !== "development" && (
          <div className="alert alert-warning" style={{ marginTop:12, fontSize:13 }}>
            ⚠️ Esta página está visível mas o seed usa Firebase <strong>do ambiente atual</strong>. Use com cuidado em produção.
          </div>
        )}
      </div>

      {/* Seleção de seções */}
      <div style={{ background:"var(--cinza-lt)", border:"1px solid var(--border)", borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <span style={{ fontWeight:600, fontSize:13 }}>Módulos a criar</span>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-sm" onClick={selTodas} style={{ fontSize:11 }}>Selecionar todos</button>
            <button className="btn btn-sm" onClick={deselTodas} style={{ fontSize:11 }}>Limpar</button>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8 }}>
          {SECOES.map(s => {
            const st = status[s.id] || "idle";
            return (
              <label key={s.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:7, cursor:"pointer",
                background: selecionadas[s.id] ? "rgba(245,200,0,.07)" : "var(--bg)",
                border:`1px solid ${selecionadas[s.id] ? "rgba(245,200,0,.4)" : "var(--border)"}`, transition:".15s" }}>
                <input type="checkbox" checked={!!selecionadas[s.id]} onChange={() => sel(s.id)} style={{ width:14, height:14 }}/>
                <span style={{ fontSize:13 }}>{s.icon} {s.label}</span>
                {st !== "idle" && (
                  <span style={{ marginLeft:"auto", fontSize:12, color:COR[st], fontWeight:700 }}>{ICON[st]}</span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Ações */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <button className="btn btn-primary" onClick={rodarSeed} disabled={rodando || limpando}
          style={{ padding:"10px 24px", fontSize:14 }}>
          {rodando ? "⏳ Criando dados..." : "🌱 Criar seeds selecionados"}
        </button>
        <button className="btn" onClick={limparSeeds} disabled={rodando || limpando}
          style={{ padding:"10px 24px", fontSize:14, borderColor:"var(--vermelho)", color:"var(--vermelho)" }}>
          {limpando ? "🧹 Removendo..." : "🗑️ Limpar todos os seeds"}
        </button>
      </div>

      {/* Log */}
      {logs.length > 0 && (
        <div style={{ background:"#1A1A1A", borderRadius:8, padding:14, fontFamily:"monospace", fontSize:12, maxHeight:300, overflowY:"auto" }}>
          {logs.map((l, i) => (
            <div key={i} style={{ color: l.tipo === "ok" ? "#4CAF50" : l.tipo === "err" ? "#F44336" : "#CCC", marginBottom:4 }}>
              <span style={{ color:"#666" }}>[{l.ts}]</span> {l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
