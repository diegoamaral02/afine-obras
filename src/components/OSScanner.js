// src/components/OSScanner.js
// Aceita foto (câmera do celular) ou PDF. Faz upload para Firebase Storage
// e retorna URL pública — nunca salva base64 no Firestore (limite 1 MB).

import React, { useRef, useState } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

async function uploadOS(file, obraId, escopoId) {
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ext  = file.name.split(".").pop().toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
  const pasta = obraId ? `obras/${obraId}/os` : "ordens-servico";
  const path = escopoId ? `${pasta}/${escopoId}_${uid}.${ext}` : `${pasta}/${uid}.${ext}`;
  const sr   = storageRef(storage, path);

  let blob = file;
  // Para imagens, comprime antes de enviar (mantém legibilidade em 1200px)
  if (file.type.startsWith("image/")) {
    blob = await comprimirImagem(file);
  }

  await uploadBytes(sr, blob, { contentType: file.type });
  const url = await getDownloadURL(sr);
  return { url, nome: file.name, tipo: file.type === "application/pdf" ? "pdf" : "imagem" };
}

function comprimirImagem(file) {
  return new Promise((resolve, reject) => {
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
        canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function OSScanner({ osFile, onChange, obraId, escopoId }) {
  const fileRef   = useRef();
  const [loading, setLoading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const resultado = await uploadOS(file, obraId, escopoId);
      onChange({ ...resultado, uploadedAt: new Date().toISOString() });
    } catch (err) {
      alert("Erro ao enviar OS: " + err.message);
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
                src={osFile.url}
                alt="OS escaneada"
                style={{ maxWidth:"100%", maxHeight:180, marginTop:10, borderRadius:6, border:"1px solid #ddd" }}
              />
            )}
            {osFile.tipo === "pdf" && (
              <p style={{ fontSize:11, marginTop:6 }}>
                Arquivo PDF anexado ✓{" "}
                <a href={osFile.url} target="_blank" rel="noreferrer" style={{ color:"var(--laranja)" }}>Abrir</a>
              </p>
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
              {loading ? "Enviando..." : "📷  Escanear / Anexar OS"}
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
        A OS é armazenada com segurança no servidor. Sem custo adicional.
      </p>
    </div>
  );
}
