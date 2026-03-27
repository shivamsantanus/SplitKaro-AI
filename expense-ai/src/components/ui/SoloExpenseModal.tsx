import { useState, useEffect } from "react"
import { Modal } from "./Modal"
import { Button } from "./Button"
import { Input } from "./Input"
import { User, DollarSign, Send, Loader2, Search, Check } from "lucide-react"

interface SoloExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function SoloExpenseModal({ isOpen, onClose, onSuccess }: SoloExpenseModalProps) {
  const [email, setEmail] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [friends, setFriends] = useState<any[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [selectedFriend, setSelectedFriend] = useState<any>(null)

  useEffect(() => {
    if (isOpen) {
      fetchFriends()
    }
  }, [isOpen])

  const fetchFriends = async () => {
    setLoadingFriends(true)
    try {
      const res = await fetch("/api/friends")
      if (res.ok) setFriends(await res.json())
    } catch (err) {
      console.error("Failed to fetch friends")
    } finally {
      setLoadingFriends(false)
    }
  }

  const handleSave = async () => {
    const targetEmail = selectedFriend ? selectedFriend.email : email
    if (!targetEmail || !amount || !description) {
      setError("Please fill all fields")
      return
    }

    setIsSaving(true)
    setError("")

    try {
      let friendId = selectedFriend?.id
      
      if (!friendId) {
        const userRes = await fetch(`/api/users/find?email=${encodeURIComponent(targetEmail)}`)
        if (!userRes.ok) {
            setError("User not found by that email. Ask them to join SplitKaro!")
            setIsSaving(false)
            return
        }
        const friend = await userRes.json()
        friendId = friend.id
      }

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description,
          groupId: null,
          splits: [{ userId: friendId, amount: parseFloat(amount) }]
        })
      })

      if (res.ok) {
        setAmount("")
        setDescription("")
        setEmail("")
        setSelectedFriend(null)
        onSuccess()
        onClose()
      } else {
        const data = await res.json()
        setError(data.message || "Failed to save")
      }
    } catch (err) {
      setError("Something went wrong")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Individual Payment">
      <div className="space-y-6">
        <div className="text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-2">
                <User className="w-10 h-10 text-primary" />
            </div>
            <p className="text-sm text-slate-500 font-medium">Record a payment for a friend</p>
        </div>

        <div className="space-y-5">
          {/* Friend Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 gap-1 flex items-center uppercase tracking-widest ml-1">
               Friend
            </label>
            
            {friends.length > 0 && !selectedFriend && (
               <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                 {friends.map(f => (
                   <button
                     key={f.id}
                     onClick={() => setSelectedFriend(f)}
                     className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl hover:border-primary/30 transition-all active:scale-95 group text-left"
                   >
                     <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-primary group-hover:text-white transition-colors">
                        {f.name?.substring(0, 2).toUpperCase() || "??"}
                     </div>
                     <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{f.name || f.email}</span>
                   </button>
                 ))}
               </div>
            )}

            {selectedFriend ? (
              <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xs">
                    {selectedFriend.name?.substring(0, 2).toUpperCase() || "??"}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-none mb-1">{selectedFriend.name}</p>
                    <p className="text-[10px] font-bold text-primary/60">{selectedFriend.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedFriend(null)}
                  className="text-[10px] font-black uppercase tracking-tight text-slate-400 hover:text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-100"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                  <Input
                      placeholder="Or enter friend's email..."
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-14 rounded-2xl pl-12 bg-slate-50 border-slate-100 focus:bg-white transition-all shadow-sm"
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Amount</label>
                <div className="relative">
                    <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-14 rounded-2xl pl-12 bg-slate-50 border-slate-100 text-lg font-black text-slate-900 focus:bg-white transition-all"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Category</label>
                <Input
                    placeholder="E.g. Coffee"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white transition-all font-bold text-slate-700"
                />
              </div>
          </div>
        </div>

        {error && <p className="text-xs font-bold text-rose-500 text-center animate-in shake duration-300 bg-rose-50 py-2 rounded-xl border border-rose-100">{error}</p>}

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-15 rounded-2xl text-base font-black shadow-[0_10px_30px_-10px_rgba(var(--primary),0.5)] active:scale-95 py-7"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Check className="w-5 h-5 mr-4 stroke-[4]" />}
          Save Individual Payment
        </Button>
      </div>
    </Modal>
  )
}

