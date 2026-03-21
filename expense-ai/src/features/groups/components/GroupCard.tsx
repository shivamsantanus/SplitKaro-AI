import Link from "next/link"
import { Card, CardContent } from "@/components/ui/Card"
import { Users, ArrowRight } from "lucide-react"

interface GroupCardProps {
  id: string
  name: string
  memberCount: number
  balance: number
}

export const GroupCard = ({ id, name, memberCount, balance }: GroupCardProps) => {
  const isPositive = balance >= 0

  return (
    <Link href={`/groups/${id}`}>
      <Card className="hover:shadow-md transition-all group cursor-pointer border-slate-100 hover:border-primary-100">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-12 w-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
              <Users className="h-6 w-6" />
            </div>
            <div className={`text-right ${isPositive ? 'text-teal-600' : 'text-rose-600'}`}>
              <p className="text-xs font-medium uppercase tracking-wider opacity-60">
                {isPositive ? 'You are owed' : 'You owe'}
              </p>
              <p className="text-lg font-bold">
                ₹{Math.abs(balance).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-end justify-between">
            <div>
              <h3 className="text-xl font-bold mb-1">{name}</h3>
              <p className="text-sm text-muted-foreground">{memberCount} members</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all transform group-hover:translate-x-1">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
