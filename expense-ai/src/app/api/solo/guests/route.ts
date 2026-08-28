import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findUserByEmailWithSelect } from "@/lib/users";

const MAX_NAME_LENGTH = 60;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, { id: true });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const guests = await prisma.user.findMany({
      where: { isPlaceholder: true, placeholderOwnerId: user.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ guests });
  } catch (error) {
    console.error("List solo guests error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, { id: true });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

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

    const guest = await prisma.user.create({
      data: {
        name,
        email: `placeholder+${randomUUID()}@splitkaro.local`,
        isPlaceholder: true,
        placeholderOwnerId: user.id,
      },
      select: { id: true, name: true },
    });

    return NextResponse.json({ guest }, { status: 201 });
  } catch (error) {
    console.error("Create solo guest error:", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
