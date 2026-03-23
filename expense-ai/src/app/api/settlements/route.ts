import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { amount, groupId, payerId, receiverId } = await req.json();

    if (!amount || !groupId || !payerId || !receiverId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Create settlement and log activity
    const settlement = await prisma.$transaction(async (tx) => {
      const newSettlement = await tx.settlement.create({
        data: {
          amount: parseFloat(amount),
          groupId,
          payerId,
          receiverId,
        },
        include: {
          payer: { select: { name: true } },
          receiver: { select: { name: true } },
        }
      });

      await tx.activity.create({
        data: {
          type: "SETTLEMENT_ADDED",
          message: `${newSettlement.payer.name} paid ₹${amount} to ${newSettlement.receiver.name}`,
          groupId,
          userId: user.id,
          metadata: { amount: parseFloat(amount), payerId, receiverId }
        }
      });

      return newSettlement;
    });

    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    console.error("Settlement error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
