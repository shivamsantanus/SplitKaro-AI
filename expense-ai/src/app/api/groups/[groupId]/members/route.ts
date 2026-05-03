import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishGroupEvent, publishUserEvent } from "@/lib/realtime";
import { invalidateGroupCaches } from "@/lib/cache-invalidation";
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

    const { email, emails } = await req.json();
    const { groupId } = await params;

    const requestedEmails = Array.from(
      new Set(
        [
          ...(Array.isArray(emails) ? emails : []),
          ...(email ? [email] : []),
        ]
          .map((value) => (typeof value === "string" ? normalizeEmail(value) : ""))
          .filter(Boolean)
      )
    );

    if (requestedEmails.length === 0) {
      return NextResponse.json(
        { message: "At least one email is required" },
        { status: 400 }
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

    // 3. Resolve requested users and reject invalid/already-added ones up front
    const targetUsers = await prisma.user.findMany({
      where: {
        OR: requestedEmails.map((requestedEmail) => ({
          email: {
            equals: requestedEmail,
            mode: "insensitive",
          },
        })),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const foundEmails = new Set(targetUsers.map((user) => normalizeEmail(user.email)));
    const missingEmails = requestedEmails.filter((requestedEmail) => !foundEmails.has(requestedEmail));

    if (missingEmails.length > 0) {
      return NextResponse.json(
        {
          message:
            missingEmails.length === 1
              ? `${missingEmails[0]} has not signed up yet.`
              : `These emails have not signed up yet: ${missingEmails.join(", ")}`,
        },
        { status: 404 }
      );
    }

    const existingMemberships = await prisma.groupMember.findMany({
      where: {
        groupId,
        userId: {
          in: targetUsers.map((user) => user.id),
        },
      },
      select: {
        userId: true,
      },
    });

    const existingMemberIds = new Set(existingMemberships.map((membership) => membership.userId));
    const alreadyMemberEmails = targetUsers
      .filter((user) => existingMemberIds.has(user.id))
      .map((user) => user.email);

    if (alreadyMemberEmails.length > 0) {
      return NextResponse.json(
        {
          message:
            alreadyMemberEmails.length === 1
              ? `${alreadyMemberEmails[0]} is already in this group`
              : `These users are already in this group: ${alreadyMemberEmails.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const usersToAdd = targetUsers.filter((user) => !existingMemberIds.has(user.id));

    // 4. Add the users and log one activity
    const newMembers = await prisma.$transaction(async (tx) => {
      const members = await Promise.all(
        usersToAdd.map((targetUser) =>
          tx.groupMember.create({
            data: {
              groupId,
              userId: targetUser.id,
            },
          })
        )
      );

      const addedNames = usersToAdd.map((user) => user.name || user.email);
      await tx.activity.create({
        data: {
          type: "MEMBER_ADDED",
          message: `${currentUser.name || currentUser.email} added ${addedNames.join(", ")}`,
          groupId,
          userId: currentUser.id,
          metadata: { addedUserEmails: usersToAdd.map((user) => user.email) }
        }
      });

      return members;
    });

    await Promise.all([
      ...usersToAdd.map((targetUser) => publishUserEvent(targetUser.id, "MEMBER_ADDED")),
      publishGroupEvent(groupId, "MEMBER_ADDED"),
      invalidateGroupCaches(groupId),
    ]);

    return NextResponse.json(
      {
        addedCount: newMembers.length,
        members: newMembers,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
