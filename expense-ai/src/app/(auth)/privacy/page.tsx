import Link from "next/link"
import { Shield } from "lucide-react"

export const metadata = {
  title: "Privacy Policy — SplitKaro AI",
  description: "How SplitKaro AI collects, uses, and protects your data.",
}

const sections = [
  {
    title: "Information We Collect",
    content: [
      {
        subtitle: "Account Information",
        text: "When you sign in with Google, we receive your name and email address. We store these to create and identify your SplitKaro account.",
      },
      {
        subtitle: "Expense & Group Data",
        text: "We store the expenses, group memberships, splits, and settlements you create within the app. This is the core data needed to provide the service.",
      },
      {
        subtitle: "Bot Identifiers",
        text: "If you link the Telegram or WhatsApp bot, we store your Telegram chat ID or WhatsApp phone number to associate bot messages with your account. We do not share these with any third party.",
      },
      {
        subtitle: "UPI ID",
        text: "If you add a UPI ID for settlement references, it is stored securely and never logged or exposed to other users beyond what is required to display settlement details.",
      },
    ],
  },
  {
    title: "How We Use Your Information",
    content: [
      {
        subtitle: "Service Delivery",
        text: "Your data is used solely to operate SplitKaro AI — tracking expenses, managing group splits, processing settlements, and delivering bot responses.",
      },
      {
        subtitle: "Real-time Sync",
        text: "We use Redis to temporarily cache data and publish real-time updates across group members. Cached data is short-lived and not persisted beyond its TTL.",
      },
      {
        subtitle: "No Advertising",
        text: "We do not use your data for advertising, profiling, or any purpose beyond operating the service.",
      },
    ],
  },
  {
    title: "Third-Party Services",
    content: [
      {
        subtitle: "Google OAuth",
        text: "Sign-in is handled by Google. We receive only your name and email from Google and do not access your Google contacts, Drive, or any other Google data.",
      },
      {
        subtitle: "Supabase (PostgreSQL)",
        text: "Your account and expense data is stored in a PostgreSQL database hosted on Supabase with encryption at rest.",
      },
      {
        subtitle: "Redis (RedisLabs)",
        text: "Used for session caching and real-time pub/sub. No sensitive personal data is stored permanently in Redis.",
      },
      {
        subtitle: "Vercel",
        text: "The application is hosted on Vercel. Your requests are processed through Vercel's infrastructure.",
      },
      {
        subtitle: "Meta (WhatsApp Cloud API)",
        text: "If you use the WhatsApp bot, messages are routed through Meta's WhatsApp Cloud API. Meta's privacy policy applies to message transmission.",
      },
      {
        subtitle: "Telegram Bot API",
        text: "If you use the Telegram bot, messages are routed through Telegram's Bot API. Telegram's privacy policy applies to message transmission.",
      },
      {
        subtitle: "Google Gemini AI",
        text: "Natural language expense messages are processed by Google's Gemini API to extract expense details. Only the text of your expense message is sent — no account data.",
      },
    ],
  },
  {
    title: "Data Security",
    content: [
      {
        subtitle: "Encryption",
        text: "Data is encrypted in transit via HTTPS/TLS. Database storage is encrypted at rest via Supabase.",
      },
      {
        subtitle: "Authentication",
        text: "We use JWT-based sessions via NextAuth. Session tokens are stored in HTTP-only cookies and never exposed to client-side scripts.",
      },
      {
        subtitle: "No Password Storage",
        text: "We do not store passwords. Authentication is handled entirely through Google OAuth.",
      },
    ],
  },
  {
    title: "Data Retention & Deletion",
    content: [
      {
        subtitle: "Account Data",
        text: "Your data is retained for as long as your account is active. You may request deletion of your account and all associated data by contacting us.",
      },
      {
        subtitle: "Bot Unlinking",
        text: "You can unlink the Telegram or WhatsApp bot at any time by sending /unlink in the respective bot. This immediately removes your bot identifier from our database.",
      },
      {
        subtitle: "Redis TTL",
        text: "Temporary bot session states (pending expenses, editing states) are automatically deleted within 2–5 minutes via Redis TTL.",
      },
    ],
  },
  {
    title: "Your Rights",
    content: [
      {
        subtitle: "Access",
        text: "You can view all your expenses and group data directly within the SplitKaro app.",
      },
      {
        subtitle: "Deletion",
        text: "To delete your account and all associated data, contact us at the email below. We will process deletion requests within 7 business days.",
      },
      {
        subtitle: "Portability",
        text: "You may request an export of your expense data in JSON or CSV format by contacting us.",
      },
    ],
  },
  {
    title: "Changes to This Policy",
    content: [
      {
        subtitle: "",
        text: "We may update this Privacy Policy from time to time. We will notify users of material changes by updating the effective date below and, where appropriate, via the app. Continued use of SplitKaro AI after changes constitutes acceptance of the updated policy.",
      },
    ],
  },
  {
    title: "Contact",
    content: [
      {
        subtitle: "",
        text: "If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at: splitkaro@tristech.in",
      },
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-background px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="rounded-[2rem] bg-white border border-slate-200/70 shadow-xl overflow-hidden">
          <div className="px-6 py-10 sm:px-10 bg-gradient-to-br from-white via-slate-50 to-primary/5 border-b border-slate-100">
            <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center shadow-lg mb-5">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-primary/70 mb-3">
              Legal
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              Effective date: May 17, 2026
            </p>
            <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
              SplitKaro AI (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting your privacy.
              This policy explains what information we collect, how we use it, and your rights
              regarding your data when you use SplitKaro AI at{" "}
              <span className="font-medium text-slate-800">splitkaro.tristech.in</span> or
              via our Telegram and WhatsApp bots.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {sections.map((section, i) => (
              <div key={section.title} className="px-6 py-7 sm:px-10">
                <h2 className="text-base font-bold text-slate-900 mb-4">
                  {i + 1}. {section.title}
                </h2>
                <div className="space-y-4">
                  {section.content.map((item, j) => (
                    <div key={j}>
                      {item.subtitle && (
                        <p className="text-sm font-semibold text-slate-800 mb-1">
                          {item.subtitle}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center pb-6">
          <Link
            href="/terms"
            className="text-sm font-medium text-primary hover:underline"
          >
            Terms of Service
          </Link>
          <span className="text-slate-300">·</span>
          <Link
            href="/welcome"
            className="text-sm font-medium text-slate-500 hover:underline"
          >
            Back to Home
          </Link>
        </div>

      </div>
    </div>
  )
}
