import prisma from "@/lib/prisma";

type PairwiseDebt = {
  userId: string;
  amount: number;
};

export async function getOutstandingDebtsForUserInGroup(groupId: string, userId: string) {
  const [members, expenses, settlements] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId },
      select: {
        userId: true,
      },
    }),
    prisma.expense.findMany({
      where: { groupId },
      select: {
        paidById: true,
        splits: {
          select: {
            userId: true,
            amount: true,
          },
        },
      },
    }),
    prisma.settlement.findMany({
      where: { groupId },
      select: {
        payerId: true,
        receiverId: true,
        amount: true,
      },
    }),
  ]);

  const pairwiseDebts: Record<string, PairwiseDebt> = {};

  for (const member of members) {
    if (member.userId !== userId) {
      pairwiseDebts[member.userId] = {
        userId: member.userId,
        amount: 0,
      };
    }
  }

  for (const expense of expenses) {
    if (expense.paidById === userId) {
      for (const split of expense.splits) {
        if (split.userId !== userId && pairwiseDebts[split.userId]) {
          pairwiseDebts[split.userId].amount += split.amount;
        }
      }
      continue;
    }

    const mySplit = expense.splits.find((split) => split.userId === userId);
    if (mySplit && pairwiseDebts[expense.paidById]) {
      pairwiseDebts[expense.paidById].amount -= mySplit.amount;
    }
  }

  for (const settlement of settlements) {
    if (settlement.payerId === userId && pairwiseDebts[settlement.receiverId]) {
      pairwiseDebts[settlement.receiverId].amount += settlement.amount;
    } else if (settlement.receiverId === userId && pairwiseDebts[settlement.payerId]) {
      pairwiseDebts[settlement.payerId].amount -= settlement.amount;
    }
  }

  return Object.values(pairwiseDebts).filter((debt) => Math.abs(debt.amount) > 0.01);
}

export async function ensureUserCanExitGroup(groupId: string, userId: string) {
  const outstandingDebts = await getOutstandingDebtsForUserInGroup(groupId, userId);
  return outstandingDebts.length === 0;
}
