import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { groupId: string } }
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
    const { groupId } = await (params as any);
    console.log("Fetching group with ID:", groupId);

    // Check if user is a member of this group
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { message: "You are not a member of this group" },
        { status: 403 }
      );
    }

    // Fetch group details, members, and expenses
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        expenses: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            payer: {
              select: {
                name: true,
              },
            },
            splits: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        settlements: {
          include: {
            payer: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          }
        }
      },
    });

    if (!group) {
      return NextResponse.json(
        { message: "Group not found" },
        { status: 404 }
      );
    }

    // Single Group Pairwise Debt Calculation
    const expenses = (group as any).expenses || [];
    const settlements = (group as any).settlements || [];
    const pairwiseDebts: Record<string, { userId: string, name: string, amount: number }> = {};
    
    group.members.forEach((member: any) => {
       if (member.userId !== user.id) {
          pairwiseDebts[member.userId] = {
             userId: member.userId,
             name: member.user.name || member.user.email,
             amount: 0
          };
       }
    });

    expenses.forEach((exp: any) => {
       if (exp.paidById === user.id) {
          exp.splits.forEach((split: any) => {
             if (split.userId !== user.id && pairwiseDebts[split.userId]) {
                pairwiseDebts[split.userId].amount += split.amount;
             }
          });
       } else {
          const mySplit = exp.splits.find((s: any) => s.userId === user.id);
          if (mySplit && pairwiseDebts[exp.paidById]) {
             pairwiseDebts[exp.paidById].amount -= mySplit.amount;
          }
       }
    });

    // Subtract/Add Settlements
    settlements.forEach((settlement: any) => {
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
  { params }: { params: { groupId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { groupId } = await (params as any);

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
  { params }: { params: { groupId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { groupId } = await (params as any);
    const { name, isArchived } = await req.json();

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ message: "Group not found" }, { status: 404 });

    if (group.createdById !== user.id) {
       return NextResponse.json({ message: "Only the group creator can edit this group" }, { status: 403 });
    }

    const updatedGroup = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
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

    return NextResponse.json(updatedGroup, { status: 200 });
  } catch (error) {
    console.error("Update group error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
