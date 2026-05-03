"use client"

import { createContext, useContext, useEffect, useState } from "react"
import en from "@/locales/en.json"
import hi from "@/locales/hi.json"
import or from "@/locales/or.json"

export type Language = "en" | "hi" | "or"

const LOCALES: Record<Language, Record<string, any>> = { en, hi, or }

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  hi: "हिंदी",
  or: "ଓଡ଼ିଆ",
}

export const LANGUAGES: Language[] = ["en", "hi", "or"]

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
})

function resolve(obj: Record<string, any>, path: string): string | undefined {
  const result = path.split(".").reduce((acc: any, key) => acc?.[key], obj)
  return typeof result === "string" ? result : undefined
}

function interpolate(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>("en")

  useEffect(() => {
    try {
      const saved = localStorage.getItem("language") as Language
      if (saved && LOCALES[saved]) setLang(saved)
    } catch {}
  }, [])

  const setLanguage = (lang: Language) => {
    setLang(lang)
    try { localStorage.setItem("language", lang) } catch {}
  }

  const t = (key: string, vars?: Record<string, string | number>): string => {
    const str =
      resolve(LOCALES[language], key) ??
      resolve(LOCALES.en, key) ??
      key
    return vars ? interpolate(str, vars) : str
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
