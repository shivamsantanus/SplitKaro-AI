"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"
export type ColorTheme = "emerald" | "ocean" | "violet" | "sunset" | "rose" | "teal"

// swatch = the brand --primary hex, used by the picker preview
export const THEMES: { id: ColorTheme; swatch: string }[] = [
  { id: "emerald", swatch: "#16a34a" },
  { id: "ocean", swatch: "#2563eb" },
  { id: "violet", swatch: "#7c3aed" },
  { id: "sunset", swatch: "#ea580c" },
  { id: "rose", swatch: "#e11d48" },
  { id: "teal", swatch: "#0d9488" },
]

const DEFAULT_COLOR_THEME: ColorTheme = "emerald"
const VALID_THEMES = new Set(THEMES.map((t) => t.id))

const ThemeContext = createContext<{
  theme: Theme
  toggle: () => void
  colorTheme: ColorTheme
  setColorTheme: (t: ColorTheme) => void
}>({
  theme: "light",
  toggle: () => {},
  colorTheme: DEFAULT_COLOR_THEME,
  setColorTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light")
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(DEFAULT_COLOR_THEME)

  useEffect(() => {
    // Sync React state from what the pre-hydration <head> script already applied.
    // setState-in-effect is deliberate: reading the DOM during render would cause a
    // hydration mismatch on theme-dependent UI (the toggle icon, picker selection).
    /* eslint-disable react-hooks/set-state-in-effect */
    const isDark = document.documentElement.classList.contains("dark")
    setTheme(isDark ? "dark" : "light")

    const applied = document.documentElement.dataset.theme
    setColorThemeState(applied && VALID_THEMES.has(applied as ColorTheme) ? (applied as ColorTheme) : DEFAULT_COLOR_THEME)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light"
    setTheme(next)
    localStorage.setItem("theme", next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  const setColorTheme = (next: ColorTheme) => {
    setColorThemeState(next)
    localStorage.setItem("colorTheme", next)
    document.documentElement.dataset.theme = next
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
