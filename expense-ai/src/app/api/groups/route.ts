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

export async function GET() {
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
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
       return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Transform for frontend
    const groups = user.memberships.map((m) => {
      const expenses = m.group.expenses;
      const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      // Balance Calculation Engine
      // 1. How much did I pay in total for this group?
      const paidByMe = expenses
        .filter(exp => exp.paidById === user.id)
        .reduce((sum, exp) => sum + exp.amount, 0);

      // 2. How much was my exact share of all expenses in this group?
      const myShare = expenses
        .flatMap(exp => exp.splits)
        .filter(split => split.userId === user.id)
        .reduce((sum, split) => sum + split.amount, 0);

      // 3. Balance = What I paid - My share
      const yourBalance = paidByMe - myShare;

      return {
        id: m.group.id,
        name: m.group.name,
        totalSpent,
        yourBalance,
        members: m.group.members.map(member => member.user.name?.substring(0, 2).toUpperCase() || "??"),
      };
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Failed to fetch groups:", error);
    return NextResponse.json(
      { message: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}
