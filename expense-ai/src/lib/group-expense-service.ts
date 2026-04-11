import prisma from "@/lib/prisma";
import { inferExpenseCategory, normalizeExpenseCategory } from "@/lib/expense-categories";

type CreateGroupExpenseInput = {
  groupId: string;
  requesterId: string;
  actorName: string;
  actorEmail: string;
  amount: number | string;
  description: string;
  paidById?: string | null;
  splits?: Array<{ userId: string; amount: number }>;
  category?: string | null;
};

export const groupExpenseService = {
  async assertGroupMember(groupId: string, userId: string) {
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: {
        groupId: true,
        userId: true,
      },
    });

    if (!membership) {
      throw new Error("You are not a member of this group");
    }

    return membership;
  },

  async list(groupId: string, requesterId: string) {
    await this.assertGroupMember(groupId, requesterId);

    return prisma.expense.findMany({
      where: {
        groupId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        description: true,
        category: true,
        amount: true,
        createdAt: true,
        updatedAt: true,
        groupId: true,
        paidById: true,
        payer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        splits: {
          select: {
            id: true,
            amount: true,
            expenseId: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });
  },

  async create(input: CreateGroupExpenseInput) {
    await this.assertGroupMember(input.groupId, input.requesterId);

    const amount = Number(input.amount);
    const description = input.description.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (!description) {
      throw new Error("Description is required");
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: input.groupId },
      select: { userId: true },
    });

    const memberIds = new Set(members.map((member) => member.userId));
    const payerUserId = input.paidById || input.requesterId;

    if (!memberIds.has(payerUserId)) {
      throw new Error("Payer must be a member of this group");
    }

    let expenseSplitData: Array<{ userId: string; amount: number }> = [];

    if (input.splits && Array.isArray(input.splits) && input.splits.length > 0) {
      const totalSplitAmount = input.splits.reduce((sum, split) => sum + Number(split.amount), 0);
      const hasInvalidSplitUser = input.splits.some(
        (split) => !split?.userId || !memberIds.has(split.userId)
      );

      if (hasInvalidSplitUser) {
        throw new Error("All split users must be members of this group");
      }

      if (Math.abs(totalSplitAmount - amount) > 0.1) {
        throw new Error("Split amounts must equal the total expense amount");
      }

      expenseSplitData = input.splits.map((split) => ({
        userId: split.userId,
        amount: Number(split.amount),
      }));
    } else {
      const splitAmount = amount / members.length;
      expenseSplitData = members.map((member) => ({
        userId: member.userId,
        amount: splitAmount,
      }));
    }

    const expenseCategory = input.category
      ? normalizeExpenseCategory(input.category)
      : inferExpenseCategory(description);

    return prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          amount,
          description,
          category: expenseCategory,
          groupId: input.groupId,
          paidById: payerUserId,
        },
        select: {
          id: true,
          description: true,
          category: true,
          amount: true,
          createdAt: true,
          updatedAt: true,
          groupId: true,
          paidById: true,
        },
      });

      await tx.expenseSplit.createMany({
        data: expenseSplitData.map((split) => ({
          expenseId: newExpense.id,
          userId: split.userId,
          amount: split.amount,
        })),
      });

      await tx.activity.create({
        data: {
          type: "EXPENSE_ADDED",
          message: `${input.actorName || input.actorEmail} added "${description}"`,
          groupId: input.groupId,
          userId: input.requesterId,
          metadata: {
            amount,
            description,
            category: expenseCategory,
            splitUserIds: expenseSplitData.map((split) => split.userId),
            paidById: payerUserId,
          },
        },
      });

      return newExpense;
    });
  },
};
