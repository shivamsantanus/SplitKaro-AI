import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Github, Linkedin, Sparkles } from "lucide-react"

const developers = [
  {
    name: "Shivam Santanu",
    role: "Full Stack Developer",
    bio: "I’m a developer who enjoys turning everyday problems into practical solutions. Outside of code, I’m usually gaming or deep into a binge-worthy series",
    githubUrl: "https://github.com/shivamsantanus",
    linkedinUrl: "https://linkedin.com/in/shivamsantanu",
    githubHandle: "@shivamsantanus",
    linkedinHandle: "/in/shivamsantanu",
    avatarUrl: "https://avatars.githubusercontent.com/shivamsantanus?v=4",
  },
  {
    name: "Anurag Verma",
    role: "Backend / Product Developer",
    bio: "I approach development with a business mindset—focused on building solutions that create real value and can scale into sustainable products.",
    githubUrl: "https://github.com/anuragverma57",
    linkedinUrl: "https://linkedin.com/in/anuragverma57",
    githubHandle: "@anuragverma57",
    linkedinHandle: "/in/anuragverma57",
    avatarUrl: "https://avatars.githubusercontent.com/anuragverma57?v=4",
  },
]

const highlights = [
  {
    title: "AI-assisted expense capture",
    description: "Natural-language input helps turn casual messages into structured expenses much faster.",
  },
  {
    title: "Realtime shared updates",
    description: "Redis-backed events keep dashboards and group pages in sync when people add expenses or settle up.",
  },
  {
    title: "Flexible payment tracking",
    description: "The app handles group expenses, individual payments, settlements, and role-based member controls.",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F8FAFC] px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="rounded-[2rem] bg-white border border-slate-200/70 shadow-xl overflow-hidden">
          <div className="px-6 py-10 sm:px-10 bg-gradient-to-br from-white via-slate-50 to-primary/5 border-b border-slate-100">
            <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center shadow-lg mb-5">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-primary/70 mb-3">
              About SplitSmart AI
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
              A collaborative expense app built for real shared life
            </h1>
            <p className="mt-4 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">
              SplitSmart AI is designed to make shared money management easier for friends, roommates,
              travel groups, and small teams. It combines clean expense tracking, live updates, and
              AI-powered input to keep the experience fast and practical.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login">
                <Button className="h-12 rounded-2xl px-6">Continue with Google</Button>
              </Link>
              <Link href="/welcome">
                <Button variant="outline" className="h-12 rounded-2xl px-6">
                  Back to Welcome
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-8 sm:px-10 md:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <h2 className="text-sm font-bold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="space-y-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500 mb-2">
              Development Team
            </p>
            <h2 className="text-2xl font-bold text-slate-900">Meet the developers</h2>
            
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {developers.map((developer) => (
              <article
                key={developer.githubUrl}
                className="rounded-[2rem] bg-white border border-slate-200/70 shadow-lg p-6"
              >
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 overflow-hidden rounded-2xl border border-slate-200">
                    <Image
                      src={developer.avatarUrl}
                      alt={developer.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{developer.name}</h3>
                    <p className="text-sm font-semibold text-primary">{developer.role}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-600 leading-relaxed">{developer.bio}</p>

                <div className="mt-5 grid gap-3">
                  <a
                    href={developer.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    <span className="flex items-center gap-3">
                      <Github className="w-4 h-4" />
                      GitHub
                    </span>
                    <span className="text-slate-500">{developer.githubHandle}</span>
                  </a>
                  <a
                    href={developer.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
                  >
                    <span className="flex items-center gap-3">
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </span>
                    <span className="text-slate-500">{developer.linkedinHandle}</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
