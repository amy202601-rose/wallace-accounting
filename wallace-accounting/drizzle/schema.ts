import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 银行账户表
export const bankAccounts = mysqlTable("bank_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bankName: varchar("bankName", { length: 128 }).notNull(),
  accountName: varchar("accountName", { length: 128 }).notNull(),
  accountNumber: varchar("accountNumber", { length: 64 }),
  currency: varchar("currency", { length: 8 }).default("CNY").notNull(),
  accountType: mysqlEnum("accountType", ["checking", "savings", "credit", "investment", "other"]).default("checking").notNull(),
  balance: decimal("balance", { precision: 18, scale: 2 }).default("0.00"),
  color: varchar("color", { length: 16 }).default("#4F46E5"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = typeof bankAccounts.$inferInsert;

// 账单文件表
export const statements = mysqlTable("statements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bankAccountId: int("bankAccountId").notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileType: mysqlEnum("fileType", ["pdf", "csv"]).notNull(),
  fileSize: bigint("fileSize", { mode: "number" }),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  transactionCount: int("transactionCount").default(0),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Statement = typeof statements.$inferSelect;
export type InsertStatement = typeof statements.$inferInsert;

// 会计科目分类
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["income", "expense", "transfer", "tax", "investment", "other"]).notNull(),
  color: varchar("color", { length: 16 }).default("#6366F1"),
  icon: varchar("icon", { length: 32 }).default("tag"),
  isDefault: int("isDefault").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// 交易记录表
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bankAccountId: int("bankAccountId").notNull(),
  statementId: int("statementId"),
  categoryId: int("categoryId"),
  transactionDate: timestamp("transactionDate").notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["income", "expense", "transfer"]).notNull(),
  description: text("description"),
  counterparty: varchar("counterparty", { length: 256 }),
  reference: varchar("reference", { length: 128 }),
  balance: decimal("balance", { precision: 18, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("CNY"),
  aiCategory: varchar("aiCategory", { length: 64 }),
  aiConfidence: decimal("aiConfidence", { precision: 5, scale: 2 }),
  isManuallyEdited: int("isManuallyEdited").default(0),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// T4A 收款人表（临时工/承包商）
export const t4aRecipients = mysqlTable("t4a_recipients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 收款人基本信息
  firstName: varchar("firstName", { length: 64 }).notNull(),
  lastName: varchar("lastName", { length: 64 }).notNull(),
  sinOrBn: varchar("sinOrBn", { length: 16 }), // SIN (Social Insurance Number) or BN
  // 地址
  address: varchar("address", { length: 256 }),
  city: varchar("city", { length: 64 }),
  province: varchar("province", { length: 4 }),
  postalCode: varchar("postalCode", { length: 16 }),
  country: varchar("country", { length: 4 }).default("CAN"),
  // 联系方式
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  // 备注
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type T4ARecipient = typeof t4aRecipients.$inferSelect;
export type InsertT4ARecipient = typeof t4aRecipients.$inferInsert;

// T4A 税单记录表
export const t4aRecords = mysqlTable("t4a_records", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recipientId: int("recipientId").notNull(),
  taxYear: int("taxYear").notNull(), // 税务年度，如 2024
  // 付款人信息（公司信息）
  payerName: varchar("payerName", { length: 128 }).notNull(),
  payerBn: varchar("payerBn", { length: 16 }), // Business Number
  payerAddress: varchar("payerAddress", { length: 256 }),
  // T4A 金额字段（CRA T4A 表格对应框号）
  box016: decimal("box016", { precision: 12, scale: 2 }).default("0.00"), // 养老金或退休金
  box020: decimal("box020", { precision: 12, scale: 2 }).default("0.00"), // 自雇佣金（Self-employment commissions）
  box022: decimal("box022", { precision: 12, scale: 2 }).default("0.00"), // 预扣所得税
  box024: decimal("box024", { precision: 12, scale: 2 }).default("0.00"), // 年金
  box028: decimal("box028", { precision: 12, scale: 2 }).default("0.00"), // 其他收入
  box048: decimal("box048", { precision: 12, scale: 2 }).default("0.00"), // 费用（Fees for services）
  box105: decimal("box105", { precision: 12, scale: 2 }).default("0.00"), // 奖学金/助学金
  // 状态
  status: mysqlEnum("status", ["draft", "final"]).default("draft").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type T4ARecord = typeof t4aRecords.$inferSelect;
export type InsertT4ARecord = typeof t4aRecords.$inferInsert;

// 小票记录表
export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // 图片存储
  imageKey: varchar("imageKey", { length: 512 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  // AI 识别结果
  merchantName: varchar("merchantName", { length: 256 }),
  transactionDate: timestamp("transactionDate"),
  amount: decimal("amount", { precision: 18, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("CAD"),
  category: varchar("category", { length: 64 }),
  description: text("description"),
  rawText: text("rawText"), // OCR 原始文本
  aiConfidence: decimal("aiConfidence", { precision: 5, scale: 2 }),
  // 关联交易（确认后创建）
  transactionId: int("transactionId"),
  bankAccountId: int("bankAccountId"),
  status: mysqlEnum("status", ["pending", "confirmed", "rejected"]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;
