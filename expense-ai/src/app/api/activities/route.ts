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

    const groupIds = memberships.map((membership) => membership.groupId);

    const [groupActivities, recentSoloActivities] = await Promise.all([
      groupIds.length > 0
        ? prisma.activity.findMany({
            where: {
              groupId: { in: groupIds },
            },
            orderBy: {
              createdAt: "desc",
            },
            include: {
              user: { select: { name: true, email: true } },
              group: { select: { name: true } },
            },
            take: 30,
          })
        : Promise.resolve([]),
      prisma.activity.findMany({
        where: {
          groupId: null,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: { select: { name: true, email: true } },
          group: { select: { name: true } },
        },
        take: 50,
      }),
    ]);

    const soloActivities = recentSoloActivities.filter((activity) => {
      if (activity.userId === user.id) {
        return true;
      }

      const metadata =
        activity.metadata && typeof activity.metadata === "object"
          ? (activity.metadata as {
              splitUserIds?: unknown;
              payerId?: unknown;
              receiverId?: unknown;
            })
          : null;

      if (!metadata) {
        return false;
      }

      if (Array.isArray(metadata.splitUserIds) && metadata.splitUserIds.includes(user.id)) {
        return true;
      }

      return metadata.payerId === user.id || metadata.receiverId === user.id;
    });

    const dedupedActivities = [...groupActivities, ...soloActivities]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .filter((activity, index, allActivities) => {
        return allActivities.findIndex((candidate) => candidate.id === activity.id) === index;
      })
      .slice(0, 30);

    return NextResponse.json(dedupedActivities);
  } catch (error) {
    console.error("Activities fetch error:", error);
    return NextResponse.json(
      { message: "Something went wrong" },
      { status: 500 }
    );
  }
}
