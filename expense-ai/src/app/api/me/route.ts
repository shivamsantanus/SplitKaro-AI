import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { findUserByEmailWithSelect } from "@/lib/users";

const UPI_REGEX = /^[\w.-]+@[\w.-]+$/

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await findUserByEmailWithSelect(session.user.email, {
      id: true, name: true, email: true, upiId: true, createdAt: true,
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, upiId } = body;

    // Validate that at least one field is being updated
    if (name === undefined && upiId === undefined) {
      return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
    }

    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ message: "Name cannot be empty" }, { status: 400 });
    }

    if (upiId !== undefined && upiId !== "" && !UPI_REGEX.test(upiId.trim())) {
      return NextResponse.json({ message: "Invalid UPI ID format (e.g. name@bank)" }, { status: 400 });
    }

    const currentUser = await findUserByEmailWithSelect(session.user.email, { id: true });
    if (!currentUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const data: Record<string, string | null> = {};
    if (name !== undefined)  data.name  = name.trim();
    if (upiId !== undefined) data.upiId = upiId.trim() || null;

    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data,
      select: { id: true, name: true, email: true, upiId: true, createdAt: true },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}
