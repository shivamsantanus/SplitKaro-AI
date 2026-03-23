import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
      include: {
        memberships: {
          include: {
            group: {
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        name: true,
                        email: true,
                      }
                    }
                  }
                },
                expenses: {
                  include: {
                    splits: true
                  }
                },
                settlements: {
                  include: {
                    payer: { select: { name: true } },
                    receiver: { select: { name: true } },
                  }
                }
              }
            }
          }
        }
      }
    });

    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("archived") === "true";

    if (!user) {
       return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Transform for frontend with debt calculation
    const groups = user.memberships.map((m) => {
      // Filter based on archived status
      if (includeArchived && !(m.group as any).isArchived) return null; // Show only archived
      if (!includeArchived && (m.group as any).isArchived) return null; // Show only active

      const expenses = m.group.expenses;
      const settlements = m.group.settlements;
      const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      // Pairwise Debt Calculation
      const pairwiseDebts: Record<string, { userId: string, name: string, amount: number }> = {};
      
      m.group.members.forEach(member => {
         if (member.userId !== user.id) {
            pairwiseDebts[member.userId] = {
               userId: member.userId,
               name: member.user.name || member.user.email,
               amount: 0
            };
         }
      });

      // 1. Add Debts from Expenses
      expenses.forEach(exp => {
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
      settlements.forEach(sett => {
         if (sett.payerId === user.id && pairwiseDebts[sett.receiverId]) {
            // I paid them, reduces what I owe them or increases what they owe me
            pairwiseDebts[sett.receiverId].amount += sett.amount;
         } else if (sett.receiverId === user.id && pairwiseDebts[sett.payerId]) {
            // They paid me, reduces what they owe me or increases what I owe them
            pairwiseDebts[sett.payerId].amount -= sett.amount;
         }
      });

      const debtsArray = Object.values(pairwiseDebts).filter(d => Math.abs(d.amount) > 0.01);

      const paidByMe = expenses
        .filter(exp => exp.paidById === user.id)
        .reduce((sum, exp) => sum + exp.amount, 0);

      const myShare = expenses
        .flatMap(exp => exp.splits)
        .filter(split => split.userId === user.id)
        .reduce((sum, split) => sum + split.amount, 0);

      const mySettledPaid = settlements
        .filter(s => s.payerId === user.id)
        .reduce((sum, s) => sum + s.amount, 0);

      const mySettledReceived = settlements
        .filter(s => s.receiverId === user.id)
        .reduce((sum, s) => sum + s.amount, 0);

      const yourBalance = (paidByMe - myShare) + (mySettledPaid - mySettledReceived);

      return {
        id: m.group.id,
        name: m.group.name,
        totalSpent,
        yourBalance,
        debts: debtsArray,
        members: m.group.members.map(member => member.user.name?.substring(0, 2).toUpperCase() || "??"),
      };
    }).filter(Boolean);

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Failed to fetch groups:", error);
    return NextResponse.json(
      { message: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
