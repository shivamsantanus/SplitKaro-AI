import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/shared/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SplitSmart AI | Effortless Expense Splitting",
  description: "SplitSmart AI is an AI-powered expense splitting app with a chat-driven interface.",
};

import { NextAuthProvider } from "@/components/providers/SessionProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} bg-background text-foreground min-h-screen flex flex-col`}>
        <NextAuthProvider>
          <Header />
          <main className="flex-1 pt-20">
            {children}
          </main>
        </NextAuthProvider>
      </body>
    </html>
  );
}
