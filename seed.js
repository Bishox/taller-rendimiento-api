const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando datos...');
  for (let i = 1; i <= 10; i++) {
    await prisma.user.create({
      data: {
        name: `Usuario ${i}`,
        posts: {
          create: [
            { title: `Post A de Usuario ${i}` },
            { title: `Post B de Usuario ${i}` },
          ],
        },
      },
    });
  }
  console.log('✅ Datos creados con éxito');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());