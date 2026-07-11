import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { personalInsightsService } from "@/lib/personal-insights-service";
import { findUserByEmailWithSelect } from "@/lib/users";
import { getCache, setCache } from "@/lib/cache";

function parseOptionalInt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, { id: true });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const month = parseOptionalInt(searchParams.get("month"));
    const year = parseOptionalInt(searchParams.get("year"));

    const cacheKey = `personal:insights:${user.id}:${year ?? "all"}:${month ?? "all"}`;
    const cached = await getCache(cacheKey);
    if (cached) return NextResponse.json(cached);

    const insights = await personalInsightsService.generate(user.id, { month, year });

    // Only cache real results — an empty/failed run should retry next load.
    if (insights.insights.length > 0) {
      await setCache(cacheKey, insights, 10800); // 3h — AI output changes slowly
    }

    return NextResponse.json(insights);
  } catch (error) {
    console.error("Personal insights error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
