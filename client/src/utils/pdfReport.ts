type PdfImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

type SummaryCard = {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
};

type TableColumn<T> = {
  label: string;
  width: number;
  value: (row: T) => string;
  align?: "left" | "right";
};

type ReportTable<T> = {
  title: string;
  rows: T[];
  columns: TableColumn<T>[];
  emptyText?: string;
};

type ReportChartSeries = {
  key: string;
  label: string;
  color: string;
};

type ReportChart = {
  title: string;
  xKey: string;
  data: Array<Record<string, string | number>>;
  series: ReportChartSeries[];
};

type ReportPdfConfig = {
  title: string;
  eyebrow: string;
  generatedAt: string;
  summaryCards: SummaryCard[];
  charts?: ReportChart[];
  tables: Array<ReportTable<any>>;
  footerNote?: string;
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 44;
const encoder = new TextEncoder();

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

function color(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function pdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function textWidth(value: string, size: number) {
  return value.length * size * 0.52;
}

function wrapText(value: string, maxWidth: number, size: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) {
    lines.push(line);
  }
  return lines;
}

function pdfY(top: number, height = 0) {
  return pageHeight - top - height;
}

function streamLength(stream: string) {
  return encoder.encode(stream).length;
}

class PdfCanvas {
  private content = "";
  cursorTop = 0;

  constructor(private readonly imageName: string | null) {}

  raw(value: string) {
    this.content += `${value}\n`;
  }

  fill(hex: string) {
    this.raw(`${color(hex)} rg`);
  }

  stroke(hex: string) {
    this.raw(`${color(hex)} RG`);
  }

  rect(x: number, top: number, width: number, height: number, hex: string) {
    this.fill(hex);
    this.raw(`${x} ${pdfY(top, height)} ${width} ${height} re f`);
  }

  line(
    x1: number,
    top1: number,
    x2: number,
    top2: number,
    hex: string,
    width = 1,
  ) {
    this.stroke(hex);
    this.raw(`${width} w ${x1} ${pdfY(top1)} m ${x2} ${pdfY(top2)} l S`);
  }

  text(
    value: string,
    x: number,
    top: number,
    size: number,
    options: {
      font?: "regular" | "bold";
      color?: string;
      align?: "left" | "right";
      maxWidth?: number;
    } = {},
  ) {
    const font = options.font === "bold" ? "F2" : "F1";
    const safeText = pdfText(value);
    const textX =
      options.align === "right"
        ? x - textWidth(safeText, size)
        : x;
    this.fill(options.color ?? "#0B1818");
    this.raw(
      `BT /${font} ${size} Tf ${textX} ${pdfY(top + size)} Td (${safeText}) Tj ET`,
    );
  }

  wrappedText(
    value: string,
    x: number,
    top: number,
    maxWidth: number,
    size: number,
    options: { color?: string; font?: "regular" | "bold" } = {},
  ) {
    const lines = wrapText(value, maxWidth, size);
    lines.forEach((line, index) => {
      this.text(line, x, top + index * (size + 4), size, options);
    });
    return Math.max(lines.length, 1) * (size + 4);
  }

  image(x: number, top: number, width: number, height: number) {
    if (!this.imageName) {
      return;
    }
    this.raw("q");
    this.raw(`${width} 0 0 ${height} ${x} ${pdfY(top, height)} cm`);
    this.raw(`/${this.imageName} Do`);
    this.raw("Q");
  }

  output() {
    return this.content;
  }
}

async function loadLogo(): Promise<PdfImage | null> {
  if (typeof window === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 192;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }
      context.fillStyle = "#06100e";
      context.fillRect(0, 0, size, size);
      const scale = Math.min(size / image.width, size / image.height) * 0.84;
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(
        image,
        (size - width) / 2,
        (size - height) / 2,
        width,
        height,
      );
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const base64 = dataUrl.split(",")[1] ?? "";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      resolve({ bytes, width: size, height: size });
    };
    image.onerror = () => resolve(null);
    image.src = "/moneymate-logo.png";
  });
}

function drawHeader(
  page: PdfCanvas,
  config: ReportPdfConfig,
  logo: PdfImage | null,
) {
  page.rect(0, 0, pageWidth, 120, "#06100e");
  page.rect(0, 118, pageWidth, 4, "#49c5b6");
  page.rect(0, 122, pageWidth, 5, "#dffaf4");
  if (logo) {
    page.image(margin, 30, 48, 48);
  } else {
    page.text("M", margin + 13, 35, 24, {
      color: "#49c5b6",
      font: "bold",
    });
  }
  page.text("MoneyMate", margin + 62, 32, 21, {
    color: "#ffffff",
    font: "bold",
  });
  page.text(config.eyebrow, margin + 62, 59, 9, {
    color: "#49C5B6",
    font: "bold",
  });
  page.text(config.title, margin, 92, 19, {
    color: "#ffffff",
    font: "bold",
  });
  page.text(config.generatedAt, pageWidth - margin, 95, 8, {
    align: "right",
    color: "#b7c7c4",
  });
  page.cursorTop = 148;
}

