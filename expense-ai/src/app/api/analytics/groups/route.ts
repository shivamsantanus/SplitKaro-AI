import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmailWithSelect } from "@/lib/users";
import { groupAnalyticsService } from "@/lib/group-analytics-service";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, { id: true });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const summary = await groupAnalyticsService.getSummary(user.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Group analytics error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
