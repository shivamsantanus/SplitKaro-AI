import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type GroupMemberRecord = {
  userId: string;
  user: {
    name: string | null;
    email: string;
  };
};

type MemberAlias = {
  userId: string;
  aliases: string[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMemberAliases(members: GroupMemberRecord[], currentUserId?: string) {
  return members.map((member) => {
    const aliases = new Set<string>();
    const name = member.user.name?.trim();

    if (name) {
      aliases.add(name.toLowerCase());
      for (const part of name.toLowerCase().split(/\s+/).filter(Boolean)) {
        aliases.add(part);
      }
    }

    const emailLocal = member.user.email.split("@")[0]?.toLowerCase();
    if (emailLocal) {
      aliases.add(emailLocal);
    }

    if (member.userId === currentUserId) {
      aliases.add("me");
      aliases.add("myself");
      aliases.add("i");
    }

    return {
      userId: member.userId,
      aliases: Array.from(aliases).sort((a, b) => b.length - a.length),
    };
  });
}

function findMemberInText(text: string, members: MemberAlias[]) {
  const normalized = normalizeText(text);

  for (const member of members) {
    for (const alias of member.aliases) {
      const regex = new RegExp(`(^|\\s)${escapeRegExp(alias)}(?=\\s|$)`, "i");
      if (regex.test(normalized)) {
        return member;
      }
    }
  }

  return null;
}

function collectMembersInText(text: string, members: MemberAlias[]) {
  const normalized = normalizeText(text);
  const found = new Map<string, MemberAlias>();

  for (const member of members) {
    for (const alias of member.aliases) {
      const regex = new RegExp(`(^|\\s)${escapeRegExp(alias)}(?=\\s|$)`, "i");
      if (regex.test(normalized)) {
        found.set(member.userId, member);
        break;
      }
    }
  }

  return Array.from(found.values());
}

function extractAmount(message: string) {
  return message.match(/(?:rs\.?|₹|\$)?\s*(\d+(?:\.\d{1,2})?)/i);
}

function extractPayer(message: string, members: MemberAlias[], fallbackUserId?: string) {
  const normalized = normalizeText(message);

  const paidByPhrase = normalized.match(/\bpaid by\s+(.+?)(?=\b(?:split|between|among|with|for|on|amount|total)\b|$)/i);
  if (paidByPhrase?.[1]) {
    const payer = findMemberInText(paidByPhrase[1], members);
    if (payer) {
      return payer.userId;
    }
  }

  for (const member of members) {
    for (const alias of member.aliases) {
      const aliasPaidPattern = new RegExp(`(^|\\s)${escapeRegExp(alias)}\\s+paid\\b`, "i");
      if (aliasPaidPattern.test(normalized)) {
        return member.userId;
      }
    }
  }

  return fallbackUserId;
}

function extractCustomSplits(message: string, members: MemberAlias[]) {
  const normalized = normalizeText(message);
  const matches = new Map<string, number>();

  for (const member of members) {
    for (const alias of member.aliases) {
      const escapedAlias = escapeRegExp(alias);
      const patterns = [
        new RegExp(`(\\d+(?:\\.\\d{1,2})?)\\s*(?:to|for)\\s+${escapedAlias}(?=\\s|$)`, "i"),
        new RegExp(`${escapedAlias}(?=\\s|$)\\s*(?:for|gets|owes|:)\\s*(\\d+(?:\\.\\d{1,2})?)`, "i"),
        new RegExp(`${escapedAlias}(?=\\s|$)\\s+(\\d+(?:\\.\\d{1,2})?)`, "i"),
      ];

      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (match?.[1]) {
          matches.set(member.userId, parseFloat(match[1]));
          break;
        }
      }

      if (matches.has(member.userId)) {
        break;
      }
    }
  }

  return matches;
}

function extractEqualSplitMembers(message: string, members: MemberAlias[]) {
  const normalized = normalizeText(message);
  const segmentMatch =
    normalized.match(/\b(?:split(?: equally)?|equally split)\s+(?:between|among|with)?\s*(.+?)(?=\b(?:for|on|paid by|amount|total)\b|$)/i) ||
    normalized.match(/\b(?:between|among|with)\s+(.+?)(?=\b(?:for|on|paid by|amount|total)\b|$)/i);

  if (!segmentMatch?.[1]) {
    return [];
  }

  return collectMembersInText(segmentMatch[1], members);
}

function extractDescription(message: string, amountMatch: RegExpMatchArray, members: MemberAlias[]) {
  const normalized = normalizeText(message);

  const tailDescription = normalized.match(/\b(?:for|on)\s+([a-z][a-z\s]+)$/i);
  if (tailDescription?.[1]) {
    const candidate = tailDescription[1].trim();
    if (collectMembersInText(candidate, members).length === 0) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  const middleDescription = normalized.match(/\b(?:for|on)\s+(.+?)(?=\b(?:split|between|among|with|paid by|amount|total)\b|$)/i);
  if (middleDescription?.[1]) {
    const candidate = middleDescription[1].trim();
    if (collectMembersInText(candidate, members).length === 0) {
      return candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  const cleaned = normalized
    .replace(amountMatch[0], "")
    .replace(/\b(?:paid by|paid|split|between|among|with|equally|for|on|to)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "Expense";
}

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

    const sessionUserId = (session.user as { id?: string }).id;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: true } },
      },
    });

    if (!group) {
      return NextResponse.json({ message: "Group not found" }, { status: 404 });
    }

    const normalizedMessage = normalizeText(message);
    const amountMatch = extractAmount(normalizedMessage);

    if (!amountMatch?.[1]) {
      return NextResponse.json(
        {
          error: "Could not detect an amount. Please include a number, like 'paid 500 for dinner'.",
        },
        { status: 400 }
      );
    }

    const amount = parseFloat(amountMatch[1]);
    const memberAliases = buildMemberAliases(group.members as GroupMemberRecord[], sessionUserId);
    const paidByUserId = extractPayer(normalizedMessage, memberAliases, sessionUserId);
    const customSplitMatches = extractCustomSplits(normalizedMessage, memberAliases);
    const equalSplitMembers = extractEqualSplitMembers(normalizedMessage, memberAliases);
    const description = extractDescription(normalizedMessage, amountMatch, memberAliases);

    let splitMode: "equal" | "custom" = "equal";
    let activeSplitMembers = group.members.map((member) => member.userId);
    let customSplits: Record<string, number> = {};

    if (customSplitMatches.size > 0) {
      splitMode = "custom";
      activeSplitMembers = Array.from(customSplitMatches.keys());
      customSplits = Object.fromEntries(customSplitMatches.entries());
    } else if (equalSplitMembers.length > 0) {
      splitMode = "equal";
      activeSplitMembers = equalSplitMembers.map((member) => member.userId);
    }

    return NextResponse.json({
      suggestion: {
        amount,
        description,
        paidByUserId,
        splitMode,
        activeSplitMembers,
        customSplits,
      },
    });
  } catch (error) {
    console.error("AI Parse error:", error);
    return NextResponse.json(
      { message: "Something went wrong parsing the message" },
      { status: 500 }
    );
  }
}
