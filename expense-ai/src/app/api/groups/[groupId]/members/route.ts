import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishGroupEvent, publishUserEvent } from "@/lib/realtime";
import { findUserByEmailWithSelect, normalizeEmail } from "@/lib/users";

export async function POST(
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

    const { email } = await req.json();
    const { groupId } = await params;

    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      );
    }

    // 1. Find the target user to add
    const targetUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizeEmail(email),
          mode: "insensitive",
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { message: "User not found. Ask them to sign up first!" },
        { status: 404 }
      );
    }

    // 2. Check if the current user is a member of the group (authorization)
    const currentUser = await findUserByEmailWithSelect(session.user.email, {
      id: true,
      name: true,
      email: true,
    });

    if (!currentUser) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: currentUser?.id,
      },
    });

    if (!isMember) {
      return NextResponse.json(
        { message: "You are not authorized to add members to this group" },
        { status: 403 }
      );
    }

    // 3. Check if the user is already a member
    const alreadyMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUser.id,
        },
      },
    });

    if (alreadyMember) {
       return NextResponse.json(
        { message: "User is already in this group" },
        { status: 400 }
      );
    }

    // 4. Add the user and log activity
    const newMember = await prisma.$transaction(async (tx) => {
      const member = await tx.groupMember.create({
        data: {
          groupId,
          userId: targetUser.id,
        },
      });

      await tx.activity.create({
        data: {
          type: "MEMBER_ADDED",
          message: `${currentUser.name || currentUser.email} added ${targetUser.name || targetUser.email}`,
          groupId,
          userId: currentUser.id,
          metadata: { addedUserEmail: targetUser.email }
        }
      });

      return member;
    });

    await publishUserEvent(targetUser.id, "MEMBER_ADDED");
    await publishGroupEvent(groupId, "MEMBER_ADDED");

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
