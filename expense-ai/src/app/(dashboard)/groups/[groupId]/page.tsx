"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
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
  ChevronRight,
  Loader2
} from "lucide-react"

export default function GroupDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()
  const groupId = params.groupId as string

  const [group, setGroup] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [targetEmail, setTargetEmail] = useState("")
  const [paidByUserId, setPaidByUserId] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [memberError, setMemberError] = useState("")
  const [isParsing, setIsParsing] = useState(false)

  const fetchGroupData = useCallback(async () => {
    if (!groupId) return;
    try {
      const response = await fetch(`/api/groups/${groupId}`)
      if (response.ok) {
        const data = await response.json()
        setGroup(data)
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch group:", errorData.message);
        router.push("/dashboard")
      }
    } catch (err) {
      console.error("Error in fetchGroupData:", err)
      router.push("/dashboard")
    } finally {
      setLoading(false)
    }
  }, [groupId, router])

  useEffect(() => {
    if (groupId) fetchGroupData()
  }, [groupId, fetchGroupData])

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    setIsParsing(true);

    try {
      const response = await fetch(`/api/groups/${groupId}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (response.ok && data.suggestion) {
        // AI found an expense! Pre-fill the modal
        setAmount(data.suggestion.amount.toString());
        setDescription(data.suggestion.description);
        setPaidByUserId(data.suggestion.paidByUserId);
        setMessage(""); // Clear chat
        setShowExpenseModal(true); // Open the pre-filled modal
      } else {
        // If not an expense, maybe just standard chat (optional)
        console.log("Not an expense:", data.error || data.message);
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
    } finally {
      setIsParsing(false);
    }
  }

  const handleAddExpense = async () => {
    if (!amount || !description) return
    setIsSaving(true)

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description,
          groupId,
          paidById: paidByUserId || undefined,
        }),
      })

      if (response.ok) {
        setAmount("")
        setDescription("")
        setPaidByUserId("")
        setShowExpenseModal(false)
        fetchGroupData() // Refresh group data to show new expense
      } else {
        console.error("Failed to add expense");
      }
    } catch (err) {
      console.error("Expense creation failed", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddMember = async () => {
    if (!targetEmail) return
    setIsAddingMember(true)
    setMemberError("")

    try {
      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      })

      const data = await response.json()

      if (response.ok) {
        setTargetEmail("")
        setShowMemberModal(false)
        fetchGroupData()
      } else {
        setMemberError(data.message || "Failed to add member")
      }
    } catch (err) {
      setMemberError("An error occurred")
      console.error("Error adding member:", err);
    } finally {
      setIsAddingMember(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!group) return null

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <div className="bg-primary text-white border-b border-primary-600 px-6 py-4 shadow-lg shrink-0 z-10 sticky top-0">
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
              <h1 className="text-xl font-bold">{group.name}</h1>
              <div className="flex items-center gap-2 mt-0.5 opacity-90">
                 <div className="flex -space-x-1">
                    {group.members.slice(0, 3).map((m: any, i: number) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-[10px] font-bold">
                        {m.user.name?.substring(0, 2).toUpperCase() || "U"}
                      </div>
                    ))}
                 </div>
                 <span className="text-xs font-medium">{group.members.length} members</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMemberModal(true)}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Add member"
              title="Add Member"
            >
              <Plus className="w-6 h-6" />
            </button>
            <button
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Group settings"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Expense/Chat Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-4xl mx-auto w-full pb-32">
        {group.expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
             <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
                <UtensilsCrossed className="w-8 h-8 text-slate-400" />
             </div>
             <p className="text-sm font-bold uppercase tracking-widest">No expenses yet</p>
             <p className="text-xs font-medium mt-1">Add friends, then add an expense!</p>
          </div>
        ) : (
          group.expenses.map((expense: any) => (
            <Card
              key={expense.id}
              className="p-5 rounded-3xl bg-white shadow-sm border border-slate-100/50 hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 relative group"
            >
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center transition-colors">
                    <UtensilsCrossed className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{expense.description}</h4>
                    <p className="text-xl font-bold text-primary mt-1">₹{expense.amount.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                  <Clock className="w-3 h-3 mb-1 ml-auto" />
                  {new Date(expense.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-medium text-slate-500">
                <p>Paid by <span className="text-slate-900 font-bold">{(session?.user as any)?.id === expense.paidById ? "You" : expense.payer.name}</span></p>
                <div className="flex items-center -space-x-1">
                   <span className="mr-2 opacity-60">Split with {expense.splits.length} people</span>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Bottom Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white px-6 py-6 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-20">
        <div className="flex gap-3 items-center max-w-4xl mx-auto w-full">
           <button
            onClick={() => setShowExpenseModal(true)}
            className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center hover:bg-primary-600 transition-all shadow-lg active:scale-95 shrink-0"
            aria-label="Add expense"
          >
            <Plus className="w-8 h-8 stroke-[3]" />
          </button>
          <div className="relative flex-1">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder="Ask AI or type 'paid 500 for lunch'..."
              className="h-14 rounded-3xl bg-slate-50 border-0 focus-visible:ring-1 focus-visible:ring-primary/20 pl-6 pr-14 text-slate-700 font-semibold"
              disabled={isParsing}
            />
             <button
              onClick={handleSendMessage}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${message.trim() && !isParsing ? 'bg-primary text-white scale-100 hover:bg-primary-600' : 'text-slate-300 scale-90'}`}
              disabled={!message.trim() || isParsing}
              aria-label="Send message"
            >
              {isParsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal isOpen={showMemberModal} onClose={() => setShowMemberModal(false)} title="Add Friend">
         <div className="space-y-6">
            <div className="text-center">
               <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-10 h-10 text-primary" />
               </div>
               <h3 className="text-lg font-bold text-slate-900">Add to Group</h3>
               <p className="text-sm text-slate-500 mt-1">Enter your friend's email address</p>
            </div>

            <div className="space-y-4">
               <div>
                  <label htmlFor="member-email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Email Address</label>
                  <Input
                    id="member-email"
                    placeholder="friend@example.com"
                    className="h-14 rounded-2xl bg-slate-50 border-transparent focus:border-primary/20 text-base font-medium"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    type="email"
                    autoFocus
                  />
                  {memberError && (
                    <p className="text-xs text-rose-500 mt-2 ml-1 font-bold">{memberError}</p>
                  )}
               </div>
            </div>

            <Button
               className="w-full h-16 rounded-3xl text-lg font-black shadow-xl shadow-primary/20 transition-all active:scale-95"
               disabled={isAddingMember || !targetEmail}
               onClick={handleAddMember}
            >
               {isAddingMember ? "Adding..." : "Add to Group"}
            </Button>
         </div>
      </Modal>

      {/* Add Expense Modal */}
      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add Expense">
         <div className="space-y-8">
            <div className="text-center py-4 bg-slate-50 rounded-3xl border border-slate-100">
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5 opacity-60">Total Amount</p>
               <div className="flex items-center justify-center">
                  <span className="text-3xl font-black text-slate-400 mr-2">₹</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-5xl font-black text-slate-900 bg-transparent border-0 outline-none w-52 text-center placeholder:text-slate-200"
                    autoFocus
                  />
               </div>
            </div>

            <div className="space-y-4">
               <div>
                  <label htmlFor="expense-description" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">What was this for?</label>
                  <Input
                    id="expense-description"
                    placeholder="Ex. Grocery, Dinner, Taxi"
                    className="h-14 rounded-2xl bg-slate-50 border-transparent focus:border-primary/20 text-base font-bold"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
               </div>

               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Splitting equally with</label>
                  <div className="flex flex-wrap gap-2">
                     {group.members.map((m: any) => (
                       <div key={m.userId} className="px-5 py-3 bg-white rounded-2xl text-xs font-bold text-slate-600 border border-slate-100 flex items-center gap-2 shadow-sm">
                          <Check className="w-3.5 h-3.5 text-primary stroke-[4]" />
                          {(session?.user as any)?.id === m.userId ? "You" : m.user.name}
                       </div>
                     ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3 font-medium px-1">
                    Split will be approximately <span className="text-slate-900 font-bold">₹{(parseFloat(amount || "0") / group.members.length).toFixed(1)}</span> per person.
                  </p>
               </div>
            </div>

            <Button
               className="w-full h-16 rounded-3xl text-lg font-black shadow-xl shadow-primary/20 transition-all active:scale-95"
               disabled={isSaving || !amount || !description}
               onClick={handleAddExpense}
            >
               {isSaving ? "Saving..." : "Save Expense"}
            </Button>
         </div>
      </Modal>
    </div>
  )
}
