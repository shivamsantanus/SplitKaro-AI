import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Header } from "@/components/shared/Header"
import { NextAuthProvider } from "@/components/providers/SessionProvider"
import { PWAProvider } from "@/components/providers/PWAProvider"
import { AppleSplashLinks } from "@/components/providers/AppleSplashLinks"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SplitKaro AI | Effortless Expense Splitting",
  description: "AI-powered group expense splitting and personal expense tracking",
  applicationName: "SplitKaro",
  // iOS home-screen behaviour
  appleWebApp: {
    capable: true,
    title: "SplitKaro",
    statusBarStyle: "default",
  },
  // Prevent iOS from auto-linking phone numbers / dates
  formatDetection: { telephone: false },
  // Explicit manifest link (belt-and-suspenders; Next.js also injects it automatically)
  manifest: "/manifest.webmanifest",
}

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  // Allow content to extend into the notch/Dynamic Island safe area
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* iOS home-screen icon — Safari ignores the manifest for this */}
        <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />
        {/* Branded splash screens for every major iPhone / iPad */}
        <AppleSplashLinks />
      </head>
      <body className={`${inter.className} bg-background text-foreground min-h-screen flex flex-col`}>
        <NextAuthProvider>
          <PWAProvider />
          <Header />
          <main className="flex-1">{children}</main>
        </NextAuthProvider>
      </body>
    </html>
  )
}
