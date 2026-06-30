import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const adminTenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "الشركة الرئيسية",
      slug: "default",
      config: { timezone: "Asia/Riyadh", locale: "ar-SA" },
    },
  });

  console.log(`Tenant created: ${adminTenant.name}`);

  const employees = [
    { name: "أحمد محمد", hireDate: new Date("2023-01-15") },
    { name: "سارة خالد", hireDate: new Date("2023-03-20") },
    { name: "محمد علي", hireDate: new Date("2022-11-01") },
    { name: "نورة عبدالله", hireDate: new Date("2024-01-10") },
    { name: "فهد عمر", hireDate: new Date("2023-06-05") },
    { name: "لينا حسن", hireDate: new Date("2022-09-12") },
    { name: "خالد إبراهيم", hireDate: new Date("2024-02-28") },
    { name: "مريم سليمان", hireDate: new Date("2023-08-15") },
  ];

  for (const emp of employees) {
    await prisma.employee.create({
      data: {
        ...emp,
        tenantId: adminTenant.id,
      },
    });
  }

  console.log(`✅ ${employees.length} employees seeded`);

  await prisma.setting.upsert({
    where: { key: "reminder_days" },
    update: { value: "30" },
    create: { key: "reminder_days", value: "30", tenantId: adminTenant.id },
  });

  await prisma.setting.upsert({
    where: { key: "reminder_email" },
    update: { value: "" },
    create: {
      key: "reminder_email",
      value: "",
      tenantId: adminTenant.id,
    },
  });

  console.log("✅ Settings seeded");
  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
