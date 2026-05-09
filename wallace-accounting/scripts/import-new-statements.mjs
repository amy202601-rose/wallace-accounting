/**
 * 导入两份新账单：
 * 1. TD Aeroplan Visa Infinite *1443 - Jan 26, 2026
 * 2. TD Unlimited Chequing Account 8018-6166911 - Apr 30 - May 30, 2025
 */
import mysql from "mysql2/promise";

const db = await mysql.createConnection(process.env.DATABASE_URL);

// 获取账户 ID
const [accounts] = await db.query("SELECT id, accountNumber FROM bank_accounts");
const acctMap = {};
for (const a of accounts) acctMap[a.accountNumber] = a.id;
console.log("Accounts:", acctMap);

// 获取用户 ID
const [users] = await db.query("SELECT id FROM users LIMIT 1");
const userId = users[0].id;
console.log("User ID:", userId);

// 获取分类
const [cats] = await db.query("SELECT id, name FROM categories WHERE userId = ?", [userId]);
const catMap = {};
for (const c of cats) catMap[c.name] = c.id;
console.log("Categories:", Object.keys(catMap));

// 确保必要分类存在
async function ensureCategory(name, type) {
  if (!catMap[name]) {
    const [r] = await db.query(
      "INSERT INTO categories (userId, name, type, color, createdAt) VALUES (?, ?, ?, ?, NOW())",
      [userId, name, type, "#6b7280"]
    );
    catMap[name] = r.insertId;
    console.log(`Created category: ${name} (${type})`);
  }
  return catMap[name];
}

await ensureCategory("保险费用", "expense");
await ensureCategory("账户转账", "transfer");
await ensureCategory("其他收入", "income");
await ensureCategory("餐饮消费", "expense");
await ensureCategory("购物消费", "expense");
await ensureCategory("通讯费用", "expense");
await ensureCategory("交通出行", "expense");
await ensureCategory("娱乐消费", "expense");
await ensureCategory("其他支出", "expense");
await ensureCategory("月费/手续费", "expense");

// ============================================================
// 账单 1: TD Aeroplan Visa Infinite *1443 - Jan 26, 2026
// ============================================================
const jan2026AccountId = acctMap["1443"];
console.log("\n--- Jan 2026 (*1443) account ID:", jan2026AccountId);

// 创建账单记录
const [jan2026Stmt] = await db.query(
  `INSERT INTO statements (userId, bankAccountId, fileName, fileKey, fileUrl, fileType, fileSize, status, transactionCount, periodStart, periodEnd, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, 'pdf', 0, 'completed', 6, '2025-12-25', '2026-01-26', NOW(), NOW())`,
  [
    userId,
    jan2026AccountId,
    "TD_AEROPLAN_VISA_INFINITE_1443_Jan_26-2026.pdf",
    `statements/${userId}/jan-2026-1443.pdf`,
    "https://placeholder.s3.url/jan-2026-1443.pdf",
  ]
);
const jan2026StmtId = jan2026Stmt.insertId;
console.log("Jan 2026 statement ID:", jan2026StmtId);

// Jan 2026 交易记录（从 PDF 提取）
const jan2026Transactions = [
  {
    date: "2026-01-20",
    desc: "VooV Meeting Pro Amsterdam",
    amount: "19.99",
    type: "expense",
    cat: "通讯费用",
    counterparty: "VooV Meeting",
  },
  {
    date: "2026-01-21",
    desc: "PAYPAL *CHINMAY09",
    amount: "249.03",
    type: "expense",
    cat: "购物消费",
    counterparty: "PayPal",
  },
  {
    date: "2026-01-22",
    desc: "ROUTES CAR RENTAL - RICHMOND",
    amount: "126.00",
    type: "expense",
    cat: "交通出行",
    counterparty: "Routes Car Rental",
  },
  {
    date: "2026-01-23",
    desc: "MCDONALD'S #40888 CALGARY",
    amount: "5.71",
    type: "expense",
    cat: "餐饮消费",
    counterparty: "McDonald's",
  },
  {
    date: "2026-01-26",
    desc: "TESLA Toronto",
    amount: "5.98",
    type: "expense",
    cat: "交通出行",
    counterparty: "Tesla",
  },
  {
    date: "2026-01-26",
    desc: "PIZZA HUT SYMONS VALLEY CALGARY",
    amount: "30.95",
    type: "expense",
    cat: "餐饮消费",
    counterparty: "Pizza Hut",
  },
];

for (const t of jan2026Transactions) {
  await db.query(
    `INSERT INTO transactions (userId, bankAccountId, statementId, categoryId, transactionDate, amount, type, description, counterparty, currency, aiCategory, aiConfidence, isManuallyEdited, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CAD', ?, '0.90', 0, NOW(), NOW())`,
    [userId, jan2026AccountId, jan2026StmtId, catMap[t.cat], t.date, t.amount, t.type, t.desc, t.counterparty, t.cat]
  );
}
console.log(`Inserted ${jan2026Transactions.length} Jan 2026 transactions`);

