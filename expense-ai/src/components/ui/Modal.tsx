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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div 
        className={cn(
          "relative w-full max-w-lg glass rounded-3xl overflow-hidden animate-in zoom-in-95 duration-200",
          className
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          {title && <h2 className="text-xl font-bold">{title}</h2>}
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 ml-auto">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
