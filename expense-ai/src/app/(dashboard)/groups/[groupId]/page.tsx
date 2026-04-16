"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { EXPENSE_CATEGORIES, getExpenseCategoryIconName, getExpenseCategoryLabel, inferExpenseCategory } from "@/lib/expense-categories"
import { formatCurrency } from "@/lib/currency"
import {
  ArrowLeft,
  Settings,
  Send,
  Mic,
  MicOff,
  Plus,
  Sparkles,
  Check,
  UtensilsCrossed,
  Bus,
  Clock,
  ChevronRight,
  Loader2,
  Pencil,
  Film,
  HeartPulse,
  Home,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Briefcase,
  User,
  UserMinus,
  Wallet
} from "lucide-react"

type SpeechRecognitionAlternative = {
  transcript: string;
};

type SpeechRecognitionResult = {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
};

type SpeechRecognitionEvent = Event & {
  results: ArrayLike<SpeechRecognitionResult>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const iconName = getExpenseCategoryIconName(category)

  switch (iconName) {
    case "food":
      return <UtensilsCrossed className={className} />
    case "transport":
      return <Bus className={className} />
    case "groceries":
      return <ShoppingBag className={className} />
    case "entertainment":
      return <Film className={className} />
    case "travel":
      return <Briefcase className={className} />
    case "rent":
      return <Home className={className} />
    case "shopping":
      return <ShoppingBag className={className} />
    case "bills":
      return <Receipt className={className} />
    case "health":
      return <HeartPulse className={className} />
    default:
      return <Wallet className={className} />
  }
}

