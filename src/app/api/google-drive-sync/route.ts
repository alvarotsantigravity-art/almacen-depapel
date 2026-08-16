import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeWebhookUrl, generateStandardPdfName } from "@/lib/googleDriveService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { webhookUrl: rawUrl, mode, albaranId, allow_overwrite, numero_albaran } = body;
    const effectiveUrl = (rawUrl && rawUrl.trim()) ? rawUrl : process.env.GOOGLE_DRIVE_WEBHOOK_URL;

    if (!effectiveUrl || !effectiveUrl.trim()) {
      return NextResponse.json({ error: "Proporciona la URL o ID del Webhook de Google Drive." }, { status: 400 });
    }

    const webhookUrl = normalizeWebhookUrl(effectiveUrl);

    if (mode === "test") {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          numero_albaran: "TEST-DRIVE-001",
          fecha: new Date().toISOString().split("T")[0],
          nombre_cliente: "Prueba Conexión Google Drive",
          fabricante: "Google Drive Sync Test",
          marca_papel: "Test Papel",
          tipo_papel: "Offset",
          ancho_papel_mm: 1450,
          gramaje_papel_gsm: 70,
          almacen: "ROTOMADRID",
          calle: "0",
          certificacion_tipo: "PEFC",
          certificacion_codigo: "PEFC/14-38-00001",
          certificacion_porcentaje: 100,
          pdf_nombre: "test_conexion.pdf",
          bobinas: [
            { identificador_bobina: "3251375910001073", peso_kg: 485.5, estado: "VERIFICADA" }
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`El Webhook devolvió el código HTTP ${res.status}`);
      }

      return NextResponse.json({
        success: true,
        message: "¡Conexión Exitosa! Se ha creado la entrada en 'BD_Almacen_Papel' en tu Google Drive.",
        normalizedUrl: webhookUrl,
      });
    }

    if (mode === "sync_single" && albaranId) {
      const alb = await db.albaranCabecera.findUnique({
        where: { id: albaranId },
        include: { cliente: true, bobinas: true },
      });

      if (!alb) {
        return NextResponse.json({ error: "Albarán no encontrado." }, { status: 404 });
      }

      const standardPdfName = generateStandardPdfName(
        alb.fecha,
        alb.cliente.nombre_empresa,
        alb.ancho_papel_mm,
        alb.numero_albaran
      );

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          numero_albaran: alb.numero_albaran,
          fecha: alb.fecha,
          nombre_cliente: alb.cliente.nombre_empresa,
          fabricante: alb.fabricante,
          marca_papel: alb.marca_papel,
          tipo_papel: alb.tipo_papel,
          ancho_papel_mm: alb.ancho_papel_mm,
          gramaje_papel_gsm: alb.gramaje_papel_gsm,
          almacen: alb.almacen || "ROTOMADRID",
          calle: alb.calle || "0",
          certificacion_tipo: alb.certificacion_tipo,
          certificacion_codigo: alb.certificacion_codigo,
          certificacion_porcentaje: alb.certificacion_porcentaje,
          pdf_nombre: standardPdfName,
          pdf_data: alb.pdf_data,
          allow_overwrite: allow_overwrite === true,
          bobinas: alb.bobinas.map((b) => ({
            identificador_bobina: b.identificador_bobina.replace(/[-_ ]/g, ""),
            peso_kg: b.peso_kg,
            estado: b.estado,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`El Webhook de Google Script devolvió el código ${res.status}`);
      }

      const resData = await res.json().catch(() => null);

      if (resData && !resData.success) {
        throw new Error(resData.error || "Error en el Webhook de Google Drive");
      }

      // Actualizar nombre de PDF estandarizado en la base de datos local
      await db.albaranCabecera.update({
        where: { id: alb.id },
        data: { pdf_nombre: standardPdfName },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: resData?.message || `¡Albarán N° ${alb.numero_albaran} guardado y actualizado exitosamente en Google Drive!`,
        pdf_url: resData?.pdf_url,
        pdf_nombre: standardPdfName,
      });
    }

    if (mode === "delete_single") {
      const numAlb = numero_albaran || albaranId;

      if (!numAlb) {
        return NextResponse.json({ error: "Proporciona el número de albarán a eliminar." }, { status: 400 });
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "delete",
          numero_albaran: numAlb,
        }),
      });

      if (!res.ok) {
        throw new Error(`El Webhook de Google Script devolvió el código ${res.status}`);
      }

      const resData = await res.json().catch(() => null);

      return NextResponse.json({
        success: true,
        message: resData?.message || `Albarán N° ${numAlb} eliminado de Google Drive.`,
      });
    }

    if (mode === "sync_all") {
      const albaranes = await db.albaranCabecera.findMany({
        include: {
          cliente: true,
          bobinas: true,
        },
      });

      let syncCount = 0;
      for (const alb of albaranes) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            numero_albaran: alb.numero_albaran,
            fecha: alb.fecha,
            nombre_cliente: alb.cliente.nombre_empresa,
            fabricante: alb.fabricante,
            marca_papel: alb.marca_papel,
            tipo_papel: alb.tipo_papel,
            ancho_papel_mm: alb.ancho_papel_mm,
            gramaje_papel_gsm: alb.gramaje_papel_gsm,
            almacen: alb.almacen || "ROTOMADRID",
            calle: alb.calle || "0",
            certificacion_tipo: alb.certificacion_tipo,
            certificacion_codigo: alb.certificacion_codigo,
            certificacion_porcentaje: alb.certificacion_porcentaje,
            pdf_nombre: alb.pdf_nombre,
            allow_overwrite: true,
            bobinas: alb.bobinas.map((b) => ({
              identificador_bobina: b.identificador_bobina.replace(/[-_ ]/g, ""),
              peso_kg: b.peso_kg,
              estado: b.estado,
            })),
          }),
        });
        syncCount++;
      }

      return NextResponse.json({
        success: true,
        message: `Se han exportado ${syncCount} albaranes hacia tu Google Drive BD_Almacen_Papel.`,
        normalizedUrl: webhookUrl,
      });
    }

    if (mode === "import_from_drive") {
      const res = await fetch(webhookUrl, { method: "GET", redirect: "follow" });

      if (!res.ok) {
        throw new Error(`Google Apps Script devolvió código HTTP ${res.status}`);
      }

      const textResponse = await res.text();

      if (textResponse.trim().startsWith("<") || textResponse.includes("<!DOCTYPE")) {
        return NextResponse.json(
          {
            error:
              "Google Drive requiere autorización de acceso para la descarga entre PCs. Para habilitarlo: abre tu Google Apps Script, haz clic en 'Desplegar' -> 'Nuevo despliegue', asegúrate de seleccionar 'Quién tiene acceso: Cualquiera' y copia el nuevo ID.",
          },
          { status: 400 }
        );
      }

      let data: any;
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        return NextResponse.json(
          { error: "La respuesta recibida de Google Drive no es un formato JSON válido." },
          { status: 400 }
        );
      }

      const rawAlbaranes = Array.isArray(data?.albaranes) ? data.albaranes : [];
      const validAlbaranes = rawAlbaranes.filter(
        (a: any) => a && a.numero_albaran && String(a.numero_albaran).trim() !== ""
      );

      // Si Google Drive no tiene albaranes (el usuario borró todo en Drive)
      if (validAlbaranes.length === 0) {
        await db.bobinaDetalle.deleteMany({});
        await db.albaranCabecera.deleteMany({});
        await db.cliente.deleteMany({
          where: { albaranes: { none: {} } },
        });

        return NextResponse.json({
          success: true,
          count: 0,
          message: "Google Drive no contiene albaranes. La base de datos local se ha limpiado para coincidir al 100% con la hoja.",
        });
      }

      // Extraer números de albarán presentes en Google Drive
      const driveNumAlbaranes = validAlbaranes.map((a: any) => String(a.numero_albaran).trim());

      // Eliminar de la base de datos local cualquier albarán que ya NO esté en Google Drive
      await db.albaranCabecera.deleteMany({
        where: {
          numero_albaran: {
            notIn: driveNumAlbaranes,
          },
        },
      });

      // Limpiar clientes huérfanos
      await db.cliente.deleteMany({
        where: { albaranes: { none: {} } },
      });

      let importedCount = 0;

      for (const albData of validAlbaranes) {
        const clienteNombre = albData.nombre_cliente ? String(albData.nombre_cliente).trim() : "Cliente Desconocido";
        const numAlb = String(albData.numero_albaran).trim();
        const almacenVal = albData.almacen ? String(albData.almacen).trim() : "ROTOMADRID";
        const calleVal = albData.calle !== undefined && albData.calle !== null && String(albData.calle).trim() !== "" ? String(albData.calle).trim() : "0";

        let cliente = await db.cliente.findFirst({
          where: { nombre_empresa: { equals: clienteNombre } },
        });

        if (!cliente) {
          cliente = await db.cliente.create({
            data: { nombre_empresa: clienteNombre },
          });
        }

        let albaran = await db.albaranCabecera.findFirst({
          where: { numero_albaran: numAlb },
        });

        if (albaran) {
          // Actualizar albarán existente
          await db.albaranCabecera.update({
            where: { id: albaran.id },
            data: {
              fecha: albData.fecha || albaran.fecha,
              cliente_id: cliente.id,
              fabricante: albData.fabricante || albaran.fabricante,
              marca_papel: albData.marca_papel || albaran.marca_papel,
              tipo_papel: albData.tipo_papel || albaran.tipo_papel,
              ancho_papel_mm: albData.ancho_papel_mm !== undefined && albData.ancho_papel_mm !== "" ? parseFloat(albData.ancho_papel_mm) || 0 : albaran.ancho_papel_mm,
              gramaje_papel_gsm: albData.gramaje_papel_gsm !== undefined && albData.gramaje_papel_gsm !== "" ? parseFloat(albData.gramaje_papel_gsm) || 0 : albaran.gramaje_papel_gsm,
              almacen: almacenVal,
              calle: calleVal,
              certificacion_tipo: albData.certificacion_tipo || albaran.certificacion_tipo,
              certificacion_codigo: albData.certificacion_codigo || albaran.certificacion_codigo,
              certificacion_porcentaje: albData.certificacion_porcentaje ? parseFloat(albData.certificacion_porcentaje) : albaran.certificacion_porcentaje,
              pdf_nombre: albData.pdf_nombre || albaran.pdf_nombre,
            },
          });

          // Reemplazar bobinas
          await db.bobinaDetalle.deleteMany({
            where: { albaran_id: albaran.id },
          });
        } else {
          // Crear nuevo albarán
          albaran = await db.albaranCabecera.create({
            data: {
              numero_albaran: numAlb,
              fecha: albData.fecha || new Date().toISOString().split("T")[0],
              cliente_id: cliente.id,
              fabricante: albData.fabricante || "Fabricante Desconocido",
              marca_papel: albData.marca_papel || "Estándar",
              tipo_papel: albData.tipo_papel || "Offset",
              ancho_papel_mm: parseFloat(albData.ancho_papel_mm) || 0,
              gramaje_papel_gsm: parseFloat(albData.gramaje_papel_gsm) || 0,
              almacen: almacenVal,
              calle: calleVal,
              certificacion_tipo: albData.certificacion_tipo || "SIN_CERTIFICACION",
              certificacion_codigo: albData.certificacion_codigo || null,
              certificacion_porcentaje: albData.certificacion_porcentaje ? parseFloat(albData.certificacion_porcentaje) : null,
              pdf_nombre: albData.pdf_nombre || null,
            },
          });
        }

        if (Array.isArray(albData.bobinas) && albData.bobinas.length > 0) {
          await db.bobinaDetalle.createMany({
            data: albData.bobinas.map((b: any) => {
              const idLimpio = String(b.identificador_bobina || "").replace(/[-_ ]/g, "").trim();
              return {
                albaran_id: albaran.id,
                codigo_barras_raw: idLimpio,
                identificador_bobina: idLimpio,
                peso_kg: b.peso_kg !== null && b.peso_kg !== undefined && b.peso_kg !== "" ? parseFloat(b.peso_kg) : null,
                estado: b.estado || "VERIFICADA",
              };
            }),
          });
        }

        importedCount++;
      }

      // Limpiar clientes residuales
      await db.cliente.deleteMany({
        where: { albaranes: { none: {} } },
      });

      return NextResponse.json({
        success: true,
        count: importedCount,
        message: `¡Sincronización Exitosa! Base de datos sincronizada con ${importedCount} albarán(es) de Google Drive.`,
      });
    }

    return NextResponse.json({ error: "Modo de acción no reconocido." }, { status: 400 });
  } catch (error: unknown) {
    console.error("Error en API de sincronización con Google Drive:", error);
    const errorMsg = error instanceof Error ? error.message : "Error conectando con Google Drive.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
