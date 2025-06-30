import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create default workers
  const worker1 = await prisma.worker.upsert({
    where: { name: 'Worker-1' },
    update: {},
    create: {
      name: 'Worker-1',
      status: 'IDLE',
      processedCount: 0,
    },
  })

  const worker2 = await prisma.worker.upsert({
    where: { name: 'Worker-2' },
    update: {},
    create: {
      name: 'Worker-2',
      status: 'IDLE',
      processedCount: 0,
    },
  })

  // Create initial system stats
  await prisma.systemStats.upsert({
    where: { id: 'system-stats' },
    update: {},
    create: {
      id: 'system-stats',
      uptime: 0,
    },
  })

  console.log('Database seeded successfully!')
  console.log({ worker1, worker2 })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  }) 