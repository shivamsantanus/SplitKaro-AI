import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type GroupMemberSummary = {
  groupId: string;
  userId: string;
  user: {
    name: string | null;
    email: string;
  };
};

type GroupExpenseSummary = {
  groupId: string;
  amount: number;
  paidById: string;
  splits: {
    userId: string;
    amount: number;
  }[];
};

type GroupSettlementSummary = {
  groupId: string;
  amount: number;
  payerId: string;
  receiverId: string;
};

type GroupTotalSpentSummary = {
  groupId: string;
  _sum: {
    amount: number | null;
  };
};

type GroupMyExpenseSummary = {
  groupId: string;
  _sum: {
    amount: number | null;
  };
};

type GroupMyShareSummary = {
  amount: number;
  expense: {
    groupId: string;
  };
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { name } = await req.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { message: "Group name is required" },
        { status: 400 }
      );
    }

    // Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Create group and add the user as ADMIN member in a transaction
    const group = await prisma.$transaction(async (tx) => {
      const newGroup = await tx.group.create({
        data: {
          name: name.trim(),
          createdById: user.id,
        },
      });

      await tx.groupMember.create({
        data: {
          groupId: newGroup.id,
          userId: user.id,
          role: "ADMIN",
        },
      });

      return newGroup;
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("Group creation error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
      },
    });

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("archived") === "true";

    if (!user) {
       return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const memberships = await prisma.groupMember.findMany({
      where: {
        userId: user.id,
        group: {
          isArchived: includeArchived,
        },
      },
      select: {
        groupId: true,
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (memberships.length === 0) {
      return NextResponse.json([]);
    }

    const groupIds = memberships.map((membership) => membership.groupId);

    const [members, expensesPaidByMe, expensesOwedByMe, settlements, totalSpentByGroup, paidByMeByGroup, myShareSplits] = await Promise.all([
      prisma.groupMember.findMany({
        where: {
          groupId: {
            in: groupIds,
          },
        },
        select: {
          groupId: true,
          userId: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          groupId: {
            in: groupIds,
          },
          paidById: user.id,
        },
        select: {
          groupId: true,
          splits: {
            where: {
              userId: {
                not: user.id,
              },
            },
            select: {
              userId: true,
              amount: true,
            },
          },
        },
      }),
      prisma.expenseSplit.findMany({
        where: {
          userId: user.id,
          expense: {
            groupId: {
              in: groupIds,
            },
            paidById: {
              not: user.id,
            },
          },
        },
        select: {
          amount: true,
          expense: {
            select: {
              groupId: true,
              paidById: true,
            },
          },
        },
      }),
      prisma.settlement.findMany({
        where: {
          groupId: {
            in: groupIds,
          },
          OR: [
            {
              payerId: user.id,
            },
            {
              receiverId: user.id,
            },
          ],
        },
        select: {
          groupId: true,
          amount: true,
          payerId: true,
          receiverId: true,
        },
      }),
      prisma.expense.groupBy({
        by: ["groupId"],
        where: {
          groupId: {
            in: groupIds,
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.expense.groupBy({
        by: ["groupId"],
        where: {
          groupId: {
            in: groupIds,
          },
          paidById: user.id,
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.expenseSplit.findMany({
        where: {
          userId: user.id,
          expense: {
            groupId: {
              in: groupIds,
            },
          },
        },
        select: {
          amount: true,
          expense: {
            select: {
              groupId: true,
            },
          },
        },
      }),
    ]);

    const membersByGroup = new Map<string, GroupMemberSummary[]>();
    const expensesByGroup = new Map<string, GroupExpenseSummary[]>();
    const settlementsByGroup = new Map<string, GroupSettlementSummary[]>();
    const totalSpentMap = new Map<string, number>();
    const paidByMeMap = new Map<string, number>();
    const myShareMap = new Map<string, number>();

    for (const member of members) {
      const groupMembers = membersByGroup.get(member.groupId) ?? [];
      groupMembers.push(member);
      membersByGroup.set(member.groupId, groupMembers);
    }

    for (const expense of expensesPaidByMe) {
      const groupExpenses = expensesByGroup.get(expense.groupId) ?? [];
      groupExpenses.push({
        groupId: expense.groupId,
        amount: 0,
        paidById: user.id,
        splits: expense.splits,
      });
      expensesByGroup.set(expense.groupId, groupExpenses);
    }

    for (const expenseSplit of expensesOwedByMe) {
      const groupExpenses = expensesByGroup.get(expenseSplit.expense.groupId) ?? [];
      groupExpenses.push({
        groupId: expenseSplit.expense.groupId,
        amount: 0,
        paidById: expenseSplit.expense.paidById,
        splits: [
          {
            userId: user.id,
            amount: expenseSplit.amount,
          },
        ],
      });
      expensesByGroup.set(expenseSplit.expense.groupId, groupExpenses);
    }

    for (const settlement of settlements) {
      const groupSettlements = settlementsByGroup.get(settlement.groupId) ?? [];
      groupSettlements.push(settlement);
      settlementsByGroup.set(settlement.groupId, groupSettlements);
    }

    for (const summary of totalSpentByGroup as GroupTotalSpentSummary[]) {
      totalSpentMap.set(summary.groupId, summary._sum.amount ?? 0);
    }

    for (const summary of paidByMeByGroup as GroupMyExpenseSummary[]) {
      paidByMeMap.set(summary.groupId, summary._sum.amount ?? 0);
    }

    for (const split of myShareSplits as GroupMyShareSummary[]) {
      const currentAmount = myShareMap.get(split.expense.groupId) ?? 0;
      myShareMap.set(split.expense.groupId, currentAmount + split.amount);
    }

    const groups = memberships.map((membership) => {
      const groupMembers = membersByGroup.get(membership.groupId) ?? [];
      const groupExpenses = expensesByGroup.get(membership.groupId) ?? [];
      const groupSettlements = settlementsByGroup.get(membership.groupId) ?? [];
      const totalSpent = totalSpentMap.get(membership.groupId) ?? 0;
      
      // Pairwise Debt Calculation
      const pairwiseDebts: Record<string, { userId: string, name: string, amount: number }> = {};
      
      groupMembers.forEach(member => {
         if (member.userId !== user.id) {
            pairwiseDebts[member.userId] = {
               userId: member.userId,
               name: member.user.name || member.user.email,
               amount: 0
            };
         }
      });

      // 1. Add Debts from Expenses
      groupExpenses.forEach(exp => {
         if (exp.paidById === user.id) {
            exp.splits.forEach(split => {
               if (split.userId !== user.id && pairwiseDebts[split.userId]) {
                  pairwiseDebts[split.userId].amount += split.amount;
               }
            });
         } else {
            const mySplit = exp.splits.find(s => s.userId === user.id);
            if (mySplit && pairwiseDebts[exp.paidById]) {
               pairwiseDebts[exp.paidById].amount -= mySplit.amount;
            }
         }
      });

      // 2. Subtract Settlements (recorded payments)
      groupSettlements.forEach(sett => {
         if (sett.payerId === user.id && pairwiseDebts[sett.receiverId]) {
            // I paid them, reduces what I owe them or increases what they owe me
            pairwiseDebts[sett.receiverId].amount += sett.amount;
         } else if (sett.receiverId === user.id && pairwiseDebts[sett.payerId]) {
            // They paid me, reduces what they owe me or increases what I owe them
            pairwiseDebts[sett.payerId].amount -= sett.amount;
         }
      });

      const debtsArray = Object.values(pairwiseDebts).filter(d => Math.abs(d.amount) > 0.01);

      const paidByMe = paidByMeMap.get(membership.groupId) ?? 0;

      const myShare = myShareMap.get(membership.groupId) ?? 0;

      const mySettledPaid = groupSettlements
        .filter(s => s.payerId === user.id)
        .reduce((sum, s) => sum + s.amount, 0);

      const mySettledReceived = groupSettlements
        .filter(s => s.receiverId === user.id)
        .reduce((sum, s) => sum + s.amount, 0);

      const yourBalance = (paidByMe - myShare) + (mySettledPaid - mySettledReceived);

      return {
        id: membership.group.id,
        name: membership.group.name,
        totalSpent,
        yourBalance,
        debts: debtsArray,
        members: groupMembers.map(member => member.user.name?.substring(0, 2).toUpperCase() || "??"),
      };
    });

    // Individual (Group-less) Transactions
    const [soloExpensesPaid, soloExpensesOwed, soloSettlements] = await Promise.all([
      prisma.expense.findMany({
        where: { groupId: null, paidById: user.id },
        include: { splits: { include: { user: { select: { id: true, name: true, email: true } } } } }
      }),
      prisma.expenseSplit.findMany({
        where: { userId: user.id, expense: { groupId: null, paidById: { not: user.id } } },
        include: { expense: { include: { payer: { select: { id: true, name: true, email: true } } } } }
      }),
      prisma.settlement.findMany({
        where: { groupId: null, OR: [{ payerId: user.id }, { receiverId: user.id }] },
        include: { payer: { select: { id: true, name: true } }, receiver: { select: { id: true, name: true } } }
      })
    ]);

    // Process Solo Transactions into a virtual "Group" for easier frontend consumption
    const soloPairwise: Record<string, { userId: string, name: string, amount: number }> = {};

    // 1. Solo Expenses Paid by Me
    soloExpensesPaid.forEach(exp => {
      exp.splits.forEach(split => {
        if (split.userId !== user.id) {
          if (!soloPairwise[split.userId]) soloPairwise[split.userId] = { userId: split.userId, name: (split as any).user.name || (split as any).user.email, amount: 0 };
          soloPairwise[split.userId].amount += split.amount;
        }
      });
    });

    // 2. Solo Expenses Owed by Me
    soloExpensesOwed.forEach(split => {
      const payerId = (split as any).expense.paidById;
      const payerName = (split as any).expense.payer.name || (split as any).expense.payer.email;
      if (!soloPairwise[payerId]) soloPairwise[payerId] = { userId: payerId, name: payerName, amount: 0 };
      soloPairwise[payerId].amount -= split.amount;
    });

    // 3. Solo Settlements
    soloSettlements.forEach(sett => {
      if (sett.payerId === user.id) {
        if (!soloPairwise[sett.receiverId]) soloPairwise[sett.receiverId] = { userId: sett.receiverId, name: (sett as any).receiver.name, amount: 0 };
        soloPairwise[sett.receiverId].amount += sett.amount;
      } else if (sett.receiverId === user.id) {
        if (!soloPairwise[sett.payerId]) soloPairwise[sett.payerId] = { userId: sett.payerId, name: (sett as any).payer.name, amount: 0 };
        soloPairwise[sett.payerId].amount -= sett.amount;
      }
    });

    const soloDebts = Object.values(soloPairwise).filter(d => Math.abs(d.amount) > 0.01);
    const soloBalance = soloDebts.reduce((acc, d) => acc + d.amount, 0);

    const groupList = groups.filter(g => g !== null);

    if (soloDebts.length > 0) {
      groupList.push({
        id: "solo-transactions",
        name: "Individual Payments",
        totalSpent: soloExpensesPaid.reduce((acc, e) => acc + e.amount, 0),
        yourBalance: soloBalance,
        debts: soloDebts,
        members: ["👤"],
        isSolo: true
      });
    }

    return NextResponse.json(groupList);
  } catch (error) {
    console.error("Failed to fetch groups:", error);
    return NextResponse.json(
      { message: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
