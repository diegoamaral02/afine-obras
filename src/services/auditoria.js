// src/services/auditoria.js — versionamento e log de auditoria
import { collection, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

// Atualiza documento COM trilha de auditoria
export async function updateComAuditoria(colecao, id, payload, userUid, userName) {
  const agora = new Date().toISOString();

  // 1. Grava na subcoleção historico
  await addDoc(collection(db, colecao, id, "historico"), {
    campos: payload,
    alteradoPor: userUid,
    alteradoPorNome: userName || "–",
    alteradoEm: agora,
    tipo: "update",
  });

  // 2. Grava no log global (append-only, imutável)
  await addDoc(collection(db, "audit_log"), {
    colecao, docId: id,
    campos: Object.keys(payload),
    alteradoPor: userUid,
    alteradoPorNome: userName || "–",
    alteradoEm: agora,
  });

  // 3. Atualiza o documento
  return updateDoc(doc(db, colecao, id), { ...payload, updatedAt: agora, updatedBy: userUid });
}

// Cria documento COM trilha de auditoria
export async function addComAuditoria(colecao, payload, userUid, userName) {
  const agora = new Date().toISOString();
  const fullPayload = { ...payload, createdAt: agora, createdBy: userUid, updatedAt: agora };
  const docRef = await addDoc(collection(db, colecao), fullPayload);

  await addDoc(collection(db, "audit_log"), {
    colecao, docId: docRef.id,
    acao: "create",
    alteradoPor: userUid,
    alteradoPorNome: userName || "–",
    alteradoEm: agora,
  });

  return docRef;
}
