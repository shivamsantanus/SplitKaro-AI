import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const { message } = await req.json();
    const { groupId } = await params;

    if (!message || message.trim() === "") {
        return NextResponse.json({ message: "Message is required" }, { status: 400 });
    }

    // Fetch group members to match names
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: true } }
      }
    });

    if (!group) {
        return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    const lowerMessage = message.toLowerCase().trim();
    
    // --- Natural Language "AI" Heuristics ---
    let amount: number | null = null;
    let description = "";
    // Default to the current logged in user
    let paidByUserId = (session.user as any).id; 

    // 1. Extract AMOUNT (matches 500, 500.50, ₹500, Rs.500)
    const amountMatch = lowerMessage.match(/(?:rs\.?|₹|\$)?\s*(\d+(?:\.\d{1,2})?)/);
    if (amountMatch && amountMatch[1]) {
      amount = parseFloat(amountMatch[1]);
    }

    if (!amount) {
      return NextResponse.json({ 
          error: "Could not detect an amount. Please include a number, e.g., 'paid 500 for lunch'." 
      }, { status: 400 });
    }

    // 2. Extract DESCRIPTION
    // Look for phrases like "for <desc>" or "on <desc>"
    const descMatch = lowerMessage.match(/(?:for|on)\s+([a-zA-Z\s]+)/);
    if (descMatch && descMatch[1]) {
      // Clean up common trailing words
      description = descMatch[1].replace(/\b(split|shared|equally|with|everyone)\b.*$/i, "").trim();
    } else {
      // If no "for", remove the amount and use the rest of the text
      description = lowerMessage
        .replace(amountMatch[0], "")
        .replace(/\b(paid|spent|gave|rs|₹)\b/gi, "")
        .trim();
    }

    // Capitalize first letter of description
    description = description ? description.charAt(0).toUpperCase() + description.slice(1) : "Expense";

    // 3. Extract PAYER
    // If someone says "John paid 500", try to find John in members
    for (const m of group.members) {
      const memberName = m.user.name?.toLowerCase().split(" ")[0]; // Check first name
      if (memberName && lowerMessage.includes(memberName)) {
          // Verify the name appears before the word "for" or "amount" to avoid matching description
          paidByUserId = m.userId;
          break;
      }
    }

    return NextResponse.json({
        suggestion: {
           amount,
           description,
           paidByUserId,
        }
    });

  } catch (error) {
    console.error("AI Parse error:", error);
    return NextResponse.json(
      { message: "Something went wrong parsing the message" },
      { status: 500 }
    );
  }
}
