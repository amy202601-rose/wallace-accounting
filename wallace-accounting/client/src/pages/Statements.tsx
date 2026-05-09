import { trpc } from "@/lib/trpc";
import { useCallback, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CheckCircle2, Clock, FileText, Loader2, Play, Trash2, Upload, X, XCircle } from "lucide-react";

const STATUS_MAP = {
  pending: { label: "待处理", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  processing: { label: "处理中", color: "bg-blue-100 text-blue-700", icon: Loader2 },
  completed: { label: "已完成", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  failed: { label: "失败", color: "bg-red-100 text-red-700", icon: XCircle },
};

type UploadFileItem = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  progress: number;
  errorMsg?: string;
  transactionCount?: number;
};

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Statements() {
  const utils = trpc.useUtils();
  const { data: accounts } = trpc.bankAccounts.list.useQuery();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const { data: statements, isLoading } = trpc.statements.list.useQuery({
    bankAccountId: selectedAccountId && selectedAccountId !== "all" ? parseInt(selectedAccountId) : undefined,
  });

  const uploadMutation = trpc.statements.upload.useMutation({
    onSuccess: () => {
      utils.statements.list.invalidate();
      utils.bankAccounts.list.invalidate();
    },
  });

  const processMutation = trpc.statements.process.useMutation({
    onSuccess: () => {
      utils.statements.list.invalidate();
      utils.transactions.list.invalidate();
      utils.reports.recentTransactions.invalidate();
      utils.bankAccounts.list.invalidate();
    },
  });

  const [isDragging, setIsDragging] = useState(false);
  const [uploadAccountId, setUploadAccountId] = useState<string>("");
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  // Single delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; fileName: string; txCount: number } | null>(null);
  const deleteMutation = trpc.statements.delete.useMutation({
    onSuccess: (data) => {
      toast.success(`账单已删除，同步删除了 ${data.deletedTransactionCount} 条交易记录`);
      utils.statements.list.invalidate();
      utils.transactions.list.invalidate();
      utils.reports.recentTransactions.invalidate();
      utils.bankAccounts.list.invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(`删除失败：${err.message}`);
    },
  });

  const handleDeleteClick = async (stmt: { id: number; fileName: string; transactionCount?: number | null }) => {
    const txCount = stmt.transactionCount ?? 0;
    setDeleteTarget({ id: stmt.id, fileName: stmt.fileName, txCount });
  };

  // Bulk delete state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkTxCount, setBulkTxCount] = useState(0);

  const bulkDeleteMutation = trpc.statements.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`已删除 ${data.deletedStatements} 份账单，同步删除 ${data.deletedTransactions} 条交易记录`);
      utils.statements.list.invalidate();
      utils.transactions.list.invalidate();
      utils.reports.recentTransactions.invalidate();
      utils.bankAccounts.list.invalidate();
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    },
    onError: (err) => {
      toast.error(`批量删除失败：${err.message}`);
    },
  });

  const statementsInView = statements ?? [];
  const allIds = useMemo(() => statementsInView.map((s) => s.id), [statementsInView]);
  const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const isPartialSelected = allIds.some((id) => selectedIds.has(id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) return;
    // Calculate total transaction count from selected statements
    const totalTx = statementsInView
      .filter((s) => selectedIds.has(s.id))
      .reduce((sum, s) => sum + (s.transactionCount ?? 0), 0);
    setBulkTxCount(totalTx);
    setBulkDeleteOpen(true);
  };

  // Multi-file queue state
  const [fileQueue, setFileQueue] = useState<UploadFileItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Duplicate detection state
  const [dupWarning, setDupWarning] = useState<{
    fileName: string;
    existingCreatedAt?: Date;
    pendingFiles: File[];
  } | null>(null);

  const validateFile = (file: File): string | null => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "csv") return "仅支持 PDF 和 CSV 格式";
    if (file.size > 10 * 1024 * 1024) return "文件大小不能超过 10MB";
    return null;
  };

  const addFilesToQueueDirect = useCallback((files: File[]) => {
    const newItems: UploadFileItem[] = [];
    files.forEach((file) => {
      const err = validateFile(file);
      newItems.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        status: err ? "error" : "pending",
        progress: 0,
        errorMsg: err ?? undefined,
      });
    });
    setFileQueue((prev) => [...prev, ...newItems]);
  }, []);

  const addFilesToQueue = useCallback(async (files: FileList | File[]) => {
    if (!uploadAccountId) {
      toast.error("请先选择银行账户");
      return;
    }
    const fileArr = Array.from(files);
    // Check first file for duplicate (check one at a time to avoid spamming)
    for (const file of fileArr) {
      try {
        const result = await utils.statements.checkDuplicate.fetch({
          bankAccountId: parseInt(uploadAccountId),
          fileName: file.name,
        });
        if (result.exists) {
          setDupWarning({
            fileName: file.name,
            existingCreatedAt: result.existingCreatedAt,
            pendingFiles: fileArr,
          });
          return; // Stop and show warning
        }
      } catch {
        // If check fails, proceed anyway
      }
    }
    addFilesToQueueDirect(fileArr);
  }, [uploadAccountId, utils, addFilesToQueueDirect]);

  const removeFromQueue = (id: string) => {
    setFileQueue((prev) => prev.filter((f) => f.id !== id));
  };

  const clearQueue = () => setFileQueue([]);

  const updateItem = (id: string, patch: Partial<UploadFileItem>) => {
    setFileQueue((prev) => prev.map((f) => f.id === id ? { ...f, ...patch } : f));
  };

  const processSingleFile = async (item: UploadFileItem): Promise<void> => {
    updateItem(item.id, { status: "uploading", progress: 20 });
    const ext = item.file.name.split(".").pop()?.toLowerCase() as "pdf" | "csv";

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        try {
          updateItem(item.id, { progress: 50 });
          const result = await uploadMutation.mutateAsync({
            bankAccountId: parseInt(uploadAccountId),
            fileName: item.file.name,
            fileType: ext,
            fileSize: item.file.size,
            fileData: base64,
          });
          updateItem(item.id, { status: "processing", progress: 70 });

          const processResult = await processMutation.mutateAsync({ id: result.id });
          updateItem(item.id, {
            status: "done",
            progress: 100,
            transactionCount: processResult.transactionCount,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "处理失败";
          updateItem(item.id, { status: "error", progress: 0, errorMsg: msg });
        }
        resolve();
      };
      reader.readAsDataURL(item.file);
    });
  };

  const runBatchUpload = async () => {
    const pendingItems = fileQueue.filter((f) => f.status === "pending");
    if (pendingItems.length === 0) {
      toast.info("没有待处理的文件");
      return;
    }
    if (!uploadAccountId) {
      toast.error("请先选择银行账户");
      return;
    }
    setIsBatchRunning(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of pendingItems) {
      await processSingleFile(item);
      const updated = fileQueue.find((f) => f.id === item.id);
      if (updated?.status === "done") successCount++;
      else failCount++;
    }

    setIsBatchRunning(false);
    utils.statements.list.invalidate();
    utils.transactions.list.invalidate();
    utils.bankAccounts.list.invalidate();

    if (failCount === 0) {
      toast.success(`全部 ${successCount} 个文件处理完成！`);
    } else {
      toast.warning(`处理完成：${successCount} 成功，${failCount} 失败`);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) addFilesToQueue(e.dataTransfer.files);
    },
    [addFilesToQueue]
  );

  const handleProcess = async (id: number) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    processMutation.mutate(
      { id },
      {
        onSettled: () => {
          setProcessingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
          utils.statements.list.invalidate();
          utils.transactions.list.invalidate();
          utils.bankAccounts.list.invalidate();
        },
      }
    );
  };

  const pendingCount = fileQueue.filter((f) => f.status === "pending").length;
  const doneCount = fileQueue.filter((f) => f.status === "done").length;
  const errorCount = fileQueue.filter((f) => f.status === "error").length;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">账单管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">上传银行账单，AI 自动提取交易信息</p>
        </div>
      </div>

      {/* Upload Zone */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">上传新账单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">选择银行账户</label>
            <Select value={uploadAccountId} onValueChange={setUploadAccountId}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="请选择要关联的银行账户" />
              </SelectTrigger>
              <SelectContent>
                {accounts?.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.accountName} · {acc.bankName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (!uploadAccountId) { toast.error("请先选择银行账户"); return; }
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".pdf,.csv";
              input.multiple = true;
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files && files.length > 0) addFilesToQueue(files);
              };
              input.click();
            }}
          >
            <Upload className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">拖拽文件到此处，或点击选择文件</p>
            <p className="text-xs text-muted-foreground mt-1.5">支持同时选择多个 PDF / CSV 文件，单文件最大 10MB</p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Badge variant="outline" className="text-xs">PDF</Badge>
              <Badge variant="outline" className="text-xs">CSV</Badge>
              <Badge variant="outline" className="text-xs">多文件批量</Badge>
            </div>
          </div>

          {/* File Queue */}
          {fileQueue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    待上传文件 ({fileQueue.length} 个)
                  </span>
                  {doneCount > 0 && (
                    <Badge className="bg-green-100 text-green-700 text-xs">{doneCount} 完成</Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge className="bg-red-100 text-red-700 text-xs">{errorCount} 失败</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isBatchRunning && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8"
                      onClick={clearQueue}
                    >
                      清空列表
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={runBatchUpload}
                    disabled={isBatchRunning || pendingCount === 0}
                  >
                    {isBatchRunning ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />处理中...</>
                    ) : (
                      <><Play className="h-3 w-3" />开始处理 {pendingCount > 0 ? `(${pendingCount})` : ""}</>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {fileQueue.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-sm transition-all ${
                      item.status === "done"
                        ? "border-green-200 bg-green-50/50"
                        : item.status === "error"
                        ? "border-red-200 bg-red-50/50"
                        : item.status === "uploading" || item.status === "processing"
                        ? "border-blue-200 bg-blue-50/50"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground text-xs">{item.file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(item.file.size)}</span>
                      </div>
                      {(item.status === "uploading" || item.status === "processing") && (
                        <div className="mt-1.5 space-y-0.5">
                          <Progress value={item.progress} className="h-1" />
                          <span className="text-xs text-blue-600">
                            {item.status === "uploading" ? "上传中..." : "AI 提取中..."}
                          </span>
                        </div>
                      )}
                      {item.status === "done" && (
                        <span className="text-xs text-green-600">
                          ✓ 完成，提取 {item.transactionCount ?? 0} 条交易
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="text-xs text-red-500">{item.errorMsg}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.status === "pending" && (
                        <Badge variant="outline" className="text-xs">待处理</Badge>
                      )}
                      {item.status === "done" && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {item.status === "error" && (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {(item.status === "uploading" || item.status === "processing") && (
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                      )}
                      {item.status !== "uploading" && item.status !== "processing" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => removeFromQueue(item.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter & Bulk Actions Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedAccountId} onValueChange={(v) => { setSelectedAccountId(v); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="所有账户" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">所有账户</SelectItem>
            {accounts?.map((acc) => (
              <SelectItem key={acc.id} value={String(acc.id)}>
                {acc.accountName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{statementsInView.length} 份账单</span>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">已选 {selectedIds.size} 份</span>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5 h-8 text-xs"
              onClick={handleBulkDeleteClick}
              disabled={bulkDeleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除选中 ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setSelectedIds(new Set())}
            >
              取消选择
            </Button>
          </div>
        )}
      </div>

      {/* Statements List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : statementsInView.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">暂无账单记录</p>
            <p className="text-sm text-muted-foreground/70 mt-1">上传您的第一份银行账单开始使用</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Select All Header */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 rounded-lg border border-border/40">
            <Checkbox
              checked={isAllSelected ? true : isPartialSelected ? "indeterminate" : false}
              onCheckedChange={toggleSelectAll}
              aria-label="全选账单"
            />
            <span className="text-xs text-muted-foreground font-medium">
              {isAllSelected ? `已全选 ${allIds.length} 份账单` : `全选（共 ${allIds.length} 份）`}
            </span>
          </div>

          {statementsInView.map((stmt) => {
            const statusInfo = STATUS_MAP[stmt.status];
            const StatusIcon = statusInfo.icon;
            const isProcessing = processingIds.has(stmt.id) || stmt.status === "processing";
            const account = accounts?.find((a) => a.id === stmt.bankAccountId);
            const isSelected = selectedIds.has(stmt.id);

            return (
              <Card
                key={stmt.id}
                className={`border shadow-sm transition-all ${
                  isSelected
                    ? "border-primary/50 bg-primary/5 shadow-none"
                    : "border-border/60 hover:shadow-md"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectOne(stmt.id)}
                      aria-label={`选择账单 ${stmt.fileName}`}
                      className="shrink-0"
                    />

                    <div className="p-2.5 bg-muted rounded-lg shrink-0">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{stmt.fileName}</p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {stmt.fileType.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {account && (
                          <span className="text-xs text-muted-foreground">{account.accountName} · {account.bankName}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{formatFileSize(stmt.fileSize)}</span>
                        {stmt.transactionCount ? (
                          <span className="text-xs text-muted-foreground">{stmt.transactionCount} 条交易</span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {new Date(stmt.createdAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                      {stmt.errorMessage && (
                        <p className="text-xs text-red-500 mt-1 truncate">{stmt.errorMessage}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon className={`h-3.5 w-3.5 ${isProcessing ? "animate-spin" : ""}`} />
                        {isProcessing ? "AI 处理中..." : statusInfo.label}
                      </div>

                      {stmt.status === "pending" && !isProcessing && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => handleProcess(stmt.id)}
                        >
                          <Play className="h-3 w-3" />
                          开始处理
                        </Button>
                      )}
                      {stmt.status === "failed" && !isProcessing && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 h-8 text-xs"
                          onClick={() => handleProcess(stmt.id)}
                        >
                          <Play className="h-3 w-3" />
                          重新处理
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteClick(stmt)}
                        disabled={isProcessing}
                        title="删除账单及关联交易"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Single Delete Confirm Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除账单</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除账单 <strong className="text-foreground">{deleteTarget?.fileName}</strong>，
              {deleteTarget?.txCount ? (
                <>并同步删除该账单下的 <strong className="text-destructive">{deleteTarget.txCount} 条</strong>关联交易记录。</>
              ) : (
                <>该账单暂无关联交易记录。</>
              )}
              此操作不可恢复，确认继续吗？
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

      {/* Bulk Delete Confirm Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open) setBulkDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除账单</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除已选中的 <strong className="text-foreground">{selectedIds.size} 份</strong>账单，
              {bulkTxCount > 0 ? (
                <>并同步删除这些账单下共 <strong className="text-destructive">{bulkTxCount} 条</strong>关联交易记录。</>
              ) : (
                <>这些账单暂无关联交易记录。</>
              )}
              此操作不可恢复，确认继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkDeleteOpen(false)}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate({ ids: Array.from(selectedIds) })}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "删除中..." : `确认删除 ${selectedIds.size} 份账单`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Detection Warning Dialog */}
      <AlertDialog open={!!dupWarning} onOpenChange={(open) => { if (!open) setDupWarning(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>账单可能重复</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>文件 <strong className="text-foreground">{dupWarning?.fileName}</strong> 在该账户下可能已存在。</p>
                {dupWarning?.existingCreatedAt && (
                  <p className="text-sm text-muted-foreground">已存入时间：{new Date(dupWarning.existingCreatedAt).toLocaleString("zh-CN")}</p>
                )}
                <p className="text-sm">是否仍然继续上传？（重复上传可能导致交易记录重复）</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDupWarning(null)}>取消上传</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (dupWarning) {
                  addFilesToQueueDirect(dupWarning.pendingFiles);
                  setDupWarning(null);
                }
              }}
            >
              继续上传
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
