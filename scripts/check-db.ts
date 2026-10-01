import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.employee.findMany({
    select: { username: true, role: true, password: true },
  });

  console.log("\n📋 Employees in DB:");
  for (const e of employees) {
    const valid = await bcrypt.compare("password123", e.password);
    console.log(`  ${e.username} (${e.role}) — bcrypt verify: ${valid ? "✅ OK" : "❌ FAIL"}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
