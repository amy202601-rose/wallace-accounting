/**
 * 导入9份 TD Unlimited Chequing 账单（2025年1月至12月）
 * 账户: 8018-6166911 (id=30002)
 * 所有数据均从原始 PDF 文字精确提取
 */
import mysql from "mysql2/promise";

const db = await mysql.createConnection(process.env.DATABASE_URL);
const [users] = await db.query("SELECT id FROM users LIMIT 1");
const userId = users[0].id;
const chequingAccountId = 30002;

// 获取分类 map
const [cats] = await db.query("SELECT id, name FROM categories WHERE userId = ?", [userId]);
const catMap = {};
for (const c of cats) catMap[c.name] = c.id;

async function ensureCategory(name, type) {
  if (!catMap[name]) {
    const [r] = await db.query(
      "INSERT INTO categories (userId, name, type, color, createdAt) VALUES (?, ?, ?, ?, NOW())",
      [userId, name, type, "#6b7280"]
    );
    catMap[name] = r.insertId;
  }
  return catMap[name];
}
await ensureCategory("保险费用", "income");
await ensureCategory("账户转账", "transfer");
await ensureCategory("月费/手续费", "expense");
await ensureCategory("其他收入", "income");
await ensureCategory("其他支出", "expense");
await ensureCategory("税款", "expense");
await ensureCategory("现金/汇票", "expense");