export default function GroupDetailPage() {
  type PendingAction =
    | {
        kind: "remove-member";
        memberId: string;
        title: string;
        message: string;
        confirmLabel: string;
      }
    | {
        kind: "leave-group";
        title: string;
        message: string;
        confirmLabel: string;
      };

  const router = useRouter()
  const params = useParams()
  const { data: session } = useSession()
  const groupId = params.groupId as string
  const isSoloGroup = groupId === "solo-transactions"

  const [group, setGroup] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [expenseCategory, setExpenseCategory] = useState("OTHER")
  const [targetEmail, setTargetEmail] = useState("")
  const [paidByUserId, setPaidByUserId] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [memberError, setMemberError] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)

  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [editGroupName, setEditGroupName] = useState("")
  const [editSimplifyDebts, setEditSimplifyDebts] = useState(false)
  
  // Custom Delete Modals
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null)

  // Advanced Splitting State
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal")
  const [activeSplitMembers, setActiveSplitMembers] = useState<string[]>([])
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})

  // Settlements State
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [settlePayerId, setSettlePayerId] = useState("")
  const [settleReceiverId, setSettleReceiverId] = useState("")
  const [settleAmount, setSettleAmount] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)

  const applyParsedSuggestion = useCallback((suggestion: {
    amount: number;
    description: string;
    paidByUserId?: string;
    splitMode?: "equal" | "custom";
    activeSplitMembers?: string[];
    customSplits?: Record<string, number>;
  }) => {
    setAmount(suggestion.amount.toString())
    setDescription(suggestion.description)
    setExpenseCategory(inferExpenseCategory(suggestion.description))
    setPaidByUserId(suggestion.paidByUserId || "")
    setSplitMode(suggestion.splitMode === "custom" ? "custom" : "equal")
    setActiveSplitMembers(
      suggestion.activeSplitMembers && suggestion.activeSplitMembers.length > 0
        ? suggestion.activeSplitMembers
        : group?.members.map((member: any) => member.userId) || []
    )
    setCustomSplits(
      Object.fromEntries(
        Object.entries(suggestion.customSplits || {}).map(([userId, splitAmount]) => [userId, splitAmount.toString()])
      )
    )
    setMessage("")
    setShowExpenseModal(true)
  }, [group?.members])

  const fetchGroupData = useCallback(async () => {
    if (!groupId) return;
    try {
      const response = await fetch(`/api/groups/${groupId}`)
      if (response.ok) {
        const data = await response.json()
        setGroup(data)
        setEditGroupName(data.name)
        setEditSimplifyDebts(Boolean(data.simplifyDebts))
        return
      }

      if (response.status === 403 || response.status === 404) {
        router.push("/dashboard")
        return
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

  useEffect(() => {
    if (!groupId) return

    const eventSource = new EventSource("/api/events")

    const handleUpdate = (event: Event) => {
      const messageEvent = event as MessageEvent<string>

      try {
        const payload = JSON.parse(messageEvent.data)
        if (payload.groupId === groupId || (groupId === "solo-transactions" && payload.userId)) {
          fetchGroupData()
        }
      } catch (error) {
        console.error("Failed to process realtime event", error)
      }
    }

    eventSource.addEventListener("update", handleUpdate)

    return () => {
      eventSource.removeEventListener("update", handleUpdate)
      eventSource.close()
    }
  }, [groupId, fetchGroupData])

  const handleUpdateGroup = async () => {
    if (!editGroupName.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editGroupName, simplifyDebts: editSimplifyDebts }),
      });
      if (response.ok) {
        setShowSettingsModal(false);
        fetchGroupData();
      } else {
         setNotice({
           title: "Couldn’t Update Group",
           message: "You might not have permission to update this group.",
         })
      }
    } catch (err) {
      console.error("Failed to update group", err);
    } finally {
      setIsSaving(false);
    }
  }

  const handleDeleteGroup = () => setShowDeleteGroupConfirm(true)

  const confirmDeleteGroup = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/dashboard");
      } else {
        setNotice({
          title: "Couldn’t Delete Group",
          message: "You might not have permission to delete this group.",
        })
      }
    } catch (err) {
      console.error("Failed to delete group", err);
    } finally {
      setIsSaving(false);
      setShowDeleteGroupConfirm(false);
    }
  }

  const handleArchiveGroup = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      if (response.ok) {
        router.push("/dashboard");
      } else {
        const data = await response.json()
        setNotice({
          title: "Couldn’t Archive Group",
          message: data.message || "The group could not be archived right now.",
        })
      }
    } catch (err) {
      console.error("Failed to archive group", err);
    } finally {
      setIsSaving(false);
    }
  }

  const handlePromoteMember = async (memberId: string) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "ADMIN" }),
      })

      const data = await response.json()
      if (response.ok) {
        fetchGroupData()
      } else {
        setNotice({
          title: "Couldn’t Update Role",
          message: data.message || "The member role could not be updated.",
        })
      }
    } catch (error) {
      console.error("Failed to promote member", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (response.ok) {
        fetchGroupData()
      } else {
        setNotice({
          title: "Couldn’t Remove Member",
          message: data.message || "The member could not be removed.",
        })
      }
    } catch (error) {
      console.error("Failed to remove member", error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLeaveGroup = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/groups/${groupId}/leave`, {
        method: "POST",
      })

      const data = await response.json()
      if (response.ok) {
        router.push("/dashboard")
      } else {
        setNotice({
          title: "Couldn’t Leave Group",
          message: data.message || "You couldn’t leave the group right now.",
        })
      }
    } catch (error) {
      console.error("Failed to leave group", error)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmPendingAction = async () => {
    if (!pendingAction) {
      return
    }

    const action = pendingAction
    setPendingAction(null)

    if (action.kind === "remove-member") {
      await handleRemoveMember(action.memberId)
      return
    }

    if (action.kind === "leave-group") {
      await handleLeaveGroup()
    }
  }

  const handleSettleUp = async () => {
    if (!settleAmount || parseFloat(settleAmount) <= 0) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(settleAmount),
          groupId: isSoloGroup ? null : groupId,
          payerId: settlePayerId,
          receiverId: settleReceiverId,
        }),
      });
      if (response.ok) {
        setShowSettleModal(false);
        setSettleAmount("");
        fetchGroupData();
      }
    } catch (err) {
      console.error("Settlement failed", err);
    } finally {
      setIsSaving(false);
    }
  }

  const openSettleModal = (debt: any) => {
    if (debt.amount > 0) {
      // They owe me, so I receive money
      setSettlePayerId(debt.userId);
      setSettleReceiverId((session?.user as any)?.id);
      setSettleAmount(debt.amount.toString());
    } else {
      // I owe them, so I pay money
      setSettlePayerId((session?.user as any)?.id);
      setSettleReceiverId(debt.userId);
      setSettleAmount(Math.abs(debt.amount).toString());
    }
    setShowSettleModal(true);
  }

  const handleSendMessage = useCallback(async (rawMessage?: string) => {
    const input = (rawMessage ?? message).trim()
    if (!input) return;
    setIsParsing(true);

    try {
      const response = await fetch(`/api/groups/${groupId}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();

      if (response.ok && data.suggestion) {
        applyParsedSuggestion(data.suggestion);
      } else {
        setNotice({
          title: "Couldn’t Understand That",
          message: data.error || data.message || "Try saying the amount, a description, and who should pay what.",
        })
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
      setNotice({
        title: "Voice Parse Failed",
        message: "We couldn’t turn that into an expense suggestion right now. You can try again or type it manually.",
      })
    } finally {
      setIsParsing(false);
    }
  }, [applyParsedSuggestion, groupId, message])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [recognitionRef])

  const handleVoiceInput = () => {
    if (typeof window === "undefined") {
      return
    }

    const recognitionApi = (window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    }).SpeechRecognition || (window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    }).webkitSpeechRecognition

    if (!recognitionApi) {
      setNotice({
        title: "Voice Not Supported",
        message: "Your browser does not support speech recognition here yet. Please use Chrome or Edge for the mic input.",
      })
      return
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    const recognition = new recognitionApi()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-IN"

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
      setNotice({
        title: "Mic Error",
        message: "We couldn’t capture your voice just now. Please allow mic access and try again.",
      })
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim()

      if (!transcript) {
        return
      }

      setMessage(transcript)
      void handleSendMessage(transcript)
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const handleAddExpense = async () => {
    if (!amount || !description) return

    if (activeSplitMembers.length === 0) {
       return alert("You must select at least one person to split the expense with.");
    }

    let splitsToSave: any[] = [];
    const parsedAmount = parseFloat(amount);

    if (splitMode === "equal") {
       const splitAmount = parsedAmount / activeSplitMembers.length;
       splitsToSave = activeSplitMembers.map(userId => ({ userId, amount: splitAmount }));
    } else {
       splitsToSave = activeSplitMembers.map(userId => ({
           userId,
           amount: parseFloat(customSplits[userId] || "0")
       }));
       const totalCustom = splitsToSave.reduce((sum, s) => sum + s.amount, 0);
       if (Math.abs(totalCustom - parsedAmount) > 0.1) {
          alert(`Custom split total (₹${totalCustom}) does not match the expense amount (₹${parsedAmount}). Please adjust.`);
          return;
       }
    }

    setIsSaving(true)

    try {
      const url = editingExpenseId ? `/api/expenses/${editingExpenseId}` : "/api/expenses"
      const method = editingExpenseId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          description,
          category: expenseCategory,
          groupId,
          paidById: paidByUserId || undefined,
          splits: splitsToSave,
        }),
      })

      if (response.ok) {
        setAmount("")
        setDescription("")
        setExpenseCategory("OTHER")
        setPaidByUserId("")
        setEditingExpenseId(null)
        setShowExpenseModal(false)
        fetchGroupData() // Refresh group data to show new expense
      } else {
        console.error("Failed to add/update expense");
      }
    } catch (err) {
      console.error("Expense creation failed", err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteExpense = (expenseId: string) => {
    setDeleteExpenseId(expenseId);
  }

  const confirmDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/expenses/${deleteExpenseId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchGroupData()
      }
    } catch (err) {
      console.error("Failed to delete expense", err);
    } finally {
      setIsSaving(false);
      setDeleteExpenseId(null);
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

  const openExpenseModal = (expense?: any) => {
    if (expense) {
      setAmount(expense.amount.toString())
      setDescription(expense.description)
      setExpenseCategory(expense.category || "OTHER")
      setPaidByUserId(expense.paidById)
      setEditingExpenseId(expense.id)
      
      if (expense.splits && expense.splits.length > 0) {
          const uIds = expense.splits.map((s: any) => s.userId);
          setActiveSplitMembers(uIds);
          
          const isEqual = expense.splits.every((s: any) => Math.abs(s.amount - (expense.amount / expense.splits.length)) < 0.1);
          if (isEqual) {
              setSplitMode("equal");
              setCustomSplits({});
          } else {
              setSplitMode("custom");
              const cs: Record<string, string> = {};
              expense.splits.forEach((s: any) => { cs[s.userId] = s.amount.toString() });
              setCustomSplits(cs);
          }
      } else {
          setActiveSplitMembers(group?.members.map((m: any) => m.userId) || []);
          setSplitMode("equal");
      }
    } else {
      setAmount("")
      setDescription("")
      setExpenseCategory("OTHER")
      setPaidByUserId("")
      setEditingExpenseId(null)
      setActiveSplitMembers(group?.members.map((m: any) => m.userId) || [])
      setSplitMode("equal")
      setCustomSplits({})
    }
    setShowExpenseModal(true)
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!group) return null

  const currentUserId = (session?.user as { id?: string } | undefined)?.id
  const currentMembership = group.members.find((member: { userId: string; role: string }) => member.userId === currentUserId)
  const isGroupAdmin = currentMembership?.role === "ADMIN"

  const allTransactions = [
    ...(group.expenses || []).map((expense: any) => ({
      ...expense,
      isSettlement: false,
    })),
    ...(group.settlements || []).map((settlement: any) => ({
      ...settlement,
      isSettlement: true,
    })),
  ].sort(
    (a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const categoryEntries = Object.entries(
    (group.expenses || []).reduce((acc: Record<string, { total: number; count: number }>, expense: any) => {
      const category = expense.category || "OTHER"
      if (!acc[category]) {
        acc[category] = { total: 0, count: 0 }
      }
      acc[category].total += expense.amount
      acc[category].count += 1
      return acc
    }, {})
  ) as Array<[string, { total: number; count: number }]>

  const categorySummary = categoryEntries
    .map(([category, summary]) => ({
      category,
      label: getExpenseCategoryLabel(category),
      total: summary.total,
      count: summary.count,
    }))
    .sort((left, right) => right.total - left.total)

  const categoryTotal = categorySummary.reduce((sum, item) => sum + item.total, 0)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-hidden">
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
          {!isSoloGroup && (
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
                onClick={() => setShowSettingsModal(true)}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label="Group settings"
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Local Group Balance Summary */}
      {group.debts && group.debts.length > 0 && (
        <div className="bg-white border-b border-slate-100 shrink-0 z-0">
          <div className="px-4 py-2 flex gap-2 items-center overflow-x-auto flex-nowrap hide-scrollbar max-w-4xl mx-auto w-full">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">
              Balances
            </span>
            {group.debts
              .filter((debt: any) => Math.abs(debt.amount) > 0.01)
              .map((debt: any) => (
                <div
                  key={debt.userId}
                  className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-xl border text-[10px] font-bold shrink-0 ${
                    debt.amount > 0
                      ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                      : "bg-rose-50 border-rose-100 text-rose-600"
                  }`}
                >
                  <span className="font-black">{debt.name}</span>
                  <span className="opacity-50">
                    {debt.amount > 0
                      ? `+${formatCurrency(debt.amount)}`
                      : `-${formatCurrency(Math.abs(debt.amount))}`}
                  </span>
                  <button
                    onClick={() => openSettleModal(debt)}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all hover:scale-105 active:scale-95 ${
                      debt.amount > 0
                        ? "bg-emerald-600 text-white"
                        : "bg-rose-600 text-white"
                    }`}
                  >
                    Settle
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {categorySummary.length > 0 && (
        <div className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-4xl px-6 py-1.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Spending</p>
              {categorySummary[0] && (
                <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-xl">
                  <CategoryIcon category={categorySummary[0].category} className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-black text-primary">{categorySummary[0].label}</span>
                  <span className="text-[10px] font-bold text-primary/60">{formatCurrency(categorySummary[0].total)}</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              {categorySummary.slice(0, 5).map((item) => {
                const pct = categoryTotal > 0 ? (item.total / categoryTotal) * 100 : 0
                return (
                  <div key={item.category} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 w-24 shrink-0">
                      <CategoryIcon category={item.category} className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-[10px] font-bold text-slate-500 truncate">{item.label}</span>
                    </div>
                    <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-600 w-14 text-right shrink-0">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Expense/Chat Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 max-w-4xl mx-auto w-full pb-24">
        {allTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
              <UtensilsCrossed className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest">No activity yet</p>
            <p className="text-xs font-medium mt-1">Add friends, then add an expense!</p>
          </div>
        ) : (
          allTransactions.map((item: any) => {
            if (item.isSettlement) {
              return (
                <div key={item.id} className="flex justify-center">
                  <div className="bg-white border border-slate-100 rounded-xl px-4 py-1.5 shadow-sm text-[11px] font-bold text-slate-600 flex items-center gap-2 hover:border-emerald-200 transition-colors">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/30">
                      <Check className="w-2.5 h-2.5 text-white stroke-[4]" />
                    </div>
                    <span>
                      <span className="text-slate-900 font-black">{item.payer.name}</span>
                      <span className="mx-1 opacity-50">paid</span>
                      <span className="text-slate-900 font-black">{item.receiver.name}</span>
                    </span>
                    <span className="text-emerald-600 font-black bg-emerald-50 px-1.5 py-0.5 rounded-lg border border-emerald-100/50">
                      {formatCurrency(item.amount)}
                    </span>
                    <span className="text-[9px] text-slate-300 font-medium">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )
            }

            {
              const userSplit = item.splits.find((s: any) => s.userId === currentUserId)
              const userShare = userSplit?.amount ?? 0
              const userPaid = currentUserId === item.paidById
              const userInvolved = userPaid || userShare > 0
              const netLent = item.amount - userShare
              const isExpanded = expandedExpenseId === item.id

              return (
                <Card
                  key={item.id}
                  className="rounded-2xl bg-white shadow-sm border border-slate-100/80 hover:shadow-md transition-all group overflow-hidden"
                >
                  {/* Main row */}
                  <div
                    className="flex items-center gap-3 px-3 py-3 cursor-pointer"
                    onClick={() => setExpandedExpenseId(isExpanded ? null : item.id)}
                  >
                    {/* Category icon — tinted by user's relationship to this expense */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      !userInvolved ? "bg-slate-100" : userPaid ? "bg-emerald-50" : "bg-orange-50"
                    }`}>
                      <CategoryIcon category={item.category || "OTHER"} className={`w-4 h-4 ${
                        !userInvolved ? "text-slate-400" : userPaid ? "text-emerald-500" : "text-orange-400"
                      }`} />
                    </div>

                    {/* Description + secondary meta */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-base leading-tight truncate">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-slate-400">
                          {userPaid ? "You paid" : `Paid by ${item.payer.name}`}
                        </span>
                        <span className="text-xs text-slate-200">•</span>
                        <span className="text-xs text-slate-400">
                          Total {formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>

                    {/* User-specific amount — primary right-side figure */}
                    <div className="flex flex-col items-end shrink-0 mr-1">
                      {userInvolved ? (
                        <>
                          <p className={`text-sm font-black leading-tight ${userPaid ? "text-emerald-600" : "text-orange-500"}`}>
                            {userPaid
                              ? netLent > 0.01 ? `+${formatCurrency(netLent)}` : "Settled"
                              : `-${formatCurrency(userShare)}`}
                          </p>
                          <span className={`text-[9px] font-black uppercase tracking-wide leading-tight ${
                            userPaid ? "text-emerald-400" : "text-orange-400"
                          }`}>
                            {userPaid ? (netLent > 0.01 ? "you lent" : "settled") : "you owe"}
                          </span>
                        </>
                      ) : (
                        <p className="text-sm font-black text-slate-300">{formatCurrency(item.amount)}</p>
                      )}
                    </div>

                    {/* Actions + date */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          aria-label="Edit expense"
                          onClick={(e) => { e.stopPropagation(); openExpenseModal(item) }}
                          className="w-7 h-7 rounded-lg text-slate-300 hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          aria-label="Delete expense"
                          onClick={(e) => { e.stopPropagation(); handleDeleteExpense(item.id) }}
                          className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-300 font-medium">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Expanded splits — toggle on card click */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-slate-50">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2 mb-1.5">Split Details</p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.splits.map((split: any) => (
                          <div
                            key={split.id}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] ${
                              split.userId === currentUserId
                                ? userPaid
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                  : "bg-orange-50 border-orange-100 text-orange-600"
                                : "bg-slate-50 border-slate-100 text-slate-600"
                            }`}
                          >
                            <span className="font-bold">
                              {split.userId === currentUserId ? "You" : split.user?.name}
                            </span>
                            <span className="font-black">{formatCurrency(split.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )
            }
          })
        )}
      </div>

      {/* Bottom Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-100/60 bg-white/70 backdrop-blur-xl px-4 py-2 md:px-12 shrink-0 shadow-[0_-6px_16px_rgba(0,0,0,0.03)] z-20 pb-safe">
        <div className="flex gap-2 items-center max-w-4xl mx-auto w-full">
          <button
            onClick={() => openExpenseModal()}
            className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-600 transition-all shadow-md active:scale-95 shrink-0"
            aria-label="Add expense"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
          </button>
          <button
            onClick={handleVoiceInput}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0 ${
              isListening ? "bg-rose-500 text-white shadow-rose-500/20" : "bg-white text-primary border border-primary/15"
            }`}
            aria-label={isListening ? "Stop voice input" : "Start voice input"}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <div className="relative flex-1">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              placeholder={isListening ? "Listening..." : "Type or speak an expense..."}
              className="h-10 rounded-2xl bg-slate-50 border-0 focus-visible:ring-1 focus-visible:ring-primary/20 pl-4 pr-11 text-slate-700 font-semibold text-sm"
              disabled={isParsing || isListening}
            />
            <button
              onClick={() => {
                void handleSendMessage()
              }}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl flex items-center justify-center transition-all ${message.trim() && !isParsing ? 'bg-primary text-white scale-100' : 'text-slate-300 scale-90'}`}
              disabled={!message.trim() || isParsing}
              aria-label="Send message"
            >
              {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
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
                  <span className="text-2xl sm:text-3xl font-black text-slate-400 mr-2">₹</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-4xl sm:text-5xl font-black text-slate-900 bg-transparent border-0 outline-none w-32 sm:w-52 text-center placeholder:text-slate-200"
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Category</label>
                  <div className="flex flex-wrap gap-2">
                     {EXPENSE_CATEGORIES.map((category) => {
                        const isSelected = expenseCategory === category.value
                        return (
                           <button
                              key={category.value}
                              type="button"
                              onClick={() => setExpenseCategory(category.value)}
                              className={`rounded-2xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
                                isSelected
                                  ? "border-primary/20 bg-primary/10 text-primary"
                                  : "border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:text-slate-600"
                              }`}
                           >
                              {category.label}
                           </button>
                        )
                     })}
                  </div>
               </div>

               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Who paid for this?</label>
                  <div className="flex flex-wrap gap-2">
                     {group.members.map((m: any) => {
                        const isPayer = paidByUserId === m.userId || (!paidByUserId && m.userId === (session?.user as any)?.id);
                        return (
                           <button 
                              key={m.userId} 
                              onClick={() => setPaidByUserId(m.userId)}
                              className={`px-4 py-2 rounded-2xl text-[11px] font-bold border flex items-center gap-2 shadow-sm transition-all active:scale-95 ${isPayer ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-400 opacity-60 hover:opacity-100"}`}
                           >
                              <div className={`w-1.5 h-1.5 rounded-full ${isPayer ? "bg-emerald-400 animate-pulse outline outline-2 outline-emerald-400/20" : "bg-slate-200"}`} />
                              {(session?.user as any)?.id === m.userId ? "You" : m.user.name}
                           </button>
                        );
                     })}
                  </div>
               </div>

               <div>
                  <div className="flex items-center justify-between mb-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Split Options</label>
                     <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button 
                           onClick={() => setSplitMode("equal")}
                           className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors ${splitMode === "equal" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}
                        >
                           EQUAL
                        </button>
                        <button 
                           onClick={() => setSplitMode("custom")}
                           className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors ${splitMode === "custom" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}
                        >
                           CUSTOM
                        </button>
                     </div>
                  </div>

                  {splitMode === "equal" ? (
                     <>
                        <div className="flex flex-wrap gap-2">
                           {group.members.map((m: any) => {
                              const isActive = activeSplitMembers.includes(m.userId);
                              return (
                                 <button 
                                    key={m.userId} 
                                    onClick={() => {
                                       if (isActive) {
                                          setActiveSplitMembers(prev => prev.filter(id => id !== m.userId));
                                       } else {
                                          setActiveSplitMembers(prev => [...prev, m.userId]);
                                       }
                                    }}
                                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold border flex items-center gap-2 shadow-sm transition-all active:scale-95 ${isActive ? "bg-primary/5 border-primary/20 text-primary" : "bg-white border-slate-100 text-slate-400 opacity-60"}`}
                                 >
                                    <Check className={`w-3.5 h-3.5 stroke-[4] ${isActive ? "opacity-100" : "opacity-0"}`} />
                                    {(session?.user as any)?.id === m.userId ? "You" : m.user.name}
                                 </button>
                              );
                           })}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-3 font-medium px-1">
                           Split will be approximately <span className="text-slate-900 font-bold">₹{activeSplitMembers.length > 0 ? (parseFloat(amount || "0") / activeSplitMembers.length).toFixed(1) : "0.0"}</span> per selected person.
                        </p>
                     </>
                  ) : (
                     <div className="space-y-3">
                        <div className="space-y-2 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                           {group.members.map((m: any) => {
                              const isActive = activeSplitMembers.includes(m.userId);
                              return (
                                 <div key={m.userId} className={`flex items-center justify-between p-2 rounded-xl transition-colors ${isActive ? "bg-white shadow-sm border border-slate-100" : "opacity-50"}`}>
                                    <div className="flex items-center gap-3">
                                       <input 
                                          type="checkbox" 
                                          checked={isActive}
                                          aria-label={`Include ${m.user.name}`}
                                          onChange={(e) => {
                                             if (e.target.checked) {
                                                setActiveSplitMembers(prev => [...prev, m.userId]);
                                             } else {
                                                setActiveSplitMembers(prev => prev.filter(id => id !== m.userId));
                                                // Also clear custom split amount
                                                const newSplits = { ...customSplits };
                                                delete newSplits[m.userId];
                                                setCustomSplits(newSplits);
                                             }
                                          }}
                                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                       />
                                       <span className="text-sm font-bold text-slate-700">{(session?.user as any)?.id === m.userId ? "You" : m.user.name}</span>
                                    </div>
                                    {isActive && (
                                       <div className="flex items-center w-28 relative">
                                          <span className="absolute left-3 text-slate-400 font-bold text-xs">₹</span>
                                          <Input
                                             type="number"
                                             className="h-10 pl-6 pr-2 rounded-lg bg-slate-50 text-right font-bold text-sm border-slate-200 focus:border-primary/50"
                                             placeholder="0.00"
                                             value={customSplits[m.userId] || ""}
                                             onChange={(e) => setCustomSplits(prev => ({ ...prev, [m.userId]: e.target.value }))}
                                          />
                                       </div>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                        {(() => {
                           const target = parseFloat(amount || "0");
                           const current = Object.values(customSplits).reduce((sum, val) => sum + parseFloat(val || "0"), 0);
                           const remaining = target - current;
                           const isOk = Math.abs(remaining) <= 0.1;
                           return (
                              <div className={`text-xs font-bold px-2 flex justify-between tracking-tight ${isOk ? "text-emerald-500" : "text-rose-500"}`}>
                                 <span>{isOk ? "Perfectly split!" : "Amounts must equal total"}</span>
                                 <span>Remaining: ₹{remaining.toFixed(2)}</span>
                              </div>
                           );
                        })()}
                     </div>
                  )}
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

      {/* Settings Modal */}
      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Group Settings">
         <div className="space-y-6">
            <div className="text-center">
               <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-10 h-10 text-slate-400" />
               </div>
               <h3 className="text-lg font-bold text-slate-900">Manage Group</h3>
            </div>

            <div className="space-y-4">
               <div>
                  <label htmlFor="edit-group-name" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Group Name</label>
                  <Input
                    id="edit-group-name"
                    placeholder="Enter group name"
                    className="h-14 rounded-2xl bg-slate-50 border-transparent focus:border-primary/20 text-base font-medium"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                  />
               </div>

               <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Simplify Payments</p>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                        Combine circular debts into the minimum transfers. Example: if A owes B and B owes C, the group can show A paying C directly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditSimplifyDebts((current) => !current)}
                      className={`relative inline-flex h-8 w-14 shrink-0 rounded-full border transition-colors ${
                        editSimplifyDebts ? "border-primary bg-primary" : "border-slate-200 bg-white"
                      }`}
                      aria-pressed={editSimplifyDebts}
                      aria-label="Toggle simplified debt view"
                    >
                      <span
                        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                          editSimplifyDebts ? "translate-x-7" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
               </div>

               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Group Members ({group.members.length})</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                     {group.members.map((m: any) => (
                       <div key={m.userId} className="flex flex-col gap-3 rounded-2xl border border-slate-100/50 bg-slate-50 p-3 transition-colors hover:bg-slate-100/50 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                {m.user.name?.substring(0, 2).toUpperCase() || "U"}
                             </div>
                             <div className="flex flex-col min-w-0">
                                <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-900">
                                   {m.user.name}
                                    {currentUserId === m.userId && <span className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase font-black">You</span>}
                                </span>
                                <span className="break-all text-[10px] font-medium text-slate-400">{m.user.email}</span>
                             </div>
                          </div>
                           <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <span
                                className={`flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                                  m.role === "ADMIN" ? "border-primary/15 text-primary" : "border-slate-100 text-slate-400"
                                }`}
                                title={m.role === "ADMIN" ? "Admin" : "Member"}
                              >
                                {m.role === "ADMIN" ? <ShieldCheck className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline">{m.role}</span>
                              </span>
                              {isGroupAdmin && currentUserId !== m.userId && m.role !== "ADMIN" && (
                                <button
                                  onClick={() => handlePromoteMember(m.userId)}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isSaving}
                                  aria-label={`Make ${m.user.name} an admin`}
                                  title="Make admin"
                                >
                                  <ShieldCheck className="h-4 w-4" />
                                </button>
                              )}
                              {isGroupAdmin && currentUserId !== m.userId && (
                                <button
                                  onClick={() =>
                                    setPendingAction({
                                      kind: "remove-member",
                                      memberId: m.userId,
                                      title: "Remove Member",
                                      message: "This member can only be removed after all of their balances in this group are settled.",
                                      confirmLabel: "Remove Member",
                                    })
                                  }
                                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  disabled={isSaving}
                                  aria-label={`Remove ${m.user.name} from the group`}
                                  title="Remove member"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </button>
                              )}
                           </div>
                        </div>
                      ))}
                  </div>
               </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                className="w-full h-14 rounded-2xl text-base font-black shadow-lg shadow-primary/20 transition-all active:scale-95 bg-primary text-white"
                disabled={isSaving || !editGroupName.trim()}
                onClick={handleUpdateGroup}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
              <button
                className="w-full h-14 rounded-2xl text-base font-black transition-all active:scale-95 bg-slate-100 text-slate-600 hover:bg-slate-200"
                onClick={handleArchiveGroup}
                disabled={isSaving}
              >
                Archive Group
              </button>
              <button
                className="w-full h-14 rounded-2xl text-base font-black transition-all active:scale-95 bg-rose-50 text-rose-600 hover:bg-rose-100"
                onClick={handleDeleteGroup}
              >
                Delete Entire Group
              </button>
              <button
                className="w-full h-14 rounded-2xl text-base font-black transition-all active:scale-95 bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                onClick={() =>
                  setPendingAction({
                    kind: "leave-group",
                    title: "Leave Group",
                    message: "You can only leave this group after all your balances are settled.",
                    confirmLabel: "Leave Group",
                  })
                }
                disabled={isSaving}
              >
                Leave Group
              </button>
            </div>
          </div>
      </Modal>

      <Modal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        title={pendingAction?.title || "Confirm Action"}
      >
        <div className="space-y-6">
          <p className="text-sm font-medium text-slate-600 text-center">
            {pendingAction?.message}
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <button
              className="w-full h-14 rounded-2xl text-base font-black transition-all active:scale-95 bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20"
              onClick={confirmPendingAction}
              disabled={isSaving}
            >
              {isSaving ? "Working..." : pendingAction?.confirmLabel}
            </button>
            <Button
              variant="outline"
              className="w-full h-14 rounded-2xl text-base font-black border-slate-200"
              onClick={() => setPendingAction(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!notice}
        onClose={() => setNotice(null)}
        title={notice?.title || "Notice"}
      >
        <div className="space-y-6">
          <p className="text-sm font-medium text-slate-600 text-center">
            {notice?.message}
          </p>
          <Button
            className="w-full h-14 rounded-2xl text-base font-black"
            onClick={() => setNotice(null)}
          >
            OK
          </Button>
        </div>
      </Modal>

      {/* Delete Group Confirm Modal */}
      <Modal isOpen={showDeleteGroupConfirm} onClose={() => setShowDeleteGroupConfirm(false)} title="Are you sure?">
         <div className="space-y-6">
            <p className="text-sm font-medium text-slate-600 text-center">
               This will permanently delete <span className="font-bold text-slate-900">{group.name}</span>, all its members, and all its expenses. This action cannot be undone.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <button
                className="w-full h-14 rounded-2xl text-base font-black transition-all active:scale-95 bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20"
                onClick={confirmDeleteGroup}
                disabled={isSaving}
              >
                {isSaving ? "Deleting..." : "Yes, Delete Group"}
              </button>
              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl text-base font-black border-slate-200"
                onClick={() => setShowDeleteGroupConfirm(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
         </div>
      </Modal>

      {/* Delete Expense Confirm Modal */}
      <Modal isOpen={!!deleteExpenseId} onClose={() => setDeleteExpenseId(null)} title="Delete Expense">
         <div className="space-y-6">
            <p className="text-sm font-medium text-slate-600 text-center">
               Are you sure you want to delete this expense? Math and total balances will be recalculated instantly.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <button
                className="w-full h-14 rounded-2xl text-base font-black transition-all active:scale-95 bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20"
                onClick={confirmDeleteExpense}
                disabled={isSaving}
              >
                {isSaving ? "Deleting..." : "Delete Expense"}
              </button>
              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl text-base font-black border-slate-200"
                onClick={() => setDeleteExpenseId(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
         </div>
      </Modal>

      {/* Settle Up Modal */}
      <Modal isOpen={showSettleModal} onClose={() => setShowSettleModal(false)} title="Record Payment">
         <div className="space-y-6">
            <div className="text-center">
               <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Check className="w-10 h-10 text-emerald-500" />
               </div>
               <h3 className="text-lg font-bold text-slate-900">Settling Up</h3>
               <p className="text-sm text-slate-500 mt-1">
                  {settlePayerId === (session?.user as any)?.id ? `You paid ${group.members.find((m:any) => m.userId === settleReceiverId)?.user.name}` : `${group.members.find((m:any) => m.userId === settlePayerId)?.user.name} paid You`}
               </p>
            </div>

            <div className="space-y-4">
               <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-300">₹</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    className="h-20 pl-14 text-3xl font-black rounded-3xl bg-slate-50 border-transparent focus:border-emerald-200"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    autoFocus
                  />
               </div>
            </div>

            <Button
               className="w-full h-16 rounded-3xl text-lg font-black shadow-xl shadow-emerald-200 transition-all active:scale-95 bg-emerald-500 hover:bg-emerald-600 text-white"
               disabled={isSaving || !settleAmount || parseFloat(settleAmount) <= 0}
               onClick={handleSettleUp}
            >
               {isSaving ? "Recording..." : "Confirm Settlement"}
            </Button>
         </div>
      </Modal>

    </div>
  )
}
