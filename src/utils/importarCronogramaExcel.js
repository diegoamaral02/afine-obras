// src/utils/importarCronogramaExcel.js
// Lê planilha de cronograma no formato AFINE/Bradesco e extrai as etapas.
//
// Estrutura esperada:
//   Linha com "Início:" → extrai o ano
//   Linha de datas  → colunas com "dd/mm"
//   Seções de fase  → células iniciando com espaços + texto da fase
//   Atividades      → código alfanumérico na col 0 + "█" nas colunas de data

import * as XLSX from "xlsx";

// Cores por fase — rotacionam a cada mudança de fase para agrupar visualmente
const CORES_FASE = ["#185FA5","#2A6B3F","#BD3838","#B8910A","#6B21A8","#0E7490","#C0392B","#E67E22"];

// Converte "dd/mm" + ano para "YYYY-MM-DD"
function toISO(ddmm, ano) {
  if (!ddmm || !ano) return "";
  const [d, m] = String(ddmm).trim().split("/");
  if (!d || !m) return "";
  return `${ano}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

// Extrai o ano de uma célula como "Início: 21/08/2026"
function extrairAno(rows) {
  for (const row of rows) {
    for (const cell of row) {
      const m = String(cell).match(/\d{2}\/\d{2}\/(\d{4})/);
      if (m) return m[1];
    }
  }
  return String(new Date().getFullYear());
}

// Retorna o índice da linha que contém as datas (dd/mm)
function acharLinhasDatas(rows) {
  for (let i = 0; i < rows.length; i++) {
    const count = rows[i].filter(c => /^\d{2}\/\d{2}$/.test(String(c).trim())).length;
    if (count >= 3) return i;
  }
  return -1;
}

// Retorna mapa colIdx → "dd/mm"
function mapearColunasDatas(row) {
  const mapa = {};
  row.forEach((c, i) => {
    if (/^\d{2}\/\d{2}$/.test(String(c).trim())) mapa[i] = String(c).trim();
  });
  return mapa;
}

// Verifica se é cabeçalho de fase (célula longa, não é atividade)
function isFase(row) {
  const col0 = String(row[0] || "").trim();
  const col1 = String(row[1] || "").trim();
  // Linha de mobilização, etapa, limpeza etc. — não tem código curto na col0
  if (/^(etapa|mobiliza|limpeza|entrega)/i.test(col0)) return true;
  // Seções numeradas tipo "  1. MOBILIZAÇÃO"
  if (/^\d+\.\s+\S/.test(col0)) return true;
  // Linhas de vistoria/inspeção intermediárias (col0 vazio, texto longo em col1 ou cel combinada)
  if (!col0 && col1 && col1.length > 15) return false; // linha de observação, ignorar
  return false;
}

// Verifica se a linha é de atividade (tem código tipo "1.1", "A.1", "B.3" na col0)
function isAtividade(row) {
  return /^[A-Z0-9]+\.\d+/.test(String(row[0] || "").trim());
}

export async function importarCronogramaExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        const ano = extrairAno(rows);
        const idxDatas = acharLinhasDatas(rows);
        if (idxDatas < 0) { reject(new Error("Não encontrei linha de datas (dd/mm) na planilha.")); return; }

        const colDatas = mapearColunasDatas(rows[idxDatas]);
        const colIdxs = Object.keys(colDatas).map(Number).sort((a,b)=>a-b);

        // Percorre linha a linha extraindo atividades individuais
        const etapas = [];
        let corFaseIdx = 0;
        let corAtual = CORES_FASE[0];

        for (let i = idxDatas + 1; i < rows.length; i++) {
          const row = rows[i];

          // Mudança de fase → troca cor
          if (isFase(row)) {
            corFaseIdx++;
            corAtual = CORES_FASE[corFaseIdx % CORES_FASE.length];
            continue;
          }

          if (!isAtividade(row)) continue;

          const codigo = String(row[0] || "").trim();
          const descricao = String(row[2] || "").trim(); // col 2 = ATIVIDADE / SERVIÇO
          const nome = descricao
            ? `${codigo} — ${descricao}`
            : codigo;

          const diasMarcados = colIdxs.filter(ci => String(row[ci]).includes("█"));
          if (diasMarcados.length === 0) continue;

          etapas.push({
            nome,
            dataInicio: toISO(colDatas[diasMarcados[0]], ano),
            dataFim:    toISO(colDatas[diasMarcados[diasMarcados.length - 1]], ano),
            status:     "NÃO INICIADA",
            cor:        corAtual,
          });
        }

        if (etapas.length === 0) { reject(new Error("Nenhuma etapa encontrada. Verifique o formato da planilha.")); return; }
        resolve(etapas);
      } catch (err) {
        reject(new Error("Erro ao ler planilha: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}
