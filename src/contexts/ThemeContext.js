import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext({});

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("afine-theme") === "dark"; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    try { localStorage.setItem("afine-theme", darkMode ? "dark" : "light"); } catch {}
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(v => !v);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
