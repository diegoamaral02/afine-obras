// src/utils/ocr.js
import Tesseract from "tesseract.js";

/**
 * Executa OCR em uma imagem e retorna o texto extraído.
 * @param {File|string} fonte — File do input ou data URL
 * @param {Function} onProgresso — callback com valor 0-100
 * @returns {Promise<{ texto: string, confianca: number }>}
 */
export async function extrairTexto(fonte, onProgresso) {
  const result = await Tesseract.recognize(fonte, "por", {
    logger: m => {
      if (m.status === "recognizing text" && onProgresso) {
        onProgresso(Math.round(m.progress * 100));
      }
    },
  });
  return {
    texto: result.data.text,
    confianca: Math.round(result.data.confidence),
  };
}

/**
 * Tenta extrair dados estruturados de uma nota fiscal / comprovante.
 * Aplica heurísticas básicas de regex no texto extraído.
 */
export function extrairDadosNota(texto) {
  const t = texto;

  // CNPJ: XX.XXX.XXX/XXXX-XX
  const cnpjMatch = t.match(/\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}/);

  // Valor total — procura padrões como "TOTAL R$ 1.234,56" ou "Valor: 1234,56"
  const valorMatch = t.match(/(?:total|valor|subtotal)[^\d]*R?\$?\s*([\d\.]+,\d{2})/i);

  // Data — DD/MM/AAAA ou AAAA-MM-DD
  const dataMatch = t.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);

  // Número da nota — "NF", "NF-e", "Nota Fiscal" seguido de número
  const nfMatch = t.match(/(?:NF-?e?|nota\s+fiscal)[^\d]*(\d+)/i);

  return {
    cnpj:       cnpjMatch?.[0]?.replace(/[\s]/g, "") || null,
    valorTotal: valorMatch?.[1]?.replace(/\./g, "").replace(",", ".") || null,
    data:       dataMatch?.[0] || null,
    numeroNF:   nfMatch?.[1] || null,
  };
}
