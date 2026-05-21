import prismaClientPkg, { type PrismaClient as PrismaClientType } from '@prisma/client/index';

const { PrismaClient } = prismaClientPkg;

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClientType;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
