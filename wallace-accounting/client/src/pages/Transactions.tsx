import { trpc } from "@/lib/trpc";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowUpDown,
  CreditCard,
  Edit2,
  Filter,
  Search,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Tag,
  Download,
} from "lucide-react";

function formatAmount(amount: string | number | null | undefined) {
  const n = parseFloat(String(amount ?? "0"));
  return "CA$" + new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const TYPE_LABELS = { income: "收入", expense: "支出", transfer: "转账" };
const TYPE_COLORS = {
  income: "bg-emerald-100 text-emerald-700",
  expense: "bg-red-100 text-red-700",
  transfer: "bg-blue-100 text-blue-700",
};

export default function Transactions() {
  const utils = trpc.useUtils();
  const { data: accounts } = trpc.bankAccounts.list.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();

  const [filterAccount, setFilterAccount] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterCounterparty, setFilterCounterparty] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterMinAmount, setFilterMinAmount] = useState<string>("");
  const [filterMaxAmount, setFilterMaxAmount] = useState<string>("");
  const [searchText, setSearchText] = useState("");
  const [sortField, setSortField] = useState<"date" | "amount" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  function toggleSort(field: "date" | "amount") {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(0);
  }

  const { data: counterparties } = trpc.transactions.counterparties.useQuery({
    bankAccountId: filterAccount ? parseInt(filterAccount) : undefined,
  });

  // Fetch available years directly from DB (independent of current filters)
  const { data: availableYearsData } = trpc.transactions.availableYears.useQuery({
    bankAccountId: filterAccount ? parseInt(filterAccount) : undefined,
  });

  const { data: transactions, isLoading } = trpc.transactions.list.useQuery({
    bankAccountId: filterAccount ? parseInt(filterAccount) : undefined,
    categoryId: filterCategory && filterCategory !== "__uncategorized__" ? parseInt(filterCategory) : undefined,
    uncategorized: filterCategory === "__uncategorized__" ? true : undefined,
    counterparty: filterCounterparty || undefined,
    type: filterType || undefined,
    startDate: filterYear ? new Date(`${filterYear}-${filterMonth || "01"}-01`) : undefined,
    endDate: filterYear && filterMonth
      ? new Date(new Date(parseInt(filterYear), parseInt(filterMonth), 0).setHours(23, 59, 59))
      : filterYear
      ? new Date(`${filterYear}-12-31T23:59:59`)
      : undefined,
    minAmount: filterMinAmount ? parseFloat(filterMinAmount) : undefined,
    maxAmount: filterMaxAmount ? parseFloat(filterMaxAmount) : undefined,
    limit: 2000,
    offset: 0,
  });
  // Use years fetched directly from DB (not derived from filtered transactions)
  const availableYears = availableYearsData ?? [];
  const updateMutation = trpc.transactions.update.useMutation({
    onSuccess: () => { utils.transactions.list.invalidate(); toast.success("交易记录已更新"); setEditDialogOpen(false); },
    onError: (e) => toast.error("更新失败: " + e.message),
  });

  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      utils.bankAccounts.list.invalidate();
      toast.success("交易记录已删除");
    },
    onError: (e) => toast.error("删除失败: " + e.message),
  });

  const createMutation = trpc.transactions.create.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      utils.bankAccounts.list.invalidate();
      toast.success("交易记录已创建");
      setCreateDialogOpen(false);
    },
    onError: (e) => toast.error("创建失败: " + e.message),
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");

  const bulkUpdateCategoryMutation = trpc.transactions.bulkUpdateCategory.useMutation({
    onSuccess: (res) => {
      utils.transactions.list.invalidate();
      toast.success(`已更新 ${res.updatedCount} 条交易记录的分类`);
      setSelectedIds(new Set());
      setBulkCategoryOpen(false);
      setBulkCategoryId("");
    },
    onError: (e) => toast.error("批量修改分类失败: " + e.message),
  });

  const bulkDeleteMutation = trpc.transactions.bulkDelete.useMutation({
    onSuccess: (res) => {
      utils.transactions.list.invalidate();
      utils.bankAccounts.list.invalidate();
      toast.success(`已删除 ${res.deletedCount} 条交易记录`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    },
    onError: (e) => toast.error("批量删除失败: " + e.message),
  });

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === paginated.length && paginated.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginated.map((t) => t.id)));
    }
  }

  const [editTxn, setEditTxn] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [createForm, setCreateForm] = useState({
    bankAccountId: "",
    categoryId: "",
    transactionDate: new Date().toISOString().split("T")[0],
    amount: "",
    type: "expense" as "income" | "expense" | "transfer",
    description: "",
    counterparty: "",
    notes: "",
  });

  const catMap = useMemo(() => {
    if (!categories) return new Map();
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((t) => {
      if (searchText) {
        const q = searchText.toLowerCase();
        if (
          !t.description?.toLowerCase().includes(q) &&
          !t.counterparty?.toLowerCase().includes(q) &&
          !t.reference?.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [transactions, searchText]);

  const activeFilterCount = [filterAccount, filterType, filterCategory, filterCounterparty, filterYear, filterMinAmount, filterMaxAmount].filter(Boolean).length;

  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        cmp = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
      } else if (sortField === "amount") {
        cmp = parseFloat(String(a.amount)) - parseFloat(String(b.amount));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const allPageSelected = paginated.length > 0 && paginated.every((t) => selectedIds.has(t.id));

  function openEdit(txn: any) {
    setEditTxn(txn);
    setEditForm({
      categoryId: txn.categoryId ? String(txn.categoryId) : "",
      type: txn.type,
      description: txn.description ?? "",
      counterparty: txn.counterparty ?? "",
      amount: String(txn.amount),
      notes: txn.notes ?? "",
    });
    setEditDialogOpen(true);
  }

  function handleUpdate() {
    if (!editTxn) return;
    updateMutation.mutate({
      id: editTxn.id,
      categoryId: editForm.categoryId ? parseInt(editForm.categoryId) : null,
      type: editForm.type,
      description: editForm.description,
      counterparty: editForm.counterparty,
      amount: editForm.amount,
      notes: editForm.notes,
    });
  }

  function handleCreate() {
    if (!createForm.bankAccountId || !createForm.amount) {
      toast.error("请填写必填字段");
      return;
    }
    createMutation.mutate({
      bankAccountId: parseInt(createForm.bankAccountId),
      categoryId: createForm.categoryId ? parseInt(createForm.categoryId) : undefined,
      transactionDate: new Date(createForm.transactionDate),
      amount: createForm.amount,
      type: createForm.type,
      description: createForm.description,
      counterparty: createForm.counterparty,
      notes: createForm.notes,
    });
  }

  const incomeTotal = useMemo(() => filtered.filter((t) => t.type === "income").reduce((s, t) => s + parseFloat(String(t.amount)), 0), [filtered]);
  const expenseTotal = useMemo(() => filtered.filter((t) => t.type === "expense").reduce((s, t) => s + parseFloat(String(t.amount)), 0), [filtered]);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">交易记录</h1>
          <p className="text-sm text-muted-foreground mt-0.5">查看和管理所有交易，支持手动修正分类</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setBulkCategoryOpen(true)}
              >
                <Tag className="h-4 w-4" />
                改分类 ({selectedIds.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                删除选中 ({selectedIds.size})
              </Button>
            </>
          )}
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            手动添加
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">筛选结果</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{filtered.length} 条</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">收入合计</p>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{formatAmount(incomeTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">支出合计</p>
            <p className="text-xl font-bold text-red-500 mt-0.5">{formatAmount(expenseTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* 第一行：搜索 + 账户 + 类型 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索描述、对手方..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={filterAccount || "all"} onValueChange={(v) => { setFilterAccount(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="所有账户" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有账户</SelectItem>
              {accounts?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.accountName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType || "all"} onValueChange={(v) => { setFilterType(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="所有类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有类型</SelectItem>
              <SelectItem value="income">收入</SelectItem>
              <SelectItem value="expense">支出</SelectItem>
              <SelectItem value="transfer">转账</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 第二行：年份 + 月份 + 金额区间 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground whitespace-nowrap">年份：</span>
          <Select value={filterYear || "all"} onValueChange={(v) => { setFilterYear(v === "all" ? "" : v); setFilterMonth(""); setPage(0); }}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="所有年份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有年份</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap">月份：</span>
          <Select
            value={filterMonth || "all"}
            onValueChange={(v) => { setFilterMonth(v === "all" ? "" : v); setPage(0); }}
            disabled={!filterYear}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="全年" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全年</SelectItem>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                <SelectItem key={m} value={String(m).padStart(2, "0")}>{m}月</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap ml-2">金额区间：</span>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">CA$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={filterMinAmount}
                onChange={(e) => { setFilterMinAmount(e.target.value); setPage(0); }}
                className="w-28 pl-8 text-sm"
                placeholder="最小"
              />
            </div>
            <span className="text-muted-foreground text-sm">—</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">CA$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={filterMaxAmount}
                onChange={(e) => { setFilterMaxAmount(e.target.value); setPage(0); }}
                className="w-28 pl-8 text-sm"
                placeholder="最大"
              />
            </div>
          </div>
        </div>

        {/* 第三行：对手方 + 分类 + 清除 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground whitespace-nowrap">对手方：</span>
          <Select value={filterCounterparty || "all"} onValueChange={(v) => { setFilterCounterparty(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="所有对手方" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">所有对手方</SelectItem>
              {counterparties?.map((cp) => (
                <SelectItem key={cp} value={cp}>{cp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground whitespace-nowrap ml-2">分类：</span>
          <Select value={filterCategory || "all"} onValueChange={(v) => { setFilterCategory(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="所有分类" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">所有分类</SelectItem>
              <SelectItem value="__uncategorized__">⚠ 未分类</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground ml-2"
              onClick={() => {
                setFilterAccount("");
                setFilterType("");
                setFilterCategory("");
                setFilterCounterparty("");
                setFilterYear("");
                setFilterMonth("");
                setFilterMinAmount("");
                setFilterMaxAmount("");
                setSearchText("");
                setPage(0);
              }}
            >
              <X className="h-3.5 w-3.5" />
              清除全部筛选 ({activeFilterCount})
            </Button>
          )}
        </div>

        {/* 已激活的筛选标签 */}
        {(filterCounterparty || filterCategory || filterYear || filterMinAmount || filterMaxAmount) && (
          <div className="flex items-center gap-2 flex-wrap">
            {filterYear && (
              <Badge variant="secondary" className="gap-1.5 pr-1 text-xs">
                {filterYear}年{filterMonth ? ` ${parseInt(filterMonth)}月` : ""}
                <button onClick={() => { setFilterYear(""); setFilterMonth(""); setPage(0); }} className="hover:text-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {filterMinAmount && (
              <Badge variant="secondary" className="gap-1.5 pr-1 text-xs">
                最小金额：CA${filterMinAmount}
                <button onClick={() => { setFilterMinAmount(""); setPage(0); }} className="hover:text-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {filterMaxAmount && (
              <Badge variant="secondary" className="gap-1.5 pr-1 text-xs">
                最大金额：CA${filterMaxAmount}
                <button onClick={() => { setFilterMaxAmount(""); setPage(0); }} className="hover:text-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {filterCounterparty && (
              <Badge variant="secondary" className="gap-1.5 pr-1 text-xs">
                对手方：{filterCounterparty}
                <button onClick={() => { setFilterCounterparty(""); setPage(0); }} className="hover:text-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {filterCategory && (
              <Badge variant="secondary" className="gap-1.5 pr-1 text-xs">
                分类：{filterCategory === "__uncategorized__" ? "⚠ 未分类" : (catMap.get(parseInt(filterCategory))?.name ?? filterCategory)}
                <button onClick={() => { setFilterCategory(""); setPage(0); }} className="hover:text-foreground ml-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <Card className="border border-border/60 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 border-b border-border/50 bg-muted/20 animate-pulse" />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <CardContent className="py-16 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">暂无交易记录</p>
            <p className="text-sm text-muted-foreground/70 mt-1">上传银行账单后，AI 将自动提取交易记录</p>
          </CardContent>
        ) : (
          <>
            {/* Header */}
            <div className="grid gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/50 text-xs font-medium text-muted-foreground" style={{gridTemplateColumns: '2rem 2rem 5.5rem 1fr 1fr 7rem 7rem 4.5rem'}}>
              <div className="flex items-center">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="全选当前页"
                />
              </div>
              <div>类型</div>
              <button
                className="flex items-center gap-0.5 hover:text-foreground transition-colors text-left"
                onClick={() => toggleSort("date")}
              >
                日期
                {sortField === "date" ? (
                  sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </button>
              <div>对手方 / 描述</div>
              <div>描述备注</div>
              <div>分类</div>
              <button
                className="flex items-center gap-0.5 hover:text-foreground transition-colors justify-end w-full"
                onClick={() => toggleSort("amount")}
              >
                {sortField === "amount" ? (
                  sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
                金额
              </button>
              <div className="text-right">操作</div>
            </div>
            <div className="divide-y divide-border/40">
              {paginated.map((txn) => {
                const cat = txn.categoryId ? catMap.get(txn.categoryId) : null;
                const isSelected = selectedIds.has(txn.id);
                const confidenceLabel = txn.isManuallyEdited
                  ? <Badge variant="outline" className="text-xs h-4 px-1">已修正</Badge>
                  : txn.aiConfidence
                  ? <span className="text-xs text-muted-foreground">AI 置信度 {(parseFloat(String(txn.aiConfidence)) * 100).toFixed(0)}%</span>
                  : null;
                return (
                  <div key={txn.id} className={`grid gap-2 px-4 py-3 transition-colors items-center ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'}`} style={{gridTemplateColumns: '2rem 2rem 5.5rem 1fr 1fr 7rem 7rem 4.5rem'}}>
                    {/* Checkbox */}
                    <div className="flex items-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(txn.id)}
                        aria-label={`选择交易 ${txn.id}`}
                      />
                    </div>
                    {/* Type icon */}
                    <div>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${TYPE_COLORS[txn.type]}`}>
                        {txn.type === "income" ? <ArrowUpRight className="h-3.5 w-3.5" /> : txn.type === "expense" ? <ArrowDownRight className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                    {/* Date */}
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(txn.transactionDate).toLocaleDateString("zh-CN")}
                    </div>
                    {/* Counterparty */}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{txn.counterparty || "-"}</p>
                    </div>
                    {/* Description + confidence */}
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{txn.description || ""}</p>
                      <div className="mt-0.5">{confidenceLabel}</div>
                    </div>
                    {/* Category */}
                    <div>
                      {cat ? (
                        <Badge variant="secondary" className="text-xs" style={{ background: cat.color + "20", color: cat.color }}>
                          {cat.name}
                        </Badge>
                      ) : txn.aiCategory ? (
                        <Badge variant="outline" className="text-xs text-muted-foreground">{txn.aiCategory}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">未分类</span>
                      )}
                    </div>
                    {/* Amount */}
                    <div className={`text-sm font-semibold text-right whitespace-nowrap ${txn.type === "income" ? "text-emerald-600" : txn.type === "expense" ? "text-red-500" : "text-blue-600"}`}>
                      {txn.type === "income" ? "+" : txn.type === "expense" ? "-" : ""}{formatAmount(txn.amount)}
                    </div>
                    {/* Actions */}
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(txn)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("确认删除？")) deleteMutation.mutate({ id: txn.id }); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            第 {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} 条，共 {filtered.length} 条
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>上一页</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>下一页</Button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除已选中的 <strong>{selectedIds.size}</strong> 条交易记录，此操作不可恢复。确认继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) })}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Update Category Dialog */}
      <Dialog open={bulkCategoryOpen} onOpenChange={(open) => { setBulkCategoryOpen(open); if (!open) setBulkCategoryId(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>批量修改分类</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">将已选的 <strong className="text-foreground">{selectedIds.size}</strong> 条交易记录统一归类为：</p>
            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
              <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未分类</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCategoryOpen(false)}>取消</Button>
            <Button
              disabled={!bulkCategoryId || bulkUpdateCategoryMutation.isPending}
              onClick={() => {
                bulkUpdateCategoryMutation.mutate({
                  ids: Array.from(selectedIds),
                  categoryId: bulkCategoryId === "none" ? null : parseInt(bulkCategoryId),
                });
              }}
            >
              {bulkUpdateCategoryMutation.isPending ? "修改中..." : "确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑交易记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>交易类型</Label>
                <Select value={editForm.type} onValueChange={(v) => setEditForm({ ...editForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">收入</SelectItem>
                    <SelectItem value="expense">支出</SelectItem>
                    <SelectItem value="transfer">转账</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>金额</Label>
                <Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>会计分类</Label>
              <Select value={editForm.categoryId || "none"} onValueChange={(v) => setEditForm({ ...editForm, categoryId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未分类</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>对手方</Label>
              <Input value={editForm.counterparty} onChange={(e) => setEditForm({ ...editForm, counterparty: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "保存中..." : "保存更改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>手动添加交易</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>银行账户 *</Label>
                <Select value={createForm.bankAccountId} onValueChange={(v) => setCreateForm({ ...createForm, bankAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder="选择账户" /></SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.accountName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>交易类型</Label>
                <Select value={createForm.type} onValueChange={(v) => setCreateForm({ ...createForm, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">收入</SelectItem>
                    <SelectItem value="expense">支出</SelectItem>
                    <SelectItem value="transfer">转账</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>金额 *</Label>
                <Input type="number" placeholder="0.00" value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>交易日期</Label>
                <Input type="date" value={createForm.transactionDate} onChange={(e) => setCreateForm({ ...createForm, transactionDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>分类</Label>
              <Select value={createForm.categoryId || "none"} onValueChange={(v) => setCreateForm({ ...createForm, categoryId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未分类</SelectItem>
                  {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Input value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>对手方</Label>
              <Input value={createForm.counterparty} onChange={(e) => setCreateForm({ ...createForm, counterparty: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "添加中..." : "添加交易"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
