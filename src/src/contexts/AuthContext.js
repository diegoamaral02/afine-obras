// src/contexts/AuthContext.js — Fixed: single "usuarios" collection, no duplication
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();
export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile]  = useState(null);
  const [loading,     setLoading]      = useState(true);

  async function fetchProfile(uid) {
    try {
      const snap = await getDoc(doc(db, "usuarios", uid));
      if (snap.exists()) return snap.data();
    } catch {}
    return null;
  }

  async function login(email, password) {
    // Login de teste local (sem Firebase configurado)
    if (email === "teste@afine.com" && password === "123456") {
      const fakeUser = { uid:"local-teste", email };
      setCurrentUser(fakeUser);
      setUserProfile({ nome:"Diego Nery (Teste)", perfil:"gestor", obras:[] });
      setLoading(false);
      return;
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await fetchProfile(cred.user.uid);
    if (profile) setUserProfile(profile);
    return cred;
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  function logout() {
    if (currentUser?.uid === "local-teste") {
      setCurrentUser(null); setUserProfile(null);
      return Promise.resolve();
    }
    return signOut(auth);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (currentUser?.uid === "local-teste") { setLoading(false); return; }
      setCurrentUser(user);
      if (user) {
        const profile = await fetchProfile(user.uid);
        setUserProfile(profile || { nome: user.email, perfil:"campo", obras:[] });
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []); // eslint-disable-line

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, login, logout, resetPassword }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
