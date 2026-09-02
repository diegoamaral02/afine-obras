// src/services/pushNotificacoes.js
// Gerencia token FCM: solicita permissão, obtém token e salva no Firestore.
// Usa dynamic import para evitar crash em browsers que não suportam FCM
// (modo privado do Firefox/Safari, browsers antigos, etc.).
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, app } from "../firebase";

const VAPID_KEY = "BK8biI6P-cWbgOhSozJ5nOrfKFh5Rn-PNMaRnwKhCgVNl6fkcS1TjJe8bUINrilwC62UOHzwEvJmRuvjrIRbmyc";

/** Retorna a instância de messaging se o ambiente suportar, ou null */
async function getMessagingInstance() {
  try {
    const { isSupported, getMessaging } = await import("firebase/messaging");
    if (!(await isSupported())) return null;
    return getMessaging(app);
  } catch {
    return null;
  }
}

/** Solicita permissão e registra o token FCM do dispositivo */
export async function registrarTokenPush(uid) {
  if (!uid || !("Notification" in window)) return null;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return null;

    const { getToken } = await import("firebase/messaging");
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return null;

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
export async function ouvirMensagensForeground(onReceber) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};

  const { onMessage } = await import("firebase/messaging");
  return onMessage(messaging, payload => {
    const title = payload.notification?.title || "Afine Obras";
    const body  = payload.notification?.body  || "";

    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/logo.png",
        badge: "/logo.png",
        tag: payload.data?.tipo || "afine",
      });
    }
    onReceber?.({ title, body, data: payload.data });
  });
}
