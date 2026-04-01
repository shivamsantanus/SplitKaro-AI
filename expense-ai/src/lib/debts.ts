export type DebtSummary = {
  userId: string;
  name: string;
  amount: number;
};

type MemberInfo = {
  userId: string;
  name: string;
};

type ExpenseInfo = {
  paidById: string;
  splits: {
    userId: string;
    amount: number;
  }[];
};

type SettlementInfo = {
  payerId: string;
  receiverId: string;
  amount: number;
};

type SimplifiedTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

function roundToCents(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildNetBalances(
  members: MemberInfo[],
  expenses: ExpenseInfo[],
  settlements: SettlementInfo[]
) {
  const balances = new Map<string, number>();
  const memberIds = new Set(members.map((member) => member.userId));

  for (const member of members) {
    balances.set(member.userId, 0);
  }

  for (const expense of expenses) {
    if (!memberIds.has(expense.paidById)) {
      continue;
    }

    for (const split of expense.splits) {
      if (!memberIds.has(split.userId) || split.userId === expense.paidById) {
        continue;
      }

      balances.set(
        expense.paidById,
        roundToCents((balances.get(expense.paidById) ?? 0) + split.amount)
      );
      balances.set(
        split.userId,
        roundToCents((balances.get(split.userId) ?? 0) - split.amount)
      );
    }
  }

  for (const settlement of settlements) {
    if (!memberIds.has(settlement.payerId) || !memberIds.has(settlement.receiverId)) {
      continue;
    }

    balances.set(
      settlement.payerId,
      roundToCents((balances.get(settlement.payerId) ?? 0) + settlement.amount)
    );
    balances.set(
      settlement.receiverId,
      roundToCents((balances.get(settlement.receiverId) ?? 0) - settlement.amount)
    );
  }

  return balances;
}

export function simplifyGroupDebts(
  balances: Map<string, number>
) {
  const debtors = Array.from(balances.entries())
    .filter(([, amount]) => amount < -0.01)
    .map(([userId, amount]) => ({ userId, amount: Math.abs(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = Array.from(balances.entries())
    .filter(([, amount]) => amount > 0.01)
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: SimplifiedTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundToCents(Math.min(debtor.amount, creditor.amount));

    if (amount > 0.01) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount,
      });
    }

    debtor.amount = roundToCents(debtor.amount - amount);
    creditor.amount = roundToCents(creditor.amount - amount);

    if (debtor.amount <= 0.01) {
      debtorIndex += 1;
    }

    if (creditor.amount <= 0.01) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

export function getUserDebtSummaries(
  currentUserId: string,
  members: MemberInfo[],
  transfers: SimplifiedTransfer[]
) {
  const memberNames = new Map(members.map((member) => [member.userId, member.name]));
  const debts: DebtSummary[] = [];

  for (const transfer of transfers) {
    if (transfer.fromUserId === currentUserId) {
      debts.push({
        userId: transfer.toUserId,
        name: memberNames.get(transfer.toUserId) ?? "Unknown User",
        amount: -transfer.amount,
      });
    } else if (transfer.toUserId === currentUserId) {
      debts.push({
        userId: transfer.fromUserId,
        name: memberNames.get(transfer.fromUserId) ?? "Unknown User",
        amount: transfer.amount,
      });
    }
  }

  return debts.filter((debt) => Math.abs(debt.amount) > 0.01);
}
