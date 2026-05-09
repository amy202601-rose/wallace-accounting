import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  FilePlus,
  Download,
  Pencil,
  Trash2,
  FileText,
  Users,
  Loader2,
} from "lucide-react";

const CA_PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
];

const CURRENT_YEAR = new Date().getFullYear();
const TAX_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

// ─── Recipient Form ───────────────────────────────────────────────────────────

interface RecipientFormData {
  firstName: string;
  lastName: string;
  sinOrBn: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyRecipient = (): RecipientFormData => ({
  firstName: "",
  lastName: "",
  sinOrBn: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  email: "",
  phone: "",
  notes: "",
});

// ─── T4A Record Form ──────────────────────────────────────────────────────────

interface RecordFormData {
  recipientId: string;
  taxYear: string;
  payerName: string;
  payerBn: string;
  payerAddress: string;
  box016: string;
  box020: string;
  box022: string;
  box024: string;
  box028: string;
  box048: string;
  box105: string;
  status: "draft" | "final";
  notes: string;
}

const emptyRecord = (): RecordFormData => ({
  recipientId: "",
  taxYear: String(CURRENT_YEAR - 1),
  payerName: "Wallace Financial Service",
  payerBn: "",
  payerAddress: "",
  box016: "",
  box020: "",
  box022: "",
  box024: "",
  box028: "",
  box048: "",
  box105: "",
  status: "draft",
  notes: "",
});

const BOX_FIELDS: { key: keyof RecordFormData; label: string; desc: string }[] = [
  { key: "box016", label: "Box 016", desc: "Pension or superannuation" },
  { key: "box020", label: "Box 020", desc: "Self-employment commissions" },
  { key: "box022", label: "Box 022", desc: "Income tax deducted" },
  { key: "box024", label: "Box 024", desc: "Annuities" },
  { key: "box028", label: "Box 028", desc: "Other income" },
  { key: "box048", label: "Box 048", desc: "Fees for services" },
  { key: "box105", label: "Box 105", desc: "Scholarships / bursaries" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function T4A() {
  const utils = trpc.useUtils();

  // ── State ──
  const [activeTab, setActiveTab] = useState("records");
  const [filterYear, setFilterYear] = useState<string>("all");

  // Recipient dialog
  const [recipientDialog, setRecipientDialog] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<number | null>(null);
  const [recipientForm, setRecipientForm] = useState<RecipientFormData>(emptyRecipient());
  const [deleteRecipientId, setDeleteRecipientId] = useState<number | null>(null);

  // Record dialog
  const [recordDialog, setRecordDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<number | null>(null);
  const [recordForm, setRecordForm] = useState<RecordFormData>(emptyRecord());
  const [deleteRecordId, setDeleteRecordId] = useState<number | null>(null);

  // PDF generation loading
  const [generatingPdf, setGeneratingPdf] = useState<number | null>(null);

  // ── Queries ──
  const { data: recipients = [], isLoading: loadingRecipients } =
    trpc.t4a.listRecipients.useQuery();

  const { data: records = [], isLoading: loadingRecords } =
    trpc.t4a.listRecords.useQuery({
      taxYear: filterYear !== "all" ? parseInt(filterYear) : undefined,
    });

  // ── Mutations ──
  const createRecipient = trpc.t4a.createRecipient.useMutation({
    onSuccess: () => {
      utils.t4a.listRecipients.invalidate();
      setRecipientDialog(false);
      toast.success("收款人已添加");
    },
    onError: (e) => toast.error("添加失败: " + e.message),
  });

  const updateRecipient = trpc.t4a.updateRecipient.useMutation({
    onSuccess: () => {
      utils.t4a.listRecipients.invalidate();
      setRecipientDialog(false);
      toast.success("收款人已更新");
    },
    onError: (e) => toast.error("更新失败: " + e.message),
  });

  const deleteRecipient = trpc.t4a.deleteRecipient.useMutation({
    onSuccess: () => {
      utils.t4a.listRecipients.invalidate();
      utils.t4a.listRecords.invalidate();
      setDeleteRecipientId(null);
      toast.success("收款人已删除");
    },
    onError: (e) => toast.error("删除失败: " + e.message),
  });

  const createRecord = trpc.t4a.createRecord.useMutation({
    onSuccess: () => {
      utils.t4a.listRecords.invalidate();
      setRecordDialog(false);
      toast.success("T4A 税单已创建");
    },
    onError: (e) => toast.error("创建失败: " + e.message),
  });

  const updateRecord = trpc.t4a.updateRecord.useMutation({
    onSuccess: () => {
      utils.t4a.listRecords.invalidate();
      setRecordDialog(false);
      toast.success("T4A 税单已更新");
    },
    onError: (e) => toast.error("更新失败: " + e.message),
  });

  const deleteRecord = trpc.t4a.deleteRecord.useMutation({
    onSuccess: () => {
      utils.t4a.listRecords.invalidate();
      setDeleteRecordId(null);
      toast.success("T4A 税单已删除");
    },
    onError: (e) => toast.error("删除失败: " + e.message),
  });

  const generatePdf = trpc.t4a.generatePdf.useMutation({
    onSuccess: (data) => {
      setGeneratingPdf(null);
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.fileName;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("PDF 已生成: " + data.fileName);
    },
    onError: (e) => {
      setGeneratingPdf(null);
      toast.error("PDF 生成失败: " + e.message);
    },
  });

  // ── Handlers ──
  function openNewRecipient() {
    setEditingRecipient(null);
    setRecipientForm(emptyRecipient());
    setRecipientDialog(true);
  }

  function openEditRecipient(r: typeof recipients[0]) {
    setEditingRecipient(r.id);
    setRecipientForm({
      firstName: r.firstName,
      lastName: r.lastName,
      sinOrBn: r.sinOrBn ?? "",
      address: r.address ?? "",
      city: r.city ?? "",
      province: r.province ?? "",
      postalCode: r.postalCode ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      notes: r.notes ?? "",
    });
    setRecipientDialog(true);
  }

  function submitRecipient() {
    const payload = {
      firstName: recipientForm.firstName.trim(),
      lastName: recipientForm.lastName.trim(),
      sinOrBn: recipientForm.sinOrBn.trim() || undefined,
      address: recipientForm.address.trim() || undefined,
      city: recipientForm.city.trim() || undefined,
      province: recipientForm.province || undefined,
      postalCode: recipientForm.postalCode.trim() || undefined,
      email: recipientForm.email.trim() || undefined,
      phone: recipientForm.phone.trim() || undefined,
      notes: recipientForm.notes.trim() || undefined,
    };
    if (editingRecipient !== null) {
      updateRecipient.mutate({ id: editingRecipient, ...payload });
    } else {
      createRecipient.mutate(payload);
    }
  }

  function openNewRecord() {
    setEditingRecord(null);
    setRecordForm(emptyRecord());
    setRecordDialog(true);
  }

  function openEditRecord(row: typeof records[0]) {
    const rec = row.record;
    setEditingRecord(rec.id);
    setRecordForm({
      recipientId: String(rec.recipientId),
      taxYear: String(rec.taxYear),
      payerName: rec.payerName,
      payerBn: rec.payerBn ?? "",
      payerAddress: rec.payerAddress ?? "",
      box016: rec.box016 ?? "",
      box020: rec.box020 ?? "",
      box022: rec.box022 ?? "",
      box024: rec.box024 ?? "",
      box028: rec.box028 ?? "",
      box048: rec.box048 ?? "",
      box105: rec.box105 ?? "",
      status: rec.status as "draft" | "final",
      notes: rec.notes ?? "",
    });
    setRecordDialog(true);
  }

  function submitRecord() {
    const toBox = (v: string) => (v.trim() === "" ? "0.00" : v.trim());
    const payload = {
      recipientId: parseInt(recordForm.recipientId),
      taxYear: parseInt(recordForm.taxYear),
      payerName: recordForm.payerName.trim(),
      payerBn: recordForm.payerBn.trim() || undefined,
      payerAddress: recordForm.payerAddress.trim() || undefined,
      box016: toBox(recordForm.box016),
      box020: toBox(recordForm.box020),
      box022: toBox(recordForm.box022),
      box024: toBox(recordForm.box024),
      box028: toBox(recordForm.box028),
      box048: toBox(recordForm.box048),
      box105: toBox(recordForm.box105),
      status: recordForm.status,
      notes: recordForm.notes.trim() || undefined,
    };
    if (editingRecord !== null) {
      updateRecord.mutate({ id: editingRecord, ...payload });
    } else {
      createRecord.mutate(payload);
    }
  }

  function handleGeneratePdf(id: number) {
    setGeneratingPdf(id);
    generatePdf.mutate({ id });
  }

  function fmtAmount(val: string | null | undefined) {
    const n = parseFloat(val ?? "0");
    if (isNaN(n) || n === 0) return "—";
    return `CA$${n.toFixed(2)}`;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">T4A 税单管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Statement of Pension, Retirement, Annuity, and Other Income
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "recipients" ? (
            <Button onClick={openNewRecipient} size="sm">
              <UserPlus className="w-4 h-4 mr-2" />
              添加收款人
            </Button>
          ) : (
            <Button onClick={openNewRecord} size="sm" disabled={recipients.length === 0}>
              <FilePlus className="w-4 h-4 mr-2" />
              新建 T4A
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="records">
            <FileText className="w-4 h-4 mr-2" />
            T4A 税单
          </TabsTrigger>
          <TabsTrigger value="recipients">
            <Users className="w-4 h-4 mr-2" />
            收款人管理
          </TabsTrigger>
        </TabsList>

        {/* ── T4A Records Tab ── */}
        <TabsContent value="records">
          {/* Filter bar */}
          <div className="flex items-center gap-3 mb-4">
            <Label className="text-sm text-muted-foreground">税务年度：</Label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部年度</SelectItem>
                {TAX_YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              共 {records.length} 份税单
            </span>
          </div>

          {loadingRecords ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-lg">
              <FileText className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暂无 T4A 税单</p>
              {recipients.length === 0 && (
                <p className="text-xs mt-1">请先在「收款人管理」中添加收款人</p>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_1fr_100px_100px_100px_120px] bg-muted/50 text-xs font-medium text-muted-foreground px-4 py-2 gap-2">
                <div>收款人</div>
                <div>年度</div>
                <div>付款人</div>
                <div className="text-right">Box 048 服务费</div>
                <div className="text-right">Box 020 佣金</div>
                <div className="text-right">Box 022 预扣税</div>
                <div className="text-right">操作</div>
              </div>
              {records.map(({ record, recipient }) => (
                <div
                  key={record.id}
                  className="grid grid-cols-[1fr_80px_1fr_100px_100px_100px_120px] px-4 py-3 gap-2 border-t items-center hover:bg-muted/20 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {recipient
                        ? `${recipient.lastName}, ${recipient.firstName}`
                        : "—"}
                    </p>
                    {recipient?.sinOrBn && (
                      <p className="text-xs text-muted-foreground">
                        SIN: ***-***-{recipient.sinOrBn.replace(/\D/g, "").slice(-3)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Badge variant="outline">{record.taxYear}</Badge>
                  </div>
                  <div className="text-muted-foreground truncate">{record.payerName}</div>
                  <div className="text-right font-mono text-sm">{fmtAmount(record.box048)}</div>
                  <div className="text-right font-mono text-sm">{fmtAmount(record.box020)}</div>
                  <div className="text-right font-mono text-sm text-destructive">{fmtAmount(record.box022)}</div>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="生成 PDF"
                      disabled={generatingPdf === record.id}
                      onClick={() => handleGeneratePdf(record.id)}
                    >
                      {generatingPdf === record.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="编辑"
                      onClick={() => openEditRecord({ record, recipient })}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="删除"
                      onClick={() => setDeleteRecordId(record.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Recipients Tab ── */}
        <TabsContent value="recipients">
          {loadingRecipients ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : recipients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border border-dashed rounded-lg">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">暂无收款人</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_1fr_1fr_80px] bg-muted/50 text-xs font-medium text-muted-foreground px-4 py-2 gap-2">
                <div>姓名</div>
                <div>SIN / BN</div>
                <div>地址</div>
                <div>联系方式</div>
                <div className="text-right">操作</div>
              </div>
              {recipients.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_120px_1fr_1fr_80px] px-4 py-3 gap-2 border-t items-center hover:bg-muted/20 text-sm"
                >
                  <div>
                    <p className="font-medium">{r.lastName}, {r.firstName}</p>
                  </div>
                  <div className="text-muted-foreground font-mono text-xs">
                    {r.sinOrBn || "—"}
                  </div>
                  <div className="text-muted-foreground text-xs truncate">
                    {[r.address, r.city, r.province, r.postalCode].filter(Boolean).join(", ") || "—"}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {r.email || r.phone || "—"}
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEditRecipient(r)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteRecipientId(r.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Recipient Dialog ── */}
      <Dialog open={recipientDialog} onOpenChange={setRecipientDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRecipient !== null ? "编辑收款人" : "添加收款人"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div>
              <Label>名字 (First Name) *</Label>
              <Input
                value={recipientForm.firstName}
                onChange={(e) => setRecipientForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="John"
              />
            </div>
            <div>
              <Label>姓氏 (Last Name) *</Label>
              <Input
                value={recipientForm.lastName}
                onChange={(e) => setRecipientForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Smith"
              />
            </div>
            <div className="col-span-2">
              <Label>SIN / Business Number</Label>
              <Input
                value={recipientForm.sinOrBn}
                onChange={(e) => setRecipientForm((f) => ({ ...f, sinOrBn: e.target.value }))}
                placeholder="123 456 789"
              />
            </div>
            <div className="col-span-2">
              <Label>地址</Label>
              <Input
                value={recipientForm.address}
                onChange={(e) => setRecipientForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St"
              />
            </div>
            <div>
              <Label>城市</Label>
              <Input
                value={recipientForm.city}
                onChange={(e) => setRecipientForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Victoria"
              />
            </div>
            <div>
              <Label>省份</Label>
              <Select
                value={recipientForm.province}
                onValueChange={(v) => setRecipientForm((f) => ({ ...f, province: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择省份" />
                </SelectTrigger>
                <SelectContent>
                  {CA_PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>邮政编码</Label>
              <Input
                value={recipientForm.postalCode}
                onChange={(e) => setRecipientForm((f) => ({ ...f, postalCode: e.target.value }))}
                placeholder="V8W 1A1"
              />
            </div>
            <div>
              <Label>电话</Label>
              <Input
                value={recipientForm.phone}
                onChange={(e) => setRecipientForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+1 250 555 0100"
              />
            </div>
            <div className="col-span-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                value={recipientForm.email}
                onChange={(e) => setRecipientForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
            <div className="col-span-2">
              <Label>备注</Label>
              <Textarea
                value={recipientForm.notes}
                onChange={(e) => setRecipientForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipientDialog(false)}>
              取消
            </Button>
            <Button
              onClick={submitRecipient}
              disabled={
                !recipientForm.firstName.trim() ||
                !recipientForm.lastName.trim() ||
                createRecipient.isPending ||
                updateRecipient.isPending
              }
            >
              {createRecipient.isPending || updateRecipient.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingRecipient !== null ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Dialog ── */}
      <Dialog open={recordDialog} onOpenChange={setRecordDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord !== null ? "编辑 T4A 税单" : "新建 T4A 税单"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>收款人 *</Label>
                <Select
                  value={recordForm.recipientId}
                  onValueChange={(v) => setRecordForm((f) => ({ ...f, recipientId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择收款人" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.lastName}, {r.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>税务年度 *</Label>
                <Select
                  value={recordForm.taxYear}
                  onValueChange={(v) => setRecordForm((f) => ({ ...f, taxYear: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Payer info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>付款人名称 (Payer Name) *</Label>
                <Input
                  value={recordForm.payerName}
                  onChange={(e) => setRecordForm((f) => ({ ...f, payerName: e.target.value }))}
                  placeholder="Wallace Financial Service"
                />
              </div>
              <div>
                <Label>Business Number (BN)</Label>
                <Input
                  value={recordForm.payerBn}
                  onChange={(e) => setRecordForm((f) => ({ ...f, payerBn: e.target.value }))}
                  placeholder="123456789 RT0001"
                />
              </div>
              <div className="col-span-2">
                <Label>付款人地址</Label>
                <Input
                  value={recordForm.payerAddress}
                  onChange={(e) => setRecordForm((f) => ({ ...f, payerAddress: e.target.value }))}
                  placeholder="123 Main St, Victoria, BC V8W 1A1"
                />
              </div>
            </div>
            {/* Amount boxes */}
            <div>
              <p className="text-sm font-medium mb-2 text-muted-foreground">金额字段（留空表示 $0）</p>
              <div className="grid grid-cols-2 gap-3">
                {BOX_FIELDS.map((f) => (
                  <div key={f.key}>
                    <Label>
                      {f.label}
                      <span className="text-muted-foreground font-normal ml-1 text-xs">
                        — {f.desc}
                      </span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        CA$
                      </span>
                      <Input
                        className="pl-10"
                        type="number"
                        step="0.01"
                        min="0"
                        value={recordForm[f.key] as string}
                        onChange={(e) =>
                          setRecordForm((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Status + notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>状态</Label>
                <Select
                  value={recordForm.status}
                  onValueChange={(v) =>
                    setRecordForm((f) => ({ ...f, status: v as "draft" | "final" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="final">最终版</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>备注</Label>
                <Input
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialog(false)}>
              取消
            </Button>
            <Button
              onClick={submitRecord}
              disabled={
                !recordForm.recipientId ||
                !recordForm.payerName.trim() ||
                createRecord.isPending ||
                updateRecord.isPending
              }
            >
              {createRecord.isPending || updateRecord.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingRecord !== null ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Recipient Confirm ── */}
      <AlertDialog
        open={deleteRecipientId !== null}
        onOpenChange={(open) => !open && setDeleteRecipientId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除收款人</AlertDialogTitle>
            <AlertDialogDescription>
              删除收款人将同时删除该收款人的所有 T4A 税单记录，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRecipientId !== null && deleteRecipient.mutate({ id: deleteRecipientId })}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Record Confirm ── */}
      <AlertDialog
        open={deleteRecordId !== null}
        onOpenChange={(open) => !open && setDeleteRecordId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除 T4A 税单</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除该 T4A 税单记录，不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRecordId !== null && deleteRecord.mutate({ id: deleteRecordId })}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
