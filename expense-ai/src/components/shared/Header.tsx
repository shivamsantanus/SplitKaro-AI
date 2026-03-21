"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "../ui/Button"
import { Sparkles, LogOut, User } from "lucide-react"

export const Header = () => {
  const pathname = usePathname()
  const { data: session } = useSession()
  
  // Don't show header on specific mobile-first screens or welcome screen
  const isAuth = pathname?.startsWith("/login") || pathname?.startsWith("/signup") || pathname === "/welcome" || pathname === "/"
  const isGroupDetail = pathname?.includes("/groups/")

  if (isAuth || isGroupDetail) return null

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-6 md:px-12">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">
            SplitSmart AI
          </span>
        </Link>
      </div>

      <nav className="ml-auto flex items-center gap-4">
        {session ? (
          <>
            <Link href="/dashboard" className="hidden md:block">
              <Button variant="ghost" size="sm" className="gap-2 text-slate-500 font-bold">
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-[1px] bg-slate-100 mx-2 hidden md:block" />
            <div className="flex items-center gap-3">
               <div className="hidden sm:flex flex-col items-end mr-1">
                  <span className="text-xs font-bold text-slate-900 leading-none">{session.user?.name}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Verified User</span>
               </div>
               <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl border-slate-200 text-slate-600 font-bold gap-2"
                onClick={() => signOut({ callbackUrl: "/welcome" })}
               >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </>
        ) : (
          <Link href="/login">
            <Button size="sm" className="rounded-xl font-bold">
              Log in
            </Button>
          </Link>
        )}
      </nav>
    </header>
  )
}
