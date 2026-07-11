import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishGroupEvent } from "@/lib/realtime";
import { invalidateGroupCaches } from "@/lib/cache-invalidation";
import { findUserByEmailWithSelect } from "@/lib/users";

const MAX_NAME_LENGTH = 60;

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
    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ message: "A name is required" }, { status: 400 });
    }

    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { message: `Name must be ${MAX_NAME_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    const currentUser = await findUserByEmailWithSelect(session.user.email, {
      id: true,
      name: true,
      email: true,
      memberships: {
        where: { groupId },
        select: { role: true },
      },
    });

    if (!currentUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Only admins may add guests (placeholder members).
    if (currentUser.memberships[0]?.role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only admins can add guest members" },
        { status: 403 }
      );
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, isArchived: true },
    });

    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    if (group.isArchived) {
      return NextResponse.json(
        { message: "Cannot add members to an archived group" },
        { status: 400 }
      );
    }

    const member = await prisma.$transaction(async (tx) => {
      const placeholder = await tx.user.create({
        data: {
          name,
          email: `placeholder+${randomUUID()}@splitkaro.local`,
          isPlaceholder: true,
          placeholderGroupId: groupId,
        },
      });

      const groupMember = await tx.groupMember.create({
        data: {
          groupId,
          userId: placeholder.id,
          role: "MEMBER",
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
              upiId: true,
              isPlaceholder: true,
            },
          },
        },
      });

      await tx.activity.create({
        data: {
          type: "MEMBER_ADDED",
          message: `${currentUser.name || currentUser.email} added guest ${name}`,
          groupId,
          userId: currentUser.id,
          metadata: { placeholderName: name, placeholderId: placeholder.id },
        },
      });

      return groupMember;
    });

    // No publishUserEvent / invalidateUserCaches for the placeholder: it has no
    // SSE channel and no personal caches. Real members refresh via the group event.
    await Promise.all([
      publishGroupEvent(groupId, "MEMBER_ADDED"),
      invalidateGroupCaches(groupId),
    ]);

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    console.error("Add placeholder member error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
