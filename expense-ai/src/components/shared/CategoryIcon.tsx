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
} from "lucide-react"
import { getExpenseCategoryIconName } from "@/lib/expense-categories"

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const iconName = getExpenseCategoryIconName(category)

  switch (iconName) {
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
