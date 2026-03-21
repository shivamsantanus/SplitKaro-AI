import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive"
  size?: "sm" | "md" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variants = {
      primary: "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 active:scale-95",
      secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:scale-95",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:scale-95",
      ghost: "hover:bg-accent hover:text-accent-foreground active:scale-95",
      destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-95",
    }

    const sizes = {
      sm: "h-9 px-3 text-xs",
      md: "h-11 px-6 text-sm font-medium",
      lg: "h-14 px-8 text-base font-semibold",
      icon: "h-10 w-10",
    }

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
