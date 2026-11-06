// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const hashedPassword = await bcrypt.hash("password123", 12);

  await prisma.employee.upsert({
    where: { username: "admin" },
    update: { password: hashedPassword, employeeName: "สมชาย ธุรการ", role: "ADMIN" },
    create: { username: "admin", password: hashedPassword, employeeName: "สมชาย ธุรการ", role: "ADMIN" },
  });

  await prisma.employee.upsert({
    where: { username: "accountant" },
    update: { password: hashedPassword, employeeName: "สมหญิง บัญชี", role: "ACCOUNTANT" },
    create: { username: "accountant", password: hashedPassword, employeeName: "สมหญิง บัญชี", role: "ACCOUNTANT" },
  });

  await prisma.employee.upsert({
    where: { username: "head_tech" },
    update: { password: hashedPassword, employeeName: "วิชัย หัวหน้าช่าง", role: "HEAD_TECHNICIAN" },
    create: { username: "head_tech", password: hashedPassword, employeeName: "วิชัย หัวหน้าช่าง", role: "HEAD_TECHNICIAN" },
  });

  await prisma.employee.upsert({
    where: { username: "tech01" },
    update: { password: hashedPassword, employeeName: "สมศักดิ์ ช่าง", role: "TECHNICIAN" },
    create: { username: "tech01", password: hashedPassword, employeeName: "สมศักดิ์ ช่าง", role: "TECHNICIAN" },
  });

  console.log("✅ Seeding complete!");
  console.log("👤 Employees seeded:");
  console.log("   admin / password123 (ADMIN)");
  console.log("   accountant / password123 (ACCOUNTANT)");
  console.log("   head_tech / password123 (HEAD_TECHNICIAN)");
  console.log("   tech01 / password123 (TECHNICIAN)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
