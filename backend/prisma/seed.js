const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@regismatic.local";
  const employeeEmail = "empleado@regismatic.local";
  const commonPassword = "Regismatic2026!";

  const adminHash = await bcrypt.hash(commonPassword, 12);
  const employeeHash = await bcrypt.hash(commonPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: "Admin Regismatic",
      role: "ADMIN",
      passwordHash: adminHash,
      isActive: true
    },
    create: {
      email: adminEmail,
      fullName: "Admin Regismatic",
      role: "ADMIN",
      passwordHash: adminHash,
      isActive: true
    }
  });

  await prisma.user.upsert({
    where: { email: employeeEmail },
    update: {
      fullName: "Empleado Demo",
      role: "EMPLOYEE",
      passwordHash: employeeHash,
      isActive: true
    },
    create: {
      email: employeeEmail,
      fullName: "Empleado Demo",
      role: "EMPLOYEE",
      passwordHash: employeeHash,
      isActive: true
    }
  });

  console.log("Seed completed. Demo password: Regismatic2026!");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