function drawFooter(page: PdfCanvas, pageNumber: number, note?: string) {
  page.line(margin, pageHeight - 42, pageWidth - margin, pageHeight - 42, "#d8ebe7");
  page.text(note ?? "Generated by MoneyMate", margin, pageHeight - 30, 8, {
    color: "#5b706d",
  });
  page.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 30, 8, {
    align: "right",
    color: "#5b706d",
  });
}

function drawSummaryCards(page: PdfCanvas, cards: SummaryCard[]) {
  const gap = 12;
  const width = (pageWidth - margin * 2 - gap * 2) / 3;
  cards.slice(0, 3).forEach((card, index) => {
    const x = margin + index * (width + gap);
    const y = page.cursorTop;
    const toneColor =
      card.tone === "negative"
        ? "#e85e6f"
        : card.tone === "positive"
          ? "#168f79"
          : "#17635c";
    page.rect(x, y, width, 72, "#eefaf7");
    page.line(x, y, x + width, y, "#49c5b6", 2);
    page.text(card.label.toUpperCase(), x + 14, y + 17, 7.5, {
      color: "#5b706d",
      font: "bold",
    });
    page.text(card.value, x + 14, y + 43, 15, {
      color: toneColor,
      font: "bold",
    });
  });
  page.cursorTop += 96;
}

function drawSectionTitle(page: PdfCanvas, title: string) {
  page.text(title, margin, page.cursorTop, 14, {
    color: "#0b1818",
    font: "bold",
  });
  page.line(margin, page.cursorTop + 22, pageWidth - margin, page.cursorTop + 22, "#d8ebe7");
  page.cursorTop += 36;
}

function drawChartSection(
  page: PdfCanvas,
  chart: ReportChart,
) {
  const chartHeight = 120;
  const chartTop = page.cursorTop;
  const chartWidth = pageWidth - margin * 2;
  if (!chart.data.length) {
    return;
  }

  const maxValue = Math.max(
    ...chart.data.flatMap((row) =>
      chart.series.map((series) => Number(row[series.key]) || 0),
    ),
    1,
  );
  const groupWidth = chartWidth / (chart.data.length * chart.series.length + chart.data.length + 1);
  const barWidth = Math.max(16, groupWidth * 0.85);
  const baseline = chartTop + chartHeight - 24;

  page.text(chart.title, margin, chartTop, 12, {
    color: "#0b1818",
    font: "bold",
  });
  page.cursorTop += 22;

  page.line(margin, baseline, margin + chartWidth, baseline, "#d8ebe7", 1);

  chart.data.forEach((row, rowIndex) => {
    const groupX = margin + groupWidth + rowIndex * (groupWidth * (chart.series.length + 1));
    chart.series.forEach((series, seriesIndex) => {
      const value = Number(row[series.key]) || 0;
      const height = (value / maxValue) * (chartHeight - 40);
      const x = groupX + seriesIndex * (barWidth + groupWidth * 0.2);
      page.rect(x, baseline - height, barWidth, height, series.color);
    });
    page.text(String(row[chart.xKey]), groupX, baseline + 8, 8, {
      color: "#5b706d",
    });
  });

  let legendX = margin;
  const legendY = baseline + 26;
  chart.series.forEach((series) => {
    page.rect(legendX, legendY - 7, 10, 10, series.color);
    page.text(series.label, legendX + 16, legendY - 2, 8, {
      color: "#5b706d",
    });
    legendX += 72 + textWidth(series.label, 8);
  });

  page.cursorTop += chartHeight + 18;
}

