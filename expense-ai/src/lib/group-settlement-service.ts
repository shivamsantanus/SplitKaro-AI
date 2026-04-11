import prisma from "@/lib/prisma";

type CreateGroupSettlementInput = {
  groupId: string;
  requesterId: string;
  actorName: string;
  actorEmail: string;
  amount: number | string;
  payerId: string;
  receiverId: string;
};

export const groupSettlementService = {
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

    return prisma.settlement.findMany({
      where: {
        groupId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        groupId: true,
        payerId: true,
        receiverId: true,
        payer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  async create(input: CreateGroupSettlementInput) {
    await this.assertGroupMember(input.groupId, input.requesterId);

    const amount = Number(input.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (!input.payerId || !input.receiverId) {
      throw new Error("Payer and receiver are required");
    }

    if (input.payerId === input.receiverId) {
      throw new Error("Payer and receiver must be different users");
    }

    const participants = await prisma.groupMember.findMany({
      where: {
        groupId: input.groupId,
        userId: {
          in: [input.payerId, input.receiverId],
        },
      },
      select: {
        userId: true,
      },
    });

    const participantIds = new Set(participants.map((participant) => participant.userId));

    if (!participantIds.has(input.payerId) || !participantIds.has(input.receiverId)) {
      throw new Error("Payer and receiver must both be members of this group");
    }

    return prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.create({
        data: {
          amount,
          groupId: input.groupId,
          payerId: input.payerId,
          receiverId: input.receiverId,
        },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          groupId: true,
          payerId: true,
          receiverId: true,
          payer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.activity.create({
        data: {
          type: "SETTLEMENT_ADDED",
          message: `${input.actorName || input.actorEmail} recorded a payment of Rs ${amount} from ${settlement.payer.name || settlement.payer.email} to ${settlement.receiver.name || settlement.receiver.email}`,
          groupId: input.groupId,
          userId: input.requesterId,
          metadata: {
            amount,
            payerId: input.payerId,
            receiverId: input.receiverId,
          },
        },
      });

      return settlement;
    });
  },
};
