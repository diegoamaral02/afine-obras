// src/services/auditoria.js — versionamento e log de auditoria
import { collection, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

// Atualiza documento COM trilha de auditoria (batch atômico: historico + audit_log + updateDoc)
export async function updateComAuditoria(colecao, id, payload, userUid, userName) {
  const agora = new Date().toISOString();
  const batch = writeBatch(db);

  batch.set(doc(collection(db, colecao, id, "historico")), {
    campos: payload,
    alteradoPor: userUid,
    alteradoPorNome: userName || "–",
    alteradoEm: agora,
    tipo: "update",
  });

  batch.set(doc(collection(db, "audit_log")), {
    colecao, docId: id,
    campos: Object.keys(payload),
    alteradoPor: userUid,
    alteradoPorNome: userName || "–",
    alteradoEm: agora,
  });

  batch.update(doc(db, colecao, id), { ...payload, updatedAt: agora, updatedBy: userUid });

  return batch.commit();
}

// Cria documento COM trilha de auditoria (batch atômico: set + audit_log)
export async function addComAuditoria(colecao, payload, userUid, userName) {
  const agora = new Date().toISOString();
  const newRef = doc(collection(db, colecao));
  const fullPayload = { ...payload, createdAt: agora, createdBy: userUid, updatedAt: agora };

  const batch = writeBatch(db);
  batch.set(newRef, fullPayload);
  batch.set(doc(collection(db, "audit_log")), {
    colecao, docId: newRef.id,
    acao: "create",
    alteradoPor: userUid,
    alteradoPorNome: userName || "–",
    alteradoEm: agora,
  });

  await batch.commit();
  return newRef;
}

// Exclui documento COM trilha de auditoria — guarda um "retrato" do documento
// antes de apagar, já que depois de excluído não há mais como consultar o
// dado original (diferente de update/create, que mantêm o doc vivo).
export async function deleteComAuditoria(colecao, id, userUid, userName, snapshotData) {
  const agora = new Date().toISOString();
  await addDoc(collection(db, "audit_log"), {
    colecao, docId: id, acao: "delete",
    snapshot: snapshotData || null,
    alteradoPor: userUid, alteradoPorNome: userName || "–", alteradoEm: agora,
  });
  return deleteDoc(doc(db, colecao, id));
}
