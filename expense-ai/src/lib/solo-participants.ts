import prisma from "@/lib/prisma";

export type SplitInput = { userId: string; amount: number };

export const NOT_A_PARTICIPANT =
  "You must be part of an individual payment you create or edit";

type ValidateInput = {
  callerId: string;
  payerId: string;
  splits: unknown;
};

// Individual ("solo") payments have no group to scope participants to, so the
// counterparty rules are enforced here instead. Adding a real account by email
// is a supported product flow, so real users stay open; the closed parts are
// that the caller must be in the payment, and that placeholder guests are
// private to whoever created them.
export async function validateSoloParticipants({
  callerId,
  payerId,
  splits,
}: ValidateInput): Promise<SplitInput[]> {
  if (!Array.isArray(splits) || splits.length === 0) {
    throw new Error("Splits are required for individual payments");
  }

  const normalized: SplitInput[] = [];

  for (const split of splits) {
    const userId = (split as SplitInput | null)?.userId;
    const amount = Number((split as SplitInput | null)?.amount);

    if (typeof userId !== "string" || !userId.trim()) {
      throw new Error("Every split must name a participant");
    }

    // Reject NaN/Infinity here: parseFloat downstream would persist them as a
    // corrupt Float and silently break every balance that sums this expense.
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("Split amounts must be valid, non-negative numbers");
    }

    normalized.push({ userId, amount });
  }

  const splitUserIds = normalized.map((split) => split.userId);

  if (new Set(splitUserIds).size !== splitUserIds.length) {
    throw new Error("A participant can only appear once per payment");
  }

  const participantIds = [...new Set([payerId, ...splitUserIds])];

  if (!participantIds.includes(callerId)) {
    throw new Error(NOT_A_PARTICIPANT);
  }

  await assertParticipantsUsable(callerId, participantIds);

  return normalized;
}

async function assertParticipantsUsable(callerId: string, participantIds: string[]) {
  const participants = await prisma.user.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, isPlaceholder: true, placeholderOwnerId: true },
  });

  if (participants.length !== participantIds.length) {
    throw new Error("One or more participants no longer exist");
  }

  // A guest belongs to exactly one owner. Group-scoped guests have a null
  // placeholderOwnerId, so this also keeps them out of solo payments.
  const foreignGuest = participants.some(
    (participant) =>
      participant.isPlaceholder && participant.placeholderOwnerId !== callerId
  );

  if (foreignGuest) {
    throw new Error("You can only include guests you created");
  }
}

// Settling an individual payment moves money between exactly two people, so
// the caller must be one of them - otherwise anyone could mark a debt between
// two strangers as paid and erase it from both ledgers.
export async function validateSoloSettlement({
  callerId,
  payerId,
  receiverId,
  amount,
}: {
  callerId: string;
  payerId: unknown;
  receiverId: unknown;
  amount: unknown;
}): Promise<number> {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  if (typeof payerId !== "string" || !payerId.trim() || typeof receiverId !== "string" || !receiverId.trim()) {
    throw new Error("Payer and receiver are required");
  }

  if (payerId === receiverId) {
    throw new Error("Payer and receiver must be different users");
  }

  if (callerId !== payerId && callerId !== receiverId) {
    throw new Error(NOT_A_PARTICIPANT);
  }

  await assertParticipantsUsable(callerId, [payerId, receiverId]);

  return value;
}
