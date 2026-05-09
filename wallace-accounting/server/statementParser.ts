import { invokeLLM } from "./_core/llm";
import Papa from "papaparse";

export interface ExtractedTransaction {
  transactionDate: string; // ISO date string YYYY-MM-DD
  amount: number;          // always positive
  type: "income" | "expense" | "transfer";
  description: string;
  counterparty?: string;
  reference?: string;
  balance?: number;
  currency?: string;
  aiCategory?: string;
  aiConfidence?: number;
}

export interface ParsedStatement {
  transactions: ExtractedTransaction[];
  periodStart?: string;
  periodEnd?: string;
  accountInfo?: string;
}

/**
 * Parse CSV text and extract transactions using LLM
 */
export async function parseCSVStatement(csvText: string): Promise<ParsedStatement> {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const rows = parsed.data as Record<string, string>[];
  // Send all rows (not just 30) for accuracy
  const csvContent = Papa.unparse(rows);

  return extractTransactionsWithLLM(csvContent, "csv");
}

/**
 * Extract transactions from PDF text content using LLM.
 * pdfText should be structured text with positional info preserved.
 */
export async function parsePDFStatement(pdfText: string, statementYear?: number): Promise<ParsedStatement> {
  // No truncation - send full text for accuracy
  return extractTransactionsWithLLM(pdfText, "pdf", statementYear);
}

/**
 * Build a structured text from PDF items preserving column layout.
 * Items are sorted by page then by vertical position (y), then horizontal (x).
 * Items on the same line (similar y) are grouped and tab-separated.
 */
export function buildStructuredPdfText(
  pages: Array<{ items: Array<{ str: string; transform: number[] }> }>
): string {
  const LINE_TOLERANCE = 3; // pixels - items within this y-distance are on the same line
  const lines: string[] = [];

  for (const page of pages) {
    // Group items by approximate y position
    const lineMap = new Map<number, Array<{ x: number; str: string }>>();

    for (const item of page.items) {
      if (!item.str.trim()) continue;
      const x = Math.round(item.transform[4]);
      const y = Math.round(item.transform[5]);

      // Find existing line within tolerance
      let lineKey: number | undefined;
      for (const key of Array.from(lineMap.keys())) {
        if (Math.abs(key - y) <= LINE_TOLERANCE) {
          lineKey = key;
          break;
        }
      }
      if (lineKey === undefined) {
        lineKey = y;
        lineMap.set(lineKey, []);
      }
      lineMap.get(lineKey)!.push({ x, str: item.str });
    }

    // Sort lines by descending y (top of page first in PDF coords)
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      const lineText = items.map((i) => i.str).join("  ");
      if (lineText.trim()) lines.push(lineText);
    }
    lines.push(""); // blank line between pages
  }

  return lines.join("\n");
}

const TRANSACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          transactionDate: {
            type: "string",
            description: "Full date in YYYY-MM-DD format. MUST include the correct year inferred from the statement period.",
          },
          amount: {
            type: "number",
            description: "Absolute positive numeric value. Never negative.",
          },
          type: {
            type: "string",
            enum: ["income", "expense", "transfer"],
            description: "income=money received, expense=money spent/paid, transfer=between own accounts",
          },
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
    periodStart: { type: "string", description: "Statement period start date YYYY-MM-DD" },
    periodEnd: { type: "string", description: "Statement period end date YYYY-MM-DD" },
    accountInfo: { type: "string" },
  },
  required: ["transactions", "periodStart", "periodEnd", "accountInfo"],
  additionalProperties: false,
} as const;

