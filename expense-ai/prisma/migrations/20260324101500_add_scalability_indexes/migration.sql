-- Improve common lookup and ordering performance for groups, expenses, settlements, and activity feeds.
CREATE INDEX "Group_createdById_idx" ON "Group"("createdById");
CREATE INDEX "Group_isArchived_idx" ON "Group"("isArchived");

CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

CREATE INDEX "Expense_groupId_createdAt_idx" ON "Expense"("groupId", "createdAt");
CREATE INDEX "Expense_paidById_idx" ON "Expense"("paidById");

CREATE INDEX "ExpenseSplit_expenseId_idx" ON "ExpenseSplit"("expenseId");
CREATE INDEX "ExpenseSplit_userId_idx" ON "ExpenseSplit"("userId");

CREATE INDEX "Settlement_groupId_createdAt_idx" ON "Settlement"("groupId", "createdAt");
CREATE INDEX "Settlement_payerId_idx" ON "Settlement"("payerId");
CREATE INDEX "Settlement_receiverId_idx" ON "Settlement"("receiverId");

CREATE INDEX "Activity_groupId_createdAt_idx" ON "Activity"("groupId", "createdAt");
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");
