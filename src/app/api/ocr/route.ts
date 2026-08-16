import { NextRequest, NextResponse } from "next/server";
import { processAlbaranOCR } from "@/lib/ocrService";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const apiKeyOverride = formData.get("apiKey") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const pdfDataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

    // Process file with Gemini Vision OCR
    const ocrData = await processAlbaranOCR(buffer, mimeType, apiKeyOverride || undefined);

    return NextResponse.json({
      success: true,
      ocrData,
      pdf_nombre: file.name,
      pdf_data: pdfDataUrl,
    });
  } catch (error: unknown) {
    console.error("Error en API OCR:", error);
    const errorMsg = error instanceof Error ? error.message : "Error interno procesando el albarán.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
