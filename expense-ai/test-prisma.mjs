import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function test() {
  try {
    await prisma.user.upsert({
      where: { email: "test-google-auth@split.ai" },
      create: { 
        email: "test-google-auth@split.ai", 
        name: "Test", 
        password: undefined 
      },
      update: { name: "Test Docs" },
    })
    console.log("SUCCESS")
  } catch (e) {
    console.error("PRISMA ERROR:", e)
  }
}
test()
