import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOutstandingDebtsForUserInGroup } from "@/lib/group-membership";
import { findUserByEmailWithSelect } from "@/lib/users";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { groupId, memberId } = await params;

    const currentUser = await findUserByEmailWithSelect(session.user.email, {
      id: true,
    });

    if (!currentUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const requesterMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: currentUser.id } },
      select: { userId: true },
    });

    if (!requesterMembership) {
      return NextResponse.json(
        { message: "You are not a member of this group" },
        { status: 403 }
      );
    }

    const targetMembership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: memberId } },
      select: { userId: true },
    });

    if (!targetMembership) {
      return NextResponse.json(
        { message: "Member not found in this group" },
        { status: 404 }
      );
    }

    const debts = await getOutstandingDebtsForUserInGroup(groupId, memberId);

    const counterparties = await prisma.user.findMany({
      where: { id: { in: debts.map((debt) => debt.userId) } },
      select: { id: true, name: true, email: true },
    });
    const nameById = new Map(counterparties.map((user) => [user.id, user]));

    // Positive amount => the member is owed by the counterparty; negative => the
    // member owes the counterparty. The UI maps this to payer/receiver.
    const balances = debts.map((debt) => ({
      userId: debt.userId,
      name: nameById.get(debt.userId)?.name ?? nameById.get(debt.userId)?.email ?? "",
      amount: debt.amount,
    }));

    return NextResponse.json({ balances });
  } catch (error) {
    console.error("Member balances error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
