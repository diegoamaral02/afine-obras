// src/contexts/AuthContext.js — v2 sem credencial hardcoded
import React, { createContext, useContext, useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext();
export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [loading,      setLoading]      = useState(true);

  async function fetchProfile(uid) {
    try {
      const snap = await getDoc(doc(db, "usuarios", uid));
      if (snap.exists()) return snap.data();
    } catch {}
    return null;
  }

  async function login(email, password) {
    // SEGURANÇA: removido bypass de teste — toda autenticação passa pelo Firebase
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await fetchProfile(cred.user.uid);
    setUserProfile(profile || { nome: cred.user.email, perfil: "campo", obras: [] });
    return cred;
  }

  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  function logout() {
    setUserProfile(null);
    return signOut(auth);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const profile = await fetchProfile(user.uid);
        setUserProfile(profile || { nome: user.email, perfil: "campo", obras: [] });
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, login, logout, resetPassword, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
