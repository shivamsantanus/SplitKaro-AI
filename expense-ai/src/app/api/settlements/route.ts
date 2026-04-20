import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { groupSettlementService } from "@/lib/group-settlement-service";
import { publishGroupEvent, publishUserEvent } from "@/lib/realtime";
import { findUserByEmailWithSelect } from "@/lib/users";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { amount, groupId, payerId, receiverId } = await req.json();

    if (!amount || !payerId || !receiverId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true,
      name: true,
      email: true,
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // If the client sent its own session ID as payerId, replace it with the
    // server-verified user.id (found by email). This prevents JWT-token vs
    // database-ID mismatches from breaking the group membership check.
    const sessionUserId = (session.user as any)?.id as string | undefined
    const resolvedPayerId = (payerId === sessionUserId || payerId === user.id)
      ? user.id
      : payerId

    if (groupId) {
      try {
        const settlement = await groupSettlementService.create({
          groupId,
          requesterId: user.id,
          actorName: user.name || "",
          actorEmail: user.email,
          amount,
          payerId: resolvedPayerId,
          receiverId,
        });

        await publishGroupEvent(groupId, "SETTLEMENT_ADDED");
        return NextResponse.json(settlement, { status: 201 });
      } catch (error) {
        if (error instanceof Error) {
          const status = error.message === "You are not a member of this group" ? 403 : 400;
          return NextResponse.json({ message: error.message }, { status });
        }

        throw error;
      }
    }

    // Create settlement and log activity
    const settlement = await prisma.$transaction(async (tx) => {
      const newSettlement = await tx.settlement.create({
        data: {
          amount: parseFloat(amount),
          groupId: groupId || null,
          payerId: resolvedPayerId,
          receiverId,
        },
        include: {
          payer: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
        }
      });

      await tx.activity.create({
        data: {
          type: "SETTLEMENT_ADDED",
          message: `${newSettlement.payer.name} paid ₹${amount} to ${newSettlement.receiver.name}`,
          groupId: groupId || null,
          userId: user.id,
          metadata: { amount: parseFloat(amount), payerId: resolvedPayerId, receiverId }
        }
      });

      return newSettlement;
    });

    if (groupId) {
        await publishGroupEvent(groupId, "SETTLEMENT_ADDED");
    } else {
        await publishUserEvent(resolvedPayerId, "SETTLEMENT_ADDED");
        await publishUserEvent(receiverId, "SETTLEMENT_ADDED");
    }

    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    console.error("Settlement error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
