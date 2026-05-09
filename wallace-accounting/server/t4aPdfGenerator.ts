/**
 * T4A PDF Generator
 * Generates a CRA-style T4A slip (Statement of Pension, Retirement, Annuity,
 * and Other Income) as a PDF buffer.
 *
 * Layout mirrors the official CRA T4A slip layout:
 *   - Top: Payer info (left) + Tax Year (right)
 *   - Middle: Recipient info
 *   - Bottom: Amount boxes in a grid
 */

import PDFDocument from "pdfkit";

export interface T4AData {
  taxYear: number;
  // Payer (company)
  payerName: string;
  payerBn?: string | null;
  payerAddress?: string | null;
  // Recipient
  recipientFirstName: string;
  recipientLastName: string;
  recipientSinOrBn?: string | null;
  recipientAddress?: string | null;
  recipientCity?: string | null;
  recipientProvince?: string | null;
  recipientPostalCode?: string | null;
  // Amount boxes
  box016?: string | null; // Pension or superannuation
  box020?: string | null; // Self-employment commissions
  box022?: string | null; // Income tax deducted
  box024?: string | null; // Annuities
  box028?: string | null; // Other income
  box048?: string | null; // Fees for services
  box105?: string | null; // Scholarships / bursaries
}

function fmt(val: string | null | undefined): string {
  const n = parseFloat(val ?? "0");
  if (isNaN(n) || n === 0) return "";
  return n.toFixed(2);
}

function maskSin(sin: string | null | undefined): string {
  if (!sin) return "";
  const clean = sin.replace(/\D/g, "");
  if (clean.length >= 9) {
    return `*** *** ${clean.slice(6)}`;
  }
  return sin;
}

