import { PrismaClient } from "@prisma/client/edge";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create a sample admin (phone OTP will be needed to actually log in)
  // In production, use your actual phone number
  console.log("✅ Seed complete. Use your phone number to register via OTP.");
  console.log("📌 To make yourself admin, run:");
  console.log("   UPDATE \"User\" SET role = 'ADMIN' WHERE phone = '+YOUR_PHONE';");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
