import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const dotenv = await import("dotenv");
dotenv.config({ path: join(__dirname, "../.env") });

// Load pdfjs
const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

const LINE_TOLERANCE = 3;

function buildStructuredPdfText(pages) {
  const lines = [];
  for (const page of pages) {
    const lineMap = new Map();
    for (const item of page.items) {
      if (!item.str.trim()) continue;
      const x = Math.round(item.transform[4]);
      const y = Math.round(item.transform[5]);
      let lineKey;
      for (const key of Array.from(lineMap.keys())) {
        if (Math.abs(key - y) <= LINE_TOLERANCE) { lineKey = key; break; }
      }
      if (lineKey === undefined) { lineKey = y; lineMap.set(lineKey, []); }
      lineMap.get(lineKey).push({ x, str: item.str });
    }
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = lineMap.get(y).sort((a, b) => a.x - b.x);
      const lineText = items.map(i => i.str).join("  ");
      if (lineText.trim()) lines.push(lineText);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// Test with Apr 2025 credit card statement
const pdfPath = "/home/ubuntu/upload/TD_AEROPLAN_VISA_INFINITE_1443_Apr_24-2025.pdf";
const buffer = readFileSync(pdfPath);
const uint8 = new Uint8Array(buffer);
const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;

const pageData = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  pageData.push({
    items: content.items.map(item => ({ str: item.str, transform: item.transform })),
  });
}

const pdfText = buildStructuredPdfText(pageData);
const yearMatch = pdfText.match(/20(2[0-9])/)?.[0];
const statementYear = yearMatch ? parseInt(yearMatch) : 2025;

console.log("Detected year:", statementYear);
console.log("Sending to LLM for extraction...\n");

// Call LLM
const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

const systemPrompt = `You are a precise financial data extraction engine. Extract ALL transactions from the bank statement exactly as they appear — do NOT invent, merge, skip, or alter any transaction.

CRITICAL ACCURACY RULES:
1. DATES: The statement year is ${statementYear}. All dates without a year should use ${statementYear}.
   - TD Canada Trust statements show dates as "MMM DD" (e.g. "APR 6" or "MAR 24"). Always add the correct year.
   - Output format: YYYY-MM-DD (e.g. "2025-04-06").

2. AMOUNTS: Copy the exact numeric value from the statement. Never round, never estimate.
   - TD credit card statements: charges are EXPENSES (positive amounts you owe), payments/credits are INCOME (reduce balance).
   - Look for separate debit and credit columns — the column determines the type, not a minus sign.
   - Payments labeled "PREAUTHORIZED PAYMENT" or "PAYMENT - THANK YOU" on credit card = type "transfer".

3. COMPLETENESS: Extract EVERY transaction row. Do not skip any.

4. CATEGORIES (use exactly these names):
   - Income: 保险佣金收入, 工资收入, 投资收益, 退款收入, 其他收入
   - Expense: 餐饮消费, 交通出行, 购物消费, 住房租金, 水电费用, 医疗健康, 教育培训, 通讯费用, 娱乐消费, 保险费用, 税费缴纳, 金融服务, 其他支出
   - Transfer: 账户转账

Return ONLY valid JSON. No markdown, no explanation.`;

const baseUrl = (apiUrl || "https://forge.manus.im").replace(/\/$/, "");
const response = await fetch(`${baseUrl}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Extract all transactions from this PDF bank statement:\n\n${pdfText}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bank_statement_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            transactions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  transactionDate: { type: "string" },
                  amount: { type: "number" },
                  type: { type: "string", enum: ["income", "expense", "transfer"] },
                  description: { type: "string" },
                  counterparty: { type: "string" },
                  reference: { type: "string" },
                  balance: { type: "number" },
                  currency: { type: "string" },
                  aiCategory: { type: "string" },
                  aiConfidence: { type: "number" },
                },
                required: ["transactionDate", "amount", "type", "description", "aiCategory", "aiConfidence"],
                additionalProperties: false,
              },
            },
            periodStart: { type: "string" },
            periodEnd: { type: "string" },
            accountInfo: { type: "string" },
          },
          required: ["transactions", "periodStart", "periodEnd", "accountInfo"],
          additionalProperties: false,
        },
      },
    },
  }),
});

const data = await response.json();
const result = JSON.parse(data.choices[0].message.content);

console.log("=== EXTRACTION RESULT ===");
console.log(`Period: ${result.periodStart} to ${result.periodEnd}`);
console.log(`Account: ${result.accountInfo}`);
console.log(`\nTransactions (${result.transactions.length} total):`);
console.log("Date         | Type     | Amount    | Description");
console.log("-------------|----------|-----------|------------------------------------------");
for (const t of result.transactions) {
  const amt = `CA$${t.amount.toFixed(2)}`.padEnd(10);
  const type = t.type.padEnd(8);
  console.log(`${t.transactionDate} | ${type} | ${amt} | ${t.description}`);
}
