import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBankAccountStats,
  deleteBankAccountCascade,
  getStatements,
  getStatementById,
  createStatement,
  updateStatement,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  deleteTransactionsBulk,
  getTransactionSummary,
  getCategorySummary,
  getMonthlyTrend,
  initDefaultCategories,
  createTransactionsBatch,
  getAvailableYears,
  getCounterparties,
  getAnnualReport,
  deleteStatement,
  countTransactionsByStatement,
  countTransactionsByStatements,
  deleteStatementsBulk,
  bulkUpdateTransactionCategory,
  getTransactionsForExport,
  checkDuplicateStatement,
  getT4ARecipients,
  createT4ARecipient,
  updateT4ARecipient,
  deleteT4ARecipient,
  getT4ARecords,
  getT4ARecordById,
  createT4ARecord,
  updateT4ARecord,
  deleteT4ARecord,
  createReceipt,
  getReceipts,
  getReceiptById,
  updateReceipt,
  deleteReceipt,
} from "./db";
import { storagePut } from "./storage";
import { parseCSVStatement, parsePDFStatement, buildStructuredPdfText } from "./statementParser";
import { nanoid } from "nanoid";
import { generateT4APDF } from "./t4aPdfGenerator";
import { invokeLLM } from "./_core/llm";

// ---- Bank Accounts Router ----
const bankAccountsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getBankAccounts(ctx.user.id)),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) =>
    getBankAccountById(input.id, ctx.user.id)
  ),

  create: protectedProcedure
    .input(
      z.object({
        bankName: z.string().min(1),
        accountName: z.string().min(1),
        accountNumber: z.string().optional(),
        currency: z.string().default("CNY"),
        accountType: z.enum(["checking", "savings", "credit", "investment", "other"]).default("checking"),
        balance: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createBankAccount({ ...input, userId: ctx.user.id });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        bankName: z.string().min(1).optional(),
        accountName: z.string().min(1).optional(),
        accountNumber: z.string().optional(),
        currency: z.string().optional(),
        accountType: z.enum(["checking", "savings", "credit", "investment", "other"]).optional(),
        balance: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateBankAccount(id, ctx.user.id, data);
      return { success: true };
    }),

  stats: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return getBankAccountStats(input.id, ctx.user.id);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const result = await deleteBankAccountCascade(input.id, ctx.user.id);
      return { success: true, ...result };
    }),
});

