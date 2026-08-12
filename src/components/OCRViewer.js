// src/components/OCRViewer.js
import React, { useState, useRef } from "react";
import { extrairTexto, extrairDadosNota } from "../utils/ocr";

/**
 * Modal reutilizável para OCR de imagens.
 *
 * Props:
 *   titulo       — título do modal
 *   onResultado  — callback(texto, dadosExtraidos)
 *   onFechar     — callback para fechar
 */
export default function OCRViewer({ titulo = "Ler documento com OCR", onResultado, onFechar }) {
  const [arquivo,    setArquivo]    = useState(null);   // { file, preview }
  const [processando,setProcessando]= useState(false);
  const [progresso,  setProgresso]  = useState(0);
  const [texto,      setTexto]      = useState("");
  const [dados,      setDados]      = useState(null);
  const [confianca,  setConfianca]  = useState(null);
  const [erro,       setErro]       = useState("");
  const inputRef = useRef(null);

  function handleArquivo(file) {
    if (!file) return;

    if (file.type === "application/pdf") {
      setErro("Para PDFs, use a importação de XML NF-e. O OCR funciona com imagens (JPG, PNG).");
      return;
    }
    setErro("");
    setTexto("");
    setDados(null);
    setConfianca(null);
    setProgresso(0);

    const reader = new FileReader();
    reader.onload = e => setArquivo({ file, preview: e.target.result });
    reader.readAsDataURL(file);
  }

  function handleInput(e) {
    handleArquivo(e.target.files?.[0]);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    handleArquivo(e.dataTransfer.files?.[0]);
  }

  async function executarOCR() {
    if (!arquivo) return;
    setProcessando(true);
    setProgresso(0);
    setErro("");
    try {
      const { texto: t, confianca: c } = await extrairTexto(arquivo.preview, p => setProgresso(p));
      setTexto(t);
      setConfianca(c);
      setDados(extrairDadosNota(t));
    } catch (err) {
      setErro("Erro ao processar imagem: " + err.message);
    }
    setProcessando(false);
    setProgresso(100);
  }

  function usarDados() {
    if (onResultado) onResultado(texto, dados);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(23,23,26,.72)",
      backdropFilter: "blur(2px)",
      zIndex: 400,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "40px 16px", overflowY: "auto",
      animation: "fadeIn .15s ease",
    }}>
      <div style={{
        background: "var(--afine-white)",
        borderRadius: "var(--r-lg)",
        width: "100%", maxWidth: 600,
        boxShadow: "var(--shadow-lg)",
        animation: "modalIn .18s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.01em" }}>🔍 {titulo}</h2>
          <button className="btn-close" onClick={onFechar}>✕</button>
        </div>
        <div style={{ height: 3, background: "var(--afine-yellow)", borderRadius: "var(--r-full)", margin: "12px 24px 0" }} />

        <div style={{ padding: "20px 24px" }}>

          {/* Drop zone */}
          {!arquivo && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border: "2px dashed var(--n-300)",
                borderRadius: "var(--r-lg)",
                padding: "36px 24px",
                textAlign: "center",
                cursor: "pointer",
                background: "var(--n-50)",
                transition: "border-color .15s, background .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--afine-yellow-dk)"; e.currentTarget.style.background = "var(--afine-yellow-lt)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--n-300)"; e.currentTarget.style.background = "var(--n-50)"; }}
            >
              <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Arraste uma imagem ou clique para selecionar</div>
              <div style={{ fontSize: 12, color: "var(--afine-gray)" }}>Formatos aceitos: JPG, PNG · PDF não suportado pelo OCR</div>
              <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleInput} />
            </div>
          )}

          {erro && (
            <div className="alert alert-danger" style={{ marginTop: arquivo ? 0 : 14 }}>⚠️ {erro}</div>
          )}

          {/* Preview da imagem */}
          {arquivo && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--afine-gray-dk)" }}>Imagem selecionada</span>
                <button className="btn btn-sm" onClick={() => { setArquivo(null); setTexto(""); setDados(null); setConfianca(null); setErro(""); }}>Trocar imagem</button>
              </div>
              <img
                src={arquivo.preview}
                alt="Preview"
                style={{ maxWidth: "100%", maxHeight: 220, borderRadius: "var(--r-md)", border: "1px solid var(--border)", display: "block" }}
              />
            </div>
          )}

          {/* Botão de executar OCR */}
          {arquivo && !processando && !texto && (
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 14 }} onClick={executarOCR}>
              🔍 Extrair texto
            </button>
          )}

          {/* Barra de progresso */}
          {processando && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "var(--afine-gray)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                <span>⏳ Processando imagem com OCR...</span>
                <span>{progresso}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill blue"
                  style={{ width: `${progresso}%`, transition: "width .3s ease" }}
                />
              </div>
            </div>
          )}

          {/* Alerta de baixa confiança */}
          {confianca !== null && confianca < 70 && (
            <div className="alert alert-warning" style={{ marginBottom: 14 }}>
              ⚠️ Qualidade baixa (confiança: {confianca}%) — verifique os dados manualmente
            </div>
          )}

          {/* Texto extraído editável */}
          {texto && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--afine-gray-dk)" }}>
                  Texto extraído
                  {confianca !== null && confianca >= 70 && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--verde)", fontWeight: 400 }}>
                      ✓ Confiança: {confianca}%
                    </span>
                  )}
                </label>
                <button className="btn btn-sm" onClick={executarOCR} disabled={processando}>
                  🔄 Refazer OCR
                </button>
              </div>
              <textarea
                value={texto}
                onChange={e => { setTexto(e.target.value); setDados(extrairDadosNota(e.target.value)); }}
                rows={6}
                style={{ fontFamily: "monospace", fontSize: 12 }}
              />
            </div>
          )}

          {/* Cards de dados detectados */}
          {dados && (dados.cnpj || dados.valorTotal || dados.data || dados.numeroNF) && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--afine-gray)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 8 }}>
                Dados detectados automaticamente
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                {dados.cnpj && (
                  <div style={{ background: "var(--n-100)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--afine-gray)", textTransform: "uppercase", marginBottom: 4 }}>CNPJ</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{dados.cnpj}</div>
                  </div>
                )}
                {dados.valorTotal && (
                  <div style={{ background: "var(--verde-lt)", border: "1px solid rgba(42,107,63,.22)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--verde)", textTransform: "uppercase", marginBottom: 4 }}>Valor Total</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--verde)" }}>R$ {Number(dados.valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                  </div>
                )}
                {dados.data && (
                  <div style={{ background: "var(--n-100)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--afine-gray)", textTransform: "uppercase", marginBottom: 4 }}>Data</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{dados.data}</div>
                  </div>
                )}
                {dados.numeroNF && (
                  <div style={{ background: "var(--afine-yellow-lt)", border: "1px solid rgba(245,196,0,.32)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--afine-yellow-dk)", textTransform: "uppercase", marginBottom: 4 }}>Nº NF</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{dados.numeroNF}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {texto && dados && !(dados.cnpj || dados.valorTotal || dados.data || dados.numeroNF) && (
            <div className="alert alert-info" style={{ marginBottom: 14 }}>
              ℹ️ Nenhum dado estruturado detectado (CNPJ, valor, data, nº NF). Verifique o texto acima.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "0 24px 20px", display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
          <button className="btn" onClick={onFechar}>Cancelar</button>
          {texto && (
            <button className="btn btn-primary" onClick={usarDados}>
              ✓ Usar estes dados
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
