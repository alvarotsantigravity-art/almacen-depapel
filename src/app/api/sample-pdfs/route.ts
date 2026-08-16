import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { processAlbaranOCR } from "@/lib/ocrService";

const SAMPLES_DIR = path.resolve(process.cwd(), "..", "TIPOS DE ALABARAN");

export async function GET() {
  try {
    if (!fs.existsSync(SAMPLES_DIR)) {
      return NextResponse.json({ samples: [] });
    }

    const files = fs.readdirSync(SAMPLES_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
    return NextResponse.json({ samples: files });
  } catch (error: unknown) {
    console.error("Error leyendo carpeta de albaranes de muestra:", error);
    return NextResponse.json({ samples: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { filename, apiKey } = await req.json();

    if (!filename) {
      return NextResponse.json({ error: "No se especificó el archivo de muestra." }, { status: 400 });
    }

    const filePath = path.join(SAMPLES_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `El archivo ${filename} no existe.` }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const pdfDataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;
    const ocrData = await processAlbaranOCR(buffer, "application/pdf", apiKey || undefined);

    return NextResponse.json({
      success: true,
      ocrData,
      pdf_nombre: filename,
      pdf_data: pdfDataUrl,
    });
  } catch (error: unknown) {
    console.error("Error en albarán de muestra:", error);
    const errorMsg = error instanceof Error ? error.message : "Error al procesar archivo de muestra.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
