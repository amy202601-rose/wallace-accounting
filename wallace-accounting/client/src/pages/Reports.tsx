import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Download, FileSpreadsheet, TrendingDown, TrendingUp, Wallet, Calendar, Building2, FileText, Printer } from "lucide-react";

const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const PIE_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16", "#F97316", "#14B8A6", "#6366F1", "#DC2626", "#2563EB"];

function fmtAmount(n: number) {
  return "CA$" + new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatAmount(amount: string | number | null | undefined) {
  const n = parseFloat(String(amount ?? "0"));
  return "CA$" + new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatAmountShort(n: number) {
  if (Math.abs(n) >= 10000) return `CA$${(n / 1000).toFixed(0)}K`;
  return `CA$${n.toFixed(0)}`;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i);

export default function Reports() {
  const [activeTab, setActiveTab] = useState("annual");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [annualAccount, setAnnualAccount] = useState<string>("");

  const monthStart = useMemo(() => new Date(selectedYear, selectedMonth - 1, 1), [selectedYear, selectedMonth]);
  const monthEnd = useMemo(() => new Date(selectedYear, selectedMonth, 0, 23, 59, 59), [selectedYear, selectedMonth]);
  const yearStart = useMemo(() => new Date(selectedYear, 0, 1), [selectedYear]);
  const yearEnd = useMemo(() => new Date(selectedYear, 11, 31, 23, 59, 59), [selectedYear]);

  const { data: accounts } = trpc.bankAccounts.list.useQuery();

  // Annual report data
  const { data: annualReport, isLoading: annualLoading } = trpc.reports.annualReport.useQuery({
    year: selectedYear,
    bankAccountId: annualAccount ? parseInt(annualAccount) : undefined,
  });

  const annualMonthlyData = useMemo(() => {
    if (!annualReport) return [];
    return annualReport.monthly.map((m) => ({
      name: MONTH_NAMES[m.month - 1],
      收入: m.income,
      支出: m.expense,
      净收支: m.net,
    }));
  }, [annualReport]);

  const annualExpensePie = useMemo(() => {
    if (!annualReport) return [];
    return annualReport.categorySummary
      .filter((s) => s.type === "expense" && parseFloat(s.total ?? "0") > 0)
      .slice(0, 10)
      .map((s) => ({ name: s.category?.name ?? "未分类", value: parseFloat(s.total ?? "0") }));
  }, [annualReport]);

  const annualIncomePie = useMemo(() => {
    if (!annualReport) return [];
    return annualReport.categorySummary
      .filter((s) => s.type === "income" && parseFloat(s.total ?? "0") > 0)
      .map((s) => ({ name: s.category?.name ?? "未分类", value: parseFloat(s.total ?? "0") }));
  }, [annualReport]);

  const annualAccountSummary = useMemo(() => {
    if (!annualReport) return [];
    const map = new Map<number, { account: any; income: number; expense: number }>();
    for (const s of annualReport.accountSummary) {
      if (!map.has(s.bankAccountId)) map.set(s.bankAccountId, { account: s.account, income: 0, expense: 0 });
      const e = map.get(s.bankAccountId)!;
      if (s.type === "income") e.income += parseFloat(s.total ?? "0");
      else if (s.type === "expense") e.expense += parseFloat(s.total ?? "0");
    }
    return Array.from(map.values());
  }, [annualReport]);

  const annualCatExpense = useMemo(() => {
    if (!annualReport) return [];
    return annualReport.categorySummary
      .filter((s) => s.type === "expense")
      .map((s) => ({ name: s.category?.name ?? "未分类", color: s.category?.color ?? "#9CA3AF", total: parseFloat(s.total ?? "0"), count: Number(s.count) }))
      .sort((a, b) => b.total - a.total);
  }, [annualReport]);

  const annualCatIncome = useMemo(() => {
    if (!annualReport) return [];
    return annualReport.categorySummary
      .filter((s) => s.type === "income")
      .map((s) => ({ name: s.category?.name ?? "未分类", color: s.category?.color ?? "#10B981", total: parseFloat(s.total ?? "0"), count: Number(s.count) }))
      .sort((a, b) => b.total - a.total);
  }, [annualReport]);

  function exportAnnualCSV() {
    if (!annualReport) return;
    const rows: string[][] = [];
    rows.push([`华莱士金融服务 - ${selectedYear}年度财务报表`]);
    rows.push([`账户：${annualAccount ? accounts?.find((a) => a.id === parseInt(annualAccount))?.accountName ?? "" : "全部账户"}`]);
    rows.push([`生成时间：${new Date().toLocaleString("zh-CN")}`]);
    rows.push([]);
    rows.push(["=== 年度汇总 ==="]);
    rows.push(["总收入", annualReport.totals.income.toFixed(2)]);
    rows.push(["总支出", annualReport.totals.expense.toFixed(2)]);
    rows.push(["净收支", annualReport.totals.net.toFixed(2)]);
    rows.push([]);
    rows.push(["=== 月度明细 ==="]);
    rows.push(["月份", "收入", "支出", "净收支", "交易笔数"]);
    for (const m of annualReport.monthly) {
      rows.push([`${selectedYear}年${m.month}月`, m.income.toFixed(2), m.expense.toFixed(2), m.net.toFixed(2), String(m.count)]);
    }
    rows.push([]);
    rows.push(["=== 支出分类 ==="]);
    rows.push(["分类", "金额", "笔数", "占比"]);
    for (const c of annualCatExpense) {
      const pct = annualReport.totals.expense > 0 ? ((c.total / annualReport.totals.expense) * 100).toFixed(1) + "%" : "—";
      rows.push([c.name, c.total.toFixed(2), String(c.count), pct]);
    }
    rows.push([]);
    rows.push(["=== 收入分类 ==="]);
    rows.push(["分类", "金额", "笔数", "占比"]);
    for (const c of annualCatIncome) {
      const pct = annualReport.totals.income > 0 ? ((c.total / annualReport.totals.income) * 100).toFixed(1) + "%" : "—";
      rows.push([c.name, c.total.toFixed(2), String(c.count), pct]);
    }
    if (annualAccountSummary.length > 1) {
      rows.push([]);
      rows.push(["=== 账户汇总 ==="]);
      rows.push(["账户", "收入", "支出", "净收支"]);
      for (const a of annualAccountSummary) {
        rows.push([a.account?.accountName ?? "未知", a.income.toFixed(2), a.expense.toFixed(2), (a.income - a.expense).toFixed(2)]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `华莱士金融服务_${selectedYear}年度财务报表.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("年度报表 CSV 已导出");
  }

  function printAnnualReport() {
    window.print();
  }

  const { data: monthSummary, isLoading: monthLoading } = trpc.reports.summary.useQuery({ startDate: monthStart, endDate: monthEnd });
  const { data: yearSummary } = trpc.reports.summary.useQuery({ startDate: yearStart, endDate: yearEnd });
  const { data: monthCatSummary } = trpc.reports.categorySummary.useQuery({ startDate: monthStart, endDate: monthEnd });
  const { data: monthlyTrend } = trpc.reports.monthlyTrend.useQuery({ year: selectedYear });
  const { data: transactions } = trpc.transactions.list.useQuery({ startDate: monthStart, endDate: monthEnd, limit: 1000 });
  const { data: categories } = trpc.categories.list.useQuery();

  const trendData = useMemo(() => {
    if (!monthlyTrend) return [];
    const map = new Map<number, { income: number; expense: number; net: number }>();
    for (let i = 1; i <= 12; i++) map.set(i, { income: 0, expense: 0, net: 0 });
    for (const row of monthlyTrend) {
      const m = row.month as number;
      const entry = map.get(m) ?? { income: 0, expense: 0, net: 0 };
      if (row.type === "income") entry.income = parseFloat(String(row.total ?? "0"));
      if (row.type === "expense") entry.expense = parseFloat(String(row.total ?? "0"));
      entry.net = entry.income - entry.expense;
      map.set(m, entry);
    }
    return Array.from(map.entries()).map(([month, data]) => ({
      name: MONTH_NAMES[month - 1],
      收入: data.income,
      支出: data.expense,
      净收支: data.net,
    }));
  }, [monthlyTrend]);

  const catMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const expensePieData = useMemo(() => {
    if (!monthCatSummary) return [];
    return monthCatSummary
      .filter((c) => c.type === "expense" && parseFloat(String(c.total ?? "0")) > 0)
      .map((c) => ({ name: c.category?.name ?? "未分类", value: parseFloat(String(c.total ?? "0")) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [monthCatSummary]);

  const incomePieData = useMemo(() => {
    if (!monthCatSummary) return [];
    return monthCatSummary
      .filter((c) => c.type === "income" && parseFloat(String(c.total ?? "0")) > 0)
      .map((c) => ({ name: c.category?.name ?? "未分类", value: parseFloat(String(c.total ?? "0")) }))
      .sort((a, b) => b.value - a.value);
  }, [monthCatSummary]);

  // Export to CSV
  function exportCSV() {
    if (!transactions || transactions.length === 0) {
      toast.error("当前月份暂无交易数据");
      return;
    }
    const headers = ["日期", "类型", "金额", "描述", "对手方", "分类", "参考号", "备注"];
    const rows = transactions.map((t) => [
      new Date(t.transactionDate).toLocaleDateString("zh-CN"),
      t.type === "income" ? "收入" : t.type === "expense" ? "支出" : "转账",
      parseFloat(String(t.amount)).toFixed(2),
      t.description ?? "",
      t.counterparty ?? "",
      t.categoryId ? (catMap.get(t.categoryId)?.name ?? t.aiCategory ?? "") : (t.aiCategory ?? ""),
      t.reference ?? "",
      t.notes ?? "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `华莱士金融_${selectedYear}年${selectedMonth}月_交易记录.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 文件已导出");
  }

  // Export report as HTML then print to PDF
  function exportPDF() {
    if (!monthSummary) return;
    const income = parseFloat(String(monthSummary.totalIncome));
    const expense = parseFloat(String(monthSummary.totalExpense));
    const net = parseFloat(String(monthSummary.netAmount));

    const catRows = (monthCatSummary ?? [])
      .filter((c) => parseFloat(String(c.total ?? "0")) > 0)
      .sort((a, b) => parseFloat(String(b.total ?? "0")) - parseFloat(String(a.total ?? "0")))
      .map((c) => `<tr>
        <td>${c.category?.name ?? c.type ?? "未分类"}</td>
        <td>${c.type === "income" ? "收入" : c.type === "expense" ? "支出" : "转账"}</td>
        <td style="text-align:right;font-weight:600;color:${c.type === "income" ? "#059669" : "#DC2626"}">${formatAmount(c.total)}</td>
      </tr>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>华莱士金融 - ${selectedYear}年${selectedMonth}月财务报表</title>
<style>
  body { font-family: "Microsoft YaHei", sans-serif; padding: 40px; color: #1a1a2e; }
  h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
  .stat { background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; }
  .stat .label { font-size: 12px; color: #64748b; }
  .stat .value { font-size: 22px; font-weight: 700; margin-top: 4px; }
  .income { color: #059669; }
  .expense { color: #DC2626; }
  .net { color: #1e3a5f; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #1e3a5f; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  tr:hover td { background: #f8fafc; }
  .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 11px; }
</style>
</head>
<body>
<h1>华莱士金融服务公司</h1>
<h2 style="color:#64748b;font-size:16px;margin-top:-10px">${selectedYear}年${selectedMonth}月财务报表</h2>
<div class="summary">
  <div class="stat"><div class="label">本月收入</div><div class="value income">${formatAmount(income)}</div></div>
  <div class="stat"><div class="label">本月支出</div><div class="value expense">${formatAmount(expense)}</div></div>
  <div class="stat"><div class="label">净收支</div><div class="value net">${formatAmount(net)}</div></div>
</div>
<h3>分类明细</h3>
<table>
  <thead><tr><th>分类名称</th><th>类型</th><th style="text-align:right">金额</th></tr></thead>
  <tbody>${catRows || "<tr><td colspan='3' style='text-align:center;color:#94a3b8'>暂无数据</td></tr>"}</tbody>
</table>
<div class="footer">生成时间：${new Date().toLocaleString("zh-CN")} · 华莱士金融服务公司会计管理系统</div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
    toast.success("报表已在新窗口打开，请使用浏览器打印功能保存为 PDF");
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">财务报表</h1>
          <p className="text-sm text-muted-foreground mt-0.5">月度与年度财务分析报告</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="annual">全年报表</TabsTrigger>
          <TabsTrigger value="monthly">月度报表</TabsTrigger>
        </TabsList>

        {/* ===== ANNUAL REPORT TAB ===== */}
        <TabsContent value="annual" className="space-y-6">
          {/* Annual controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-1.5 border border-border/60">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="border-0 bg-transparent shadow-none h-auto p-0 w-20 text-sm font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-1.5 border border-border/60">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={annualAccount || "all"} onValueChange={(v) => setAnnualAccount(v === "all" ? "" : v)}>
                <SelectTrigger className="border-0 bg-transparent shadow-none h-auto p-0 w-36 text-sm font-semibold">
                  <SelectValue placeholder="全部账户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部账户</SelectItem>
                  {accounts?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.accountName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportAnnualCSV} disabled={!annualReport}>
              <Download className="h-4 w-4" />导出 CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={printAnnualReport} disabled={!annualReport}>
              <Printer className="h-4 w-4" />打印 / PDF
            </Button>
          </div>

          {annualLoading ? (
            <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
          ) : !annualReport ? null : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-muted-foreground">全年总收入</p>
                      <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">{fmtAmount(annualReport.totals.income)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedYear} 年度</p>
                  </CardContent>
                </Card>
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-muted-foreground">全年总支出</p>
                      <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center"><TrendingDown className="h-4 w-4 text-red-500" /></div>
                    </div>
                    <p className="text-2xl font-bold text-red-500">{fmtAmount(annualReport.totals.expense)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedYear} 年度</p>
                  </CardContent>
                </Card>
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-muted-foreground">全年净收支</p>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${annualReport.totals.net >= 0 ? "bg-blue-100" : "bg-orange-100"}`}>
                        <Wallet className={`h-4 w-4 ${annualReport.totals.net >= 0 ? "text-blue-600" : "text-orange-500"}`} />
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${annualReport.totals.net >= 0 ? "text-blue-600" : "text-orange-500"}`}>
                      {annualReport.totals.net >= 0 ? "+" : ""}{fmtAmount(annualReport.totals.net)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">收入 - 支出</p>
                  </CardContent>
                </Card>
                <Card className="border border-border/60 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-muted-foreground">交易总笔数</p>
                      <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center"><FileText className="h-4 w-4 text-purple-600" /></div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{annualReport.monthly.reduce((s, m) => s + m.count, 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">全年累计</p>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly bar chart */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">{selectedYear} 年月度收支对比</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={annualMonthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => v >= 1000 ? `CA$${(v/1000).toFixed(0)}k` : `CA$${v}`} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => [fmtAmount(v), ""]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="收入" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="支出" fill="#EF4444" radius={[3, 3, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Net trend line */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">月度净收支趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={annualMonthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => v >= 1000 ? `CA$${(v/1000).toFixed(0)}k` : `CA$${v}`} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => [fmtAmount(v), ""]} />
                      <Line type="monotone" dataKey="净收支" stroke="#6366F1" strokeWidth={2.5} dot={{ fill: "#6366F1", r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pie charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">全年支出分类分布</CardTitle></CardHeader>
                  <CardContent>
                    {annualExpensePie.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">暂无支出数据</div>
                    ) : (
                      <div className="flex gap-4 items-center">
                        <ResponsiveContainer width="55%" height={200}>
                          <PieChart><Pie data={annualExpensePie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                            {annualExpensePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie><Tooltip formatter={(v: number) => fmtAmount(v)} /></PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-1.5 text-xs">
                          {annualExpensePie.map((d, i) => (
                            <div key={d.name} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-muted-foreground truncate">{d.name}</span>
                              </div>
                              <span className="font-medium text-foreground shrink-0">{fmtAmount(d.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">全年收入分类分布</CardTitle></CardHeader>
                  <CardContent>
                    {annualIncomePie.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">暂无收入数据</div>
                    ) : (
                      <div className="flex gap-4 items-center">
                        <ResponsiveContainer width="55%" height={200}>
                          <PieChart><Pie data={annualIncomePie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                            {annualIncomePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie><Tooltip formatter={(v: number) => fmtAmount(v)} /></PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-1.5 text-xs">
                          {annualIncomePie.map((d, i) => (
                            <div key={d.name} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-muted-foreground truncate">{d.name}</span>
                              </div>
                              <span className="font-medium text-foreground shrink-0">{fmtAmount(d.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Monthly detail table */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">{selectedYear} 年月度收支明细表</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">月份</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">收入</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">支出</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">净收支</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">笔数</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {annualReport.monthly.map((m) => (
                          <tr key={m.month} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-foreground">{selectedYear}年{MONTH_NAMES[m.month - 1]}</td>
                            <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{m.income > 0 ? fmtAmount(m.income) : "—"}</td>
                            <td className="px-4 py-2.5 text-right text-red-500 font-medium">{m.expense > 0 ? fmtAmount(m.expense) : "—"}</td>
                            <td className={`px-4 py-2.5 text-right font-semibold ${m.net >= 0 ? "text-blue-600" : "text-orange-500"}`}>
                              {m.net !== 0 ? (m.net >= 0 ? "+" : "") + fmtAmount(m.net) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground">{m.count > 0 ? m.count : "—"}</td>
                          </tr>
                        ))}
                        <tr className="bg-muted/30 font-semibold border-t-2 border-border">
                          <td className="px-4 py-3 text-foreground">全年合计</td>
                          <td className="px-4 py-3 text-right text-emerald-600">{fmtAmount(annualReport.totals.income)}</td>
                          <td className="px-4 py-3 text-right text-red-500">{fmtAmount(annualReport.totals.expense)}</td>
                          <td className={`px-4 py-3 text-right ${annualReport.totals.net >= 0 ? "text-blue-600" : "text-orange-500"}`}>
                            {annualReport.totals.net >= 0 ? "+" : ""}{fmtAmount(annualReport.totals.net)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{annualReport.monthly.reduce((s, m) => s + m.count, 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Category breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">支出分类明细</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {annualCatExpense.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">暂无支出数据</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border/50 bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">分类</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">金额</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">笔数</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">占比</th>
                        </tr></thead>
                        <tbody className="divide-y divide-border/40">
                          {annualCatExpense.map((c) => (
                            <tr key={c.name} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} /><span className="text-foreground">{c.name}</span></div></td>
                              <td className="px-4 py-2 text-right font-medium text-red-500">{fmtAmount(c.total)}</td>
                              <td className="px-4 py-2 text-right text-muted-foreground">{c.count}</td>
                              <td className="px-4 py-2 text-right text-muted-foreground">{annualReport.totals.expense > 0 ? ((c.total / annualReport.totals.expense) * 100).toFixed(1) + "%" : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">收入分类明细</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    {annualCatIncome.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">暂无收入数据</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-border/50 bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">分类</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">金额</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">笔数</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">占比</th>
                        </tr></thead>
                        <tbody className="divide-y divide-border/40">
                          {annualCatIncome.map((c) => (
                            <tr key={c.name} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} /><span className="text-foreground">{c.name}</span></div></td>
                              <td className="px-4 py-2 text-right font-medium text-emerald-600">{fmtAmount(c.total)}</td>
                              <td className="px-4 py-2 text-right text-muted-foreground">{c.count}</td>
                              <td className="px-4 py-2 text-right text-muted-foreground">{annualReport.totals.income > 0 ? ((c.total / annualReport.totals.income) * 100).toFixed(1) + "%" : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Account summary */}
              {annualAccountSummary.length > 1 && (
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">账户收支汇总</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border/50 bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">账户</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">收入</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">支出</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">净收支</th>
                      </tr></thead>
                      <tbody className="divide-y divide-border/40">
                        {annualAccountSummary.map((a, i) => (
                          <tr key={i} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.account?.color ?? "#6366F1" }} /><span className="font-medium text-foreground">{a.account?.accountName ?? "未知"}</span><span className="text-xs text-muted-foreground">{a.account?.bankName}</span></div></td>
                            <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">{a.income > 0 ? fmtAmount(a.income) : "—"}</td>
                            <td className="px-4 py-2.5 text-right text-red-500 font-medium">{a.expense > 0 ? fmtAmount(a.expense) : "—"}</td>
                            <td className={`px-4 py-2.5 text-right font-semibold ${(a.income - a.expense) >= 0 ? "text-blue-600" : "text-orange-500"}`}>
                              {(a.income - a.expense) !== 0 ? ((a.income - a.expense) >= 0 ? "+" : "") + fmtAmount(a.income - a.expense) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ===== MONTHLY REPORT TAB ===== */}
        <TabsContent value="monthly" className="space-y-6">
          {/* Monthly controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTH_NAMES.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={exportCSV}>
              <FileSpreadsheet className="h-4 w-4" />导出 CSV
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportPDF}>
              <Download className="h-4 w-4" />导出 PDF
            </Button>
          </div>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {monthLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <Card className="border border-border/60 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500 rounded-xl">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{selectedMonth}月收入</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-0.5">{formatAmount(monthSummary?.totalIncome)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/60 shadow-sm bg-gradient-to-br from-red-50 to-red-100/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-red-500 rounded-xl">
                    <TrendingDown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{selectedMonth}月支出</p>
                    <p className="text-2xl font-bold text-red-600 mt-0.5">{formatAmount(monthSummary?.totalExpense)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/60 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 rounded-xl">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">净收支</p>
                    <p className={`text-2xl font-bold mt-0.5 ${parseFloat(String(monthSummary?.netAmount ?? "0")) >= 0 ? "text-indigo-700" : "text-red-600"}`}>
                      {formatAmount(monthSummary?.netAmount)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Annual Summary */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">{selectedYear}年度汇总</CardTitle>
            <Badge variant="outline" className="text-xs">{selectedYear}年全年</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">年度总收入</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{formatAmount(yearSummary?.totalIncome)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">年度总支出</p>
              <p className="text-xl font-bold text-red-500 mt-1">{formatAmount(yearSummary?.totalExpense)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">年度净收支</p>
              <p className={`text-xl font-bold mt-1 ${parseFloat(String(yearSummary?.netAmount ?? "0")) >= 0 ? "text-indigo-600" : "text-red-500"}`}>
                {formatAmount(yearSummary?.netAmount)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart - Monthly */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{selectedYear}年月度收支对比</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={formatAmountShort} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number) => [formatAmount(value), ""]}
                />
                <Bar dataKey="收入" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="支出" fill="#EF4444" radius={[3, 3, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Line Chart - Net */}
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{selectedYear}年净收支趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={formatAmountShort} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(value: number) => [formatAmount(value), ""]}
                />
                <Line type="monotone" dataKey="净收支" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 4, fill: "#4F46E5" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{selectedMonth}月支出分类分布</CardTitle>
          </CardHeader>
          <CardContent>
            {expensePieData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">本月暂无支出数据</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={expensePieData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                    {expensePieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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

        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">{selectedMonth}月收入来源分布</CardTitle>
          </CardHeader>
          <CardContent>
            {incomePieData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">本月暂无收入数据</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={incomePieData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                    {incomePieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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

      {/* Category Detail Table */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{selectedMonth}月分类明细</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!monthCatSummary || monthCatSummary.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">本月暂无分类数据</div>
          ) : (
            <div>
              <div className="grid grid-cols-4 gap-2 px-5 py-2.5 bg-muted/30 border-b border-border/50 text-xs font-medium text-muted-foreground">
                <div>分类名称</div>
                <div>类型</div>
                <div className="text-right">金额</div>
                <div className="text-right">笔数</div>
              </div>
              <div className="divide-y divide-border/40">
                {monthCatSummary
                  .filter((c) => parseFloat(String(c.total ?? "0")) > 0)
                  .sort((a, b) => parseFloat(String(b.total ?? "0")) - parseFloat(String(a.total ?? "0")))
                  .map((c, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2 px-5 py-3 hover:bg-muted/20 transition-colors items-center">
                      <div className="flex items-center gap-2">
                        {c.category && (
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.category.color ?? "#6366F1" }} />
                        )}
                        <span className="text-sm text-foreground">{c.category?.name ?? "未分类"}</span>
                      </div>
                      <div>
                        <Badge variant="secondary" className={`text-xs ${c.type === "income" ? "bg-emerald-100 text-emerald-700" : c.type === "expense" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                          {c.type === "income" ? "收入" : c.type === "expense" ? "支出" : "转账"}
                        </Badge>
                      </div>
                      <div className={`text-sm font-semibold text-right ${c.type === "income" ? "text-emerald-600" : c.type === "expense" ? "text-red-500" : "text-blue-600"}`}>
                        {formatAmount(c.total)}
                      </div>
                      <div className="text-sm text-muted-foreground text-right">{c.count} 笔</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
