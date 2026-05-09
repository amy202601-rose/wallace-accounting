import { and, desc, eq, gte, inArray, isNull, like, lte, sql, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  BankAccount,
  Category,
  InsertBankAccount,
  InsertCategory,
  InsertStatement,
  InsertTransaction,
  InsertUser,
  InsertT4ARecipient,
  InsertT4ARecord,
  InsertReceipt,
  Statement,
  Transaction,
  bankAccounts,
  categories,
  statements,
  transactions,
  users,
  t4aRecipients,
  receipts,
  t4aRecords,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ---- Bank Accounts ----
export async function getBankAccounts(userId: number): Promise<(BankAccount & { computedBalance: string })[]> {
  const db = await getDb();
  if (!db) return [];
  const accts = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId)).orderBy(desc(bankAccounts.createdAt));
  if (accts.length === 0) return [];

  // Compute balance dynamically from transactions: sum(income) - sum(expense)
  const balanceRows = await db
    .select({
      bankAccountId: transactions.bankAccountId,
      type: transactions.type,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.bankAccountId, transactions.type);

  const balanceMap = new Map<number, number>();
  for (const row of balanceRows) {
    const current = balanceMap.get(row.bankAccountId) ?? 0;
    const amount = parseFloat(String(row.total ?? "0"));
    if (row.type === "income") balanceMap.set(row.bankAccountId, current + amount);
    else if (row.type === "expense") balanceMap.set(row.bankAccountId, current - amount);
    // transfer: neutral for balance
  }

  return accts.map((a) => ({
    ...a,
    computedBalance: (balanceMap.get(a.id) ?? 0).toFixed(2),
  }));
}

export async function getBankAccountById(id: number, userId: number): Promise<BankAccount | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId))).limit(1);
  return result[0];
}

export async function createBankAccount(data: InsertBankAccount): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(bankAccounts).values(data);
  return (result[0] as any).insertId;
}

export async function updateBankAccount(id: number, userId: number, data: Partial<InsertBankAccount>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(bankAccounts).set(data).where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)));
}

export async function deleteBankAccount(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)));
}

export async function getBankAccountStats(id: number, userId: number): Promise<{ statementCount: number; transactionCount: number }> {
  const db = await getDb();
  if (!db) return { statementCount: 0, transactionCount: 0 };
  const [stmtResult, txResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(statements).where(and(eq(statements.bankAccountId, id), eq(statements.userId, userId))),
    db.select({ count: sql<number>`count(*)` }).from(transactions).where(and(eq(transactions.bankAccountId, id), eq(transactions.userId, userId))),
  ]);
  return {
    statementCount: Number(stmtResult[0]?.count ?? 0),
    transactionCount: Number(txResult[0]?.count ?? 0),
  };
}

export async function deleteBankAccountCascade(id: number, userId: number): Promise<{ deletedStatements: number; deletedTransactions: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // 1. Delete all transactions for this account
  const txResult = await db.delete(transactions).where(and(eq(transactions.bankAccountId, id), eq(transactions.userId, userId)));
  const deletedTransactions = (txResult as any)[0]?.affectedRows ?? 0;
  // 2. Delete all statements for this account
  const stmtResult = await db.delete(statements).where(and(eq(statements.bankAccountId, id), eq(statements.userId, userId)));
  const deletedStatements = (stmtResult as any)[0]?.affectedRows ?? 0;
  // 3. Delete the account itself
  await db.delete(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)));
  return { deletedStatements, deletedTransactions };
}

// ---- Statements ----
export async function getStatements(userId: number, bankAccountId?: number): Promise<Statement[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(statements.userId, userId)];
  if (bankAccountId) conditions.push(eq(statements.bankAccountId, bankAccountId));
  return db.select().from(statements).where(and(...conditions)).orderBy(desc(statements.createdAt));
}

export async function getStatementById(id: number, userId: number): Promise<Statement | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(statements).where(and(eq(statements.id, id), eq(statements.userId, userId))).limit(1);
  return result[0];
}

