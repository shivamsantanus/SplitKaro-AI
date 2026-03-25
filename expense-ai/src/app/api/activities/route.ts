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

    // Fetch activities for all groups the user is a member of
    const activities = await prisma.activity.findMany({
      where: {
        groupId: {
          in: groupIds,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        group: {
          select: {
            name: true,
          },
        },
      },
      take: 20, // Limit to recent 20 for activity feed
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
