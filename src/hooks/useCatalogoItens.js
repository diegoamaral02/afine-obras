// src/hooks/useCatalogoItens.js
// USA getDocs (leitura única) em vez de onSnapshot para não consumir cota do Firestore.
// Recarrega manualmente após cada operação de escrita (add/edit/remove).

import { useState, useEffect, useCallback } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { CATEGORIAS_COMPRAS } from "../constants/itensCompras";

export function useCatalogoItens() {
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Carrega do Firestore (leitura única) ─────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "catalogo_itens"));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Seed automático se vazio
      if (items.length === 0) {
        const batch = writeBatch(db);
        let ordem = 0;
        for (const cat of CATEGORIAS_COMPRAS) {
          for (const item of cat.itens) {
            const ref = doc(collection(db, "catalogo_itens"));
            batch.set(ref, {
              categoriaId:    cat.id,
              categoriaLabel: cat.label,
              categoriaCor:   cat.cor,
              descricao:      item.descricao,
              unidade:        item.unidade,
              fabricante:     item.fabricante || "",
              ordem:          ordem++,
              createdAt:      new Date().toISOString(),
            });
          }
        }
        await batch.commit();
        // Recarrega após seed
        const snap2 = await getDocs(collection(db, "catalogo_itens"));
        setDocs(snap2.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setDocs(items);
      }
    } catch(e) {
      console.error("useCatalogoItens:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Categorias derivadas ─────────────────────────────────────────────────
  const categorias = (() => {
    const map = new Map();
    for (const cat of CATEGORIAS_COMPRAS) {
      map.set(cat.id, { id: cat.id, label: cat.label, cor: cat.cor, itens: [] });
    }
    for (const d of docs) {
      if (!map.has(d.categoriaId)) {
        map.set(d.categoriaId, { id: d.categoriaId, label: d.categoriaLabel, cor: d.categoriaCor || "#4A4A4A", itens: [] });
      }
      map.get(d.categoriaId).itens.push(d);
    }
    for (const cat of map.values()) {
      cat.itens.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
    }
    return Array.from(map.values());
  })();

  // ── CRUD — cada operação recarrega localmente sem nova leitura Firestore ──

  const adicionarItem = useCallback(async (categoriaId, { descricao, unidade, fabricante = "" }) => {
    if (!descricao?.trim()) return;
    const catSeed  = CATEGORIAS_COMPRAS.find(c => c.id === categoriaId);
    const catLabel = catSeed?.label || categoriaId;
    const catCor   = catSeed?.cor   || "#4A4A4A";
    const maxOrdem = docs.filter(d => d.categoriaId === categoriaId)
      .reduce((max, d) => Math.max(max, d.ordem ?? 0), 0);
    const novoDoc = {
      categoriaId,
      categoriaLabel: catLabel,
      categoriaCor:   catCor,
      descricao:      descricao.trim(),
      unidade:        unidade || "un",
      fabricante:     fabricante.trim(),
      ordem:          maxOrdem + 1,
      createdAt:      new Date().toISOString(),
    };
    const ref = await addDoc(collection(db, "catalogo_itens"), novoDoc);
    // Atualiza estado local sem reler o Firestore
    setDocs(prev => [...prev, { id: ref.id, ...novoDoc }]);
  }, [docs]);

  const editarItem = useCallback(async (id, campos) => {
    const atualizado = { ...campos, updatedAt: new Date().toISOString() };
    await updateDoc(doc(db, "catalogo_itens", id), atualizado);
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ...atualizado } : d));
  }, []);

  const removerItem = useCallback(async (id) => {
    await deleteDoc(doc(db, "catalogo_itens", id));
    setDocs(prev => prev.filter(d => d.id !== id));
  }, []);

  const adicionarCategoria = useCallback(async ({ id, label, cor }) => {
    if (!label?.trim()) return;
    const safeId = (id || label).trim().toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");
    const novoDoc = {
      categoriaId:    safeId,
      categoriaLabel: label.trim(),
      categoriaCor:   cor || "#4A4A4A",
      descricao:      "(clique para editar)",
      unidade:        "un",
      fabricante:     "",
      ordem:          9999,
      createdAt:      new Date().toISOString(),
    };
    const ref = await addDoc(collection(db, "catalogo_itens"), novoDoc);
    setDocs(prev => [...prev, { id: ref.id, ...novoDoc }]);
  }, []);

  return { categorias, loading, adicionarItem, editarItem, removerItem, adicionarCategoria };
}