export async function createStatement(data: InsertStatement): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(statements).values(data);
  return (result[0] as any).insertId;
}

export async function updateStatement(id: number, data: Partial<InsertStatement>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(statements).set(data).where(eq(statements.id, id));
}

export async function countTransactionsByStatement(statementId: number, userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(eq(transactions.statementId, statementId), eq(transactions.userId, userId)));
  return Number(result[0]?.count ?? 0);
}

export async function deleteStatement(id: number, userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // First delete all associated transactions
  const txResult = await db.delete(transactions).where(
    and(eq(transactions.statementId, id), eq(transactions.userId, userId))
  );
  const deletedTxCount = (txResult as any)[0]?.affectedRows ?? 0;
  // Then delete the statement itself
  await db.delete(statements).where(and(eq(statements.id, id), eq(statements.userId, userId)));
  return deletedTxCount;
}

export async function countTransactionsByStatements(statementIds: number[], userId: number): Promise<number> {
  if (statementIds.length === 0) return 0;
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(and(inArray(transactions.statementId, statementIds), eq(transactions.userId, userId)));
  return Number(result[0]?.count ?? 0);
}

export async function deleteStatementsBulk(ids: number[], userId: number): Promise<{ deletedStatements: number; deletedTransactions: number }> {
  if (ids.length === 0) return { deletedStatements: 0, deletedTransactions: 0 };
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // First delete all associated transactions
  const txResult = await db.delete(transactions).where(
    and(inArray(transactions.statementId, ids), eq(transactions.userId, userId))
  );
  const deletedTransactions = (txResult as any)[0]?.affectedRows ?? 0;
  // Then delete the statements
  const stmtResult = await db.delete(statements).where(
    and(inArray(statements.id, ids), eq(statements.userId, userId))
  );
  const deletedStatements = (stmtResult as any)[0]?.affectedRows ?? ids.length;
  return { deletedStatements, deletedTransactions };
}

// ---- Categories ----
export async function getCategories(userId: number): Promise<Category[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.userId, userId)).orderBy(categories.type, categories.name);
}

export async function createCategory(data: InsertCategory): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(categories).values(data);
  return (result[0] as any).insertId;
}

export async function updateCategory(id: number, userId: number, data: Partial<InsertCategory>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(categories).set(data).where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

export async function deleteCategory(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

// ---- Transactions ----
export async function getTransactions(
  userId: number,
  opts?: {
    bankAccountId?: number;
    categoryId?: number;
    uncategorized?: boolean;
    counterparty?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }
): Promise<Transaction[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(transactions.userId, userId)];
  if (opts?.bankAccountId) conditions.push(eq(transactions.bankAccountId, opts.bankAccountId));
  if (opts?.uncategorized) {
    conditions.push(isNull(transactions.categoryId));
  } else if (opts?.categoryId) {
    conditions.push(eq(transactions.categoryId, opts.categoryId));
  }
  if (opts?.counterparty) conditions.push(like(transactions.counterparty, `%${opts.counterparty}%`));
  if (opts?.type) conditions.push(eq(transactions.type, opts.type as any));
  if (opts?.startDate) conditions.push(gte(transactions.transactionDate, opts.startDate));
  if (opts?.endDate) conditions.push(lte(transactions.transactionDate, opts.endDate));
  if (opts?.minAmount != null) conditions.push(sql`CAST(${transactions.amount} AS DECIMAL(20,2)) >= ${opts.minAmount}`);
  if (opts?.maxAmount != null) conditions.push(sql`CAST(${transactions.amount} AS DECIMAL(20,2)) <= ${opts.maxAmount}`);
  return db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.transactionDate))
    .limit(opts?.limit ?? 2000)
    .offset(opts?.offset ?? 0);
}

