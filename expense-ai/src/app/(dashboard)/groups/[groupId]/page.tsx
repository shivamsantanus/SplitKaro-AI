"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import {
  ArrowLeft,
  Settings,
  Send,
  Plus,
  Sparkles,
  Check,
  UtensilsCrossed,
  Clock,
  ChevronRight
} from "lucide-react"

interface Message {
  id: number
  type: string
  sender?: string
  initials?: string
  content?: string
  title?: string
  amount?: number
  paidBy?: string
  splitWith?: string[]
  timestamp: string
  suggestion?: {
    title: string
    amount: number
    participants: string[]
  }
}

const mockMessages: Message[] = [
  {
    id: 1,
    type: "text",
    sender: "Rahul",
    initials: "RA",
    content: "Where are you guys?",
    timestamp: "10:30 AM",
  },
  {
    id: 2,
    type: "expense",
    title: "Dinner at Brittos",
    amount: 1200,
    paidBy: "Rahul",
    splitWith: ["You", "Aman"],
    timestamp: "10:31 AM",
  },
  {
    id: 3,
    type: "settlement",
    sender: "Rahul", // payer
    content: "you", // receiver
    amount: 400,
    timestamp: "11:00 AM",
  },
  {
    id: 4,
    type: "ai-suggestion",
    suggestion: {
      title: "Taxi to Airport",
      amount: 800,
      participants: ["Rahul", "Aman", "Priya"],
    },
    timestamp: "11:30 AM",
  },
];

export default function GroupDetailPage({ params }: { params: { groupId: string } }) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [showExpenseModal, setShowExpenseModal] = useState(false)

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <div className="bg-primary text-white border-b border-primary-600 px-6 py-4 shadow-lg shrink-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold">Goa Trip</h1>
              <div className="flex items-center gap-2 mt-0.5 opacity-90">
                 <div className="flex -space-x-1">
                    {["SH", "RA", "AM"].map((initial, i) => (
                      <div key={i} className="w-5 h-5 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-[8px] font-bold">
                        {initial}
                      </div>
                    ))}
                 </div>
                 <span className="text-xs font-medium">5 members</span>
              </div>
            </div>
          </div>
          <button 
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="Group settings"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Chat Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-4xl mx-auto w-full">
        {mockMessages.map((msg) => {
          if (msg.type === "text") {
            return (
              <div key={msg.id} className="flex gap-4 animate-in">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                  {msg.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span className="text-sm font-bold text-slate-900">{msg.sender}</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase">{msg.timestamp}</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 inline-block max-w-[85%]">
                    <p className="text-sm text-slate-700 leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              </div>
            );
          }

          if (msg.type === "expense") {
            return (
              <Card
                key={msg.id}
                className="p-5 rounded-3xl bg-white shadow-sm border border-slate-100 animate-in overflow-hidden relative"
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                      <UtensilsCrossed className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{msg.title}</h4>
                      <p className="text-xl font-bold text-primary mt-1">₹{msg.amount?.toLocaleString()}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-medium text-slate-500">
                  <p>Paid by <span className="text-slate-900 font-bold">{msg.paidBy}</span></p>
                  <p>Split with <span className="text-slate-900 font-bold">{msg.splitWith?.length} others</span></p>
                </div>
              </Card>
            );
          }

          if (msg.type === "settlement") {
            return (
              <div key={msg.id} className="flex justify-center py-2 animate-in">
                <div className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-full border border-emerald-100 flex items-center gap-3 shadow-sm">
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <p className="text-sm font-bold">
                    {msg.sender} paid {msg.content} <span className="ml-1 text-base">₹{msg.amount}</span>
                  </p>
                </div>
              </div>
            );
          }

          if (msg.type === "ai-suggestion") {
            return (
              <Card
                key={msg.id}
                className="p-5 rounded-3xl bg-slate-900 text-white shadow-xl animate-in border-0 overflow-hidden group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-base">AI detected an expense</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      &quot;{msg.suggestion?.title}&quot; for ₹{msg.suggestion?.amount}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <Button className="flex-1 rounded-2xl h-12 bg-primary hover:bg-primary-600 border-0 font-bold">
                    Confirm
                  </Button>
                  <Button variant="ghost" className="flex-1 rounded-2xl h-12 text-white hover:bg-white/10 font-bold border border-white/10">
                    Ignore
                  </Button>
                </div>
              </Card>
            );
          }

          return null;
        })}
      </div>

      {/* Bottom Input Bar */}
      <div className="border-t border-slate-100 bg-white px-6 py-6 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <div className="flex gap-3 items-center max-w-4xl mx-auto w-full">
           <button
            onClick={() => setShowExpenseModal(true)}
            className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Add expense"
          >
            <Plus className="w-7 h-7" />
          </button>
          <div className="relative flex-1">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask AI or type message..."
              className="h-14 rounded-2xl bg-slate-50 border-0 focus-visible:ring-1 focus-visible:ring-primary/20 pl-5 pr-14 text-slate-700 font-medium"
            />
             <button
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${message.trim() ? 'bg-primary text-white scale-100' : 'text-slate-300 scale-90'}`}
              disabled={!message.trim()}
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Expense Modal Container */}
      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add Expense">
         <div className="space-y-8 animate-in">
            <div className="text-center py-6">
               <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-2">Total Amount</p>
               <div className="flex items-center justify-center">
                  <span className="text-4xl font-bold text-slate-900 mr-2">₹</span>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="text-6xl font-black text-slate-900 bg-transparent border-0 outline-none w-48 text-center placeholder:text-slate-100"
                  />
               </div>
            </div>

            <div className="space-y-4">
               <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">What was this for?</label>
                  <Input placeholder="Enter a description" className="h-14 rounded-2xl bg-slate-50 border-0" />
               </div>

               <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Splitting with</label>
                  <div className="flex flex-wrap gap-2">
                     {["Rahul", "Aman", "Priya", "Neha"].map(name => (
                       <div key={name} className="px-5 py-3 bg-slate-50 rounded-2xl text-sm font-bold text-slate-700 border-2 border-transparent hover:border-primary/20 cursor-pointer transition-all">
                          {name}
                       </div>
                     ))}
                  </div>
               </div>
            </div>

            <Button className="w-full h-16 rounded-3xl text-lg font-black shadow-xl shadow-primary/20" onClick={() => setShowExpenseModal(false)}>
               Save Expense
            </Button>
         </div>
      </Modal>
    </div>
  )
}
