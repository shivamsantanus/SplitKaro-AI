import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findUserByEmailWithSelect } from "@/lib/users";
import { getCache, setCache } from "@/lib/cache";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true,
    });

    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const cacheKey = `friends:${user.id}`;
    const cached = await getCache(cacheKey);
    if (cached) return NextResponse.json(cached);

    // 1. Get all members of all groups I'm in
    const groupMembers = await prisma.groupMember.findMany({
      where: {
        group: {
          members: {
            some: { userId: user.id }
          }
        },
        userId: { not: user.id },
        user: { isPlaceholder: false }
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
        payer: { select: { id: true, name: true, email: true, isPlaceholder: true } },
        splits: { include: { user: { select: { id: true, name: true, email: true, isPlaceholder: true } } } }
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
        payer: { select: { id: true, name: true, email: true, isPlaceholder: true } },
        receiver: { select: { id: true, name: true, email: true, isPlaceholder: true } }
      }
    });

    const friendsMap = new Map();

    // Guests (placeholders) are excluded — they are not real, reusable friends
    // and must never surface in group add-member suggestions.
    const addFriend = (person: any) => {
      if (person && !person.isPlaceholder) friendsMap.set(person.id, person);
    };

    groupMembers.forEach(m => {
      friendsMap.set(m.user.id, m.user);
    });

    soloExpenses.forEach((exp: any) => {
      if (exp.paidById !== user.id) addFriend(exp.payer);
      exp.splits.forEach((s: any) => {
        if (s.userId !== user.id) addFriend(s.user);
      });
    });

    soloSettlements.forEach((s: any) => {
      if (s.payerId !== user.id) addFriend(s.payer);
      if (s.receiverId !== user.id) addFriend(s.receiver);
    });

    const friends = Array.from(friendsMap.values());
    await setCache(cacheKey, friends, 300);
    return NextResponse.json(friends);
  } catch (error) {
    console.error("Friends fetch error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