// Get distinct years that have transactions (for year filter dropdown)
export async function getAvailableYears(userId: number, bankAccountId?: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(transactions.userId, userId)];
  if (bankAccountId) conditions.push(eq(transactions.bankAccountId, bankAccountId));
  const rows = await db
    .selectDistinct({ year: sql<number>`YEAR(${transactions.transactionDate})` })
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(sql`YEAR(${transactions.transactionDate})`));
  return rows.map((r) => Number(r.year)).filter((y) => !isNaN(y));
}

// Get distinct counterparties for filter dropdown
export async function getCounterparties(userId: number, bankAccountId?: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(transactions.userId, userId)];
  if (bankAccountId) conditions.push(eq(transactions.bankAccountId, bankAccountId));
  const rows = await db
    .selectDistinct({ counterparty: transactions.counterparty })
    .from(transactions)
    .where(and(...conditions))
    .orderBy(transactions.counterparty);
  return rows
    .map((r) => r.counterparty)
    .filter((c): c is string => !!c);
}

export async function getTransactionById(id: number, userId: number): Promise<Transaction | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
  return result[0];
}

export async function createTransaction(data: InsertTransaction): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(transactions).values(data);
  return (result[0] as any).insertId;
}

export async function createTransactionsBatch(data: InsertTransaction[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.length === 0) return;
  await db.insert(transactions).values(data);
}

export async function updateTransaction(id: number, userId: number, data: Partial<InsertTransaction>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(transactions).set(data).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteTransaction(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteTransactionsBulk(ids: number[], userId: number): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.delete(transactions).where(
    and(inArray(transactions.id, ids), eq(transactions.userId, userId))
  );
  return (result as any)[0]?.affectedRows ?? ids.length;
}

// ---- Reports ----
export async function getTransactionSummary(userId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return { totalIncome: "0", totalExpense: "0", netAmount: "0" };
  const result = await db
    .select({
      type: transactions.type,
      total: sum(transactions.amount),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.transactionDate, startDate), lte(transactions.transactionDate, endDate)))
    .groupBy(transactions.type);
  let totalIncome = 0;
  let totalExpense = 0;
  for (const row of result) {
    if (row.type === "income") totalIncome = parseFloat(row.total ?? "0");
    if (row.type === "expense") totalExpense = parseFloat(row.total ?? "0");
  }
  return {
    totalIncome: totalIncome.toFixed(2),
    totalExpense: totalExpense.toFixed(2),
    netAmount: (totalIncome - totalExpense).toFixed(2),
  };
}

export async function getCategorySummary(userId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      categoryId: transactions.categoryId,
      type: transactions.type,
      total: sum(transactions.amount),
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.transactionDate, startDate), lte(transactions.transactionDate, endDate)))
    .groupBy(transactions.categoryId, transactions.type);
  return result;
}

export async function getMonthlyTrend(userId: number, year: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      month: sql<number>`MONTH(transactionDate)`,
      type: transactions.type,
      total: sum(transactions.amount),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), sql`YEAR(transactionDate) = ${year}`))
    .groupBy(sql`MONTH(transactionDate)`, transactions.type)
    .orderBy(sql`MONTH(transactionDate)`);
  return result;
}

