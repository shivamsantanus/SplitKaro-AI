"use client"

import { useState, useRef } from "react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Input } from "./Input"
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
      <div className="space-y-6 min-h-[260px]">

        {/* Idle */}
        {stage === "idle" && (
          <div className="flex flex-col items-center gap-6 py-4">
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
          <div className="flex flex-col items-center gap-5 py-4">
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
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-60" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Parsing your expenses...
            </p>
          </div>
        )}

        {/* Preview */}
        {stage === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-slate-900">
                Found {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Start over
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto overflow-x-hidden pr-1">
              {expenses.map((exp, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-2 overflow-hidden">
                  {/* Description + delete */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Input
                      value={exp.description}
                      onChange={(e) => updateExpense(i, "description", e.target.value)}
                      className="h-10 rounded-xl text-sm font-bold bg-white border-slate-100 flex-1 min-w-0"
                      placeholder="Description"
                    />
                    <button
                      onClick={() => removeExpense(i)}
                      className="shrink-0 w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-400 hover:bg-rose-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Amount + date */}
                  <div className="flex gap-2 min-w-0">
                    <div className="h-10 flex-1 min-w-0 flex items-center gap-1.5 rounded-xl border border-slate-100 bg-white px-3 focus-within:ring-2 focus-within:ring-ring">
                      <span className="text-xs font-bold text-slate-400 shrink-0">₹</span>
                      <input
                        type="number"
                        value={exp.amount}
                        onChange={(e) =>
                          updateExpense(i, "amount", parseFloat(e.target.value) || 0)
                        }
                        className="flex-1 min-w-0 text-sm font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-300"
                        placeholder="0"
                      />
                    </div>
                    <Input
                      type="date"
                      value={exp.transactionDate}
                      onChange={(e) => updateExpense(i, "transactionDate", e.target.value)}
                      className="h-10 flex-1 min-w-0 rounded-xl text-xs bg-white border-slate-100 px-2"
                    />
                  </div>

                  {/* Category */}
                  <select
                    value={exp.category}
                    onChange={(e) => updateExpense(i, "category", e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-100 bg-white px-3 text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 text-center">
                {error}
              </p>
            )}

            <Button
              onClick={saveAll}
              className="w-full rounded-2xl py-6 font-black text-base"
            >
              <Check className="w-5 h-5 mr-3 stroke-[3]" />
              Add {expenses.length} Expense{expenses.length !== 1 ? "s" : ""}
            </Button>
          </div>
        )}

        {/* Saving */}
        {stage === "saving" && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary opacity-60" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Saving {expenses.length} expense{expenses.length !== 1 ? "s" : ""}...
            </p>
          </div>
        )}

      </div>
    </Modal>
  )
}