// ---- Statements Router ----
const statementsRouter = router({
  list: protectedProcedure
    .input(z.object({ bankAccountId: z.number().optional() }))
    .query(({ ctx, input }) => getStatements(ctx.user.id, input.bankAccountId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getStatementById(input.id, ctx.user.id)),

  // Upload statement file (base64 encoded)
  upload: protectedProcedure
    .input(
      z.object({
        bankAccountId: z.number(),
        fileName: z.string(),
        fileType: z.enum(["pdf", "csv"]),
        fileSize: z.number(),
        fileData: z.string(), // base64 encoded
      })
    )
    .mutation(async ({ ctx, input }) => {
      const suffix = nanoid(8);
      const fileKey = `statements/${ctx.user.id}/${suffix}-${input.fileName}`;
      const buffer = Buffer.from(input.fileData, "base64");
      const mimeType = input.fileType === "pdf" ? "application/pdf" : "text/csv";
      const { url } = await storagePut(fileKey, buffer, mimeType);

      const statementId = await createStatement({
        userId: ctx.user.id,
        bankAccountId: input.bankAccountId,
        fileName: input.fileName,
        fileKey,
        fileUrl: url,
        fileType: input.fileType,
        fileSize: input.fileSize,
        status: "pending",
      });

      return { id: statementId, fileUrl: url };
    }),

  // Process statement with AI
  process: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const statement = await getStatementById(input.id, ctx.user.id);
      if (!statement) throw new Error("Statement not found");

      await updateStatement(input.id, { status: "processing" });

      try {
        // Fetch file content
        const response = await fetch(statement.fileUrl);
        if (!response.ok) throw new Error("Failed to fetch statement file");

        let parsed;
        if (statement.fileType === "csv") {
          const text = await response.text();
          parsed = await parseCSVStatement(text);
        } else {
          // PDF: use pdfjs-dist to extract text with positional info preserved
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
          const buffer = Buffer.from(await response.arrayBuffer());
          const uint8 = new Uint8Array(buffer);
          const doc = await (pdfjsLib as any).getDocument({ data: uint8 }).promise;

          // Collect all pages with positional data
          const pageData: Array<{ items: Array<{ str: string; transform: number[] }> }> = [];
          for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            pageData.push({
              items: (content.items as any[]).map((item: any) => ({
                str: item.str,
                transform: item.transform,
              })),
            });
          }

          // Build structured text preserving column layout
          const pdfText = buildStructuredPdfText(pageData);

          // Extract year from statement period for accurate date parsing
          const yearMatch = pdfText.match(/20(2[0-9])/)?.[0];
          const statementYear = yearMatch ? parseInt(yearMatch) : new Date().getFullYear();

          parsed = await parsePDFStatement(pdfText, statementYear);
        }

        // Ensure default categories exist
        await initDefaultCategories(ctx.user.id);
        const cats = await getCategories(ctx.user.id);
        const catMap = new Map(cats.map((c) => [c.name, c.id]));

        // Save transactions
        const txnData = parsed.transactions.map((t) => ({
          userId: ctx.user.id,
          bankAccountId: statement.bankAccountId,
          statementId: input.id,
          categoryId: catMap.get(t.aiCategory ?? "") ?? null,
          transactionDate: new Date(t.transactionDate),
          amount: String(t.amount),
          type: t.type,
          description: t.description,
          counterparty: t.counterparty ?? null,
          reference: t.reference ?? null,
          balance: t.balance != null ? String(t.balance) : null,
          currency: t.currency ?? "CNY",
          aiCategory: t.aiCategory ?? null,
          aiConfidence: t.aiConfidence != null ? String(t.aiConfidence) : null,
          isManuallyEdited: 0,
        }));

        await createTransactionsBatch(txnData);

        await updateStatement(input.id, {
          status: "completed",
          transactionCount: parsed.transactions.length,
          periodStart: parsed.periodStart ? new Date(parsed.periodStart) : undefined,
          periodEnd: parsed.periodEnd ? new Date(parsed.periodEnd) : undefined,
        });

        return { success: true, transactionCount: parsed.transactions.length };
      } catch (err: any) {
        await updateStatement(input.id, { status: "failed", errorMessage: err.message });
        throw err;
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const deletedTxCount = await deleteStatement(input.id, ctx.user.id);
      return { success: true, deletedTransactionCount: deletedTxCount };
    }),

  transactionCount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const count = await countTransactionsByStatement(input.id, ctx.user.id);
      return { count };
    }),

  bulkTransactionCount: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .query(async ({ ctx, input }) => {
      const count = await countTransactionsByStatements(input.ids, ctx.user.id);
      return { count };
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await deleteStatementsBulk(input.ids, ctx.user.id);
      return { success: true, ...result };
    }),

  checkDuplicate: protectedProcedure
    .input(z.object({ bankAccountId: z.number(), fileName: z.string() }))
    .query(async ({ ctx, input }) => {
      return checkDuplicateStatement(ctx.user.id, input.bankAccountId, input.fileName);
    }),
});

