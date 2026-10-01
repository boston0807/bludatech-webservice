import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const pending = await prisma.customer.findMany({
    where: { status: "PENDING" },
  });
  console.log("PENDING customers:", pending.length);

  const all = await prisma.customer.findMany({
    select: { username: true, status: true },
  });
  console.log("All customers:", all);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
