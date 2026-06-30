import { PrismaClient } from "@prisma/client";
import { config } from "../config";

export const prisma = new PrismaClient({
  log: config.isDev ? ["query", "error", "warn"] : ["error"],
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log("📦 Database connected successfully");
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