function drawTable<T>(
  pages: PdfCanvas[],
  table: ReportTable<T>,
  logo: PdfImage | null,
  config: ReportPdfConfig,
) {
  let page = pages[pages.length - 1];
  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 28;

  const newPage = () => {
    drawFooter(page, pages.length, config.footerNote);
    page = new PdfCanvas(logo ? "Logo" : null);
    pages.push(page);
    drawHeader(page, config, logo);
  };

  if (page.cursorTop + 80 > pageHeight - 70) {
    newPage();
  }
  drawSectionTitle(page, table.title);

  const drawHeaderRow = () => {
    page.rect(margin, page.cursorTop, tableWidth, rowHeight, "#0b2f2c");
    let x = margin;
    table.columns.forEach((column) => {
      page.text(column.label, x + 10, page.cursorTop + 10, 8, {
        color: "#ffffff",
        font: "bold",
      });
      x += column.width;
    });
    page.cursorTop += rowHeight;
  };

  drawHeaderRow();

  const rows = table.rows.length ? table.rows : ([null] as Array<T | null>);
  rows.forEach((row, index) => {
    if (page.cursorTop + rowHeight > pageHeight - 74) {
      newPage();
      drawSectionTitle(page, table.title);
      drawHeaderRow();
    }

    const isEmptyRow = row === null;
    const rowTone =
      !isEmptyRow &&
      table.title === "Month-by-month breakdown" &&
      typeof (row as { netSavings?: unknown }).netSavings === "number"
        ? Number((row as { netSavings: number }).netSavings) >= 0
          ? "#ecfbf2"
          : "#ffe8ec"
        : null;
    const rowColor = rowTone ?? (index % 2 === 0 ? "#ffffff" : "#f4fbf9");
    page.rect(margin, page.cursorTop, tableWidth, rowHeight, rowColor);

    if (isEmptyRow) {
      page.text(table.emptyText ?? "No data available.", margin + 10, page.cursorTop + 10, 8.5, {
        color: "#5b706d",
      });
    } else {
      let x = margin;
      table.columns.forEach((column) => {
        const value = column.value(row);
        const textX =
          column.align === "right"
            ? x + column.width - 10
            : x + 10;
        page.text(value, textX, page.cursorTop + 10, 8.5, {
          align: column.align,
          color: "#152525",
        });
        x += column.width;
      });
    }
    page.cursorTop += rowHeight;
  });

  page.cursorTop += 22;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function createBlob(parts: Array<string | Uint8Array>) {
  const encodedParts: BlobPart[] = parts.map((part) =>
    typeof part === "string" ? encoder.encode(part) : toArrayBuffer(part),
  );
  return new Blob(encodedParts, { type: "application/pdf" });
}

export async function buildThemedReportPdf(config: ReportPdfConfig) {
  const logo = await loadLogo();
  const pages = [new PdfCanvas(logo ? "Logo" : null)];
  drawHeader(pages[0], config, logo);
  drawSummaryCards(pages[0], config.summaryCards);
  config.charts?.forEach((chart) => {
    if (pages[pages.length - 1].cursorTop + 160 > pageHeight - 70) {
      drawFooter(pages[pages.length - 1], pages.length, config.footerNote);
      const newPage = new PdfCanvas(logo ? "Logo" : null);
      pages.push(newPage);
      drawHeader(newPage, config, logo);
    }
    drawChartSection(pages[pages.length - 1], chart);
  });
  config.tables.forEach((table) => {
    drawTable(pages, table, logo, config);
  });
  drawFooter(pages[pages.length - 1], pages.length, config.footerNote);

  const objects: Array<Array<string | Uint8Array>> = [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    [""],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"],
  ];
  let logoRef: number | null = null;
  if (logo) {
    logoRef = objects.length + 1;
    objects.push([
      (
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} ` +
        `/Height ${logo.height} /ColorSpace /DeviceRGB ` +
        "/BitsPerComponent 8 /Filter /DCTDecode " +
        `/Length ${logo.bytes.length} >> stream\n`
      ),
      logo.bytes,
      "\nendstream",
    ]);
  }

  const pageRefs: number[] = [];
  const pageObjects: Array<Array<string | Uint8Array>> = [];
  pages.forEach((page) => {
    const pageRef = objects.length + pageObjects.length + 1;
    const contentRef = pageRef + 1;
    pageRefs.push(pageRef);
    const xObject = logoRef
      ? `/XObject << /Logo ${logoRef} 0 R >>`
      : "";
    pageObjects.push([
      (
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ` +
        `${pageHeight}] /Resources << /Font << /F1 3 0 R ` +
        `/F2 4 0 R >> ${xObject} >> /Contents ${contentRef} 0 R >>`
      ),
    ]);
    const stream = page.output();
    pageObjects.push([
      `<< /Length ${streamLength(stream)} >> stream\n${stream}endstream`,
    ]);
  });

  objects[1] = [
    `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`,
  ];
  objects.push(...pageObjects);

  const pdfHeader = "%PDF-1.4\n";
  const parts: Array<string | Uint8Array> = [pdfHeader];
  const offsets = [0];
  let byteLength = streamLength(pdfHeader);

  objects.forEach((objectParts, index) => {
    const ref = index + 1;
    offsets.push(byteLength);
    const header = `${ref} 0 obj\n`;
    parts.push(header);
    byteLength += streamLength(header);
    objectParts.forEach((part) => {
      parts.push(part);
      byteLength += (
        typeof part === "string" ? streamLength(part) : part.length
      );
    });
    const footer = "\nendobj\n";
    parts.push(footer);
    byteLength += streamLength(footer);
  });

  const xrefStart = byteLength;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    `trailer << /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
  ].join("\n");
  parts.push(xref);
  return createBlob(parts);
}

export function triggerPdfDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
