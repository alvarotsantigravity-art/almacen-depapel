import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseBarcode } from "@/lib/barcodeParser";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { albaran_id, codigo_barras_raw } = body;

    if (!albaran_id || !codigo_barras_raw) {
      return NextResponse.json({ error: "Faltan parámetros albaran_id o codigo_barras_raw." }, { status: 400 });
    }

    const albaran = await db.albaranCabecera.findUnique({
      where: { id: albaran_id },
    });

    if (!albaran) {
      return NextResponse.json({ error: "Albarán no encontrado." }, { status: 404 });
    }

    // Parse dynamic barcode according to manufacturer
    const parsed = parseBarcode(codigo_barras_raw, albaran.fabricante);

    // Buscar si la bobina ya existía pre-cargada por el albarán (por identificador_bobina o raw)
    const bobinaExistente = await db.bobinaDetalle.findFirst({
      where: {
        albaran_id,
        OR: [
          { identificador_bobina: parsed.identificador_bobina },
          { codigo_barras_raw: codigo_barras_raw.trim() },
        ],
      },
    });

    let bobina;
    if (bobinaExistente) {
      // Actualizar estado a VERIFICADA y asignar peso si antes era null o viene nuevo
      bobina = await db.bobinaDetalle.update({
        where: { id: bobinaExistente.id },
        data: {
          estado: "VERIFICADA",
          ...(parsed.peso_kg !== null ? { peso_kg: parsed.peso_kg } : {}),
        },
      });
    } else {
      // Crear nueva bobina no listada previamente en el albarán
      bobina = await db.bobinaDetalle.create({
        data: {
          albaran_id,
          codigo_barras_raw,
          identificador_bobina: parsed.identificador_bobina,
          peso_kg: parsed.peso_kg,
          estado: "VERIFICADA",
        },
      });
    }

    return NextResponse.json({
      success: true,
      bobina,
      formato_detectado: parsed.formato_detectado,
      requiere_edicion_manual: bobina.peso_kg === null,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Error registrando bobina.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// Acción para marcar todas las bobinas del albarán como VERIFICADAS de golpe
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { albaran_id } = body;

    if (!albaran_id) {
      return NextResponse.json({ error: "Falta albaran_id." }, { status: 400 });
    }

    await db.bobinaDetalle.updateMany({
      where: { albaran_id },
      data: { estado: "VERIFICADA" },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Error al verificar todas las bobinas.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, peso_kg, identificador_bobina, estado } = body;

    if (!id) {
      return NextResponse.json({ error: "Falta el ID de la bobina." }, { status: 400 });
    }

    const bobinaActualizada = await db.bobinaDetalle.update({
      where: { id },
      data: {
        ...(peso_kg !== undefined ? { peso_kg: parseFloat(peso_kg) } : {}),
        ...(identificador_bobina ? { identificador_bobina } : {}),
        ...(estado ? { estado } : {}),
      },
    });

    return NextResponse.json({ success: true, bobina: bobinaActualizada });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Error actualizando bobina.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Falta el ID de la bobina." }, { status: 400 });
    }

    await db.bobinaDetalle.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Error al eliminar bobina.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
