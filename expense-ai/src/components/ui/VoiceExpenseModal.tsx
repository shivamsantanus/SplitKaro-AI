"use client"

import { useState, useRef } from "react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Mic, MicOff, Loader2, Check, X, RefreshCw } from "lucide-react"
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories"

type Stage = "idle" | "recording" | "parsing" | "preview" | "saving"

type ParsedExpense = {
  description: string
  amount: number
  category: string
  transactionDate: string
}

interface VoiceExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function VoiceExpenseModal({ isOpen, onClose, onSuccess }: VoiceExpenseModalProps) {
  const [stage, setStage] = useState<Stage>("idle")
  const [transcript, setTranscript] = useState("")
  const [expenses, setExpenses] = useState<ParsedExpense[]>([])
  const [error, setError] = useState("")
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef("")

  const reset = () => {
    setStage("idle")
    setTranscript("")
    setExpenses([])
    setError("")
    transcriptRef.current = ""
  }

  const handleClose = () => {
    try { recognitionRef.current?.stop() } catch {}
    reset()
    onClose()
  }

  const startRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError("Voice input requires Chrome or Edge. Please use one of those browsers.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-IN"

    recognition.onresult = (event: any) => {
      let final = ""
      let interim = ""
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + " "
        } else {
          interim += event.results[i][0].transcript
        }
      }
      transcriptRef.current = final
      setTranscript(final + interim)
    }

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setError("Microphone permission denied. Please allow microphone access.")
      } else if (event.error !== "aborted") {
        setError("Microphone error: " + event.error)
      }
      setStage("idle")
    }

    recognitionRef.current = recognition
    recognition.start()
    setStage("recording")
    setTranscript("")
    setError("")
    transcriptRef.current = ""
  }

  const stopRecording = async () => {
    recognitionRef.current?.stop()

    const text = transcriptRef.current.trim() || transcript.trim()

    if (!text) {
      setError("No speech detected. Please try again.")
      setStage("idle")
      return
    }

    setStage("parsing")

    try {
      const res = await fetch("/api/personal/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "Failed to parse expenses.")
        setStage("idle")
        return
      }

      setExpenses(data.expenses)
      setStage("preview")
    } catch {
      setError("Failed to reach the server. Please try again.")
      setStage("idle")
    }
  }

  const updateExpense = (index: number, field: keyof ParsedExpense, value: string | number) => {
    setExpenses((prev) =>
      prev.map((exp, i) => (i === index ? { ...exp, [field]: value } : exp))
    )
  }

  const removeExpense = (index: number) => {
    setExpenses((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      if (updated.length === 0) setStage("idle")
      return updated
    })
  }

  const saveAll = async () => {
    setStage("saving")
    setError("")
    try {
      const results = await Promise.allSettled(
        expenses.map((exp) =>
          fetch("/api/personal/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(exp),
          })
        )
      )

      const failed = results.filter((r) => r.status === "rejected").length
      if (failed > 0) {
        setError(`${failed} expense(s) failed to save. Please retry.`)
        setStage("preview")
        return
      }

      reset()
      onSuccess()
      onClose()
    } catch {
      setError("Something went wrong while saving.")
      setStage("preview")
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Voice Expenses">

      {/* Idle */}
      {stage === "idle" && (
        <div className="flex flex-col items-center gap-6 py-4 min-h-[260px]">
          <button
            onClick={startRecording}
            className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-transform"
          >
            <Mic className="w-10 h-10 text-white" />
          </button>
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-slate-900">Tap to start speaking</p>
            <p className="text-xs text-slate-400">Say all your expenses naturally</p>
            <p className="text-[10px] text-slate-300 font-medium mt-2">
              e.g. "Coffee 80, lunch 250 at canteen, Uber 120"
            </p>
          </div>
          {error && (
            <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 text-center w-full">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Recording */}
      {stage === "recording" && (
        <div className="flex flex-col items-center gap-5 py-4 min-h-[260px]">
          <button
            onClick={stopRecording}
            className="w-24 h-24 rounded-3xl bg-rose-500 flex items-center justify-center shadow-xl shadow-rose-500/30 hover:scale-105 active:scale-95 transition-transform animate-pulse"
          >
            <MicOff className="w-10 h-10 text-white" />
          </button>
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-500">
            Listening — tap to stop
          </p>
          {transcript ? (
            <div className="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-700 leading-relaxed">{transcript}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-300 animate-pulse">Waiting for speech...</p>
          )}
        </div>
      )}

      {/* Parsing */}
      {stage === "parsing" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 min-h-[260px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary opacity-60" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Parsing your expenses...
          </p>
        </div>
      )}

      {/* Preview */}
      {stage === "preview" && (
        <div className="-mx-6 -mb-12 flex flex-col">

          {/* Tight header */}
          <div className="flex items-center justify-between px-6 pb-3">
            <p className="text-xs font-black text-slate-700 uppercase tracking-widest">
              Found <span className="text-primary">{expenses.length}</span> expense{expenses.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={reset}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Start over
            </button>
          </div>

          {/* Scrollable list — capped height so footer is always visible below */}
          <div className="px-6 space-y-1.5 overflow-y-auto overscroll-contain max-h-[50vh] pb-2">
            {expenses.map((exp, i) => {
              // Heuristic: flag items the AI likely guessed at
              const uncertain = exp.category === "OTHER" || exp.amount === 0
              return (
                <div
                  key={i}
                  className={`rounded-xl p-2 space-y-1.5 overflow-hidden ${
                    uncertain
                      ? "bg-amber-50/70 ring-1 ring-amber-200/70"
                      : "bg-slate-50/80"
                  }`}
                >
                  {/* Top row: description + delete */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <input
                      type="text"
                      value={exp.description}
                      onChange={(e) => updateExpense(i, "description", e.target.value)}
                      placeholder="Description"
                      className="flex-1 min-w-0 h-8 rounded-lg bg-white/80 px-2.5 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:bg-white transition-colors"
                    />
                    <button
                      onClick={() => removeExpense(i)}
                      className="shrink-0 w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-400 hover:bg-rose-100 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Bottom row: amount | category | date */}
                  <div className="flex gap-1.5 min-w-0">
                    {/* Amount */}
                    <div className={`flex items-center gap-1 w-24 shrink-0 h-8 rounded-lg px-2 focus-within:bg-white transition-colors ${
                      exp.amount === 0 ? "bg-amber-100/60" : "bg-white/80"
                    }`}>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">₹</span>
                      <input
                        type="number"
                        value={exp.amount || ""}
                        onChange={(e) => updateExpense(i, "amount", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="flex-1 min-w-0 text-xs font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-300"
                      />
                    </div>

                    {/* Category */}
                    <select
                      value={exp.category}
                      onChange={(e) => updateExpense(i, "category", e.target.value)}
                      className={`flex-1 min-w-0 h-8 rounded-lg px-2 text-[10px] font-black text-slate-700 outline-none focus:bg-white transition-colors cursor-pointer ${
                        exp.category === "OTHER" ? "bg-amber-100/60" : "bg-white/80"
                      }`}
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>

                    {/* Date */}
                    <input
                      type="date"
                      value={exp.transactionDate}
                      onChange={(e) => updateExpense(i, "transactionDate", e.target.value)}
                      className="w-28 shrink-0 h-8 rounded-lg bg-white/80 px-2 text-[10px] font-medium text-slate-600 outline-none focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Error */}
          {error && (
            <div className="px-6 pt-2">
              <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 text-center">
                {error}
              </p>
            </div>
          )}

          {/* Footer — sits below the capped list, no sticky needed */}
          <div className="px-6 pt-3 pb-6 bg-white border-t border-slate-50 mt-2">
            <Button
              onClick={saveAll}
              className="w-full rounded-2xl py-4 font-black text-sm"
            >
              <Check className="w-4 h-4 mr-2 stroke-[3]" />
              Add {expenses.length} Expense{expenses.length !== 1 ? "s" : ""}
            </Button>
            <button
              onClick={handleClose}
              className="w-full mt-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Saving */}
      {stage === "saving" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 min-h-[260px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary opacity-60" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Saving {expenses.length} expense{expenses.length !== 1 ? "s" : ""}...
          </p>
        </div>
      )}

    </Modal>
  )
}
