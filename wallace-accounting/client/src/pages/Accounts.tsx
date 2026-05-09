import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2, Edit2, FileText, Loader2, Plus, Receipt, Trash2, Wallet } from "lucide-react";

const ACCOUNT_TYPES = {
  checking: "活期账户",
  savings: "储蓄账户",
  credit: "信用卡",
  investment: "投资账户",
  other: "其他",
};

const COLORS = [
  "#4F46E5", "#7C3AED", "#DB2777", "#DC2626", "#D97706",
  "#059669", "#0891B2", "#0284C7", "#6366F1", "#8B5CF6",
];

function formatAmount(amount: string | number | null | undefined) {
  const n = parseFloat(String(amount ?? "0"));
  return "CA$" + new Intl.NumberFormat("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type AccountFormData = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  accountType: "checking" | "savings" | "credit" | "investment" | "other";
  balance: string;
  color: string;
  notes: string;
};

const defaultForm: AccountFormData = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  currency: "CAD",
  accountType: "checking",
  balance: "0",
  color: "#4F46E5",
  notes: "",
};

type DeleteTarget = {
  id: number;
  accountName: string;
  bankName: string;
  statementCount: number;
  transactionCount: number;
};

export default function Accounts() {
  const utils = trpc.useUtils();
  const { data: accounts, isLoading } = trpc.bankAccounts.list.useQuery();

  const createMutation = trpc.bankAccounts.create.useMutation({
    onSuccess: () => { utils.bankAccounts.list.invalidate(); toast.success("账户创建成功"); setDialogOpen(false); setForm(defaultForm); },
    onError: (e) => toast.error("创建失败: " + e.message),
  });
  const updateMutation = trpc.bankAccounts.update.useMutation({
    onSuccess: () => { utils.bankAccounts.list.invalidate(); toast.success("账户更新成功"); setDialogOpen(false); setEditId(null); },
    onError: (e) => toast.error("更新失败: " + e.message),
  });
  const deleteMutation = trpc.bankAccounts.delete.useMutation({
    onSuccess: (data) => {
      utils.bankAccounts.list.invalidate();
      utils.statements.list.invalidate();
      utils.transactions.list.invalidate();
      utils.reports.recentTransactions.invalidate();
      const parts: string[] = ["账户已删除"];
      if (data.deletedStatements > 0) parts.push(`${data.deletedStatements} 份账单`);
      if (data.deletedTransactions > 0) parts.push(`${data.deletedTransactions} 条交易记录`);
      toast.success(parts.length > 1 ? `${parts[0]}，同步删除了 ${parts.slice(1).join("和")}` : parts[0]);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error("删除失败: " + e.message),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AccountFormData>(defaultForm);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [loadingStatsId, setLoadingStatsId] = useState<number | null>(null);

  // Lazy stats query — only fires when deleteTarget is set
  const statsQuery = trpc.bankAccounts.stats.useQuery(
    { id: deleteTarget?.id ?? 0 },
    { enabled: false }
  );

  function openCreate() {
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(acc: any) {
    setEditId(acc.id);
    setForm({
      bankName: acc.bankName,
      accountName: acc.accountName,
      accountNumber: acc.accountNumber ?? "",
      currency: acc.currency ?? "CAD",
      accountType: acc.accountType,
      balance: String(acc.balance ?? "0"),
      color: acc.color ?? "#4F46E5",
      notes: acc.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleDeleteClick(acc: { id: number; accountName: string; bankName: string }) {
    setLoadingStatsId(acc.id);
    try {
      // Fetch stats directly via utils
      const stats = await utils.bankAccounts.stats.fetch({ id: acc.id });
      setDeleteTarget({
        id: acc.id,
        accountName: acc.accountName,
        bankName: acc.bankName,
        statementCount: stats.statementCount,
        transactionCount: stats.transactionCount,
      });
    } catch {
      // Fallback: open dialog with unknown counts
      setDeleteTarget({ id: acc.id, accountName: acc.accountName, bankName: acc.bankName, statementCount: 0, transactionCount: 0 });
    } finally {
      setLoadingStatsId(null);
    }
  }

  function handleSubmit() {
    if (!form.bankName || !form.accountName) {
      toast.error("请填写银行名称和账户名称");
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  const totalBalance = accounts?.reduce((sum, a) => sum + parseFloat(String((a as any).computedBalance ?? a.balance ?? "0")), 0) ?? 0;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">银行账户</h1>
          <p className="text-sm text-muted-foreground mt-0.5">管理您的所有银行账户</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          添加账户
        </Button>
      </div>

      {/* Summary Card */}
      <Card className="border border-border/60 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary rounded-xl">
              <Wallet className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium">所有账户总余额</p>
              <p className="text-3xl font-bold text-foreground mt-0.5">{formatAmount(totalBalance)}</p>
              <p className="text-xs text-muted-foreground mt-1">{accounts?.length ?? 0} 个账户</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : accounts?.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">暂无银行账户</p>
            <p className="text-sm text-muted-foreground/70 mt-1">点击「添加账户」开始管理您的银行账户</p>
            <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              添加第一个账户
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts?.map((acc) => {
            const isLoadingStats = loadingStatsId === acc.id;
            return (
              <Card key={acc.id} className="border border-border/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                <div className="h-1.5 w-full" style={{ background: acc.color ?? "#4F46E5" }} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: acc.color ?? "#4F46E5" }}>
                        {acc.bankName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{acc.accountName}</p>
                        <p className="text-xs text-muted-foreground">{acc.bankName}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteClick(acc)}
                        disabled={isLoadingStats}
                        title="删除账户及关联数据"
                      >
                        {isLoadingStats ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">账户余额</p>
                      <p className="text-xl font-bold text-foreground">{formatAmount((acc as any).computedBalance ?? acc.balance)}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <Badge variant="secondary" className="text-xs">
                        {ACCOUNT_TYPES[acc.accountType]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{acc.currency}</span>
                    </div>
                    {acc.accountNumber && (
                      <p className="text-xs text-muted-foreground font-mono">
                        ****{acc.accountNumber.slice(-4)}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "编辑账户" : "添加银行账户"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>银行名称 *</Label>
                <Input placeholder="如：TD Bank" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>账户名称 *</Label>
                <Input placeholder="如：Aeroplan Visa *1261" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>账户类型</Label>
                <Select value={form.accountType} onValueChange={(v) => setForm({ ...form, accountType: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>币种</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">加拿大元 (CAD)</SelectItem>
                    <SelectItem value="USD">美元 (USD)</SelectItem>
                    <SelectItem value="CNY">人民币 (CNY)</SelectItem>
                    <SelectItem value="EUR">欧元 (EUR)</SelectItem>
                    <SelectItem value="HKD">港元 (HKD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>账户号码（后四位）</Label>
                <Input placeholder="可选" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>当前余额</Label>
                <Input type="number" placeholder="0.00" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>账户颜色</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-105"}`}
                    style={{ background: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>备注</Label>
              <Textarea placeholder="可选备注信息" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "保存中..." : editId ? "保存更改" : "创建账户"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除银行账户</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  将永久删除账户{" "}
                  <strong className="text-foreground">{deleteTarget?.accountName}</strong>
                  {deleteTarget?.bankName ? `（${deleteTarget.bankName}）` : ""}。
                </p>

                {/* Stats summary */}
                {(deleteTarget?.statementCount ?? 0) > 0 || (deleteTarget?.transactionCount ?? 0) > 0 ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                    <p className="text-sm font-medium text-destructive">以下关联数据将被一并删除：</p>
                    <div className="flex items-center gap-4">
                      {(deleteTarget?.statementCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <FileText className="h-4 w-4 text-destructive/70" />
                          <span className="font-semibold text-destructive">{deleteTarget?.statementCount}</span>
                          <span className="text-muted-foreground">份账单</span>
                        </div>
                      )}
                      {(deleteTarget?.transactionCount ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Receipt className="h-4 w-4 text-destructive/70" />
                          <span className="font-semibold text-destructive">{deleteTarget?.transactionCount}</span>
                          <span className="text-muted-foreground">条交易记录</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">该账户下暂无账单或交易记录。</p>
                )}

                <p className="text-sm text-muted-foreground">此操作不可恢复，确认继续吗？</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
