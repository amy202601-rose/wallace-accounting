import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@wallace.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const clearedCookies: string[] = [];
    const user: AuthenticatedUser = {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: (name: string) => clearedCookies.push(name) } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies).toHaveLength(1);
  });
});

describe("auth.me", () => {
  it("returns current user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.openId).toBe("test-user-001");
    expect(user?.name).toBe("Test User");
  });

  it("returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

describe("bankAccounts router", () => {
  it("list requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.bankAccounts.list()).rejects.toThrow();
  });
});

describe("transactions router", () => {
  it("list requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.transactions.list({})).rejects.toThrow();
  });
});

describe("bankAccounts router - stats and cascade delete", () => {
  it("stats requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.bankAccounts.stats({ id: 1 })).rejects.toThrow();
  });

  it("delete requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.bankAccounts.delete({ id: 1 })).rejects.toThrow();
  });
});

describe("transactions.list filter params", () => {
  it("rejects unauthenticated requests with date/amount filters", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.transactions.list({
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
        minAmount: 10,
        maxAmount: 1000,
      })
    ).rejects.toThrow();
  });
});

describe("statements router", () => {
  it("bulkDelete requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.statements.bulkDelete({ ids: [1, 2] })).rejects.toThrow();
  });

  it("bulkTransactionCount requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.statements.bulkTransactionCount({ ids: [1] })).rejects.toThrow();
  });
});

describe("reports router", () => {
  it("summary requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.reports.summary({ startDate: new Date(), endDate: new Date() })
    ).rejects.toThrow();
  });
});

describe("transactions bulk category + export", () => {
  it("bulkUpdateCategory requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.transactions.bulkUpdateCategory({ ids: [1], categoryId: 1 })).rejects.toThrow();
  });

  it("exportCsv requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.transactions.exportCsv({})).rejects.toThrow();
  });
});

describe("statements.checkDuplicate", () => {
  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.statements.checkDuplicate({ bankAccountId: 1, fileName: "test.pdf" })).rejects.toThrow();
  });
});

describe("t4a routes", () => {
  const unauthCtx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };

  it("listRecipients requires authentication", async () => {
    const caller = appRouter.createCaller(unauthCtx);
    await expect(caller.t4a.listRecipients()).rejects.toThrow();
  });

  it("createRecipient requires authentication", async () => {
    const caller = appRouter.createCaller(unauthCtx);
    await expect(
      caller.t4a.createRecipient({ firstName: "John", lastName: "Doe" })
    ).rejects.toThrow();
  });

  it("listRecords requires authentication", async () => {
    const caller = appRouter.createCaller(unauthCtx);
    await expect(caller.t4a.listRecords({})).rejects.toThrow();
  });

  it("createRecord requires authentication", async () => {
    const caller = appRouter.createCaller(unauthCtx);
    await expect(
      caller.t4a.createRecord({
        recipientId: 1,
        taxYear: 2024,
        payerName: "Test Co",
      })
    ).rejects.toThrow();
  });

  it("generatePdf requires authentication", async () => {
    const caller = appRouter.createCaller(unauthCtx);
    await expect(caller.t4a.generatePdf({ id: 1 })).rejects.toThrow();
  });

  it("deleteRecord requires authentication", async () => {
    const caller = appRouter.createCaller(unauthCtx);
    await expect(caller.t4a.deleteRecord({ id: 1 })).rejects.toThrow();
  });
});
