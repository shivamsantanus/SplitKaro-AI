import {
  UtensilsCrossed,
  Bus,
  ShoppingBasket,
  Clapperboard,
  Plane,
  House,
  ShoppingBag,
  Receipt,
  HeartPulse,
  Wallet,
  Banknote,
  Laptop,
  Briefcase,
  BadgePercent,
  Gift,
  PiggyBank,
  Undo2,
} from "lucide-react"
import { getExpenseCategoryIconName } from "@/lib/expense-categories"
import { getIncomeCategoryIconName } from "@/lib/income-categories"

export function CategoryIcon({
  category,
  className,
  type = "EXPENSE",
}: {
  category: string
  className?: string
  type?: "EXPENSE" | "INCOME"
}) {
  if (type === "INCOME") {
    switch (getIncomeCategoryIconName(category)) {
      case "salary":    return <Banknote className={className} />
      case "freelance": return <Laptop className={className} />
      case "business":  return <Briefcase className={className} />
      case "cashback":  return <BadgePercent className={className} />
      case "rewards":   return <Gift className={className} />
      case "interest":  return <PiggyBank className={className} />
      case "refund":    return <Undo2 className={className} />
      case "gift":      return <Gift className={className} />
      default:          return <Wallet className={className} />
    }
  }

  switch (getExpenseCategoryIconName(category)) {
    case "food":          return <UtensilsCrossed className={className} />
    case "transport":     return <Bus className={className} />
    case "groceries":     return <ShoppingBasket className={className} />
    case "entertainment": return <Clapperboard className={className} />
    case "travel":        return <Plane className={className} />
    case "rent":          return <House className={className} />
    case "shopping":      return <ShoppingBag className={className} />
    case "bills":         return <Receipt className={className} />
    case "health":        return <HeartPulse className={className} />
    default:              return <Wallet className={className} />
  }
}
