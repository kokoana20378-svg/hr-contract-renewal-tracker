import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: (process.env.NODE_ENV || "development") === "development",

  database: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/hr_contracts",
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    enabled: process.env.REDIS_ENABLED === "true",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },

  smtp: {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || "",
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "*",
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
  },

  tenant: {
    enabled: process.env.MULTI_TENANT_ENABLED === "true",
  },
};
