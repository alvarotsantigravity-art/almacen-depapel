import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const clienteId = searchParams.get("clienteId");
    const numeroAlbaran = searchParams.get("numeroAlbaran");
    const tipoPapel = searchParams.get("tipoPapel");
    const anchoMin = searchParams.get("anchoMin");
    const anchoMax = searchParams.get("anchoMax");
    const gramaje = searchParams.get("gramaje");
    const certificacion = searchParams.get("certificacion");
    const almacen = searchParams.get("almacen");
    const calle = searchParams.get("calle");
    const fechaDesde = searchParams.get("fechaDesde");
    const fechaHasta = searchParams.get("fechaHasta");

    // Construir la consulta Prisma dinámica
    const whereClause: any = {};

    if (clienteId) {
      whereClause.cliente_id = clienteId;
    }

    if (almacen) {
      whereClause.almacen = { contains: almacen };
    }

    if (calle) {
      whereClause.calle = { contains: calle };
    }

    if (certificacion) {
      if (certificacion === "SIN_CERTIFICACION") {
        whereClause.certificacion_tipo = "SIN_CERTIFICACION";
      } else {
        whereClause.OR = [
          { certificacion_tipo: { contains: certificacion } },
          { certificacion_codigo: { contains: certificacion } },
        ];
      }
    }

    if (numeroAlbaran) {
      whereClause.numero_albaran = {
        contains: numeroAlbaran,
      };
    }

    if (tipoPapel) {
      const currentOr = whereClause.OR || [];
      whereClause.OR = [
        ...currentOr,
        { tipo_papel: { contains: tipoPapel } },
        { marca_papel: { contains: tipoPapel } },
        { fabricante: { contains: tipoPapel } },
      ];
    }

    if (anchoMin || anchoMax) {
      whereClause.ancho_papel_mm = {};
      if (anchoMin) whereClause.ancho_papel_mm.gte = parseFloat(anchoMin);
      if (anchoMax) whereClause.ancho_papel_mm.lte = parseFloat(anchoMax);
    }

    if (gramaje) {
      whereClause.gramaje_papel_gsm = parseFloat(gramaje);
    }

    if (fechaDesde || fechaHasta) {
      whereClause.fecha = {};
      if (fechaDesde) whereClause.fecha.gte = fechaDesde;
      if (fechaHasta) whereClause.fecha.lte = fechaHasta;
    }

    // Obtener los albaranes que cumplen los filtros
    const albaranes = await db.albaranCabecera.findMany({
      where: whereClause,
      include: {
        cliente: true,
        bobinas: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    // Obtener la lista completa de clientes para el desplegable de filtro
    const clientes = await db.cliente.findMany({
      orderBy: {
        nombre_empresa: "asc",
      },
    });

    // Obtener almacenes distintos para selectores
    const allAlbaranes = await db.albaranCabecera.findMany({
      select: { almacen: true },
      distinct: ["almacen"],
    });
    const almacenes = Array.from(
      new Set(["ROTOMADRID", ...allAlbaranes.map((a) => a.almacen).filter(Boolean)])
    );

    return NextResponse.json({ albaranes, clientes, almacenes });
  } catch (error: unknown) {
    console.error("Error en API histórico:", error);
    const errorMsg = error instanceof Error ? error.message : "Error al obtener el histórico.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
