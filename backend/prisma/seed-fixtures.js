const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const FIXTURE_DOMAIN = "fixtures.regismatic.local";
const FIXTURE_PASSWORD = "Regismatic2026!";
const FIXTURE_WINDOW_DAYS = Number(process.env.FIXTURE_WINDOW_DAYS ?? 75);
const FIXTURE_ADMIN_COUNT = Number(process.env.FIXTURE_ADMIN_COUNT ?? 6);
const FIXTURE_EMPLOYEES_PER_ADMIN = Number(process.env.FIXTURE_EMPLOYEES_PER_ADMIN ?? 20);
const FIXTURE_AVAILABLE_EMPLOYEES = Number(process.env.FIXTURE_AVAILABLE_EMPLOYEES ?? 12);

const addDays = (date, days) => {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
};

const atUtc = (date, hours, minutes) => {
  const value = new Date(date);
  value.setUTCHours(hours, minutes, 0, 0);
  return value;
};

const chunk = (items, size) => {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

const createUser = async ({ email, fullName, role, passwordHash, adminInviteCode = null, managerId = null }) => {
  return prisma.user.create({
    data: {
      email,
      fullName,
      role,
      passwordHash,
      adminInviteCode,
      managerId,
      isActive: true
    }
  });
};

const cleanupPreviousFixtures = async () => {
  const users = await prisma.user.findMany({
    where: {
      email: {
        endsWith: `@${FIXTURE_DOMAIN}`
      }
    },
    select: {
      id: true
    }
  });

  if (users.length === 0) {
    return;
  }

  const userIds = users.map((user) => user.id);

  await prisma.workEventEditRequest.deleteMany({
    where: {
      OR: [
        { requestedById: { in: userIds } },
        { reviewedById: { in: userIds } },
        {
          workEvent: {
            userId: { in: userIds }
          }
        }
      ]
    }
  });

  await prisma.teamJoinRequest.deleteMany({
    where: {
      OR: [
        { employeeId: { in: userIds } },
        { targetManagerId: { in: userIds } },
        { reviewedById: { in: userIds } }
      ]
    }
  });

  await prisma.notification.deleteMany({
    where: {
      userId: { in: userIds }
    }
  });

  await prisma.pushDeviceToken.deleteMany({
    where: {
      userId: { in: userIds }
    }
  });

  await prisma.workEvent.deleteMany({
    where: {
      userId: { in: userIds }
    }
  });

  await prisma.user.updateMany({
    where: {
      managerId: { in: userIds }
    },
    data: {
      managerId: null
    }
  });

  await prisma.user.deleteMany({
    where: {
      id: { in: userIds }
    }
  });
};

const buildWorkEvents = (employees, admins, startDate) => {
  const rows = [];

  employees.forEach((employee, employeeIndex) => {
    for (let dayOffset = 0; dayOffset < FIXTURE_WINDOW_DAYS; dayOffset += 1) {
      const currentDate = addDays(startDate, dayOffset);
      const weekday = currentDate.getUTCDay();
      const workday = weekday >= 1 && weekday <= 5;
      const includeDay = workday || (employeeIndex + dayOffset) % 17 === 0;

      if (!includeDay) {
        continue;
      }

      const baseHour = 7 + (employeeIndex % 3);
      const entry = atUtc(currentDate, baseHour, 15 + ((employeeIndex * 7 + dayOffset * 3) % 30));
      const breakStart = atUtc(currentDate, 13, 30 + ((employeeIndex + dayOffset) % 20));
      const breakEnd = atUtc(currentDate, 14, 10 + ((employeeIndex * 2 + dayOffset) % 20));
      const exit = atUtc(currentDate, 16 + (employeeIndex % 2), 40 + ((employeeIndex + dayOffset * 5) % 15));

      rows.push({
        userId: employee.id,
        type: "CLOCK_IN",
        source: dayOffset % 6 === 0 ? "MOBILE" : "WEB",
        eventAt: entry,
        createdAt: entry,
        note: dayOffset % 11 === 0 ? "Entrada registrada desde demo fixtures." : null
      });

      if ((employeeIndex + dayOffset) % 5 !== 0) {
        rows.push({
          userId: employee.id,
          type: "BREAK_START",
          source: "WEB",
          eventAt: breakStart,
          createdAt: breakStart,
          note: null
        });

        rows.push({
          userId: employee.id,
          type: "BREAK_END",
          source: "WEB",
          eventAt: breakEnd,
          createdAt: breakEnd,
          note: null
        });
      }

      rows.push({
        userId: employee.id,
        type: "CLOCK_OUT",
        source: dayOffset % 7 === 0 ? "MOBILE" : "WEB",
        eventAt: exit,
        createdAt: exit,
        note: dayOffset % 9 === 0 ? "Salida registrada desde demo fixtures." : null
      });

      if ((employeeIndex + dayOffset) % 9 === 0) {
        rows.push({
          userId: employee.id,
          type: "MANUAL_ADJUSTMENT",
          source: "ADMIN",
          eventAt: atUtc(currentDate, 17, 35),
          createdAt: atUtc(currentDate, 17, 35),
          note: "Ajuste demo por cierre de jornada.",
          modifiedById: admins[employeeIndex % admins.length].id,
          metadata: {
            minutesDelta: employeeIndex % 2 === 0 ? 15 : -10,
            adjustedByFixture: true
          }
        });
      }
    }
  });

  return rows;
};

const createWorkEvents = async (rows) => {
  for (const batch of chunk(rows, 400)) {
    await prisma.workEvent.createMany({
      data: batch
    });
  }
};

const createEditRequests = async (employees, admins) => {
  const selectedEmployees = employees.slice(0, 6);
  const requests = [];

  for (let index = 0; index < selectedEmployees.length; index += 1) {
    const employee = selectedEmployees[index];
    const admin = admins[index % admins.length];
    const baseEvent = await prisma.workEvent.findFirst({
      where: {
        userId: employee.id,
        type: "CLOCK_IN"
      },
      orderBy: {
        eventAt: "desc"
      }
    });

    if (!baseEvent) {
      continue;
    }

    const requestedEventAt = new Date(baseEvent.eventAt.getTime() + 10 * 60 * 1000);
    const now = new Date();

    if (index < 2) {
      requests.push({
        workEventId: baseEvent.id,
        requestedById: employee.id,
        requestedEventAt,
        requestedNote: "Solicitud pendiente generada por fixtures.",
        reason: "Olvide fichar a la hora exacta.",
        status: "PENDING",
        createdAt: now,
        updatedAt: now
      });
      continue;
    }

    if (index < 4) {
      await prisma.workEvent.update({
        where: { id: baseEvent.id },
        data: {
          eventAt: requestedEventAt,
          modifiedAt: now,
          modifiedById: admin.id,
          modificationReason: "Solicitud aprobada generada por fixtures."
        }
      });

      requests.push({
        workEventId: baseEvent.id,
        requestedById: employee.id,
        requestedEventAt,
        requestedNote: "Solicitud aprobada generada por fixtures.",
        reason: "Necesitaba corregir la hora de entrada.",
        status: "APPROVED",
        reviewedById: admin.id,
        reviewedAt: now,
        reviewComment: "Aprobada desde datos demo.",
        createdAt: now,
        updatedAt: now
      });
      continue;
    }

    requests.push({
      workEventId: baseEvent.id,
      requestedById: employee.id,
      requestedEventAt,
      requestedNote: "Solicitud rechazada generada por fixtures.",
      reason: "Queria ajustar una entrada de prueba.",
      status: "REJECTED",
      reviewedById: admin.id,
      reviewedAt: now,
      reviewComment: "Rechazada desde datos demo.",
      createdAt: now,
      updatedAt: now
    });
  }

  if (requests.length > 0) {
    await prisma.workEventEditRequest.createMany({
      data: requests
    });
  }
};

const createTeamJoinRequests = async ({ availableEmployees, admins, superadmin }) => {
  const now = new Date();
  const pendingEmployees = availableEmployees.slice(0, 3);
  const approvedEmployee = availableEmployees[3];
  const rejectedEmployee = availableEmployees[4];

  const requests = [];

  pendingEmployees.forEach((employee, index) => {
    requests.push({
      employeeId: employee.id,
      targetManagerId: admins[index % admins.length].id,
      inviteCodeUsed: admins[index % admins.length].adminInviteCode,
      status: "PENDING",
      message: "Quiero unirme a este equipo desde el flujo de alta libre.",
      createdAt: now,
      updatedAt: now
    });
  });

  if (approvedEmployee) {
    await prisma.user.update({
      where: { id: approvedEmployee.id },
      data: {
        managerId: admins[0].id
      }
    });

    requests.push({
      employeeId: approvedEmployee.id,
      targetManagerId: admins[0].id,
      inviteCodeUsed: admins[0].adminInviteCode,
      status: "APPROVED",
      message: "Solicitud aprobada de ejemplo.",
      reviewComment: "Aprobada por superadmin en fixtures.",
      reviewedById: superadmin.id,
      reviewedAt: now,
      createdAt: now,
      updatedAt: now
    });
  }

  if (rejectedEmployee) {
    requests.push({
      employeeId: rejectedEmployee.id,
      targetManagerId: admins[1].id,
      inviteCodeUsed: admins[1].adminInviteCode,
      status: "REJECTED",
      message: "Solicitud rechazada de ejemplo.",
      reviewComment: "Rechazada por superadmin en fixtures.",
      reviewedById: superadmin.id,
      reviewedAt: now,
      createdAt: now,
      updatedAt: now
    });
  }

  if (requests.length > 0) {
    await prisma.teamJoinRequest.createMany({
      data: requests
    });
  }
};

const createNotifications = async ({ admins, employees, availableEmployees }) => {
  const now = new Date();
  const notificationRows = [];

  admins.forEach((admin, index) => {
    notificationRows.push({
      userId: admin.id,
      type: "TEAM_JOIN_REQUEST_CREATED",
      title: "Nueva solicitud de acceso a equipo",
      body: `${availableEmployees[index]?.fullName ?? "Un empleado"} ha solicitado unirse a tu equipo.`,
      metadata: {
        route: "/users?workspace=directory&focus=join-requests",
        fixture: true
      },
      isRead: false,
      createdAt: now
    });
  });

  employees.slice(0, 4).forEach((employee, index) => {
    notificationRows.push({
      userId: employee.id,
      type: index % 2 === 0 ? "EDIT_REQUEST_APPROVED" : "EVENT_MODIFIED",
      title: index % 2 === 0 ? "Solicitud de correccion aprobada" : "Registro modificado por administracion",
      body: index % 2 === 0 ? "Tu solicitud de correccion ha sido aprobada." : "Un administrador ha modificado uno de tus fichajes.",
      metadata: {
        route: "/reports",
        fixture: true
      },
      isRead: index % 3 === 0,
      readAt: index % 3 === 0 ? now : null,
      createdAt: now
    });
  });

  availableEmployees.slice(0, 3).forEach((employee, index) => {
    notificationRows.push({
      userId: employee.id,
      type: index === 0 ? "TEAM_JOIN_REQUEST_APPROVED" : "TEAM_JOIN_REQUEST_REJECTED",
      title: index === 0 ? "Solicitud de equipo aprobada" : "Solicitud de equipo rechazada",
      body: index === 0 ? "Tu solicitud para unirte a un equipo ha sido aprobada." : "Tu solicitud para unirte a un equipo ha sido rechazada.",
      metadata: {
        route: "/dashboard",
        fixture: true
      },
      isRead: false,
      createdAt: now
    });
  });

  if (notificationRows.length > 0) {
    await prisma.notification.createMany({
      data: notificationRows
    });
  }
};

async function main() {
  await cleanupPreviousFixtures();

  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);

  const superadmin = await createUser({
    email: `superadmin.fixture@${FIXTURE_DOMAIN}`,
    fullName: "Superadmin Fixtures",
    role: "SUPERADMIN",
    passwordHash
  });

  const adminNames = ["Norte", "Centro", "Levante", "Sur", "Canarias", "Portugal", "Baleares", "Internacional"];
  const admins = [];

  for (let index = 0; index < FIXTURE_ADMIN_COUNT; index += 1) {
    const adminLabel = adminNames[index] ?? `Zona ${index + 1}`;
    admins.push(
      await createUser({
        email: `admin${index + 1}.fixture@${FIXTURE_DOMAIN}`,
        fullName: `Admin ${adminLabel} Fixtures`,
        role: "ADMIN",
        passwordHash,
        adminInviteCode: `RGM-FXADM${String(index + 1).padStart(2, "0")}`
      })
    );
  }

  for (const admin of admins) {
    await prisma.billingSubscription.upsert({
      where: { adminId: admin.id },
      update: {
        planCode: "PACK_100",
        status: "ACTIVE",
        seatLimit: 100,
        isTrial: false,
        trialEndsAt: null
      },
      create: {
        adminId: admin.id,
        planCode: "PACK_100",
        status: "ACTIVE",
        seatLimit: 100,
        isTrial: false
      }
    });
  }

  const employees = [];
  for (let adminIndex = 0; adminIndex < admins.length; adminIndex += 1) {
    for (let employeeIndex = 0; employeeIndex < FIXTURE_EMPLOYEES_PER_ADMIN; employeeIndex += 1) {
      employees.push(
        await createUser({
          email: `empleado-${adminIndex + 1}-${employeeIndex + 1}@${FIXTURE_DOMAIN}`,
          fullName: `Empleado ${adminIndex + 1}-${employeeIndex + 1} Fixtures`,
          role: "EMPLOYEE",
          passwordHash,
          managerId: admins[adminIndex].id
        })
      );
    }
  }

  const availableEmployees = [];
  for (let index = 0; index < FIXTURE_AVAILABLE_EMPLOYEES; index += 1) {
    availableEmployees.push(
      await createUser({
        email: `pendiente-${index + 1}@${FIXTURE_DOMAIN}`,
        fullName: `Empleado Pendiente ${index + 1} Fixtures`,
        role: "EMPLOYEE",
        passwordHash
      })
    );
  }

  const startDate = addDays(new Date(), -FIXTURE_WINDOW_DAYS);
  const workEvents = buildWorkEvents(employees, admins, startDate);
  await createWorkEvents(workEvents);
  await createEditRequests(employees, admins);
  await createTeamJoinRequests({ availableEmployees, admins, superadmin });
  await createNotifications({ admins, employees, availableEmployees });

  console.log("Fixture seed completed.");
  console.log(`Password comun: ${FIXTURE_PASSWORD}`);
  console.log(`Superadmin fixture: superadmin.fixture@${FIXTURE_DOMAIN}`);
  console.log(`Admins fixture: ${admins.length}`);
  console.log(`Empleados asignados fixture: ${employees.length}`);
  console.log(`Empleados libres con solicitudes fixture: ${availableEmployees.length}`);
  console.log(`Eventos generados: ${workEvents.length}`);
  console.log(`Ventana de dias: ${FIXTURE_WINDOW_DAYS}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