async function extractTransactionsWithLLM(
  content: string,
  fileType: string,
  statementYear?: number
): Promise<ParsedStatement> {
  const yearHint = statementYear
    ? `The statement year is ${statementYear}. All dates without a year should use ${statementYear}.`
    : "Infer the year from the statement period header (e.g. 'Statement Period: MAR 25, 2025 to APR 24, 2025').";

  const systemPrompt = `You are a precise financial data extraction engine. Extract ALL transactions from the bank statement exactly as they appear — do NOT invent, merge, skip, or alter any transaction.

CRITICAL ACCURACY RULES:
1. DATES: ${yearHint}
   - TD Canada Trust statements show dates as "MMM DD" (e.g. "APR 6" or "MAR 24"). Always add the correct year.
   - Output format: YYYY-MM-DD (e.g. "2025-04-06").
   - If a transaction date falls in December but the statement period starts in January, the year may be the previous year — check carefully.

2. AMOUNTS: Copy the exact numeric value from the statement. Never round, never estimate.
   - TD credit card statements: charges are EXPENSES (positive amounts you owe), payments/credits are INCOME (reduce balance).
   - TD chequing statements: deposits/credits are INCOME, withdrawals/debits are EXPENSES.
   - Look for separate debit and credit columns — the column determines the type, not a minus sign.
   - Payments labeled "PREAUTHORIZED PAYMENT" or "PAYMENT - THANK YOU" on credit card = type "transfer" (paying off the card).

3. COMPLETENESS: Extract EVERY transaction row. Do not skip any. Count them carefully.

4. COUNTERPARTY: Use the merchant/payee name exactly as shown. For preauthorized payments, use the payee name.

5. CATEGORIES (use exactly these names - CRA T2125 based):
   - Income: 保险佣金收入, 投资收益, 退款收入, 其他收入
   - Expense (Business Operating): 广告与营销, 专业服务费, 办公用品, 办公费用
   - Expense (Travel & Meals): 餐饮与娱乐, 差旅费
   - Expense (Motor Vehicle): 燃油费, 车辆保险, 车辆维修与保养, 车辆登记与执照, 车辆租赁与折旧
   - Expense (Home Office): 地税, 房屋保险, 公用事业费, 房屋贷款利息, 房租
   - Expense (Financial): 利息与银行费用, 商业保险
   - Expense (Salary): 员工工资与福利, 分包商费用
   - Expense (Capital): 资本支出与折旧
   - Expense (Other): 电话与网络, 教育与培训, 坏账, 其他支出
   - Transfer: 账户转账

Return ONLY valid JSON matching the schema. No markdown, no explanation.`;

  const userPrompt = `Extract all transactions from this ${fileType.toUpperCase()} bank statement:\n\n${content}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "bank_statement_extraction",
        strict: true,
        schema: TRANSACTION_JSON_SCHEMA,
      },
    },
  });

  const raw = response.choices[0]?.message?.content;
  const contentStr = typeof raw === "string" ? raw : "{}";

  try {
    const result = JSON.parse(contentStr);
    const transactions: ExtractedTransaction[] = (result.transactions ?? []).map((t: any) => ({
      transactionDate: t.transactionDate,
      amount: Math.abs(Number(t.amount)), // ensure positive
      type: t.type,
      description: t.description ?? "",
      counterparty: t.counterparty || undefined,
      reference: t.reference || undefined,
      balance: t.balance != null ? Number(t.balance) : undefined,
      currency: t.currency || "CAD",
      aiCategory: t.aiCategory || undefined,
      aiConfidence: t.aiConfidence != null ? Number(t.aiConfidence) : undefined,
    }));

    return {
      transactions,
      periodStart: result.periodStart || undefined,
      periodEnd: result.periodEnd || undefined,
      accountInfo: result.accountInfo || undefined,
    };
  } catch {
    return { transactions: [] };
  }
}

/**
 * Re-classify a batch of transactions using LLM
 */
export async function classifyTransactions(
  txns: Array<{ description: string; counterparty?: string; amount: number; type: string }>
): Promise<Array<{ aiCategory: string; aiConfidence: number }>> {
  const systemPrompt = `You are a financial transaction classifier for a Canadian self-employed/small business accounting system (CRA T2125 based).
Classify each transaction into exactly one of these categories:
- Income: 保险佣金收入, 投资收益, 退款收入, 其他收入
- Expense (Business Operating): 广告与营销, 专业服务费, 办公用品, 办公费用
- Expense (Travel & Meals): 餐饮与娱乐, 差旅费
- Expense (Motor Vehicle): 燃油费, 车辆保险, 车辆维修与保养, 车辆登记与执照, 车辆租赁与折旧
- Expense (Home Office): 地税, 房屋保险, 公用事业费, 房屋贷款利息, 房租
- Expense (Financial): 利息与银行费用, 商业保险
- Expense (Salary): 员工工资与福利, 分包商费用
- Expense (Capital): 资本支出与折旧
- Expense (Other): 电话与网络, 教育与培训, 坏账, 其他支出
- Transfer: 账户转账

Return a JSON array with one object per transaction: [{"aiCategory": "...", "aiConfidence": 0.0-1.0}]
Return ONLY valid JSON array, no other text.`;

  const txnList = txns
    .map((t, i) => `${i + 1}. [${t.type}] ${t.description} | ${t.counterparty ?? ""} | CA$${t.amount}`)
    .join("\n");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Classify these transactions:\n${txnList}` },
    ],
  });

  const rawMsg = response.choices[0]?.message?.content;
  const raw = typeof rawMsg === "string" ? rawMsg : "[]";
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return txns.map(() => ({ aiCategory: "其他支出", aiConfidence: 0.5 }));
  }
}