// ============================================================
// 账单 2: TD Unlimited Chequing 8018-6166911 - Apr 30 - May 30, 2025
// ============================================================
const chequingAccountId = acctMap["6166911"];
console.log("\n--- Chequing account ID:", chequingAccountId);

const [chequingStmt] = await db.query(
  `INSERT INTO statements (userId, bankAccountId, fileName, fileKey, fileUrl, fileType, fileSize, status, transactionCount, periodStart, periodEnd, createdAt, updatedAt)
   VALUES (?, ?, ?, ?, ?, 'pdf', 0, 'completed', 20, '2025-04-30', '2025-05-30', NOW(), NOW())`,
  [
    userId,
    chequingAccountId,
    "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_Apr_30-May_30_2025.pdf",
    `statements/${userId}/chequing-apr-may-2025.pdf`,
    "https://placeholder.s3.url/chequing-apr-may-2025.pdf",
  ]
);
const chequingStmtId = chequingStmt.insertId;
console.log("Chequing statement ID:", chequingStmtId);

// 支票账单交易（从 PDF 提取，起始余额 $69,407.44）
const chequingTransactions = [
  { date: "2025-05-01", desc: "IND ALLIANCE MSP", amount: "555.51", type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
  { date: "2025-05-01", desc: "EQUITABLE LIFE PAY", amount: "194.52", type: "income", cat: "保险费用", counterparty: "Equitable Life", balance: "70157.47" },
  { date: "2025-05-02", desc: "MANULIFE PAY", amount: "865.76", type: "income", cat: "保险费用", counterparty: "Manulife", balance: "71023.23" },
  { date: "2025-05-08", desc: "IND ALLIANCE MSP", amount: "7913.89", type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: "78937.12" },
  { date: "2025-05-09", desc: "MANULIFE PAY", amount: "103.65", type: "income", cat: "保险费用", counterparty: "Manulife", balance: "79040.77" },
  { date: "2025-05-12", desc: "JB325 TFR-TO C/C", amount: "7000.00", type: "transfer", cat: "账户转账", counterparty: "Credit Card", balance: "72040.77" },
  { date: "2025-05-15", desc: "IND ALLIANCE MSP", amount: "4697.30", type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
  { date: "2025-05-15", desc: "SUN LIFE OF CAN PAY", amount: "103.03", type: "income", cat: "保险费用", counterparty: "Sun Life", balance: "76841.10" },
  { date: "2025-05-20", desc: "RB425 TFR-TO 6116507", amount: "2000.00", type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: null },
  { date: "2025-05-20", desc: "RB430 TFR-TO 6116507", amount: "2000.00", type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: null },
  { date: "2025-05-20", desc: "SEND E-TFR ***pYZ", amount: "89.25", type: "expense", cat: "账户转账", counterparty: "E-Transfer pYZ", balance: null },
  { date: "2025-05-20", desc: "SEND E-TFR ***SUW", amount: "300.00", type: "expense", cat: "账户转账", counterparty: "E-Transfer SUW", balance: "72451.85" },
  { date: "2025-05-22", desc: "IND ALLIANCE MSP", amount: "132.50", type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: "72584.35" },
  { date: "2025-05-23", desc: "MANULIFE PAY", amount: "72.36", type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
  { date: "2025-05-23", desc: "SEND E-TFR ***FPP", amount: "71.25", type: "expense", cat: "账户转账", counterparty: "E-Transfer FPP", balance: "72585.46" },
  { date: "2025-05-29", desc: "IND ALLIANCE MSP", amount: "114.30", type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
  { date: "2025-05-29", desc: "IY525 TFR-TO 6116507", amount: "1919.00", type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: "70780.76" },
  { date: "2025-05-30", desc: "MANULIFE PAY", amount: "871.29", type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
  { date: "2025-05-30", desc: "MONTHLY ACCOUNT FEE", amount: "16.95", type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
  { date: "2025-05-30", desc: "ACCT BAL REBATE", amount: "16.95", type: "income", cat: "其他收入", counterparty: "TD Bank", balance: "71652.05" },
];

for (const t of chequingTransactions) {
  await db.query(
    `INSERT INTO transactions (userId, bankAccountId, statementId, categoryId, transactionDate, amount, type, description, counterparty, balance, currency, aiCategory, aiConfidence, isManuallyEdited, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CAD', ?, '0.90', 0, NOW(), NOW())`,
    [userId, chequingAccountId, chequingStmtId, catMap[t.cat], t.date, t.amount, t.type, t.desc, t.counterparty, t.balance || null, t.cat]
  );
}
console.log(`Inserted ${chequingTransactions.length} chequing transactions`);

// 验证
const [txCount] = await db.query("SELECT COUNT(*) as cnt FROM transactions WHERE userId = ?", [userId]);
const [stmtCount] = await db.query("SELECT COUNT(*) as cnt FROM statements WHERE userId = ?", [userId]);
console.log(`\n✅ Total transactions: ${txCount[0].cnt}`);
console.log(`✅ Total statements: ${stmtCount[0].cnt}`);

await db.end();
