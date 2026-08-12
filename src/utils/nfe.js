// src/utils/nfe.js
// Parser de NF-e (modelo 55) usando DOMParser nativo

export function parseNFe(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");

  // Verifica erro de parse
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) throw new Error("XML inválido: " + parseErr.textContent.slice(0, 120));

  // Helper: pega texto do primeiro elemento com a tag
  function txt(tag) {
    const el = doc.getElementsByTagName(tag)[0];
    return el ? el.textContent.trim() : "";
  }

  // Helper: pega texto dentro de um elemento pai específico
  function txtIn(parent, tag) {
    const el = parent.getElementsByTagName(tag)[0];
    return el ? el.textContent.trim() : "";
  }

  // Emitente (fornecedor)
  const emitEl = doc.getElementsByTagName("emit")[0];
  const emitente = emitEl ? {
    cnpj:         txtIn(emitEl, "CNPJ"),
    razaoSocial:  txtIn(emitEl, "xNome"),
    nomeFantasia: txtIn(emitEl, "xFant"),
    uf:           txtIn(emitEl, "UF"),
    cidade:       txtIn(emitEl, "xMun"),
  } : {
    cnpj: txt("CNPJ"), razaoSocial: txt("xNome"),
    nomeFantasia: txt("xFant"), uf: "", cidade: "",
  };

  // Nota
  const nota = {
    numero:      txt("nNF"),
    serie:       txt("serie"),
    dataEmissao: txt("dhEmi") ? txt("dhEmi").split("T")[0] : txt("dEmi"),
    chaveAcesso: txt("chNFe"),
    natureza:    txt("natOp"),
  };

  // Itens (det[])
  const dets = doc.getElementsByTagName("det");
  const itens = Array.from(dets).map(det => ({
    codigo:        txtIn(det, "cProd"),
    descricao:     txtIn(det, "xProd"),
    unidade:       txtIn(det, "uCom"),
    quantidade:    parseFloat(txtIn(det, "qCom"))   || 0,
    valorUnitario: parseFloat(txtIn(det, "vUnCom")) || 0,
    valorTotal:    parseFloat(txtIn(det, "vProd"))  || 0,
    ncm:           txtIn(det, "NCM"),
  }));

  // Totais — vProd e vNF aparecem em dois contextos; pegamos o do elemento ICMSTot
  const totEl = doc.getElementsByTagName("ICMSTot")[0];
  const totais = {
    produtos: parseFloat(totEl ? txtIn(totEl, "vProd") : txt("vProd")) || 0,
    desconto: parseFloat(totEl ? txtIn(totEl, "vDesc") : txt("vDesc")) || 0,
    frete:    parseFloat(totEl ? txtIn(totEl, "vFrete") : txt("vFrete")) || 0,
    total:    parseFloat(totEl ? txtIn(totEl, "vNF")   : txt("vNF"))   || 0,
  };

  return { emitente, nota, itens, totais };
}
