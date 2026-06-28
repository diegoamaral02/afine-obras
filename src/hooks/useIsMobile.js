// src/hooks/useIsMobile.js
// Detecta tela estreita (celular) para alternar layouts densos (tabelas, grades)
// por versões verticais/empilhadas mais confortáveis de usar com o dedo.
import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth <= breakpoint);
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth <= breakpoint); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}