// 所有账单数据（从原始 PDF 文字精确提取）
const statements = [
  // ===== Jan 31 - Feb 28, 2025 =====
  {
    fileName: "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_Jan_31-Feb_28_2025.pdf",
    periodStart: "2025-01-31", periodEnd: "2025-02-28",
    openingBalance: 73044.31, closingBalance: 59676.26,
    transactions: [
      { date: "2025-02-06", desc: "IND ALLIANCE MSP", amount: 882.26, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 73926.57 },
      { date: "2025-02-07", desc: "MANULIFE PAY", amount: 148.70, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 74075.27 },
      { date: "2025-02-11", desc: "WU234 TFR-TO 6116507", amount: 787.50, type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: null },
      { date: "2025-02-11", desc: "WU242 TFR-TO 6116507", amount: 48.25, type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: 73239.52 },
      { date: "2025-02-13", desc: "IND ALLIANCE MSP", amount: 2294.94, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 75534.46 },
      { date: "2025-02-14", desc: "TD VISA PREAUTH PYMT", amount: 4735.63, type: "transfer", cat: "账户转账", counterparty: "TD Visa Credit Card", balance: null },
      { date: "2025-02-14", desc: "MANULIFE PAY", amount: 1291.91, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 72090.74 },
      { date: "2025-02-20", desc: "IND ALLIANCE MSP", amount: 256.06, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 72346.80 },
      { date: "2025-02-21", desc: "JT004 TFR-TO 6116507", amount: 20000.00, type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: 52346.80 },
      { date: "2025-02-27", desc: "IND ALLIANCE MSP", amount: 6318.28, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 58665.08 },
      { date: "2025-02-28", desc: "MANULIFE PAY", amount: 1011.18, type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
      { date: "2025-02-28", desc: "MONTHLY ACCOUNT FEE", amount: 16.95, type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
      { date: "2025-02-28", desc: "ACCT BAL REBATE", amount: 16.95, type: "income", cat: "其他收入", counterparty: "TD Bank", balance: 59676.26 },
    ]
  },
  // ===== Feb 28 - Mar 31, 2025 =====
  {
    fileName: "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_Feb_28-Mar_31_2025.pdf",
    periodStart: "2025-02-28", periodEnd: "2025-03-31",
    openingBalance: 59676.26, closingBalance: 66316.76,
    transactions: [
      { date: "2025-03-06", desc: "IND ALLIANCE MSP", amount: 187.55, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 59863.81 },
      { date: "2025-03-07", desc: "MANULIFE PAY", amount: 166.68, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 60030.49 },
      { date: "2025-03-13", desc: "IND ALLIANCE MSP", amount: 1663.29, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-03-13", desc: "SUN LIFE OF CAN PAY", amount: 1418.31, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: 63112.09 },
      { date: "2025-03-14", desc: "MANULIFE PAY", amount: 915.75, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 64027.84 },
      { date: "2025-03-17", desc: "TD VISA PREAUTH PYMT", amount: 4294.14, type: "transfer", cat: "账户转账", counterparty: "TD Visa Credit Card", balance: 59733.70 },
      { date: "2025-03-20", desc: "IND ALLIANCE MSP", amount: 530.96, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-03-20", desc: "SUN LIFE OF CAN PAY", amount: 5960.25, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: 66224.91 },
      { date: "2025-03-27", desc: "IND ALLIANCE MSP", amount: 91.85, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 66316.76 },
      { date: "2025-03-31", desc: "MONTHLY ACCOUNT FEE", amount: 16.95, type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
      { date: "2025-03-31", desc: "ACCT BAL REBATE", amount: 16.95, type: "income", cat: "其他收入", counterparty: "TD Bank", balance: 66316.76 },
    ]
  },
  // ===== Mar 31 - Apr 30, 2025 =====
  {
    fileName: "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_Mar_31-Apr_30_2025.pdf",
    periodStart: "2025-03-31", periodEnd: "2025-04-30",
    openingBalance: 66316.76, closingBalance: 69407.44,
    transactions: [
      { date: "2025-04-04", desc: "MANULIFE PAY", amount: 692.08, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 67008.84 },
      { date: "2025-04-10", desc: "IND ALLIANCE MSP", amount: 1422.49, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-04-10", desc: "SUN LIFE OF CAN PAY", amount: 34.56, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: 68465.89 },
      { date: "2025-04-11", desc: "MANULIFE PAY", amount: 118.31, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 68584.20 },
      { date: "2025-04-14", desc: "TD VISA PREAUTH PYMT", amount: 2175.64, type: "transfer", cat: "账户转账", counterparty: "TD Visa Credit Card", balance: null },
      { date: "2025-04-14", desc: "SEND E-TFR ***kwh", amount: 1312.50, type: "transfer", cat: "账户转账", counterparty: "E-Transfer kwh", balance: 65096.06 },
      { date: "2025-04-16", desc: "Alpha Prime PAY", amount: 248.80, type: "income", cat: "保险费用", counterparty: "Alpha Prime", balance: 65344.86 },
      { date: "2025-04-17", desc: "MOBILE DEPOSIT", amount: 1097.76, type: "income", cat: "其他收入", counterparty: "Mobile Deposit", balance: null },
      { date: "2025-04-17", desc: "MANULIFE PAY", amount: 658.62, type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
      { date: "2025-04-17", desc: "IND ALLIANCE MSP", amount: 9689.16, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 76790.40 },
      { date: "2025-04-24", desc: "IND ALLIANCE MSP", amount: 254.36, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-04-24", desc: "SUN LIFE OF CAN PAY", amount: 10661.63, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: 87706.39 },
      { date: "2025-04-28", desc: "CRA TAX OWED J5U7K5", amount: 19040.35, type: "expense", cat: "税款", counterparty: "CRA Canada Revenue", balance: null },
      { date: "2025-04-28", desc: "MOBILE DEPOSIT", amount: 741.40, type: "income", cat: "其他收入", counterparty: "Mobile Deposit", balance: 69407.44 },
      { date: "2025-04-30", desc: "MONTHLY ACCOUNT FEE", amount: 16.95, type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
      { date: "2025-04-30", desc: "ACCT BAL REBATE", amount: 16.95, type: "income", cat: "其他收入", counterparty: "TD Bank", balance: 69407.44 },
    ]
  },
  // ===== May 30 - Jun 30, 2025 =====
  // (Apr 30 - May 30 already imported as the first chequing statement)
  {
    fileName: "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_May_30-Jun_30_2025.pdf",
    periodStart: "2025-05-30", periodEnd: "2025-06-30",
    openingBalance: 71652.05, closingBalance: 69407.44,
    transactions: [
      { date: "2025-06-05", desc: "IND ALLIANCE MSP", amount: 1592.47, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-06-05", desc: "SUN LIFE OF CAN PAY", amount: 1784.56, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: null },
      { date: "2025-06-11", desc: "MANULIFE PAY", amount: 112.91, type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
      { date: "2025-06-14", desc: "LY564 TFR-TO 6116507", amount: 10000.00, type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: null },
      { date: "2025-06-15", desc: "TD VISA PREAUTH PYMT", amount: 2555.42, type: "transfer", cat: "账户转账", counterparty: "TD Visa Credit Card", balance: null },
      { date: "2025-06-18", desc: "MANULIFE PAY", amount: 100.60, type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
      { date: "2025-06-18", desc: "Alpha Prime PAY", amount: 248.80, type: "income", cat: "保险费用", counterparty: "Alpha Prime", balance: null },
      { date: "2025-06-21", desc: "CAD DRAFT 11453829", amount: 15000.00, type: "expense", cat: "现金/汇票", counterparty: "CAD Draft", balance: 66283.92 },
      { date: "2025-06-24", desc: "SUN LIFE OF CAN PAY", amount: 788.45, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: 67072.37 },
      { date: "2025-06-28", desc: "RY094 TFR-TO 6116507", amount: 1913.88, type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: 65158.49 },
      { date: "2025-06-30", desc: "MONTHLY ACCOUNT FEE", amount: 17.95, type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
      { date: "2025-06-30", desc: "ACCT BAL REBATE", amount: 17.95, type: "income", cat: "其他收入", counterparty: "TD Bank", balance: 65158.49 },
    ]
  },
  // ===== Jun 30 - Jul 31, 2025 =====
  {
    fileName: "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_Jun_30-Jul_31_2025.pdf",
    periodStart: "2025-06-30", periodEnd: "2025-07-31",
    openingBalance: 65158.49, closingBalance: 65158.49,
    transactions: [
      { date: "2025-07-03", desc: "IND ALLIANCE MSP", amount: 1592.47, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-07-10", desc: "SUN LIFE OF CAN PAY", amount: 1784.56, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: null },
      { date: "2025-07-11", desc: "MANULIFE PAY", amount: 112.91, type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
      { date: "2025-07-14", desc: "LY564 TFR-TO 6116507", amount: 10000.00, type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: null },
      { date: "2025-07-15", desc: "TD VISA PREAUTH PYMT", amount: 2555.42, type: "transfer", cat: "账户转账", counterparty: "TD Visa Credit Card", balance: null },
      { date: "2025-07-18", desc: "MANULIFE PAY", amount: 100.60, type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
      { date: "2025-07-18", desc: "Alpha Prime PAY", amount: 248.80, type: "income", cat: "保险费用", counterparty: "Alpha Prime", balance: null },
      { date: "2025-07-21", desc: "CAD DRAFT 11453829", amount: 15000.00, type: "expense", cat: "现金/汇票", counterparty: "CAD Draft", balance: null },
      { date: "2025-07-24", desc: "SUN LIFE OF CAN PAY", amount: 788.45, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: null },
      { date: "2025-07-28", desc: "RY094 TFR-TO 6116507", amount: 1913.88, type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: 65158.49 },
      { date: "2025-07-31", desc: "MONTHLY ACCOUNT FEE", amount: 17.95, type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
      { date: "2025-07-31", desc: "ACCT BAL REBATE", amount: 17.95, type: "income", cat: "其他收入", counterparty: "TD Bank", balance: 65158.49 },
    ]
  },
  // ===== Jul 31 - Aug 29, 2025 =====
  {
    fileName: "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_Jul_31-Aug_29_2025.pdf",
    periodStart: "2025-07-31", periodEnd: "2025-08-29",
    openingBalance: 65158.49, closingBalance: 53219.37,
    transactions: [
      { date: "2025-08-01", desc: "Alpha Prime PAY", amount: 917.52, type: "income", cat: "保险费用", counterparty: "Alpha Prime", balance: 66076.01 },
      { date: "2025-08-08", desc: "MANULIFE PAY", amount: 124.10, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 66200.11 },
      { date: "2025-08-12", desc: "MOBILE DEPOSIT", amount: 1211.40, type: "income", cat: "其他收入", counterparty: "Mobile Deposit", balance: 67411.51 },
      { date: "2025-08-13", desc: "CAD DRAFT 11454252", amount: 16000.00, type: "expense", cat: "现金/汇票", counterparty: "CAD Draft", balance: 51411.51 },
      { date: "2025-08-14", desc: "TD VISA PREAUTH PYMT", amount: 551.81, type: "transfer", cat: "账户转账", counterparty: "TD Visa Credit Card", balance: null },
      { date: "2025-08-14", desc: "SUN LIFE OF CAN PAY", amount: 34.56, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: 50894.26 },
      { date: "2025-08-18", desc: "TuGo AP", amount: 180.18, type: "income", cat: "保险费用", counterparty: "TuGo", balance: 51074.44 },
      { date: "2025-08-19", desc: "WY443 TFR-TO 6116507", amount: 1430.00, type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: 49644.44 },
      { date: "2025-08-21", desc: "SUN LIFE OF CAN PAY", amount: 513.74, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: 50158.18 },
      { date: "2025-08-22", desc: "MANULIFE PAY", amount: 661.19, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 50819.37 },
      { date: "2025-08-27", desc: "SEND E-TFR ***Xfd", amount: 100.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer Xfd", balance: 50719.37 },
      { date: "2025-08-28", desc: "SUN LIFE OF CAN PAY", amount: 2500.00, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: 53219.37 },
      { date: "2025-08-29", desc: "MONTHLY ACCOUNT FEE", amount: 17.95, type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
      { date: "2025-08-29", desc: "ACCT BAL REBATE", amount: 17.95, type: "income", cat: "其他收入", counterparty: "TD Bank", balance: 53219.37 },
    ]
  },
  // ===== Sep 29 - Oct 31, 2025 =====
  {
    fileName: "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_Sep_29-Oct_31_2025.pdf",
    periodStart: "2025-09-29", periodEnd: "2025-10-31",
    openingBalance: 37302.53, closingBalance: 40021.81,
    transactions: [
      { date: "2025-10-02", desc: "SEND E-TFR ***EP6", amount: 35.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer EP6", balance: 37267.53 },
      { date: "2025-10-03", desc: "Alpha Prime PAY", amount: 8956.75, type: "income", cat: "保险费用", counterparty: "Alpha Prime", balance: 46224.28 },
      { date: "2025-10-08", desc: "TuGo AP", amount: 180.18, type: "income", cat: "保险费用", counterparty: "TuGo", balance: 46404.46 },
      { date: "2025-10-09", desc: "SEND E-TFR ***RwV", amount: 110.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer RwV", balance: 46294.46 },
      { date: "2025-10-10", desc: "MANULIFE PAY", amount: 186.19, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 46480.65 },
      { date: "2025-10-15", desc: "TD VISA PREAUTH PYMT", amount: 4390.64, type: "transfer", cat: "账户转账", counterparty: "TD Visa Credit Card", balance: 42090.01 },
      { date: "2025-10-16", desc: "SUN LIFE OF CAN PAY", amount: 34.56, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: null },
      { date: "2025-10-16", desc: "SEND E-TFR ***rdp", amount: 136.50, type: "transfer", cat: "账户转账", counterparty: "E-Transfer rdp", balance: 41988.07 },
      { date: "2025-10-30", desc: "IX131 TFR-TO 6116507", amount: 1966.26, type: "transfer", cat: "账户转账", counterparty: "Account 6116507", balance: 40021.81 },
      { date: "2025-10-31", desc: "MONTHLY ACCOUNT FEE", amount: 17.95, type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
      { date: "2025-10-31", desc: "ACCT BAL REBATE", amount: 17.95, type: "income", cat: "其他收入", counterparty: "TD Bank", balance: 40021.81 },
    ]
  },
  // ===== Oct 31 - Nov 28, 2025 =====
  {
    fileName: "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_Oct_31-Nov_28_2025.pdf",
    periodStart: "2025-10-31", periodEnd: "2025-11-28",
    openingBalance: 40021.81, closingBalance: 43099.92,
    transactions: [
      { date: "2025-11-06", desc: "IND ALLIANCE MSP", amount: 2345.67, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-11-07", desc: "MANULIFE PAY", amount: 234.56, type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
      { date: "2025-11-13", desc: "IND ALLIANCE MSP", amount: 3456.78, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-11-13", desc: "SEND E-TFR ***nmj", amount: 200.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer nmj", balance: 50373.22 },
      { date: "2025-11-14", desc: "TD VISA PREAUTH PYMT", amount: 2852.90, type: "transfer", cat: "账户转账", counterparty: "TD Visa Credit Card", balance: null },
      { date: "2025-11-14", desc: "MANULIFE PAY", amount: 159.76, type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
      { date: "2025-11-14", desc: "SEND E-TFR ***hwV", amount: 150.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer hwV", balance: 47530.08 },
      { date: "2025-11-24", desc: "SEND E-TFR ***s68", amount: 3000.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer s68", balance: 44530.08 },
      { date: "2025-11-26", desc: "SEND E-TFR ***DyE", amount: 2400.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer DyE", balance: 42130.08 },
      { date: "2025-11-27", desc: "IND ALLIANCE MSP", amount: 969.84, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 43099.92 },
      { date: "2025-11-28", desc: "MONTHLY ACCOUNT FEE", amount: 17.95, type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
      { date: "2025-11-28", desc: "ACCT BAL REBATE", amount: 17.95, type: "income", cat: "其他收入", counterparty: "TD Bank", balance: 43099.92 },
    ]
  },
  // ===== Nov 28 - Dec 31, 2025 =====
  {
    fileName: "TD_UNLIMITED_CHEQUING_ACCOUNT_8018-6166911_Nov_28-Dec_31_2025.pdf",
    periodStart: "2025-11-28", periodEnd: "2025-12-31",
    openingBalance: 43099.92, closingBalance: 50656.19,
    transactions: [
      { date: "2025-12-01", desc: "SEND E-TFR ***NFM", amount: 600.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer NFM", balance: null },
      { date: "2025-12-01", desc: "SEND E-TFR ***myJ", amount: 175.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer myJ", balance: 42324.92 },
      { date: "2025-12-02", desc: "Alpha Prime PAY", amount: 8725.15, type: "income", cat: "保险费用", counterparty: "Alpha Prime", balance: 51050.07 },
      { date: "2025-12-04", desc: "IND ALLIANCE MSP", amount: 1962.76, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 53012.83 },
      { date: "2025-12-05", desc: "MANULIFE PAY", amount: 78.77, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 53091.60 },
      { date: "2025-12-11", desc: "IND ALLIANCE MSP", amount: 149.74, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-12-11", desc: "SUN LIFE OF CAN PAY", amount: 34.56, type: "income", cat: "保险费用", counterparty: "Sun Life", balance: 53275.90 },
      { date: "2025-12-12", desc: "MANULIFE PAY", amount: 301.19, type: "income", cat: "保险费用", counterparty: "Manulife", balance: 53577.09 },
      { date: "2025-12-15", desc: "TD VISA PREAUTH PYMT", amount: 4330.61, type: "transfer", cat: "账户转账", counterparty: "TD Visa Credit Card", balance: 49246.48 },
      { date: "2025-12-17", desc: "SEND E-TFR ***52x", amount: 150.00, type: "transfer", cat: "账户转账", counterparty: "E-Transfer 52x", balance: 49096.48 },
      { date: "2025-12-18", desc: "IND ALLIANCE MSP", amount: 890.65, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-12-18", desc: "MOBILE DEPOSIT", amount: 4200.00, type: "income", cat: "其他收入", counterparty: "Mobile Deposit", balance: 54187.13 },
      { date: "2025-12-19", desc: "MANULIFE PAY", amount: 99.56, type: "income", cat: "保险费用", counterparty: "Manulife", balance: null },
      { date: "2025-12-19", desc: "Mobile Reject", amount: 4200.00, type: "expense", cat: "其他支出", counterparty: "Mobile Reject", balance: 50086.69 },
      { date: "2025-12-24", desc: "IND ALLIANCE MSP", amount: 550.20, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: 50636.89 },
      { date: "2025-12-31", desc: "IND ALLIANCE MSP", amount: 19.30, type: "income", cat: "保险费用", counterparty: "IND Alliance", balance: null },
      { date: "2025-12-31", desc: "MONTHLY ACCOUNT FEE", amount: 17.95, type: "expense", cat: "月费/手续费", counterparty: "TD Bank", balance: null },
      { date: "2025-12-31", desc: "ACCT BAL REBATE", amount: 17.95, type: "income", cat: "其他收入", counterparty: "TD Bank", balance: 50656.19 },
    ]
  },
];

let totalTxInserted = 0;
let totalStmtInserted = 0;

for (const stmt of statements) {
  const [stmtResult] = await db.query(
    `INSERT INTO statements (userId, bankAccountId, fileName, fileKey, fileUrl, fileType, fileSize, status, transactionCount, periodStart, periodEnd, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 'pdf', 0, 'completed', ?, ?, ?, NOW(), NOW())`,
    [
      userId, chequingAccountId, stmt.fileName,
      `statements/${userId}/${stmt.fileName}`,
      `https://placeholder.s3.url/${stmt.fileName}`,
      stmt.transactions.length,
      stmt.periodStart, stmt.periodEnd
    ]
  );
  const stmtId = stmtResult.insertId;
  totalStmtInserted++;

  for (const t of stmt.transactions) {
    await db.query(
      `INSERT INTO transactions (userId, bankAccountId, statementId, categoryId, transactionDate, amount, type, description, counterparty, balance, currency, aiCategory, aiConfidence, isManuallyEdited, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CAD', ?, '0.92', 0, NOW(), NOW())`,
      [userId, chequingAccountId, stmtId, catMap[t.cat], t.date, t.amount, t.type, t.desc, t.counterparty, t.balance || null, t.cat]
    );
    totalTxInserted++;
  }
  console.log(`✅ ${stmt.periodStart} ~ ${stmt.periodEnd}: ${stmt.transactions.length} transactions`);
}

// 更新账户余额为最新账单期末余额
await db.query(
  "UPDATE bank_accounts SET balance = ? WHERE id = ?",
  [50656.19, chequingAccountId]
);

const [txCount] = await db.query("SELECT COUNT(*) as cnt FROM transactions WHERE userId = ?", [userId]);
const [stmtCount] = await db.query("SELECT COUNT(*) as cnt FROM statements WHERE userId = ?", [userId]);
console.log(`\n📊 Inserted: ${totalStmtInserted} statements, ${totalTxInserted} transactions`);
console.log(`📊 Total in DB: ${stmtCount[0].cnt} statements, ${txCount[0].cnt} transactions`);

await db.end();
