// src/firebase.js
// ─────────────────────────────────────────────────────────────────────────────
// SUBSTITUA os valores abaixo pelos da sua conta Firebase:
// Firebase Console → Seu projeto → Configurações → Adicionar app Web
// ─────────────────────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getAuth }       from "firebase/auth";
import { getFirestore }  from "firebase/firestore";
import { getStorage }    from "firebase/storage";
import { getMessaging }  from "firebase/messaging";

const firebaseConfig = {
  apiKey:            "AIzaSyBzhRx4tCtVzxhSfSp7_A3aKBazAoIDySI",
  authDomain:        "afine-obras-deaeb.firebaseapp.com",
  projectId:         "afine-obras-deaeb",
  storageBucket:     "afine-obras-deaeb.firebasestorage.app",
  messagingSenderId: "445289736678",
  appId:             "1:445289736678:web:10fdb656ca1ae81cb6ce27",
};

const app      = initializeApp(firebaseConfig);
export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const messaging = getMessaging(app);
export default app;
