import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CreditCard,
  FileText,
  ScanLine,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function formatAmount(amount: string | number | null | undefined) {
  const n = parseFloat(String(amount ?? "0"));
  return "CA$" + new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color: string;
}) {
  return (
    <Card className="stat-card border border-border/60 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
            {trendLabel && (
              <div className="flex items-center gap-1 mt-1">
                {trend === "up" && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />}
                {trend === "down" && <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />}
                <span className={`text-xs font-medium ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
                  {trendLabel}
                </span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PIE_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16"];

export default function Dashboard() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [startDate] = useState(() => new Date(currentYear, currentMonth, 1));
  const [endDate] = useState(() => new Date(currentYear, currentMonth + 1, 0, 23, 59, 59));

  const { data: summary, isLoading: summaryLoading } = trpc.reports.summary.useQuery({ startDate, endDate });
  const { data: monthlyTrend, isLoading: trendLoading } = trpc.reports.monthlyTrend.useQuery({ year: currentYear });
  const { data: categorySummary } = trpc.reports.categorySummary.useQuery({ startDate, endDate });
  const { data: recentTxns, isLoading: txnsLoading } = trpc.reports.recentTransactions.useQuery({ limit: 8 });
  const { data: accounts } = trpc.bankAccounts.list.useQuery();
  const { data: statements } = trpc.statements.list.useQuery({});

  const chartData = useMemo(() => {
    if (!monthlyTrend) return [];
    const map = new Map<number, { income: number; expense: number }>();
    for (let i = 1; i <= 12; i++) map.set(i, { income: 0, expense: 0 });
    for (const row of monthlyTrend) {
      const m = row.month as number;
      const entry = map.get(m) ?? { income: 0, expense: 0 };
      if (row.type === "income") entry.income = parseFloat(String(row.total ?? "0"));
      if (row.type === "expense") entry.expense = parseFloat(String(row.total ?? "0"));
      map.set(m, entry);
    }
    return Array.from(map.entries()).map(([month, data]) => ({
      name: MONTH_NAMES[month - 1],
      收入: data.income,
      支出: data.expense,
    }));
  }, [monthlyTrend]);

  const pieData = useMemo(() => {
    if (!categorySummary) return [];
    return categorySummary
      .filter((c) => c.type === "expense" && parseFloat(String(c.total ?? "0")) > 0)
      .map((c) => ({
        name: c.category?.name ?? "未分类",
        value: parseFloat(String(c.total ?? "0")),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [categorySummary]);

  const totalBalance = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum, a) => sum + parseFloat(String((a as any).computedBalance ?? a.balance ?? "0")), 0);
  }, [accounts]);

  const [, navigate] = useLocation();

  return (
    <div className="space-y-6 pb-8">
      {/* Receipt Upload Banner */}
      <div
        onClick={() => navigate("/receipts")}
        className="flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-4 cursor-pointer shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-purple-700 transition-all select-none"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/20 rounded-lg">
            <ScanLine className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">上传小票</p>
            <p className="text-xs text-white/80">拍照或选图，AI 自动识别并入账</p>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-white text-indigo-600 hover:bg-white/90 font-semibold shrink-0 shadow-sm"
          onClick={(e) => { e.stopPropagation(); navigate("/receipts"); }}
        >
          立即上传
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">财务概览</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentYear}年{currentMonth + 1}月 · 华莱士金融服务
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-medium px-3 py-1.5 border-border">
          {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
        </Badge>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : (
          <>
            <StatCard
              title="账户总余额"
              value={formatAmount(totalBalance)}
              icon={Wallet}
              color="bg-indigo-600"
              trend="neutral"
              trendLabel={`${accounts?.length ?? 0} 个账户`}
            />
            <StatCard
              title="本月收入"
              value={formatAmount(summary?.totalIncome)}
              icon={TrendingUp}
              color="bg-emerald-500"
              trend="up"
              trendLabel="本月累计"
            />
            <StatCard
              title="本月支出"
              value={formatAmount(summary?.totalExpense)}
              icon={ArrowDownRight}
              color="bg-rose-500"
              trend="down"
              trendLabel="本月累计"
            />
            <StatCard
              title="净收支"
              value={formatAmount(summary?.netAmount)}
              icon={CreditCard}
              color={parseFloat(String(summary?.netAmount ?? "0")) >= 0 ? "bg-blue-600" : "bg-orange-500"}
              trend={parseFloat(String(summary?.netAmount ?? "0")) >= 0 ? "up" : "down"}
              trendLabel="收入 - 支出"
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Trend Chart */}
        <Card className="lg:col-span-2 border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">全年收支趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [formatAmount(value), ""]}
                  />
                  <Area type="monotone" dataKey="收入" stroke="#10B981" strokeWidth={2} fill="url(#incomeGrad)" />
                  <Area type="monotone" dataKey="支出" stroke="#EF4444" strokeWidth={2} fill="url(#expenseGrad)" />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expense Pie Chart */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">本月支出分类</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">暂无支出数据</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [formatAmount(value), ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2 border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">最近交易</CardTitle>
              <a href="/transactions" className="text-xs text-primary hover:underline font-medium">查看全部</a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {txnsLoading ? (
              <div className="space-y-2 px-6 pb-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentTxns?.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">暂无交易记录，请先上传银行账单</div>
            ) : (
              <div className="divide-y divide-border/50">
                {recentTxns?.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${txn.type === "income" ? "bg-emerald-100 text-emerald-600" : txn.type === "expense" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                        {txn.type === "income" ? <ArrowUpRight className="h-4 w-4" /> : txn.type === "expense" ? <ArrowDownRight className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{txn.description || "无描述"}</p>
                        <p className="text-xs text-muted-foreground">
                          {txn.counterparty && `${txn.counterparty} · `}
                          {new Date(txn.transactionDate).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ml-4 ${txn.type === "income" ? "text-emerald-600" : txn.type === "expense" ? "text-red-500" : "text-blue-600"}`}>
                      {txn.type === "income" ? "+" : txn.type === "expense" ? "-" : ""}
                      {formatAmount(txn.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-4">
          <Card className="border border-border/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">账户概览</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {accounts?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">暂无银行账户</p>
              ) : (
                accounts?.slice(0, 4).map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: acc.color ?? "#4F46E5" }} />
                      <span className="text-sm text-foreground truncate">{acc.accountName}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground shrink-0 ml-2">
                      {formatAmount((acc as any).computedBalance ?? acc.balance)}
                    </span>
                  </div>
                ))
              )}
              {(accounts?.length ?? 0) > 4 && (
                <p className="text-xs text-muted-foreground text-center">+{(accounts?.length ?? 0) - 4} 个账户</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">银行账户</p>
                  <p className="text-lg font-bold text-foreground">{accounts?.length ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">已处理账单</p>
                  <p className="text-lg font-bold text-foreground">
                    {statements?.filter((s) => s.status === "completed").length ?? 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
