import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureUserCanExitGroup } from "@/lib/group-membership";
import { publishGroupEvent, publishUserEvent } from "@/lib/realtime";
import { normalizeEmail } from "@/lib/users";

async function getRequestContext(groupId: string, memberId: string, email: string) {
  const requester = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizeEmail(email),
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        where: { groupId },
        select: {
          role: true,
        },
      },
    },
  });

  const [targetMembership, adminCount, memberCount] = await Promise.all([
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: memberId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.groupMember.count({ where: { groupId, role: "ADMIN" } }),
    prisma.groupMember.count({ where: { groupId } }),
  ]);

  return {
    requester,
    requesterRole: requester?.memberships[0]?.role,
    targetMembership,
    adminCount,
    memberCount,
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { groupId, memberId } = await params;
    const { role } = await req.json();

    if (role !== "ADMIN" && role !== "MEMBER") {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }

    const { requester, requesterRole, targetMembership, adminCount } = await getRequestContext(
      groupId,
      memberId,
      session.user.email
    );

    if (!requester) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (requesterRole !== "ADMIN") {
      return NextResponse.json({ message: "Only admins can change member roles" }, { status: 403 });
    }

    if (!targetMembership) {
      return NextResponse.json({ message: "Member not found" }, { status: 404 });
    }

    if (targetMembership.role === role) {
      return NextResponse.json(targetMembership);
    }

    if (targetMembership.role === "ADMIN" && role === "MEMBER" && adminCount <= 1) {
      return NextResponse.json(
        { message: "The group must have at least one admin." },
        { status: 400 }
      );
    }

    const updatedMembership = await prisma.$transaction(async (tx) => {
      const updated = await tx.groupMember.update({
        where: {
          groupId_userId: {
            groupId,
            userId: memberId,
          },
        },
        data: {
          role,
        },
      });

      await tx.activity.create({
        data: {
          type: "MEMBER_ROLE_UPDATED",
          message: `${requester.name || requester.email} made ${targetMembership.user.name || targetMembership.user.email} ${role.toLowerCase()}`,
          groupId,
          userId: requester.id,
          metadata: { memberId, role },
        },
      });

      return updated;
    });

    await publishUserEvent(memberId, "MEMBER_ROLE_UPDATED", { groupId });
    await publishGroupEvent(groupId, "MEMBER_ROLE_UPDATED");

    return NextResponse.json(updatedMembership);
  } catch (error) {
    console.error("Update member role error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { groupId, memberId } = await params;
    const { requester, requesterRole, targetMembership, adminCount, memberCount } =
      await getRequestContext(groupId, memberId, session.user.email);

    if (!requester) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (requesterRole !== "ADMIN") {
      return NextResponse.json({ message: "Only admins can remove members" }, { status: 403 });
    }

    if (!targetMembership) {
      return NextResponse.json({ message: "Member not found" }, { status: 404 });
    }

    if (targetMembership.userId === requester.id) {
      return NextResponse.json(
        { message: "Use the leave action to remove yourself from the group." },
        { status: 400 }
      );
    }

    if (memberCount <= 1) {
      return NextResponse.json(
        { message: "The last member cannot be removed from the group." },
        { status: 400 }
      );
    }

    const canRemove = await ensureUserCanExitGroup(groupId, memberId);
    if (!canRemove) {
      return NextResponse.json(
        { message: "A member can only be removed after all of their balances in this group are settled." },
        { status: 400 }
      );
    }

    if (targetMembership.role === "ADMIN" && adminCount <= 1) {
      return NextResponse.json(
        { message: "Promote another member to admin before removing this admin." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({
        where: {
          groupId_userId: {
            groupId,
            userId: memberId,
          },
        },
      });

      await tx.activity.create({
        data: {
          type: "MEMBER_REMOVED",
          message: `${requester.name || requester.email} removed ${targetMembership.user.name || targetMembership.user.email} from the group`,
          groupId,
          userId: requester.id,
          metadata: { memberId },
        },
      });
    });

    await publishUserEvent(memberId, "MEMBER_REMOVED", { groupId });
    await publishGroupEvent(groupId, "MEMBER_REMOVED");

    return NextResponse.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
