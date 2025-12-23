import { defineConfig } from "@prisma/config";
import dotenv from "dotenv";

// Load .env file
dotenv.config();

export default defineConfig({
  schema: "./prisma/schema.prisma",

  datasource: {
    db: {
      provider: "postgresql",
      url: process.env.DATABASE_URL
    }
  }
});