// ---- Categories Router ----
const categoriesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await initDefaultCategories(ctx.user.id);
    return getCategories(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(["income", "expense", "transfer", "tax", "investment", "other"]),
        color: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createCategory({ ...input, userId: ctx.user.id });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        type: z.enum(["income", "expense", "transfer", "tax", "investment", "other"]).optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateCategory(id, ctx.user.id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCategory(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ---- Transactions Router ----
const transactionsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        bankAccountId: z.number().optional(),
        categoryId: z.number().optional(),
        uncategorized: z.boolean().optional(),
        counterparty: z.string().optional(),
        type: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        minAmount: z.number().optional(),
        maxAmount: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
    )
    .query(({ ctx, input }) => getTransactions(ctx.user.id, input)),

  counterparties: protectedProcedure
    .input(z.object({ bankAccountId: z.number().optional() }))
    .query(({ ctx, input }) => getCounterparties(ctx.user.id, input.bankAccountId)),

  availableYears: protectedProcedure
    .input(z.object({ bankAccountId: z.number().optional() }))
    .query(({ ctx, input }) => getAvailableYears(ctx.user.id, input.bankAccountId)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getTransactionById(input.id, ctx.user.id)),

  create: protectedProcedure
    .input(
      z.object({
        bankAccountId: z.number(),
        categoryId: z.number().optional(),
        transactionDate: z.date(),
        amount: z.string(),
        type: z.enum(["income", "expense", "transfer"]),
        description: z.string().optional(),
        counterparty: z.string().optional(),
        reference: z.string().optional(),
        balance: z.string().optional(),
        currency: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createTransaction({ ...input, userId: ctx.user.id });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        categoryId: z.number().optional().nullable(),
        transactionDate: z.date().optional(),
        amount: z.string().optional(),
        type: z.enum(["income", "expense", "transfer"]).optional(),
        description: z.string().optional(),
        counterparty: z.string().optional(),
        reference: z.string().optional(),
        notes: z.string().optional(),
        isManuallyEdited: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updateTransaction(id, ctx.user.id, { ...data, isManuallyEdited: 1 });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteTransaction(input.id, ctx.user.id);
      return { success: true };
    }),
  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const count = await deleteTransactionsBulk(input.ids, ctx.user.id);
      return { success: true, deletedCount: count };
    }),

  bulkUpdateCategory: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1),
      categoryId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const count = await bulkUpdateTransactionCategory(input.ids, input.categoryId, ctx.user.id);
      return { success: true, updatedCount: count };
    }),

  exportCsv: protectedProcedure
    .input(z.object({
      bankAccountId: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const rows = await getTransactionsForExport(ctx.user.id, input);
      const cats = await getCategories(ctx.user.id);
      const accounts = await getBankAccounts(ctx.user.id);
      const catMap = new Map(cats.map((c) => [c.id, c.name]));
      const acctMap = new Map(accounts.map((a) => [a.id, a.accountName]));
      const header = ["ID", "日期", "类型", "金额", "对手方", "描述", "分类", "账户", "备注"];
      const csvRows = rows.map((r) => [
        r.id,
        r.transactionDate ? new Date(r.transactionDate).toISOString().split("T")[0] : "",
        r.type,
        r.amount,
        r.counterparty ?? "",
        r.description ?? "",
        r.categoryId ? (catMap.get(r.categoryId) ?? "") : "",
        acctMap.get(r.bankAccountId) ?? "",
        r.notes ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
      return { csv: [header.join(","), ...csvRows].join("\n") };
    }),
});

// ---- Reports Router ----
const reportsRouter = router({
  summary: protectedProcedure
    .input(z.object({ startDate: z.date(), endDate: z.date() }))
    .query(({ ctx, input }) => getTransactionSummary(ctx.user.id, input.startDate, input.endDate)),

  categorySummary: protectedProcedure
    .input(z.object({ startDate: z.date(), endDate: z.date() }))
    .query(async ({ ctx, input }) => {
      const summary = await getCategorySummary(ctx.user.id, input.startDate, input.endDate);
      const cats = await getCategories(ctx.user.id);
      const catMap = new Map(cats.map((c) => [c.id, c]));
      return summary.map((s) => ({
        ...s,
        category: s.categoryId ? catMap.get(s.categoryId) : null,
      }));
    }),

  monthlyTrend: protectedProcedure
    .input(z.object({ year: z.number() }))
    .query(({ ctx, input }) => getMonthlyTrend(ctx.user.id, input.year)),

  annualReport: protectedProcedure
    .input(z.object({ year: z.number(), bankAccountId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const report = await getAnnualReport(ctx.user.id, input.year, input.bankAccountId);
      const cats = await getCategories(ctx.user.id);
      const accounts = await getBankAccounts(ctx.user.id);
      const catMap = new Map(cats.map((c) => [c.id, c]));
      const acctMap = new Map(accounts.map((a) => [a.id, a]));
      return {
        ...report,
        categorySummary: report.categorySummary.map((s) => ({
          ...s,
          category: s.categoryId ? catMap.get(s.categoryId) ?? null : null,
        })),
        accountSummary: report.accountSummary.map((s) => ({
          ...s,
          account: acctMap.get(s.bankAccountId) ?? null,
        })),
      };
    }),

  recentTransactions: protectedProcedure
    .input(z.object({ limit: z.number().default(10) }))
    .query(({ ctx, input }) => getTransactions(ctx.user.id, { limit: input.limit })),
});

// ---- T4A Router ----
const t4aRouter = router({
  // Recipients
  listRecipients: protectedProcedure.query(({ ctx }) =>
    getT4ARecipients(ctx.user.id)
  ),

  createRecipient: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        sinOrBn: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        province: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().default("CAN"),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      createT4ARecipient({ ...input, userId: ctx.user.id })
    ),

  updateRecipient: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        sinOrBn: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        province: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateT4ARecipient(id, ctx.user.id, data);
    }),

  deleteRecipient: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteT4ARecipient(input.id, ctx.user.id)),

  // Records
  listRecords: protectedProcedure
    .input(z.object({ taxYear: z.number().optional() }))
    .query(({ ctx, input }) => getT4ARecords(ctx.user.id, input.taxYear)),

  getRecord: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getT4ARecordById(input.id, ctx.user.id)),

  createRecord: protectedProcedure
    .input(
      z.object({
        recipientId: z.number(),
        taxYear: z.number().int().min(2000).max(2100),
        payerName: z.string().min(1),
        payerBn: z.string().optional(),
        payerAddress: z.string().optional(),
        box016: z.string().default("0.00"),
        box020: z.string().default("0.00"),
        box022: z.string().default("0.00"),
        box024: z.string().default("0.00"),
        box028: z.string().default("0.00"),
        box048: z.string().default("0.00"),
        box105: z.string().default("0.00"),
        status: z.enum(["draft", "final"]).default("draft"),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      createT4ARecord({ ...input, userId: ctx.user.id })
    ),

  updateRecord: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        taxYear: z.number().int().min(2000).max(2100).optional(),
        payerName: z.string().min(1).optional(),
        payerBn: z.string().optional(),
        payerAddress: z.string().optional(),
        box016: z.string().optional(),
        box020: z.string().optional(),
        box022: z.string().optional(),
        box024: z.string().optional(),
        box028: z.string().optional(),
        box048: z.string().optional(),
        box105: z.string().optional(),
        status: z.enum(["draft", "final"]).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateT4ARecord(id, ctx.user.id, data);
    }),

  deleteRecord: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteT4ARecord(input.id, ctx.user.id)),

  generatePdf: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const row = await getT4ARecordById(input.id, ctx.user.id);
      if (!row) throw new Error("T4A record not found");
      const { record, recipient } = row;
      if (!recipient) throw new Error("Recipient not found");

      const pdfBuffer = await generateT4APDF({
        taxYear: record.taxYear,
        payerName: record.payerName,
        payerBn: record.payerBn,
        payerAddress: record.payerAddress,
        recipientFirstName: recipient.firstName,
        recipientLastName: recipient.lastName,
        recipientSinOrBn: recipient.sinOrBn,
        recipientAddress: recipient.address,
        recipientCity: recipient.city,
        recipientProvince: recipient.province,
        recipientPostalCode: recipient.postalCode,
        box016: record.box016,
        box020: record.box020,
        box022: record.box022,
        box024: record.box024,
        box028: record.box028,
        box048: record.box048,
        box105: record.box105,
      });

      // Upload to S3 and return URL
      const fileKey = `t4a/${ctx.user.id}/${record.taxYear}-${recipient.lastName}-${recipient.firstName}-${nanoid(6)}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");
      return { url, fileName: `T4A_${record.taxYear}_${recipient.lastName}_${recipient.firstName}.pdf` };
    }),
});

// ---- Receipts Router ----
const receiptsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getReceipts(ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ ctx, input }) => getReceiptById(input.id, ctx.user.id)),

  // Step 1: Upload image to S3, run AI OCR, save receipt record
  upload: protectedProcedure
    .input(
      z.object({
        imageBase64: z.string(), // base64 encoded image
        mimeType: z.string().default("image/jpeg"),
        bankAccountId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Decode base64 and upload to S3
      const buffer = Buffer.from(input.imageBase64, "base64");
      const fileKey = `receipts/${ctx.user.id}/${nanoid(12)}.jpg`;
      const { url: imageUrl } = await storagePut(fileKey, buffer, input.mimeType);

      // 2. Use AI vision to extract receipt info
      let merchantName: string | null = null;
      let transactionDate: Date | null = null;
      let amount: string | null = null;
      let currency = "CAD";
      let category: string | null = null;
      let description: string | null = null;
      let rawText: string | null = null;
      let aiConfidence = "80";

      try {
        const aiResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a receipt OCR assistant. Extract structured data from receipt images.
Return JSON with these fields:
- merchantName: string (store/restaurant name)
- date: string (YYYY-MM-DD format, null if not found)
- amount: string (total amount as decimal string, e.g. "25.99", null if not found)
- currency: string (3-letter code, default "CAD")
- category: string (one of: 餐饮与娱乐|办公用品|广告与营销|差旅费|车辆维修与保养|燃油费|専业服务费|利息与银行费用|电话与网络|教育与培训|其他支出)
- description: string (brief description of purchase)
- rawText: string (all text found on receipt)
- confidence: number (0-100, how confident you are in the extraction)
If a field cannot be determined, use null.`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "请识别这张小票并返回 JSON。" },
                { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "receipt_data",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  merchantName: { type: ["string", "null"] },
                  date: { type: ["string", "null"] },
                  amount: { type: ["string", "null"] },
                  currency: { type: "string" },
                  category: { type: ["string", "null"] },
                  description: { type: ["string", "null"] },
                  rawText: { type: ["string", "null"] },
                  confidence: { type: "number" },
                },
                required: ["merchantName", "date", "amount", "currency", "category", "description", "rawText", "confidence"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = aiResult.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        merchantName = parsed.merchantName;
        if (parsed.date) {
          const d = new Date(parsed.date);
          if (!isNaN(d.getTime())) transactionDate = d;
        }
        amount = parsed.amount;
        currency = parsed.currency || "CAD";
        category = parsed.category;
        description = parsed.description;
        rawText = parsed.rawText;
        aiConfidence = String(parsed.confidence ?? 80);
      } catch (e) {
        // AI failed, still save the image
        console.error("Receipt AI OCR failed:", e);
      }

      // 3. Save receipt record
      const id = await createReceipt({
        userId: ctx.user.id,
        imageKey: fileKey,
        imageUrl,
        merchantName,
        transactionDate,
        amount,
        currency,
        category,
        description,
        rawText,
        aiConfidence,
        bankAccountId: input.bankAccountId ?? null,
        status: "pending",
      });

      const receipt = await getReceiptById(id, ctx.user.id);
      return receipt;
    }),

  // Step 2: Confirm receipt and create transaction
  confirm: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        merchantName: z.string().optional(),
        transactionDate: z.string(), // ISO date string
        amount: z.string(),
        currency: z.string().default("CAD"),
        category: z.string().optional(),
        description: z.string().optional(),
        bankAccountId: z.number(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create transaction record
      const categories = await import("./db").then(m => m.getCategories);
      const userCategories = await categories(ctx.user.id);
      const matchedCategory = userCategories.find(
        c => c.name === input.category
      );

      const txId = await createTransaction({
        userId: ctx.user.id,
        bankAccountId: input.bankAccountId,
        transactionDate: new Date(input.transactionDate),
        amount: input.amount,
        type: "expense",
        description: input.description ?? input.merchantName ?? "小票消费",
        counterparty: input.merchantName ?? undefined,
        currency: input.currency,
        categoryId: matchedCategory?.id ?? undefined,
        notes: input.notes,
        isManuallyEdited: 1,
      });

      // Update receipt status
      await updateReceipt(input.id, ctx.user.id, {
        status: "confirmed",
        transactionId: txId,
        bankAccountId: input.bankAccountId,
        merchantName: input.merchantName,
        transactionDate: new Date(input.transactionDate),
        amount: input.amount,
        currency: input.currency,
        category: input.category,
        description: input.description,
        notes: input.notes,
      });

      return { transactionId: txId };
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await updateReceipt(input.id, ctx.user.id, { status: "rejected" });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteReceipt(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ---- Main App Router ----
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  bankAccounts: bankAccountsRouter,
  statements: statementsRouter,
  categories: categoriesRouter,
  transactions: transactionsRouter,
  reports: reportsRouter,
  t4a: t4aRouter,
  receipts: receiptsRouter,
});

export type AppRouter = typeof appRouter;
