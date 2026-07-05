// ============================================================
// CATÁLOGO DE ITENS DE COMPRAS POR CATEGORIA DE SERVIÇO
// Extraído dos Pedidos de Material AFINE (PDFs de referência)
// Itens que aparecem em ao menos 1 obra — base para seleção rápida
// ============================================================

export const CATEGORIAS_COMPRAS = [
  {
    id: "eletrica_tomadas",
    label: "⚡ Elétrica — Tomadas e Interruptores",
    cor: "#F5A623",
    itens: [
      { descricao: "Tomada modular 2P+T 10A", unidade: "un", fabricante: "LEGRAND Pial Plus+Safira" },
      { descricao: "Tomada mobiliário 2P+T 10A", unidade: "un", fabricante: "INJETEL Padrão/Granbella" },
      { descricao: "Caixa de chão 4×4 conjunto completo prata (com módulo)", unidade: "un", fabricante: "Genérico" },
      { descricao: "Filtro de linha 4 tomadas 2P+T 10A", unidade: "un", fabricante: "Genérico" },
      { descricao: "Módulo RJ45 de piso — redondo", unidade: "un", fabricante: "Genérico" },
      { descricao: "Placa 4×2 modular (2 módulos)", unidade: "un", fabricante: "LEGRAND Pial Plus+Safira" },
      { descricao: "Tomada sistema X (simples)", unidade: "un", fabricante: "Genérico" },
      { descricao: "Tomada Trava Giro", unidade: "un", fabricante: "LEGRAND Pial" },
    ],
  },
  {
    id: "eletrica_infra",
    label: "⚡ Elétrica — Infraestrutura",
    cor: "#F5A623",
    itens: [
      { descricao: "Eletroduto corrugado 3/4\"", unidade: "m", fabricante: "Genérico" },
      { descricao: "Eletroduto rígido 1\"", unidade: "m", fabricante: "Genérico" },
      { descricao: "Cabo flexível 2,5mm² fase/neutro (preto/azul)", unidade: "m", fabricante: "Genérico" },
      { descricao: "Cabo flexível 2,5mm² terra (verde)", unidade: "m", fabricante: "Genérico" },
      { descricao: "Caixa 4×4 (espelho central com furação)", unidade: "un", fabricante: "Genérico" },
      { descricao: "Canaleta 5cm com tampa — branca", unidade: "un (2m)", fabricante: "Genérico" },
      { descricao: "Barras PVC rígido 3/4\"", unidade: "un (3m)", fabricante: "Genérico" },
      { descricao: "Barras PVC rígido 1\"", unidade: "un (3m)", fabricante: "Genérico" },
      { descricao: "Fita isolante", unidade: "rolo", fabricante: "Genérico" },
      { descricao: "Enforca gato", unidade: "un", fabricante: "Genérico" },
    ],
  },
  {
    id: "logica_cabeamento",
    label: "🌐 Lógica — Cabeamento Estruturado",
    cor: "#4A90D9",
    itens: [
      { descricao: "Cabo de rede CAT5e UTP (caixa 305m)", unidade: "cx", fabricante: "Genérico CAT5e" },
      { descricao: "Keystone CAT5e", unidade: "un", fabricante: "Genérico CAT5e" },
      { descricao: "Keystone telefonia (RJ11)", unidade: "un", fabricante: "Genérico" },
      { descricao: "Patch cord CAT5 1,5m", unidade: "un", fabricante: "Genérico" },
      { descricao: "Patch cord CAT5 3m", unidade: "un", fabricante: "Genérico" },
      { descricao: "RJ45", unidade: "un", fabricante: "Genérico" },
      { descricao: "RJ11", unidade: "un", fabricante: "Genérico" },
      { descricao: "Cabo de telefone 1,5m RJ11 — Preto", unidade: "un", fabricante: "Genérico" },
      { descricao: "Organizador de cabos horizontal", unidade: "un", fabricante: "Genérico" },
      { descricao: "Etiqueta de identificação", unidade: "un", fabricante: "Genérico" },
    ],
  },
  {
    id: "pisos_vinilico",
    label: "🪵 Pisos — Vinílico Amadeirado",
    cor: "#8B5E3C",
    itens: [
      { descricao: "Piso vinílico amadeirado régua — Cor Carambola (Tarkett Ambienta CÓD 9344653)", unidade: "m²", fabricante: "Tarkett/Interface" },
      { descricao: "Piso vinílico amadeirado régua — Nat.Wood CÓD A00204 BEECH", unidade: "m²", fabricante: "Tarkett/Interface" },
      { descricao: "Piso vinílico Hercules Square 203 STATION", unidade: "m²", fabricante: "Belgotex" },
      { descricao: "Cola acrílica para piso vinílico", unidade: "gl", fabricante: "Genérico" },
      { descricao: "Massa niveladora 20kg", unidade: "sc", fabricante: "Genérico" },
      { descricao: "Primer para contrapiso", unidade: "lata", fabricante: "Genérico" },
      { descricao: "Rodapé MDF 7cm branco sem friso", unidade: "m", fabricante: "Genérico" },
      { descricao: "Cola para rodapé", unidade: "gl", fabricante: "Genérico" },
    ],
  },
  {
    id: "pisos_carpete",
    label: "🟫 Pisos — Carpete",
    cor: "#7B5EA7",
    itens: [
      { descricao: "Carpete rolo bouclé grafite — São Carlos Itapuã MASTER REF. 8.01.9877 GRAFITE", unidade: "m²", fabricante: "São Carlos" },
      { descricao: "Carpete São Carlos — Alto Tráfego Cor Grafite (Lumiere)", unidade: "m²", fabricante: "São Carlos" },
      { descricao: "Cola para carpete", unidade: "gl", fabricante: "Genérico" },
      { descricao: "Perfil alumínio arremate sem garra — cor preta", unidade: "barra", fabricante: "Genérico" },
      { descricao: "Massa niveladora 20kg", unidade: "sc", fabricante: "Genérico" },
      { descricao: "Primer para contrapiso", unidade: "lata", fabricante: "Genérico" },
      { descricao: "Rodapé MDF 7cm branco sem friso", unidade: "m", fabricante: "Genérico" },
    ],
  },
  {
    id: "drywall",
    label: "🧱 Paredes — Drywall / Mesão",
    cor: "#6D6D6D",
    itens: [
      { descricao: "Placa drywall ST 1,20×1,80m 12,5mm (Standard)", unidade: "chp", fabricante: "Genérico" },
      { descricao: "Placa drywall ST 1,20×2,40m 12,5mm (Standard)", unidade: "m²", fabricante: "Genérico" },
      { descricao: "Perfil U 70mm — guia horizontal", unidade: "m", fabricante: "Genérico" },
      { descricao: "Perfil C 70mm — montante vertical", unidade: "m", fabricante: "Genérico" },
      { descricao: "Parafuso TTPC 3,5×25mm (chapa-chapa)", unidade: "cx", fabricante: "Genérico" },
      { descricao: "Parafuso TTPC 3,5×45mm (drywall-perfil)", unidade: "cx", fabricante: "Genérico" },
      { descricao: "Bucha metálica (fixação guia/piso)", unidade: "un", fabricante: "Genérico" },
      { descricao: "Fita para juntas", unidade: "m", fabricante: "Genérico" },
      { descricao: "Massa de acabamento/juntas drywall 18kg", unidade: "balde", fabricante: "Genérico" },
      { descricao: "Cantoneira metálica (quinas)", unidade: "m", fabricante: "Genérico" },
      { descricao: "Seladora para drywall", unidade: "galão", fabricante: "Genérico" },
    ],
  },
  {
    id: "pintura",
    label: "🎨 Pintura — Látex",
    cor: "#2ECC71",
    itens: [
      { descricao: "Tinta látex acrílico branco neve fosco 18L", unidade: "lata", fabricante: "Suvinil/Coral/Sherwin Williams" },
      { descricao: "Tinta acrílica Cinza Prata", unidade: "lata", fabricante: "Suvinil" },
      { descricao: "Massa corrida PVA 25kg", unidade: "lata", fabricante: "Genérico" },
      { descricao: "Lona plástica proteção (4×100m)", unidade: "rolo", fabricante: "Genérico" },
      { descricao: "Lixa grão 180", unidade: "fl", fabricante: "Genérico" },
      { descricao: "Lixa grão 220", unidade: "fl", fabricante: "Genérico" },
      { descricao: "Rolo de lã 23cm", unidade: "un", fabricante: "Genérico" },
      { descricao: "Pincel 2\"", unidade: "un", fabricante: "Genérico" },
      { descricao: "Pincel 3\"", unidade: "un", fabricante: "Genérico" },
      { descricao: "Fita crepe 50mm", unidade: "rolo", fabricante: "Genérico" },
    ],
  },
  {
    id: "portas_ferragens",
    label: "🚪 Portas e Ferragens",
    cor: "#C0392B",
    itens: [
      { descricao: "Porta montada vão 80cm com guarnição 10cm", unidade: "un", fabricante: "Genérico (padrão agência)" },
      { descricao: "Porta montada vão 90cm com guarnição 10cm", unidade: "un", fabricante: "Genérico (padrão agência)" },
      { descricao: "Batente regulável", unidade: "cj", fabricante: "Genérico" },
    ],
  },
  {
    id: "controle_acesso",
    label: "🔐 Controle de Acesso",
    cor: "#E74C3C",
    itens: [
      { descricao: "Módulo de controle de acesso (eletromagnético/eletromecânico) — Amelco AM CDA 100", unidade: "un", fabricante: "Amelco" },
      { descricao: "Cabo para controle de acesso 4 vias", unidade: "m", fabricante: "Genérico" },
      { descricao: "Botão de saída (push button)", unidade: "un", fabricante: "Genérico" },
      { descricao: "Fechadura Eletroimã — Amelco AM-KFEI 150 (ou similar)", unidade: "un", fabricante: "Amelco" },
    ],
  },
  {
    id: "vegetacao",
    label: "🌿 Vegetação Artificial",
    cor: "#27AE60",
    itens: [
      { descricao: "Filodendro verde (vaso)", unidade: "vaso", fabricante: "Genérico" },
      { descricao: "Pileia (vaso)", unidade: "vaso", fabricante: "Genérico" },
      { descricao: "Mini jiboia pendente (vaso)", unidade: "vaso", fabricante: "Genérico" },
    ],
  },
];

// Unidades disponíveis para seleção (lista completa)
export const UNIDADES_COMPRAS = [
  "un", "m", "m²", "m³", "cx", "sc", "lata", "galão", "gl",
  "rolo", "barra", "balde", "chp", "cj", "fl", "vaso", "kg",
];
