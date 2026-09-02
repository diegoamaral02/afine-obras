// functions/index.js — Node 22 runtime
// Dispara push notification via FCM quando uma nova notificação é criada no Firestore.
// Deploy: firebase deploy --only functions  (na pasta raiz do projeto)
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getMessaging }      = require("firebase-admin/messaging");
const { getFirestore }      = require("firebase-admin/firestore");

initializeApp();
const db        = getFirestore();
const fcm       = getMessaging();

// Gatilho: nova notificação criada em notificacoes/{uid}/items/{docId}
exports.enviarPushNotificacao = onDocumentCreated(
  "notificacoes/{uid}/items/{docId}",
  async event => {
    const uid    = event.params.uid;
    const notif  = event.data?.data();
    if (!notif) return;

    // Busca todos os tokens FCM do usuário destinatário
    const tokensSnap = await db
      .collection("usuarios").doc(uid).collection("fcmTokens")
      .get();

    if (tokensSnap.empty) return;

    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
    if (!tokens.length) return;

    const mensagem = {
      notification: {
        title: notif.titulo || "Afine Obras",
        body:  notif.corpo  || "",
      },
      data: {
        tipo: notif.tipo  || "info",
        link: notif.link  || "/",
      },
      tokens,
    };

    try {
      const resp = await fcm.sendEachForMulticast(mensagem);

      // Remove tokens inválidos do Firestore
      const invalidos = [];
      resp.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalidos.push(tokens[i]);
          }
        }
      });

      if (invalidos.length) {
        const batch = db.batch();
        tokensSnap.docs.forEach(d => {
          if (invalidos.includes(d.data().token)) batch.delete(d.ref);
        });
        await batch.commit();
      }
    } catch (err) {
      console.error("FCM erro:", err);
    }
  }
);
