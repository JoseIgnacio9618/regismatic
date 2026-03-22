const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const superadminEmail = "superadmin@regismatic.local";
  const adminEmail = "admin@regismatic.local";
  const employeeEmail = "empleado@regismatic.local";
  const commonPassword = "Regismatic2026!";

  const superadminHash = await bcrypt.hash(commonPassword, 12);
  const adminHash = await bcrypt.hash(commonPassword, 12);
  const employeeHash = await bcrypt.hash(commonPassword, 12);

  await prisma.user.upsert({
    where: { email: superadminEmail },
    update: {
      fullName: "Superadmin Regismatic",
      role: "SUPERADMIN",
      passwordHash: superadminHash,
      adminInviteCode: null,
      managerId: null,
      isActive: true
    },
    create: {
      email: superadminEmail,
      fullName: "Superadmin Regismatic",
      role: "SUPERADMIN",
      passwordHash: superadminHash,
      adminInviteCode: null,
      isActive: true
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: "Admin Regismatic",
      role: "ADMIN",
      passwordHash: adminHash,
      adminInviteCode: "RGM-ADMIN01",
      managerId: null,
      isActive: true
    },
    create: {
      email: adminEmail,
      fullName: "Admin Regismatic",
      role: "ADMIN",
      passwordHash: adminHash,
      adminInviteCode: "RGM-ADMIN01",
      isActive: true
    }
  });

  await prisma.billingSubscription.upsert({
    where: { adminId: admin.id },
    update: {
      planCode: "PACK_20",
      status: "ACTIVE",
      seatLimit: 20,
      isTrial: false,
      trialEndsAt: null
    },
    create: {
      adminId: admin.id,
      planCode: "PACK_20",
      status: "ACTIVE",
      seatLimit: 20,
      isTrial: false
    }
  });

  await prisma.user.upsert({
    where: { email: employeeEmail },
    update: {
      fullName: "Empleado Demo",
      role: "EMPLOYEE",
      passwordHash: employeeHash,
      managerId: admin.id,
      isActive: true
    },
    create: {
      email: employeeEmail,
      fullName: "Empleado Demo",
      role: "EMPLOYEE",
      passwordHash: employeeHash,
      managerId: admin.id,
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