// Full annual report: monthly breakdown, category summary, account summary
export async function getAnnualReport(userId: number, year: number, bankAccountId?: number) {
  const db = await getDb();
  if (!db) return { monthly: [], categorySummary: [], accountSummary: [], totals: { income: 0, expense: 0, net: 0 } };

  const yearCondition = sql`YEAR(transactionDate) = ${year}`;
  const baseConditions = bankAccountId
    ? and(eq(transactions.userId, userId), yearCondition, eq(transactions.bankAccountId, bankAccountId))
    : and(eq(transactions.userId, userId), yearCondition);

  // 12-month breakdown
  const monthlyRows = await db
    .select({
      month: sql<number>`MONTH(transactionDate)`,
      type: transactions.type,
      total: sum(transactions.amount),
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(baseConditions)
    .groupBy(sql`MONTH(transactionDate)`, transactions.type)
    .orderBy(sql`MONTH(transactionDate)`);

  // Build full 12-month array
  const monthMap = new Map<number, { income: number; expense: number; transfer: number; count: number }>();
  for (let m = 1; m <= 12; m++) monthMap.set(m, { income: 0, expense: 0, transfer: 0, count: 0 });
  for (const row of monthlyRows) {
    const entry = monthMap.get(row.month)!;
    const val = parseFloat(row.total ?? "0");
    if (row.type === "income") entry.income += val;
    else if (row.type === "expense") entry.expense += val;
    else if (row.type === "transfer") entry.transfer += val;
    entry.count += Number(row.count);
  }
  const monthly = Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    income: parseFloat(data.income.toFixed(2)),
    expense: parseFloat(data.expense.toFixed(2)),
    transfer: parseFloat(data.transfer.toFixed(2)),
    net: parseFloat((data.income - data.expense).toFixed(2)),
    count: data.count,
  }));

  // Category summary
  const catRows = await db
    .select({
      categoryId: transactions.categoryId,
      type: transactions.type,
      total: sum(transactions.amount),
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(baseConditions)
    .groupBy(transactions.categoryId, transactions.type)
    .orderBy(sql`SUM(CAST(amount AS DECIMAL(20,2))) DESC`);

  // Account summary
  const acctRows = await db
    .select({
      bankAccountId: transactions.bankAccountId,
      type: transactions.type,
      total: sum(transactions.amount),
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(baseConditions)
    .groupBy(transactions.bankAccountId, transactions.type);

  // Totals
  let totalIncome = 0, totalExpense = 0;
  for (const row of monthlyRows) {
    if (row.type === "income") totalIncome += parseFloat(row.total ?? "0");
    if (row.type === "expense") totalExpense += parseFloat(row.total ?? "0");
  }

  return {
    monthly,
    categorySummary: catRows,
    accountSummary: acctRows,
    totals: {
      income: parseFloat(totalIncome.toFixed(2)),
      expense: parseFloat(totalExpense.toFixed(2)),
      net: parseFloat((totalIncome - totalExpense).toFixed(2)),
    },
  };
}

// ---- Bulk update category ----
export async function bulkUpdateTransactionCategory(
  ids: number[],
  categoryId: number | null,
  userId: number
): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db
    .update(transactions)
    .set({ categoryId, isManuallyEdited: 1 })
    .where(and(inArray(transactions.id, ids), eq(transactions.userId, userId)));
  return (result as any)[0]?.affectedRows ?? ids.length;
}

// ---- Export transactions as CSV data ----
export async function getTransactionsForExport(
  userId: number,
  params: {
    bankAccountId?: number;
    startDate?: Date;
    endDate?: Date;
    type?: string;
  }
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(transactions.userId, userId)];
  if (params.bankAccountId) conditions.push(eq(transactions.bankAccountId, params.bankAccountId));
  if (params.type) conditions.push(eq(transactions.type, params.type as any));
  if (params.startDate) conditions.push(gte(transactions.transactionDate, params.startDate));
  if (params.endDate) conditions.push(lte(transactions.transactionDate, params.endDate));
  const rows = await db
    .select({
      id: transactions.id,
      transactionDate: transactions.transactionDate,
      type: transactions.type,
      amount: transactions.amount,
      counterparty: transactions.counterparty,
      description: transactions.description,
      notes: transactions.notes,
      categoryId: transactions.categoryId,
      bankAccountId: transactions.bankAccountId,
    })
    .from(transactions)
    .where(and(...conditions))
    .orderBy(transactions.transactionDate);
  return rows;
}

// ---- Check duplicate statement ----
export async function checkDuplicateStatement(
  userId: number,
  bankAccountId: number,
  fileName: string
): Promise<{ exists: boolean; existingId?: number; existingCreatedAt?: Date }> {
  const db = await getDb();
  if (!db) return { exists: false };
  const rows = await db
    .select({ id: statements.id, createdAt: statements.createdAt })
    .from(statements)
    .where(and(eq(statements.userId, userId), eq(statements.bankAccountId, bankAccountId), eq(statements.fileName, fileName)))
    .limit(1);
  if (rows.length === 0) return { exists: false };
  return { exists: true, existingId: rows[0].id, existingCreatedAt: rows[0].createdAt };
}

export async function initDefaultCategories(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(categories).where(eq(categories.userId, userId)).limit(1);
  if (existing.length > 0) return;
  const defaults: InsertCategory[] = [
    // Income
    { userId, name: "保险佣金收入", type: "income", color: "#10B981", icon: "briefcase", isDefault: 1 },
    { userId, name: "投资收益", type: "income", color: "#06B6D4", icon: "trending-up", isDefault: 1 },
    { userId, name: "退款收入", type: "income", color: "#34D399", icon: "refresh-cw", isDefault: 1 },
    { userId, name: "其他收入", type: "income", color: "#8B5CF6", icon: "plus-circle", isDefault: 1 },
    // Business Operating Expenses
    { userId, name: "广告与营销", type: "expense", color: "#F59E0B", icon: "megaphone", isDefault: 1 },
    { userId, name: "专业服务费", type: "expense", color: "#EF4444", icon: "briefcase", isDefault: 1 },
    { userId, name: "办公用品", type: "expense", color: "#EC4899", icon: "package", isDefault: 1 },
    { userId, name: "办公费用", type: "expense", color: "#F97316", icon: "building-2", isDefault: 1 },
    // Travel & Meals
    { userId, name: "餐饮与娱乐", type: "expense", color: "#FBBF24", icon: "utensils", isDefault: 1 },
    { userId, name: "差旅费", type: "expense", color: "#60A5FA", icon: "plane", isDefault: 1 },
    // Motor Vehicle Expenses
    { userId, name: "燃油费", type: "expense", color: "#84CC16", icon: "fuel", isDefault: 1 },
    { userId, name: "车辆保险", type: "expense", color: "#A3E635", icon: "shield", isDefault: 1 },
    { userId, name: "车辆维修与保养", type: "expense", color: "#4ADE80", icon: "wrench", isDefault: 1 },
    { userId, name: "车辆登记与执照", type: "expense", color: "#86EFAC", icon: "file-text", isDefault: 1 },
    { userId, name: "车辆租赁与折旧", type: "expense", color: "#6EE7B7", icon: "car", isDefault: 1 },
    // Business-use-of-home
    { userId, name: "地税", type: "expense", color: "#14B8A6", icon: "landmark", isDefault: 1 },
    { userId, name: "房屋保险", type: "expense", color: "#2DD4BF", icon: "home", isDefault: 1 },
    { userId, name: "公用事业费", type: "expense", color: "#5EEAD4", icon: "zap", isDefault: 1 },
    { userId, name: "房屋贷款利息", type: "expense", color: "#99F6E4", icon: "percent", isDefault: 1 },
    { userId, name: "房租", type: "expense", color: "#CCFBF1", icon: "key", isDefault: 1 },
    // Financial & Insurance
    { userId, name: "利息与银行费用", type: "expense", color: "#6366F1", icon: "credit-card", isDefault: 1 },
    { userId, name: "商业保险", type: "expense", color: "#818CF8", icon: "shield-check", isDefault: 1 },
    // Salary & Benefits
    { userId, name: "员工工资与福利", type: "expense", color: "#A855F7", icon: "users", isDefault: 1 },
    { userId, name: "分包商费用", type: "expense", color: "#C084FC", icon: "user-check", isDefault: 1 },
    // Capital Expenditures
    { userId, name: "资本支出与折旧", type: "expense", color: "#2563EB", icon: "bar-chart-2", isDefault: 1 },
    // Other
    { userId, name: "电话与网络", type: "expense", color: "#0EA5E9", icon: "phone", isDefault: 1 },
    { userId, name: "教育与培训", type: "expense", color: "#38BDF8", icon: "book-open", isDefault: 1 },
    { userId, name: "坏账", type: "expense", color: "#7DD3FC", icon: "alert-triangle", isDefault: 1 },
    { userId, name: "账户转账", type: "transfer", color: "#64748B", icon: "arrow-right-left", isDefault: 1 },
    { userId, name: "其他支出", type: "expense", color: "#9CA3AF", icon: "more-horizontal", isDefault: 1 },
  ];
  await db.insert(categories).values(defaults);
}

// ============================================================
// T4A Recipients (临时工/承包商)
// ============================================================

export async function getT4ARecipients(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(t4aRecipients)
    .where(eq(t4aRecipients.userId, userId))
    .orderBy(desc(t4aRecipients.createdAt));
}

export async function createT4ARecipient(
  data: Omit<InsertT4ARecipient, "id" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(t4aRecipients).values(data as InsertT4ARecipient);
  return result;
}

export async function updateT4ARecipient(
  id: number,
  userId: number,
  data: Partial<Omit<InsertT4ARecipient, "id" | "userId" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(t4aRecipients)
    .set(data)
    .where(and(eq(t4aRecipients.id, id), eq(t4aRecipients.userId, userId)));
}

export async function deleteT4ARecipient(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // cascade delete associated records
  await db
    .delete(t4aRecords)
    .where(and(eq(t4aRecords.recipientId, id), eq(t4aRecords.userId, userId)));
  await db
    .delete(t4aRecipients)
    .where(and(eq(t4aRecipients.id, id), eq(t4aRecipients.userId, userId)));
}

// ============================================================
// T4A Records (税单记录)
// ============================================================

export async function getT4ARecords(userId: number, taxYear?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(t4aRecords.userId, userId)];
  if (taxYear) conditions.push(eq(t4aRecords.taxYear, taxYear));
  const rows = await db
    .select({
      record: t4aRecords,
      recipient: t4aRecipients,
    })
    .from(t4aRecords)
    .leftJoin(t4aRecipients, eq(t4aRecords.recipientId, t4aRecipients.id))
    .where(and(...conditions))
    .orderBy(desc(t4aRecords.createdAt));
  return rows;
}

