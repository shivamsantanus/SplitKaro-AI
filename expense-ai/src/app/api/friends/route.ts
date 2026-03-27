import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    // 1. Get all members of all groups I'm in
    const groupMembers = await prisma.groupMember.findMany({
      where: {
        group: {
          members: {
            some: { userId: user.id }
          }
        },
        userId: { not: user.id }
      },
      select: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // 2. Get all participants of solo transactions I'm in
    const soloExpenses = await prisma.expense.findMany({
      where: {
        groupId: null,
        OR: [
          { paidById: user.id },
          { splits: { some: { userId: user.id } } }
        ]
      },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        splits: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    });

    const soloSettlements = await prisma.settlement.findMany({
      where: {
        groupId: null,
        OR: [
          { payerId: user.id },
          { receiverId: user.id }
        ]
      },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        receiver: { select: { id: true, name: true, email: true } }
      }
    });

    const friendsMap = new Map();

    groupMembers.forEach(m => {
      friendsMap.set(m.user.id, m.user);
    });

    soloExpenses.forEach((exp: any) => {
      if (exp.paidById !== user.id) friendsMap.set(exp.payer.id, exp.payer);
      exp.splits.forEach((s: any) => {
        if (s.userId !== user.id) friendsMap.set(s.userId, s.user);
      });
    });

    soloSettlements.forEach((s: any) => {
      if (s.payerId !== user.id) friendsMap.set(s.payerId, s.payer);
      if (s.receiverId !== user.id) friendsMap.set(s.receiverId, s.receiver);
    });

    return NextResponse.json(Array.from(friendsMap.values()));
  } catch (error) {
    console.error("Friends fetch error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
