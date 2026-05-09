import mysql from "mysql2/promise";
import { readFileSync } from "fs";

// Dec 2025 transactions extracted manually from PDF
const decTransactions = [
  { transaction_date: "2025-11-25", posting_date: "2025-11-27", description: "JOLLIBEE CALGARY", amount: 51.31, type: "expense", category: "餐饮" },
  { transaction_date: "2025-11-28", posting_date: "2025-11-28", description: "TESLA Toronto", amount: 14.65, type: "expense", category: "交通" },
  { transaction_date: "2025-11-27", posting_date: "2025-12-01", description: "MCDONALD'S #40888 CALGARY", amount: 44.99, type: "expense", category: "餐饮" },
  { transaction_date: "2025-11-30", posting_date: "2025-12-01", description: "JET CAR RENTAL MISSISSAUGA", amount: 114.19, type: "expense", category: "交通" },
  { transaction_date: "2025-12-05", posting_date: "2025-12-08", description: "MCDONALD S #9527 CALGARY", amount: 5.57, type: "expense", category: "餐饮" },
  { transaction_date: "2025-12-07", posting_date: "2025-12-08", description: "ROGERS ******4058 888-764-3771", amount: 163.05, type: "expense", category: "通讯" },
  { transaction_date: "2025-12-08", posting_date: "2025-12-09", description: "Burton Canada Company Montreal", amount: 654.07, type: "expense", category: "购物" },
  { transaction_date: "2025-12-15", posting_date: "2025-12-15", description: "PREAUTHORIZED PAYMENT", amount: -4330.61, type: "transfer", category: "还款" },
  { transaction_date: "2025-12-14", posting_date: "2025-12-16", description: "K-GOLF INC CALGARY", amount: 105.00, type: "expense", category: "娱乐" },
  { transaction_date: "2025-12-16", posting_date: "2025-12-16", description: "TESLA Toronto", amount: 18.27, type: "expense", category: "交通" },
  { transaction_date: "2025-12-17", posting_date: "2025-12-17", description: "TESLA Toronto", amount: 8.62, type: "expense", category: "交通" },
  { transaction_date: "2025-12-19", posting_date: "2025-12-22", description: "SHELL EASYPAY AB CALGARY", amount: 62.99, type: "expense", category: "交通" },
  { transaction_date: "2025-12-19", posting_date: "2025-12-22", description: "K-GOLF INC CALGARY", amount: 48.13, type: "expense", category: "娱乐" },
  { transaction_date: "2025-12-20", posting_date: "2025-12-22", description: "WINSPORT CALGARY", amount: 79.80, type: "expense", category: "娱乐" },
  { transaction_date: "2025-12-20", posting_date: "2025-12-22", description: "ROCKIES&RIVER RESTAURANT CALGARY", amount: 134.58, type: "expense", category: "餐饮" },
  { transaction_date: "2025-12-21", posting_date: "2025-12-22", description: "T&T SUPERMARKET #014 CALGARY", amount: 400.00, type: "expense", category: "购物" },
];

const decStatement = {
  statement_date: "2025-12-24",
  statement_period: "2025-11-25 to 2025-12-24",
  new_balance: 1905.22,
  transactions: decTransactions,
};

// Load parsed results
const data = JSON.parse(readFileSync("/home/ubuntu/parse_td_statements.json", "utf-8"));

const allStatements = data.results
  .filter(r => r.output && r.output.statement_date)
  .map(r => {
    // Clean up malformed JSON strings (trailing garbage like "})")
    let txStr = r.output.transactions.trim();
    const lastBracket = txStr.lastIndexOf(']');
    if (lastBracket !== -1) txStr = txStr.slice(0, lastBracket + 1);
    return {
      ...r.output,
      transactions: JSON.parse(txStr),
    };
  });

// Add Dec manually
allStatements.push(decStatement);

// Sort by statement date
allStatements.sort((a, b) => a.statement_date.localeCompare(b.statement_date));

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Get the bank account id
const [accounts] = await connection.execute(
  "SELECT id FROM bank_accounts WHERE accountNumber = '1261' LIMIT 1"
);
if (!accounts.length) {
  console.error("Bank account not found!");
  process.exit(1);
}
const accountId = accounts[0].id;
console.log(`Using bank account id: ${accountId}`);

// Get the user id
const [users] = await connection.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1");
const userId = users[0].id;
console.log(`Using user id: ${userId}`);

// Get or create categories
const categoryMap = {};
const categoryColors = {
  "餐饮": "#f59e0b",
  "购物": "#8b5cf6",
  "通讯": "#06b6d4",
  "软件订阅": "#3b82f6",
  "保险": "#10b981",
  "娱乐": "#ec4899",
  "医疗": "#ef4444",
  "教育": "#f97316",
  "住房": "#84cc16",
  "金融服务": "#6366f1",
  "还款": "#64748b",
  "交通": "#14b8a6",
  "其他": "#94a3b8",
};

for (const [name, color] of Object.entries(categoryColors)) {
  const [existing] = await connection.execute(
    "SELECT id FROM categories WHERE name = ? AND userId = ? LIMIT 1",
    [name, userId]
  );
  if (existing.length) {
    categoryMap[name] = existing[0].id;
  } else {
      const [result] = await connection.execute(
      "INSERT INTO categories (userId, name, type, color, createdAt) VALUES (?, ?, 'expense', ?, NOW())",
      [userId, name, color]
    );
    categoryMap[name] = result.insertId;
  }
}
console.log(`Categories ready: ${Object.keys(categoryMap).length}`);

let totalStatements = 0;
let totalTransactions = 0;

for (const stmt of allStatements) {
  const periodParts = stmt.statement_period.split(" to ");
  const periodStart = periodParts[0];
  const periodEnd = periodParts[1];

  // Insert statement record
  const [stmtResult] = await connection.execute(
    `INSERT INTO statements (userId, bankAccountId, fileName, fileKey, fileUrl, fileType, fileSize, status, transactionCount, periodStart, periodEnd, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 'pdf', 0, 'completed', ?, ?, ?, NOW(), NOW())`,
    [
      userId,
      accountId,
      `TD_AEROPLAN_VISA_INFINITE_1443_${stmt.statement_date}.pdf`,
      "",
      "",
      stmt.transactions.length,
      periodStart,
      periodEnd,
    ]
  );
  const statementId = stmtResult.insertId;
  totalStatements++;

  // Insert transactions
  for (const tx of stmt.transactions) {
    if (tx.amount === 0) continue;

    const catId = categoryMap[tx.category] || categoryMap["其他"];

    await connection.execute(
      `INSERT INTO transactions (userId, bankAccountId, statementId, categoryId, transactionDate, amount, type, description, counterparty, reference, currency, aiCategory, aiConfidence, isManuallyEdited, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CAD', ?, 0.85, 0, '', NOW(), NOW())`,
      [
        userId,
        accountId,
        statementId,
        catId,
        tx.transaction_date,
        tx.amount,
        tx.type,
        tx.description || "(无描述)",
        "",
        tx.posting_date,
        tx.category,
      ]
    );
    totalTransactions++;
  }

  console.log(`✓ ${stmt.statement_date} — ${stmt.transactions.filter(t => t.amount !== 0).length} transactions`);
}

// Update account balance to latest statement balance
const latestStmt = allStatements[allStatements.length - 1];
await connection.execute(
  "UPDATE bank_accounts SET balance = ? WHERE id = ?",
  [-latestStmt.new_balance, accountId]
);

console.log(`\n✅ Import complete!`);
console.log(`   Statements: ${totalStatements}`);
console.log(`   Transactions: ${totalTransactions}`);

await connection.end();
