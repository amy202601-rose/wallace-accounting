import { useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, Receipt, CheckCircle, XCircle, Loader2, Trash2, ImageIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const CATEGORIES = [
  "餐饮与娱乐", "办公用品", "广告与营销", "差旅费",
  "车辆维修与保养", "燃油费", "专业服务费", "利息与银行费用",
  "电话与网络", "教育与培训", "其他支出",
];

export default function Receipts() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [confirmReceipt, setConfirmReceipt] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Confirm form state
  const [form, setForm] = useState({
    merchantName: "",
    transactionDate: "",
    amount: "",
    currency: "CAD",
    category: "",
    description: "",
    bankAccountId: "",
    notes: "",
  });

  const utils = trpc.useUtils();
  const { data: receipts = [], isLoading } = trpc.receipts.list.useQuery();
  const { data: bankAccounts = [] } = trpc.bankAccounts.list.useQuery();

  const uploadMutation = trpc.receipts.upload.useMutation({
    onSuccess: (receipt) => {
      utils.receipts.list.invalidate();
      // Open confirm dialog with AI results
      setConfirmReceipt(receipt);
      setForm({
        merchantName: receipt?.merchantName ?? "",
        transactionDate: receipt?.transactionDate
          ? new Date(receipt.transactionDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        amount: receipt?.amount ?? "",
        currency: receipt?.currency ?? "CAD",
        category: receipt?.category ?? "",
        description: receipt?.description ?? "",
        bankAccountId: bankAccounts[0]?.id?.toString() ?? "",
        notes: "",
      });
      setIsUploading(false);
    },
    onError: (err) => {
      toast.error("上传失败：" + err.message);
      setIsUploading(false);
    },
  });

  const confirmMutation = trpc.receipts.confirm.useMutation({
    onSuccess: () => {
      toast.success("交易记录已创建");
      setConfirmReceipt(null);
      utils.receipts.list.invalidate();
      utils.transactions.list.invalidate();
      utils.bankAccounts.list.invalidate();
    },
    onError: (err) => toast.error("保存失败：" + err.message),
  });

  const rejectMutation = trpc.receipts.reject.useMutation({
    onSuccess: () => {
      toast.info("小票已忽略");
      setConfirmReceipt(null);
      utils.receipts.list.invalidate();
    },
  });

  const deleteMutation = trpc.receipts.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      setDeleteId(null);
      utils.receipts.list.invalidate();
    },
  });

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("图片不能超过 10MB");
      return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadMutation.mutate({
        imageBase64: base64,
        mimeType: file.type,
        bankAccountId: bankAccounts[0]?.id,
      });
    };
    reader.readAsDataURL(file);
  }, [uploadMutation, bankAccounts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleConfirm = () => {
    if (!form.transactionDate || !form.amount || !form.bankAccountId) {
      toast.error("请填写日期、金额和账户");
      return;
    }
    confirmMutation.mutate({
      id: confirmReceipt.id,
      merchantName: form.merchantName || undefined,
      transactionDate: form.transactionDate,
      amount: form.amount,
      currency: form.currency,
      category: form.category || undefined,
      description: form.description || undefined,
      bankAccountId: parseInt(form.bankAccountId),
      notes: form.notes || undefined,
    });
  };

  const statusBadge = (status: string) => {
    if (status === "confirmed") return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">已入账</Badge>;
    if (status === "rejected") return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">已忽略</Badge>;
    return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">待确认</Badge>;
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">小票上传</h1>
        <p className="text-muted-foreground text-sm mt-1">拍照或上传小票，AI 自动识别金额和商家信息</p>
      </div>

      {/* Upload Buttons - Mobile-first prominent design */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 active:scale-95 transition-all p-6 cursor-pointer disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <Camera className="w-8 h-8 text-primary" />
          )}
          <span className="text-sm font-semibold text-primary">拍照</span>
          <span className="text-xs text-muted-foreground">直接拍小票</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 active:scale-95 transition-all p-6 cursor-pointer disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-violet-400" />
          )}
          <span className="text-sm font-semibold text-violet-400">从相册选图</span>
          <span className="text-xs text-muted-foreground">选择已有照片</span>
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Upload status */}
      {isUploading && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <div>
              <p className="text-sm font-medium text-foreground">AI 正在识别小票...</p>
              <p className="text-xs text-muted-foreground">通常需要 5-15 秒</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">上传记录</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Receipt className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">还没有上传记录</p>
            <p className="text-xs mt-1">点击上方按钮拍照或上传小票</p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((r: any) => (
              <Card key={r.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border/50">
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt="小票" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-sm text-foreground truncate">
                          {r.merchantName ?? "未知商家"}
                        </p>
                        {statusBadge(r.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {r.amount && (
                          <span className="font-semibold text-red-400">
                            -{r.currency ?? "CAD"}${parseFloat(r.amount).toFixed(2)}
                          </span>
                        )}
                        {r.transactionDate && (
                          <span>{new Date(r.transactionDate).toLocaleDateString("zh-CN")}</span>
                        )}
                        {r.category && <span>{r.category}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {r.status === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => {
                            setConfirmReceipt(r);
                            setForm({
                              merchantName: r.merchantName ?? "",
                              transactionDate: r.transactionDate
                                ? new Date(r.transactionDate).toISOString().split("T")[0]
                                : new Date().toISOString().split("T")[0],
                              amount: r.amount ?? "",
                              currency: r.currency ?? "CAD",
                              category: r.category ?? "",
                              description: r.description ?? "",
                              bankAccountId: bankAccounts[0]?.id?.toString() ?? "",
                              notes: "",
                            });
                          }}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => setDeleteId(r.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmReceipt} onOpenChange={(open) => !open && setConfirmReceipt(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              确认小票信息
            </DialogTitle>
          </DialogHeader>

          {/* Receipt image preview */}
          {confirmReceipt?.imageUrl && (
            <div className="rounded-lg overflow-hidden border border-border/50 max-h-40">
              <img src={confirmReceipt.imageUrl} alt="小票" className="w-full object-contain max-h-40" />
            </div>
          )}

          {/* AI confidence */}
          {confirmReceipt?.aiConfidence && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              <span className="text-amber-400">✦</span>
              AI 识别置信度：{confirmReceipt.aiConfidence}%，请核对以下信息
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">商家名称</Label>
                <Input
                  value={form.merchantName}
                  onChange={(e) => setForm(f => ({ ...f, merchantName: e.target.value }))}
                  placeholder="商家名称"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">日期 *</Label>
                <Input
                  type="date"
                  value={form.transactionDate}
                  onChange={(e) => setForm(f => ({ ...f, transactionDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">金额 *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">币种</Label>
                <Select value={form.currency} onValueChange={(v) => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">记账账户 *</Label>
              <Select value={form.bankAccountId} onValueChange={(v) => setForm(f => ({ ...f, bankAccountId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择账户" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">分类</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">描述</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="消费描述"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => rejectMutation.mutate({ id: confirmReceipt.id })}
              disabled={rejectMutation.isPending}
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-1" />
              忽略
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmMutation.isPending}
              className="flex-1"
            >
              {confirmMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-1" />
              )}
              确认入账
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复，关联的交易记录不受影响。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
