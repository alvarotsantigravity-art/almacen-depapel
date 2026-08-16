import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncAlbaranToGoogleDrive, normalizeWebhookUrl, generateStandardPdfName } from "@/lib/googleDriveService";

export async function GET() {
  try {
    const albaranes = await db.albaranCabecera.findMany({
      include: {
        cliente: true,
        bobinas: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json({ albaranes });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Error al obtener albaranes.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      numero_albaran,
      fecha,
      nombre_cliente,
      fabricante,
      marca_papel,
      tipo_papel,
      ancho_papel_mm,
      gramaje_papel_gsm,
      almacen,
      calle,
      certificacion_tipo,
      certificacion_codigo,
      certificacion_porcentaje,
      pdf_nombre,
      pdf_data,
      allow_overwrite,
      sync_to_drive,
      bobinas,
    } = body;

    if (!numero_albaran || !nombre_cliente) {
      return NextResponse.json({ error: "Faltan datos obligatorios del albarán." }, { status: 400 });
    }

    const nombreClienteLimpio = nombre_cliente.trim();
    const numAlbaranLimpio = numero_albaran.trim();
    const almacenLimpio = almacen ? String(almacen).trim() : "ROTOMADRID";
    const calleLimpia = calle !== undefined && calle !== null && String(calle).trim() !== "" ? String(calle).trim() : "0";

    let cliente = await db.cliente.findFirst({
      where: {
        nombre_empresa: {
          equals: nombreClienteLimpio,
        },
      },
    });

    if (!cliente) {
      cliente = await db.cliente.create({
        data: {
          nombre_empresa: nombreClienteLimpio,
        },
      });
    }

    // CONTROL DE DUPLICADOS LOCAL: Buscar si ya existe un albarán con el mismo número y cliente
    const albaranExistente = await db.albaranCabecera.findFirst({
      where: {
        numero_albaran: numAlbaranLimpio,
        cliente_id: cliente.id,
      },
    });

    if (albaranExistente && !allow_overwrite) {
      return NextResponse.json(
        {
          duplicate: true,
          message: `El albarán N° ${numAlbaranLimpio} ya existe para el cliente '${nombreClienteLimpio}'. ¿Deseas reemplazarlo y actualizar sus datos?`,
          existingId: albaranExistente.id,
        },
        { status: 409 }
      );
    }

    // Si existía y se aceptó sobreescribir, eliminar el anterior para reemplazarlo limpiamente
    if (albaranExistente && allow_overwrite) {
      await db.albaranCabecera.delete({
        where: { id: albaranExistente.id },
      });
    }

    const albaran = await db.albaranCabecera.create({
      data: {
        numero_albaran: numAlbaranLimpio,
        fecha: fecha || new Date().toISOString().split("T")[0],
        cliente_id: cliente.id,
        fabricante: fabricante || "Fabricante Desconocido",
        marca_papel: marca_papel || "Estándar",
        tipo_papel: tipo_papel || "Offset",
        ancho_papel_mm: parseFloat(ancho_papel_mm) || 0,
        gramaje_papel_gsm: parseFloat(gramaje_papel_gsm) || 0,
        almacen: almacenLimpio,
        calle: calleLimpia,
        certificacion_tipo: certificacion_tipo || "SIN_CERTIFICACION",
        certificacion_codigo: certificacion_codigo || null,
        certificacion_porcentaje: certificacion_porcentaje ? parseFloat(certificacion_porcentaje) : null,
        pdf_nombre: pdf_nombre || null,
        pdf_data: pdf_data || null,
      },
    });

    // Guardar bobinas (asegurando que los identificadores no lleven guiones)
    if (Array.isArray(bobinas) && bobinas.length > 0) {
      await db.bobinaDetalle.createMany({
        data: bobinas.map((b: any) => {
          const idLimpio = String(b.identificador_bobina || "").replace(/[-_ ]/g, "").trim();
          return {
            albaran_id: albaran.id,
            codigo_barras_raw: idLimpio,
            identificador_bobina: idLimpio,
            peso_kg: b.peso_kg !== null && b.peso_kg !== undefined && b.peso_kg !== "" ? parseFloat(b.peso_kg) : null,
            estado: b.estado || "PENDIENTE DE VERIFICACIÓN",
          };
        }),
      });
    }

    const albaranCompleto = await db.albaranCabecera.findUnique({
      where: { id: albaran.id },
      include: {
        cliente: true,
        bobinas: true,
      },
    });

    // Sincronizar con Google Drive si se solicitó o si hay webhookUrl
    const effectiveWebhookUrl = (body.drive_webhook_url && body.drive_webhook_url.trim())
      ? body.drive_webhook_url.trim()
      : ((body.webhookUrl && body.webhookUrl.trim()) ? body.webhookUrl.trim() : process.env.GOOGLE_DRIVE_WEBHOOK_URL);

    const shouldSyncDrive = sync_to_drive || body.sync_drive || !!effectiveWebhookUrl;

    if (shouldSyncDrive && effectiveWebhookUrl) {
      syncAlbaranToGoogleDrive(
        {
          numero_albaran: numAlbaranLimpio,
          fecha: fecha || new Date().toISOString().split("T")[0],
          nombre_cliente: nombreClienteLimpio,
          fabricante,
          marca_papel,
          tipo_papel,
          ancho_papel_mm: parseFloat(ancho_papel_mm) || 0,
          gramaje_papel_gsm: parseFloat(gramaje_papel_gsm) || 0,
          almacen: almacenLimpio,
          calle: calleLimpia,
          certificacion_tipo,
          certificacion_codigo,
          certificacion_porcentaje: certificacion_porcentaje ? parseFloat(certificacion_porcentaje) : null,
          pdf_nombre,
          pdf_data,
          allow_overwrite,
          bobinas: Array.isArray(bobinas)
            ? bobinas.map((b: any) => ({
                identificador_bobina: String(b.identificador_bobina || "").replace(/[-_ ]/g, "").trim(),
                peso_kg: b.peso_kg !== null && b.peso_kg !== undefined && b.peso_kg !== "" ? parseFloat(b.peso_kg) : null,
                estado: b.estado || "PENDIENTE DE VERIFICACIÓN",
              }))
            : [],
        },
        normalizeWebhookUrl(effectiveWebhookUrl)
      ).catch((err) => console.error("Error al subir a Google Drive:", err));
    }

    return NextResponse.json({ success: true, albaran: albaranCompleto });
  } catch (error: unknown) {
    console.error("Error creando albarán:", error);
    const errorMsg = error instanceof Error ? error.message : "Error al guardar albarán.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      numero_albaran,
      fecha,
      nombre_cliente,
      fabricante,
      marca_papel,
      tipo_papel,
      ancho_papel_mm,
      gramaje_papel_gsm,
      almacen,
      calle,
      certificacion_tipo,
      certificacion_codigo,
      certificacion_porcentaje,
      bobinas,
      drive_webhook_url,
      webhookUrl,
      sync_to_drive = true,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Falta el ID del albarán a actualizar." }, { status: 400 });
    }

    const albExistente = await db.albaranCabecera.findUnique({
      where: { id },
      include: { cliente: true, bobinas: true },
    });

    if (!albExistente) {
      return NextResponse.json({ error: "Albarán no encontrado." }, { status: 404 });
    }

    const nombreClienteLimpio = nombre_cliente ? String(nombre_cliente).trim() : albExistente.cliente.nombre_empresa;
    const numAlbaranLimpio = numero_albaran ? String(numero_albaran).trim() : albExistente.numero_albaran;
    const almacenLimpio = almacen !== undefined ? String(almacen).trim() : albExistente.almacen;
    const calleLimpia = calle !== undefined && calle !== null && String(calle).trim() !== "" ? String(calle).trim() : "0";
    const fechaLimpia = fecha ? String(fecha).trim() : albExistente.fecha;
    const fabricanteLimpio = fabricante !== undefined ? String(fabricante).trim() : albExistente.fabricante;
    const marcaLimpia = marca_papel !== undefined ? String(marca_papel).trim() : albExistente.marca_papel;
    const tipoPapelLimpio = tipo_papel !== undefined ? String(tipo_papel).trim() : albExistente.tipo_papel;
    const anchoNum = ancho_papel_mm !== undefined ? parseFloat(ancho_papel_mm) || 0 : albExistente.ancho_papel_mm;
    const gramajeNum = gramaje_papel_gsm !== undefined ? parseFloat(gramaje_papel_gsm) || 0 : albExistente.gramaje_papel_gsm;
    const certTipo = certificacion_tipo !== undefined ? certificacion_tipo : albExistente.certificacion_tipo;
    const certCodigo = certificacion_codigo !== undefined ? certificacion_codigo : albExistente.certificacion_codigo;
    const certPorc = certificacion_porcentaje !== undefined && certificacion_porcentaje !== null && certificacion_porcentaje !== "" ? parseFloat(certificacion_porcentaje) : null;

    // Detectar campos modificados respecto al estado actual
    const cambios = new Set<string>();

    // Recuperar cambios previos si existían
    if (albExistente.campos_modificados) {
      try {
        const prevCambios = JSON.parse(albExistente.campos_modificados);
        if (Array.isArray(prevCambios)) {
          prevCambios.forEach((c: string) => cambios.add(c));
        }
      } catch {}
    }

    if (nombreClienteLimpio !== albExistente.cliente.nombre_empresa) cambios.add("Cliente");
    if (numAlbaranLimpio !== albExistente.numero_albaran) cambios.add("N° Albarán");
    if (fechaLimpia !== albExistente.fecha) cambios.add("Fecha");
    if (almacenLimpio !== albExistente.almacen) cambios.add("Almacén");
    if (calleLimpia !== albExistente.calle) cambios.add("Calle");
    if (fabricanteLimpio !== albExistente.fabricante) cambios.add("Fabricante");
    if (marcaLimpia !== albExistente.marca_papel) cambios.add("Marca Papel");
    if (tipoPapelLimpio !== albExistente.tipo_papel) cambios.add("Tipo Papel");
    if (anchoNum !== albExistente.ancho_papel_mm) cambios.add("Ancho (mm)");
    if (gramajeNum !== albExistente.gramaje_papel_gsm) cambios.add("Gramaje (gsm)");
    if (certTipo !== albExistente.certificacion_tipo || certCodigo !== albExistente.certificacion_codigo || certPorc !== albExistente.certificacion_porcentaje) {
      cambios.add("Certificación");
    }

    // Comprobar cambios en bobinas
    if (Array.isArray(bobinas)) {
      const bobinasOriginales = albExistente.bobinas;
      if (bobinas.length !== bobinasOriginales.length) {
        cambios.add("Bobinas");
      } else {
        const idMatches = bobinas.every((b: any, idx: number) => {
          const orig = bobinasOriginales[idx];
          if (!orig) return false;
          const bIdLimpio = String(b.identificador_bobina || "").replace(/[-_ ]/g, "").trim();
          const origIdLimpio = String(orig.identificador_bobina || "").replace(/[-_ ]/g, "").trim();
          const pesoB = b.peso_kg !== null && b.peso_kg !== undefined && b.peso_kg !== "" ? parseFloat(b.peso_kg) : null;
          return bIdLimpio === origIdLimpio && pesoB === orig.peso_kg && b.estado === orig.estado;
        });
        if (!idMatches) cambios.add("Bobinas");
      }
    }

    // Gestionar cliente en BD
    let cliente = await db.cliente.findFirst({
      where: { nombre_empresa: { equals: nombreClienteLimpio } },
    });

    if (!cliente) {
      cliente = await db.cliente.create({
        data: { nombre_empresa: nombreClienteLimpio },
      });
    }

    const clienteOriginal = albExistente.cliente_original || (nombreClienteLimpio !== albExistente.cliente.nombre_empresa ? albExistente.cliente.nombre_empresa : null);

    // Actualizar cabecera de albarán
    await db.albaranCabecera.update({
      where: { id },
      data: {
        numero_albaran: numAlbaranLimpio,
        fecha: fechaLimpia,
        cliente_id: cliente.id,
        fabricante: fabricanteLimpio,
        marca_papel: marcaLimpia,
        tipo_papel: tipoPapelLimpio,
        ancho_papel_mm: anchoNum,
        gramaje_papel_gsm: gramajeNum,
        almacen: almacenLimpio,
        calle: calleLimpia,
        certificacion_tipo: certTipo,
        certificacion_codigo: certCodigo,
        certificacion_porcentaje: certPorc,
        es_personalizado: cambios.size > 0,
        campos_modificados: JSON.stringify(Array.from(cambios)),
        cliente_original: clienteOriginal,
      },
    });

    // Actualizar bobinas si se enviaron
    if (Array.isArray(bobinas)) {
      await db.bobinaDetalle.deleteMany({
        where: { albaran_id: id },
      });

      if (bobinas.length > 0) {
        await db.bobinaDetalle.createMany({
          data: bobinas.map((b: any) => {
            const idLimpio = String(b.identificador_bobina || "").replace(/[-_ ]/g, "").trim();
            return {
              albaran_id: id,
              codigo_barras_raw: idLimpio,
              identificador_bobina: idLimpio,
              peso_kg: b.peso_kg !== null && b.peso_kg !== undefined && b.peso_kg !== "" ? parseFloat(b.peso_kg) : null,
              estado: b.estado || "VERIFICADA",
            };
          }),
        });
      }
    }

    const albaranCompleto = await db.albaranCabecera.findUnique({
      where: { id },
      include: {
        cliente: true,
        bobinas: true,
      },
    });

    // Re-sincronizar con Google Drive automáticamente
    const effectiveWebhookUrl = (drive_webhook_url && drive_webhook_url.trim())
      ? drive_webhook_url.trim()
      : ((webhookUrl && webhookUrl.trim()) ? webhookUrl.trim() : process.env.GOOGLE_DRIVE_WEBHOOK_URL);

    let driveSynced = false;

    if (sync_to_drive && albaranCompleto && effectiveWebhookUrl) {
      const normalizedUrl = normalizeWebhookUrl(effectiveWebhookUrl);

      // Si cambió el número de albarán, borrar el número anterior en Drive
      if (albExistente.numero_albaran && albExistente.numero_albaran.toUpperCase() !== numAlbaranLimpio.toUpperCase()) {
        try {
          await fetch(normalizedUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "delete",
              numero_albaran: albExistente.numero_albaran,
            }),
          });
        } catch (errDel) {
          console.error("Error borrando albarán anterior de Drive tras renombramiento:", errDel);
        }
      }

      const stdPdfName = generateStandardPdfName(fechaLimpia, nombreClienteLimpio, anchoNum, numAlbaranLimpio);

      // Actualizar nombre estandarizado en BD local
      await db.albaranCabecera.update({
        where: { id },
        data: { pdf_nombre: stdPdfName },
      }).catch(() => {});

      const syncRes = await syncAlbaranToGoogleDrive(
        {
          numero_albaran: numAlbaranLimpio,
          fecha: fechaLimpia,
          nombre_cliente: nombreClienteLimpio,
          fabricante: fabricanteLimpio,
          marca_papel: marcaLimpia,
          tipo_papel: tipoPapelLimpio,
          ancho_papel_mm: anchoNum,
          gramaje_papel_gsm: gramajeNum,
          almacen: almacenLimpio,
          calle: calleLimpia,
          certificacion_tipo: certTipo,
          certificacion_codigo: certCodigo,
          certificacion_porcentaje: certPorc,
          pdf_nombre: stdPdfName,
          pdf_data: albaranCompleto.pdf_data,
          allow_overwrite: true,
          bobinas: albaranCompleto.bobinas.map((b) => ({
            identificador_bobina: b.identificador_bobina.replace(/[-_ ]/g, ""),
            peso_kg: b.peso_kg,
            estado: b.estado,
          })),
        },
        normalizedUrl
      );

      driveSynced = syncRes?.success === true;
    }

    const syncMsg = driveSynced
      ? "¡Albarán N° " + numAlbaranLimpio + " actualizado y re-sincronizado exitosamente en Google Drive y Base de Datos Local!"
      : "¡Albarán N° " + numAlbaranLimpio + " actualizado exitosamente en Base de Datos Local!";

    return NextResponse.json({
      success: true,
      message: syncMsg,
      albaran: albaranCompleto,
    });
  } catch (error: unknown) {
    console.error("Error actualizando albarán:", error);
    const errorMsg = error instanceof Error ? error.message : "Error al actualizar el albarán.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const webhookUrlParam = searchParams.get("webhookUrl") || searchParams.get("drive_webhook_url") || process.env.GOOGLE_DRIVE_WEBHOOK_URL;

    if (!id) {
      return NextResponse.json({ error: "Falta el ID del albarán." }, { status: 400 });
    }

    const alb = await db.albaranCabecera.findUnique({
      where: { id },
    });

    if (alb && webhookUrlParam && webhookUrlParam.trim()) {
      try {
        await fetch(normalizeWebhookUrl(webhookUrlParam.trim()), {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "delete",
            numero_albaran: alb.numero_albaran,
          }),
        });
      } catch (errDrive) {
        console.error("Error eliminando albarán de Google Drive:", errDrive);
      }
    }

    if (alb) {
      await db.bobinaDetalle.deleteMany({ where: { albaran_id: id } });
      await db.albaranCabecera.delete({ where: { id } });
      await db.cliente.deleteMany({ where: { albaranes: { none: {} } } });
    }

    return NextResponse.json({
      success: true,
      message: `Albarán N° ${alb?.numero_albaran || id} eliminado correctamente.`,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Error al eliminar albarán.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
