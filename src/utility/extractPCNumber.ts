const PC_REGEX = /PC\s*(\d{7,})/i;

function parsePC(text: string): string | null {
  const match = text.match(PC_REGEX);
  return match ? `PC${match[1]}` : null;
}

function getFileExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase() || "";
    return ext;
  } catch {
    return "";
  }
}

async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string | null> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@5.5.207/build/pdf.worker.min.mjs";

  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = "";

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  const pc = parsePC(fullText);
  if (pc) return pc;

  // Scanned PDF fallback: render first page to canvas and OCR
  if (fullText.trim().length < 20) {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    return extractTextFromImage(canvas);
  }

  return null;
}

async function extractTextFromImage(
  source: string | HTMLCanvasElement
): Promise<string | null> {
  const Tesseract = await import("tesseract.js");
  const { data } = await Tesseract.recognize(source, "eng");
  return parsePC(data.text);
}

export async function extractPCNumber(
  fileUrl: string
): Promise<string | null> {
  try {
    const ext = getFileExtension(fileUrl);
    const isPDF = ext === "pdf";
    const isImage = ["jpg", "jpeg", "png", "webp", "bmp", "tiff"].includes(ext);

    if (!isPDF && !isImage) {
      console.warn("[extractPCNumber] Unsupported file type:", ext);
      return null;
    }

    if (isPDF) {
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      return await extractTextFromPDF(buffer);
    }

    // Image path
    return await extractTextFromImage(fileUrl);
  } catch (err) {
    console.error("[extractPCNumber] Extraction failed:", err);
    return null;
  }
}