export async function getT4ARecordById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ record: t4aRecords, recipient: t4aRecipients })
    .from(t4aRecords)
    .leftJoin(t4aRecipients, eq(t4aRecords.recipientId, t4aRecipients.id))
    .where(and(eq(t4aRecords.id, id), eq(t4aRecords.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createT4ARecord(
  data: Omit<InsertT4ARecord, "id" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(t4aRecords).values(data as InsertT4ARecord);
  return result;
}

export async function updateT4ARecord(
  id: number,
  userId: number,
  data: Partial<Omit<InsertT4ARecord, "id" | "userId" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(t4aRecords)
    .set(data)
    .where(and(eq(t4aRecords.id, id), eq(t4aRecords.userId, userId)));
}

export async function deleteT4ARecord(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(t4aRecords)
    .where(and(eq(t4aRecords.id, id), eq(t4aRecords.userId, userId)));
}

// ---- Receipts ----
export async function createReceipt(data: InsertReceipt) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(receipts).values(data);
  return (result as any).insertId as number;
}

export async function getReceipts(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(receipts)
    .where(eq(receipts.userId, userId))
    .orderBy(desc(receipts.createdAt));
}

export async function getReceiptById(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.userId, userId)));
  return rows[0] ?? null;
}

export async function updateReceipt(
  id: number,
  userId: number,
  data: Partial<Omit<InsertReceipt, "id" | "userId" | "createdAt" | "updatedAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(receipts)
    .set(data)
    .where(and(eq(receipts.id, id), eq(receipts.userId, userId)));
}

export async function deleteReceipt(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(receipts)
    .where(and(eq(receipts.id, id), eq(receipts.userId, userId)));
}
