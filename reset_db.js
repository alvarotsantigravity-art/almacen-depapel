const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetDatabase() {
  console.log("Iniciando borrado completo de tablas...");
  await prisma.bobinaDetalle.deleteMany({});
  await prisma.albaranCabecera.deleteMany({});
  await prisma.cliente.deleteMany({});
  console.log("✅ RESET COMPLETADO A 0: Todos los clientes, albaranes y bobinas han sido eliminados.");
}

resetDatabase()
  .catch((e) => {
    console.error("Error reseteando base de datos:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
