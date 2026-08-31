// src/services/pushNotifications.js
// Push notifications via Web Push API (independente do Firebase)
// O SW em public/sw.js já possui o handler de push e notificationclick.
//
// Para ativar envio de servidor:
// 1. Gerar chaves VAPID: npx web-push generate-vapid-keys
// 2. Salvar VAPID_PUBLIC_KEY abaixo
// 3. No servidor (ou Firebase Function), usar a chave privada para enviar pushes
//
// Sem servidor próprio: use Firebase Cloud Messaging (FCM) como alternativa
// — basta habilitar Cloud Messaging no Firebase Console e substituir
// o requestPermission abaixo por getToken(messaging, { vapidKey }).

// ── Substituir pela chave pública VAPID do seu projeto ────────────────────────
// Gerada em: npx web-push generate-vapid-keys --universal
const VAPID_PUBLIC_KEY = "BFEbLdW2rGL6vu3htRpe5vhwzVNt04vw3G5di466GpNL-fYm1yR1ITo68H2cK5pTGJVLTRPg0sD9Dl7fNLhJd8A";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/**
 * Solicita permissão e retorna a PushSubscription do usuário.
 * Retorna null se negado ou se VAPID não estiver configurado.
 */
export async function subscribePush() {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[Push] VAPID_PUBLIC_KEY não configurada.");
    return null;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

  const reg = await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

/**
 * Cancela a subscrição do usuário atual.
 */
export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}

/**
 * Retorna a subscrição atual sem solicitar permissão.
 */
export async function getSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Verifica se o browser suporta Push API.
 */
export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Retorna o estado atual da permissão: 'default' | 'granted' | 'denied'
 */
export function notificationPermission() {
  return "Notification" in window ? Notification.permission : "denied";
}