export async function generateT4APDF(data: T4AData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 0,
      info: {
        Title: `T4A ${data.taxYear} - ${data.recipientLastName}, ${data.recipientFirstName}`,
        Author: data.payerName,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 612; // Letter width in points
    const H = 792; // Letter height in points
    const margin = 36;
    const contentW = W - margin * 2;

    // ─── Helper functions ───────────────────────────────────────────────────

    function drawRect(
      x: number,
      y: number,
      w: number,
      h: number,
      fill?: string,
      stroke?: string
    ) {
      doc.save();
      if (fill) doc.fillColor(fill);
      if (stroke) doc.strokeColor(stroke);
      doc
        .rect(x, y, w, h)
        .fillAndStroke(fill ?? "white", stroke ?? "#333333");
      doc.restore();
    }

    function label(
      text: string,
      x: number,
      y: number,
      opts?: { size?: number; bold?: boolean; color?: string; align?: "left" | "center" | "right"; width?: number }
    ) {
      doc
        .font(opts?.bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(opts?.size ?? 8)
        .fillColor(opts?.color ?? "#000000")
        .text(text, x, y, {
          width: opts?.width,
          align: opts?.align ?? "left",
          lineBreak: false,
        });
    }

    function boxField(
      boxNum: string,
      boxLabel: string,
      value: string,
      x: number,
      y: number,
      w: number,
      h: number
    ) {
      drawRect(x, y, w, h, "#FFFFFF", "#555555");
      // Box number label (top-left inside box)
      label(boxNum, x + 3, y + 2, { size: 6, color: "#666666" });
      // Box description (small, below number)
      label(boxLabel, x + 3, y + 10, { size: 6, color: "#444444", width: w - 6 });
      // Value (right-aligned, larger)
      if (value) {
        label(`$${value}`, x + 3, y + h - 14, {
          size: 9,
          bold: true,
          color: "#000000",
          align: "right",
          width: w - 6,
        });
      }
    }

    // ─── Header band ────────────────────────────────────────────────────────
    const headerY = margin;
    const headerH = 44;
    drawRect(margin, headerY, contentW, headerH, "#1A3A5C", "#1A3A5C");

    label("T4A", margin + 8, headerY + 8, {
      size: 22,
      bold: true,
      color: "#FFFFFF",
    });
    label("Statement of Pension, Retirement, Annuity, and Other Income", margin + 60, headerY + 10, {
      size: 9,
      color: "#FFFFFF",
    });
    label("Relevé des pensions, des retraites, des rentes et des autres revenus", margin + 60, headerY + 22, {
      size: 8,
      color: "#CCDDEE",
    });

    // Tax year badge
    const yearBadgeW = 70;
    drawRect(W - margin - yearBadgeW, headerY + 6, yearBadgeW, 30, "#FFFFFF", "#FFFFFF");
    label(`${data.taxYear}`, W - margin - yearBadgeW + 4, headerY + 8, {
      size: 18,
      bold: true,
      color: "#1A3A5C",
      width: yearBadgeW - 8,
      align: "center",
    });

    // ─── Payer section ──────────────────────────────────────────────────────
    let curY = headerY + headerH + 6;
    const sectionH = 70;
    const halfW = (contentW - 6) / 2;

    // Payer box (left)
    drawRect(margin, curY, halfW, sectionH, "#F5F8FF", "#AAAAAA");
    label("PAYER'S NAME AND ADDRESS / NOM ET ADRESSE DU PAYEUR", margin + 4, curY + 3, {
      size: 6,
      color: "#666666",
    });
    label(data.payerName, margin + 4, curY + 14, {
      size: 10,
      bold: true,
      color: "#000000",
      width: halfW - 8,
    });
    if (data.payerBn) {
      label(`BN: ${data.payerBn}`, margin + 4, curY + 28, { size: 8, color: "#333333" });
    }
    if (data.payerAddress) {
      label(data.payerAddress, margin + 4, curY + 40, {
        size: 8,
        color: "#333333",
        width: halfW - 8,
      });
    }

    // Recipient box (right)
    const rightX = margin + halfW + 6;
    drawRect(rightX, curY, halfW, sectionH, "#F5F8FF", "#AAAAAA");
    label("RECIPIENT'S NAME AND ADDRESS / NOM ET ADRESSE DU BÉNÉFICIAIRE", rightX + 4, curY + 3, {
      size: 6,
      color: "#666666",
    });
    const recipientName = `${data.recipientLastName.toUpperCase()}, ${data.recipientFirstName}`;
    label(recipientName, rightX + 4, curY + 14, {
      size: 10,
      bold: true,
      color: "#000000",
      width: halfW - 8,
    });
    if (data.recipientSinOrBn) {
      label(`SIN: ${maskSin(data.recipientSinOrBn)}`, rightX + 4, curY + 28, {
        size: 8,
        color: "#333333",
      });
    }
    const addrParts = [
      data.recipientAddress,
      data.recipientCity,
      data.recipientProvince,
      data.recipientPostalCode,
    ]
      .filter(Boolean)
      .join(", ");
    if (addrParts) {
      label(addrParts, rightX + 4, curY + 40, {
        size: 8,
        color: "#333333",
        width: halfW - 8,
      });
    }

    // ─── Amount boxes grid ───────────────────────────────────────────────────
    curY += sectionH + 8;

    // Section title
    drawRect(margin, curY, contentW, 16, "#E8EEF8", "#AAAAAA");
    label("INCOME / REVENUS", margin + 4, curY + 4, {
      size: 8,
      bold: true,
      color: "#1A3A5C",
    });
    curY += 16;

    const boxH = 50;
    const cols = 3;
    const boxW = (contentW - (cols - 1) * 4) / cols;
    const boxGap = 4;

    const boxes = [
      { num: "016", label: "Pension or superannuation\nPension ou retraite", value: fmt(data.box016) },
      { num: "020", label: "Self-employment commissions\nCommissions d'un travail indépendant", value: fmt(data.box020) },
      { num: "022", label: "Income tax deducted\nImpôt sur le revenu retenu", value: fmt(data.box022) },
      { num: "024", label: "Annuities\nRentes", value: fmt(data.box024) },
      { num: "028", label: "Other income\nAutres revenus", value: fmt(data.box028) },
      { num: "048", label: "Fees for services\nHonoraires ou autres sommes", value: fmt(data.box048) },
      { num: "105", label: "Scholarships, fellowships, bursaries\nBourses d'études", value: fmt(data.box105) },
    ];

    boxes.forEach((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = margin + col * (boxW + boxGap);
      const by = curY + row * (boxH + boxGap);
      boxField(b.num, b.label, b.value, bx, by, boxW, boxH);
    });

    const rows = Math.ceil(boxes.length / cols);
    curY += rows * (boxH + boxGap) + 8;

    // ─── Notes section ───────────────────────────────────────────────────────
    drawRect(margin, curY, contentW, 16, "#E8EEF8", "#AAAAAA");
    label("NOTES / REMARQUES", margin + 4, curY + 4, {
      size: 8,
      bold: true,
      color: "#1A3A5C",
    });
    curY += 16;
    drawRect(margin, curY, contentW, 40, "#FFFFFF", "#AAAAAA");
    curY += 40 + 8;

    // ─── Footer ──────────────────────────────────────────────────────────────
    drawRect(margin, curY, contentW, 20, "#1A3A5C", "#1A3A5C");
    label(
      "This is a computer-generated T4A slip. / Ce feuillet T4A est généré par ordinateur.",
      margin + 4,
      curY + 6,
      { size: 7, color: "#FFFFFF", width: contentW - 8 }
    );
    label(
      `Generated: ${new Date().toLocaleDateString("en-CA")}`,
      margin + 4,
      curY + 6,
      { size: 7, color: "#AACCEE", align: "right", width: contentW - 8 }
    );

    doc.end();
  });
}
