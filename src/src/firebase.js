// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// SUBSTITUA os valores abaixo pelos da sua conta Firebase:
// Firebase Console → Seu projeto → Configurações → Adicionar app Web
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getAuth }       from "firebase/auth";
import { getFirestore }  from "firebase/firestore";

// Sem Firebase Storage — fotos e OS são salvas como base64 no Firestore.
// Plano GRATUITO (Spark) — sem cartão de crédito necessário.

const firebaseConfig = {
  apiKey:            "COLE_AQUI_SUA_API_KEY",
  authDomain:        "COLE_AQUI.firebaseapp.com",
  projectId:         "COLE_AQUI_SEU_PROJECT_ID",
  storageBucket:     "COLE_AQUI.appspot.com",
  messagingSenderId: "COLE_AQUI",
  appId:             "COLE_AQUI",
};

const app     = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;
