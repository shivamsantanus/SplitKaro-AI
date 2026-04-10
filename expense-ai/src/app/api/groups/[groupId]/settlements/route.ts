import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { groupSettlementService } from "@/lib/group-settlement-service";
import { publishGroupEvent } from "@/lib/realtime";
import { findUserByEmailWithSelect } from "@/lib/users";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true,
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const { groupId } = await params;
    const settlements = await groupSettlementService.list(groupId, user.id);

    return NextResponse.json(settlements);
  } catch (error) {
    if (error instanceof Error && error.message === "You are not a member of this group") {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Group settlements fetch error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true,
      name: true,
      email: true,
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const { groupId } = await params;
    const { amount, payerId, receiverId } = await req.json();

    const settlement = await groupSettlementService.create({
      groupId,
      requesterId: user.id,
      actorName: user.name || "",
      actorEmail: user.email,
      amount,
      payerId,
      receiverId,
    });

    await publishGroupEvent(groupId, "SETTLEMENT_ADDED");

    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      const status =
        error.message === "You are not a member of this group"
          ? 403
          : 400;
      return NextResponse.json({ message: error.message }, { status });
    }

    console.error("Group settlement create error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
