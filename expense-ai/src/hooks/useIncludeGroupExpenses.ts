"use client"

import { useCallback, useSyncExternalStore } from "react"

const STORAGE_KEY = "personal:includeGroupExpenses"
const CHANGE_EVENT = "personal-include-group-change"

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) !== "false"
}

// Server render defaults to on; useSyncExternalStore reconciles to the stored
// value after hydration without a mismatch warning.
function getServerSnapshot() {
  return true
}

export function useIncludeGroupExpenses() {
  const includeGroup = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setValue = useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // localStorage may be unavailable (private mode) — non-fatal.
    }
    // storage events don't fire in the tab that wrote them; notify locally.
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return [includeGroup, setValue] as const
}
