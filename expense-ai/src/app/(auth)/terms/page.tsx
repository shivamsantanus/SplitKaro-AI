import Link from "next/link"
import { ScrollText } from "lucide-react"

export const metadata = {
  title: "Terms of Service — SplitKaro AI",
  description: "Terms and conditions for using SplitKaro AI.",
}

const sections = [
  {
    title: "Acceptance of Terms",
    content: [
      {
        subtitle: "",
        text: "By accessing or using SplitKaro AI (\"the Service\") at splitkaro.tristech.in or via our Telegram or WhatsApp bots, you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.",
      },
    ],
  },
  {
    title: "Description of Service",
    content: [
      {
        subtitle: "",
        text: "SplitKaro AI is a personal finance and expense-splitting application that allows users to track personal expenses, manage group bills, record settlements, and add expenses via Telegram and WhatsApp bots. The Service uses AI (Google Gemini) to parse natural language expense descriptions.",
      },
    ],
  },
  {
    title: "Eligibility",
    content: [
      {
        subtitle: "",
        text: "You must be at least 13 years of age to use the Service. By using SplitKaro AI, you represent that you meet this requirement. If you are using the Service on behalf of an organisation, you represent that you have authority to bind that organisation to these terms.",
      },
    ],
  },
  {
    title: "User Account & Responsibilities",
    content: [
      {
        subtitle: "Account Creation",
        text: "You sign in using your Google account. You are responsible for maintaining the security of your Google credentials and for all activity that occurs under your account.",
      },
      {
        subtitle: "Accurate Information",
        text: "You agree to provide accurate expense and group information. The Service is a tool to assist your own record-keeping — you are responsible for the accuracy of the data you enter.",
      },
      {
        subtitle: "Bot Usage",
        text: "If you link the WhatsApp or Telegram bot, you agree to use it only for its intended purpose of logging and managing expenses. You must not attempt to abuse, spam, or reverse-engineer the bot.",
      },
      {
        subtitle: "Group Conduct",
        text: "When participating in shared groups, you agree to interact respectfully. Expense descriptions and notes are visible to group members.",
      },
    ],
  },
  {
    title: "Prohibited Uses",
    content: [
      {
        subtitle: "",
        text: "You agree not to: (a) use the Service for any unlawful purpose or in violation of any applicable law; (b) attempt to gain unauthorised access to any part of the Service or its infrastructure; (c) use automated scripts to scrape or abuse the Service; (d) impersonate another person or entity; (e) use the Service to process, store, or transmit malicious code; (f) circumvent or disable any security or rate-limiting features.",
      },
    ],
  },
  {
    title: "Financial Disclaimer",
    content: [
      {
        subtitle: "",
        text: "SplitKaro AI is an expense tracking and splitting tool only. It does not process real payments, hold funds, or facilitate financial transactions. Settlement records are for reference purposes only. We are not a payment service, bank, or financial institution. Always verify settlement amounts independently before making or receiving payments.",
      },
    ],
  },
  {
    title: "AI-Powered Features",
    content: [
      {
        subtitle: "",
        text: "The natural language expense parser uses Google Gemini AI. While we strive for accuracy, AI-parsed expense details (amounts, categories, dates) may occasionally be incorrect. Always review the confirmation card before saving an expense. You are responsible for verifying that saved expenses are accurate.",
      },
    ],
  },
  {
    title: "Intellectual Property",
    content: [
      {
        subtitle: "",
        text: "The SplitKaro AI application, including its design, code, and content, is owned by its developers. You are granted a limited, non-exclusive, non-transferable licence to use the Service for its intended purpose. You may not copy, modify, distribute, or create derivative works based on the Service without written permission.",
      },
    ],
  },
  {
    title: "Service Availability",
    content: [
      {
        subtitle: "",
        text: "We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control. We are not liable for any loss arising from Service downtime.",
      },
    ],
  },
  {
    title: "Limitation of Liability",
    content: [
      {
        subtitle: "",
        text: "To the maximum extent permitted by applicable law, SplitKaro AI and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of revenue, or financial disputes arising from reliance on the Service. Our total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim (which, for a free service, is zero).",
      },
    ],
  },
  {
    title: "Termination",
    content: [
      {
        subtitle: "By You",
        text: "You may stop using the Service at any time. You may request deletion of your account and data by contacting us.",
      },
      {
        subtitle: "By Us",
        text: "We reserve the right to suspend or terminate your access to the Service if you violate these Terms, with or without notice. Upon termination, your right to use the Service ceases immediately.",
      },
    ],
  },
  {
    title: "Changes to These Terms",
    content: [
      {
        subtitle: "",
        text: "We may update these Terms from time to time. We will indicate the effective date of the latest version below. Continued use of the Service after changes constitutes your acceptance of the updated Terms. If you disagree with any changes, you should stop using the Service.",
      },
    ],
  },
  {
    title: "Governing Law",
    content: [
      {
        subtitle: "",
        text: "These Terms are governed by the laws of India. Any disputes arising from or related to these Terms or the Service shall be subject to the exclusive jurisdiction of the courts of India.",
      },
    ],
  },
  {
    title: "Contact",
    content: [
      {
        subtitle: "",
        text: "For questions about these Terms, contact us at: splitkaro@tristech.in",
      },
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-background px-6 py-10">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="rounded-[2rem] bg-white border border-slate-200/70 shadow-xl overflow-hidden">
          <div className="px-6 py-10 sm:px-10 bg-gradient-to-br from-white via-slate-50 to-primary/5 border-b border-slate-100">
            <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center shadow-lg mb-5">
              <ScrollText className="w-8 h-8 text-white" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-primary/70 mb-3">
              Legal
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              Effective date: May 17, 2026
            </p>
            <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
              Please read these Terms of Service carefully before using SplitKaro AI.
              These terms govern your use of the application and our Telegram and WhatsApp bots.
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
            href="/privacy"
            className="text-sm font-medium text-primary hover:underline"
          >
            Privacy Policy
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
