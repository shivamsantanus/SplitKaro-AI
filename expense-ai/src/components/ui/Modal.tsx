"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./Button"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export const Modal = ({ isOpen, onClose, title, children, className }: ModalProps) => {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div 
        className={cn(
          "relative w-full max-w-lg bg-white sm:rounded-3xl rounded-t-[2.5rem] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 flex flex-col max-h-[92vh]",
          className
        )}
      >
        {/* Handle for mobile drawer accessibility */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
        
        <div className="flex items-center justify-between px-6 py-4 sm:p-6 border-b border-slate-50 shrink-0">
          {title && <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="rounded-full h-10 w-10 hover:bg-slate-50 transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </Button>
        </div>
        
        <div className="p-6 pb-12 overflow-y-auto overscroll-contain flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
