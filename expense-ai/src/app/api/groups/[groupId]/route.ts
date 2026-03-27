import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishGroupEvent } from "@/lib/realtime";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Await params in Next.js 15+ / 16
    const { groupId } = await params;
    console.log("Fetching group with ID:", groupId);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Check if it's the virtual solo-transactions group
    if (groupId === "solo-transactions") {
        const [soloExpensesPaid, soloExpensesOwed, soloSettlements] = await Promise.all([
          prisma.expense.findMany({
            where: { groupId: null, paidById: user.id },
            include: { 
              payer: { select: { id: true, name: true, email: true } },
              splits: { include: { user: { select: { id: true, name: true, email: true } } } } 
            }
          }),
          prisma.expenseSplit.findMany({
            where: { userId: user.id, expense: { groupId: null, paidById: { not: user.id } } },
            include: { expense: { include: { 
              payer: { select: { id: true, name: true, email: true } },
              splits: { include: { user: { select: { id: true, name: true, email: true } } } } 
            } } }
          }),
          prisma.settlement.findMany({
            where: { groupId: null, OR: [{ payerId: user.id }, { receiverId: user.id }] },
            include: { payer: { select: { id: true, name: true } }, receiver: { select: { id: true, name: true } } }
          })
        ]);

        const allSoloExpenses = [
          ...soloExpensesPaid,
          ...soloExpensesOwed.map(s => (s as any).expense)
        ].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Construct unique members
        const memberMap = new Map();
        memberMap.set(user.id, { userId: user.id, user: { name: (session?.user as any)?.name || "You", email: session.user.email } });
        allSoloExpenses.forEach(exp => {
            memberMap.set(exp.paidById, { userId: exp.paidById, user: exp.payer });
            exp.splits.forEach((split: any) => {
                memberMap.set(split.userId, { userId: split.userId, user: split.user });
            });
        });
        soloSettlements.forEach((sett: any) => {
            memberMap.set(sett.payerId, { userId: sett.payerId, user: sett.payer });
            memberMap.set(sett.receiverId, { userId: sett.receiverId, user: sett.receiver });
        });

        // Calculate debts logic similar to group but simplified
        const pairwiseDebts: Record<string, any> = {};
        memberMap.forEach((m) => {
            if (m.userId !== user.id) {
                pairwiseDebts[m.userId] = { userId: m.userId, name: m.user.name || m.user.email, amount: 0 };
            }
        });

        allSoloExpenses.forEach((exp: any) => {
            if (exp.paidById === user.id) {
                exp.splits.forEach((split: any) => {
                    if (split.userId !== user.id && pairwiseDebts[split.userId]) pairwiseDebts[split.userId].amount += split.amount;
                });
            } else {
                const mySplit = exp.splits.find((s: any) => s.userId === user.id);
                if (mySplit && pairwiseDebts[exp.paidById]) pairwiseDebts[exp.paidById].amount -= mySplit.amount;
            }
        });

        soloSettlements.forEach((sett: any) => {
            if (sett.payerId === user.id) {
                if (pairwiseDebts[sett.receiverId]) pairwiseDebts[sett.receiverId].amount += sett.amount;
            } else if (sett.receiverId === user.id) {
                if (pairwiseDebts[sett.payerId]) pairwiseDebts[sett.payerId].amount -= sett.amount;
            }
        });

        return NextResponse.json({
            id: "solo-transactions",
            name: "Individual Payments",
            isSolo: true,
            members: Array.from(memberMap.values()),
            expenses: allSoloExpenses,
            settlements: soloSettlements,
            debts: Object.values(pairwiseDebts).filter(d => Math.abs(d.amount) > 0.01)
        });
    }

    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { message: "You are not a member of this group" },
        { status: 403 }
      );
    }

    const [group, members, expenses, settlements] = await Promise.all([
      prisma.group.findUnique({
        where: { id: groupId },
        select: {
          id: true,
          name: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
        },
      }),
      prisma.groupMember.findMany({
        where: {
          groupId,
        },
        select: {
          id: true,
          role: true,
          createdAt: true,
          groupId: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          groupId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          description: true,
          amount: true,
          createdAt: true,
          updatedAt: true,
          groupId: true,
          paidById: true,
          payer: {
            select: {
              name: true,
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
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.settlement.findMany({
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
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    if (!group) {
      return NextResponse.json(
        { message: "Group not found" },
        { status: 404 }
      );
    }

    // Single Group Pairwise Debt Calculation
    const pairwiseDebts: Record<string, { userId: string, name: string, amount: number }> = {};
    
    members.forEach((member) => {
       if (member.userId !== user.id) {
          pairwiseDebts[member.userId] = {
             userId: member.userId,
             name: member.user.name || member.user.email,
             amount: 0
          };
       }
    });

    expenses.forEach((exp) => {
       if (exp.paidById === user.id) {
          exp.splits.forEach((split) => {
             if (split.userId !== user.id && pairwiseDebts[split.userId]) {
                pairwiseDebts[split.userId].amount += split.amount;
             }
          });
       } else {
          const mySplit = exp.splits.find((split) => split.userId === user.id);
          if (mySplit && pairwiseDebts[exp.paidById]) {
             pairwiseDebts[exp.paidById].amount -= mySplit.amount;
          }
       }
    });

    // Subtract/Add Settlements
    settlements.forEach((settlement) => {
      if (settlement.payerId === user.id) {
        // You paid: reduces what you owe or increases what they owe you
        if (pairwiseDebts[settlement.receiverId]) {
          pairwiseDebts[settlement.receiverId].amount += settlement.amount;
        }
      } else if (settlement.receiverId === user.id) {
        // You were paid: reduces what they owe you or increases what you owe them
        if (pairwiseDebts[settlement.payerId]) {
          pairwiseDebts[settlement.payerId].amount -= settlement.amount;
        }
      }
    });

    const debtsArray = Object.values(pairwiseDebts).filter(d => Math.abs(d.amount) > 0.01);

    return NextResponse.json({
      ...group,
      members,
      expenses,
      settlements,
      debts: debtsArray
    });
  } catch (error) {
    console.error("Group fetch error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { groupId } = await params;

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

    if (group.createdById !== user.id) {
      return NextResponse.json({ message: "Only the group creator can delete this group" }, { status: 403 });
    }

    await prisma.group.delete({ where: { id: groupId } });
    return NextResponse.json({ message: "Group deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Delete group error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { groupId } = await params;
    const { name, isArchived } = await req.json();

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

    if (group.createdById !== user.id) {
       return NextResponse.json({ message: "Only the group creator can edit this group" }, { status: 403 });
    }

    const updatedGroup = await prisma.$transaction(async (tx) => {
      const updateData: { name?: string; isArchived?: boolean } = {};
      if (name) updateData.name = name.trim();
      if (typeof isArchived === "boolean") updateData.isArchived = isArchived;

      const updated = await tx.group.update({
        where: { id: groupId },
        data: updateData,
      });

      if (name && name.trim() !== group.name) {
        await tx.activity.create({
          data: {
            type: "GROUP_RENAMED",
            message: `${user.name || user.email} renamed the group to "${name.trim()}"`,
            groupId: groupId,
            userId: user.id,
            metadata: { oldName: group.name, newName: name.trim() }
          }
        });
      }

      if (isArchived === true && !group.isArchived) {
        await tx.activity.create({
          data: {
            type: "GROUP_ARCHIVED",
            message: `${user.name || user.email} archived the group "${updated.name}"`,
            groupId: groupId,
            userId: user.id,
          }
        });
      }

      return updated;
    });

    await publishGroupEvent(groupId, "GROUP_UPDATED");

    return NextResponse.json(updatedGroup, { status: 200 });
  } catch (error) {
    console.error("Update group error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
