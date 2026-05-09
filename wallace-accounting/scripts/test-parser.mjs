import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load env
const dotenv = await import("dotenv");
dotenv.config({ path: join(__dirname, "../.env") });

// Load pdfjs
const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

const LINE_TOLERANCE = 3;

function buildStructuredPdfText(pages) {
  const lines = [];
  for (const page of pages) {
    const lineMap = new Map();
    for (const item of page.items) {
      if (!item.str.trim()) continue;
      const x = Math.round(item.transform[4]);
      const y = Math.round(item.transform[5]);
      let lineKey;
      for (const key of Array.from(lineMap.keys())) {
        if (Math.abs(key - y) <= LINE_TOLERANCE) { lineKey = key; break; }
      }
      if (lineKey === undefined) { lineKey = y; lineMap.set(lineKey, []); }
      lineMap.get(lineKey).push({ x, str: item.str });
    }
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = lineMap.get(y).sort((a, b) => a.x - b.x);
      const lineText = items.map(i => i.str).join("  ");
      if (lineText.trim()) lines.push(lineText);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// Test with Apr 2025 credit card statement
const pdfPath = "/home/ubuntu/upload/TD_AEROPLAN_VISA_INFINITE_1443_Apr_24-2025.pdf";
const buffer = readFileSync(pdfPath);
const uint8 = new Uint8Array(buffer);
const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;

const pageData = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  pageData.push({
    items: content.items.map(item => ({ str: item.str, transform: item.transform })),
  });
}

const pdfText = buildStructuredPdfText(pageData);

// Show first 3000 chars of structured text
console.log("=== STRUCTURED PDF TEXT (first 3000 chars) ===");
console.log(pdfText.slice(0, 3000));
console.log("\n=== TOTAL CHARS:", pdfText.length, "===");

// Extract year
const yearMatch = pdfText.match(/20(2[0-9])/)?.[0];
console.log("\n=== DETECTED YEAR:", yearMatch, "===");
