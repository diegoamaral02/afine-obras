// src/services/pushNotificacoes.js
// Gerencia token FCM: solicita permissão, obtém token e salva no Firestore.
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { messaging, db } from "../firebase";

// !! SUBSTITUIR pela chave VAPID gerada em:
// Firebase Console → Project Settings → Cloud Messaging →
// Web configuration → Generate key pair
const VAPID_KEY = "COLE_AQUI_A_CHAVE_VAPID";

/** Solicita permissão e registra o token FCM do dispositivo */
export async function registrarTokenPush(uid) {
  if (!uid) return null;
  if (!("Notification" in window)) return null;

  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return null;

    // Salva token associado ao usuário no Firestore
    await setDoc(
      doc(db, "usuarios", uid, "fcmTokens", token.slice(-20)),
      { token, device: navigator.userAgent.slice(0, 100), updatedAt: serverTimestamp() },
      { merge: true }
    );

    return token;
  } catch (err) {
    console.warn("Push: erro ao registrar token:", err.message);
    return null;
  }
}

/** Escuta mensagens quando o app está em foreground — retorna função de cleanup */
export function ouvirMensagensForeground(onReceber) {
  return onMessage(messaging, payload => {
    const title = payload.notification?.title || "Afine Obras";
    const body  = payload.notification?.body  || "";

    // Mostra notificação do browser mesmo com o app aberto
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/logo.png",
        badge: "/logo.png",
        tag: payload.data?.tipo || "afine",
      });
    }

    // Callback opcional para o app reagir (ex: toast in-app)
    onReceber?.({ title, body, data: payload.data });
  });
}
