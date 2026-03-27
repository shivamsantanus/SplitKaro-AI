import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const memberships = await prisma.groupMember.findMany({
      where: {
        userId: user.id,
      },
      select: {
        groupId: true,
      },
    });

    if (memberships.length === 0) {
      return NextResponse.json([]);
    }

    const groupIds = memberships.map((membership) => membership.groupId);

    // Fetch activities for all groups the user is a member of + solo activities
    const activities = await prisma.activity.findMany({
      where: {
        OR: [
          { groupId: { in: groupIds } },
          { 
            groupId: null,
            OR: [
              { userId: user.id },
              // For solo expenses added by OTHERS where you are a participant,
              // we'd need a way to link activity to participants.
              // For now, let's fetch solo expenses you are part of and match activities.
              // Or just fetch all solo activities for now if the privacy risk is low (in this small app).
              // Better: fetch where user is creator OR metadata contains your ID (if we added it).
            ]
          }
        ]
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: { select: { name: true, email: true } },
        group: { select: { name: true } },
      },
      take: 30, 
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Activities fetch error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
