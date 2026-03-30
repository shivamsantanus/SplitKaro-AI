import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureUserCanExitGroup } from "@/lib/group-membership";
import { publishGroupEvent, publishUserEvent } from "@/lib/realtime";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
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
      return NextResponse.json({ message: "You are not a member of this group" }, { status: 404 });
    }

    const [memberCount, adminCount, canExit] = await Promise.all([
      prisma.groupMember.count({ where: { groupId } }),
      prisma.groupMember.count({ where: { groupId, role: "ADMIN" } }),
      ensureUserCanExitGroup(groupId, user.id),
    ]);

    if (!canExit) {
      return NextResponse.json(
        { message: "You can only leave after all your balances in this group are settled." },
        { status: 400 }
      );
    }

    if (memberCount <= 1) {
      return NextResponse.json(
        { message: "You are the last member. Delete the group instead of leaving it." },
        { status: 400 }
      );
    }

    if (membership.role === "ADMIN" && adminCount <= 1) {
      return NextResponse.json(
        { message: "Promote another member to admin before leaving the group." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({
        where: {
          groupId_userId: {
            groupId,
            userId: user.id,
          },
        },
      });

      await tx.activity.create({
        data: {
          type: "MEMBER_LEFT",
          message: `${user.name || user.email} left the group`,
          groupId,
          userId: user.id,
        },
      });
    });

    await publishUserEvent(user.id, "MEMBER_LEFT", { groupId });
    await publishGroupEvent(groupId, "MEMBER_LEFT");

    return NextResponse.json({ message: "You left the group successfully" });
  } catch (error) {
    console.error("Leave group error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
