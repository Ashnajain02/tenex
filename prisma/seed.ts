import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create test user
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.upsert({
    where: { email: "test@twix.dev" },
    update: {},
    create: {
      email: "test@twix.dev",
      name: "Test User",
      passwordHash,
    },
  });

  console.log("Created test user:", user.email);

  // Create a sample conversation with main thread and messages
  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: "Welcome to Twix",
      threads: {
        create: {
          depth: 0,
          status: "ACTIVE",
          messages: {
            create: [
              {
                role: "ASSISTANT",
                content:
                  "Welcome to Twix! I'm your AI assistant. You can highlight any text in my responses and open a tangent thread to explore sub-topics without disrupting our main conversation. Try it out!",
              },
            ],
          },
        },
      },
    },
  });

  console.log("Created sample conversation:", conversation.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
