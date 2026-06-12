// src/components/OSScanner.js
// Versão 100% gratuita — OS convertida em base64 e salva no Firestore.
// Aceita foto (câmera do celular) ou PDF convertido em imagem.

import React, { useRef, useState } from "react";

// Comprime a imagem da OS para no máximo 1200px (precisa ser legível)
function comprimirOS(file) {
  return new Promise((resolve, reject) => {
    // Se for PDF, não conseguimos converter no browser sem biblioteca.
    // Orientamos o usuário a tirar foto da OS impressa.
    if (file.type === "application/pdf") {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        // Salva o PDF como base64 diretamente
        resolve({ base64: e.target.result, nome: file.name, tipo: "pdf" });
      };
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else                { width  = Math.round(width  * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL("image/jpeg", 0.85); // qualidade maior para OS ser legível
        resolve({ base64, nome: file.name, tipo: "imagem" });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function OSScanner({ osFile, onChange }) {
  const fileRef    = useRef();
  const [loading,  setLoading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const resultado = await comprimirOS(file);
      onChange({ ...resultado, uploadedAt: new Date().toISOString() });
    } catch (err) {
      alert("Erro ao processar OS: " + err.message);
    }
    setLoading(false);
    e.target.value = "";
  }

  return (
    <div>
      <label style={{ fontSize:12, fontWeight:600, color:"#444", display:"block", marginBottom:6 }}>
        Ordem de Serviço (OS) – assinada e carimbada pelo gerente{" "}
        <span style={{ color:"var(--vermelho)" }}>*</span>
      </label>

      <div className={`scan-zone ${osFile ? "done" : ""}`}>
        {osFile ? (
          <>
            <div style={{ fontSize:32 }}>✅</div>
            <p>OS anexada: <strong>{osFile.nome}</strong></p>

            {osFile.tipo === "imagem" && (
              <img
                src={osFile.base64}
                alt="OS escaneada"
                style={{ maxWidth:"100%", maxHeight:180, marginTop:10, borderRadius:6, border:"1px solid #ddd" }}
              />
            )}
            {osFile.tipo === "pdf" && (
              <p style={{ fontSize:11, marginTop:6 }}>Arquivo PDF anexado ✓</p>
            )}

            <button
              className="btn btn-sm"
              style={{ marginTop:10 }}
              onClick={() => fileRef.current.click()}
            >
              Substituir OS
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize:36 }}>📄</div>
            <p>Escaneie ou fotografe a OS assinada e carimbada</p>
            <p style={{ fontSize:11, marginTop:4, color:"#888" }}>
              No celular: câmera abre automaticamente.<br />
              No computador: selecione uma imagem ou PDF.
            </p>
            <button
              className="btn btn-sm"
              style={{ marginTop:12, background:"var(--laranja)", color:"#fff", border:"none" }}
              onClick={() => fileRef.current.click()}
              disabled={loading}
            >
              {loading ? "Processando..." : "📷  Escanear / Anexar OS"}
            </button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handleFile}
        style={{ display:"none" }}
      />

      <p style={{ fontSize:11, color:"var(--cinza-med)", marginTop:6 }}>
        A OS é salva diretamente no banco de dados. Sem custo adicional.
      </p>
    </div>
  );
}
