// FILE PATH: apps/api/src/prisma.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
// import { withOptimize } from "@prisma/extension-optimize"; // Uncomment if using optimize

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString: connectionString,
});

const prisma = new PrismaClient({
  adapter: adapter,
})
  // .extends(withOptimize({ apiKey: process.env.OPTIMIZE_API_KEY })) // Add optimize here if needed
  .$extends({
    name: 'NoCreatedAtUpdate',
    query: {
      $allModels: {
        update({ args, query }: { args: any, query: any }) {
          if ('created_at' in (args.data || {})) {
            delete (args.data as any).created_at
          }
          if ('updated_at' in (args.data || {})) {
            delete (args.data as any).updated_at
          }
          return query(args)
        },
        updateMany({ args, query }: { args: any, query: any }) {
          if ('created_at' in (args.data || {})) {
            delete (args.data as any).created_at
          }
          if ('updated_at' in (args.data || {})) {
            delete (args.data as any).updated_at
          }
          return query(args)
        }
      }
    }
  })

async function connect() {
  try {
    await prisma.$connect();
    console.log('Prisma connected');
  } catch (error) {
    console.error('Error connecting to Prisma:', error);
    process.exit(1);
  }
}

connect();

export default prisma
