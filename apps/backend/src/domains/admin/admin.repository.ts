import { prisma } from '../../db/prisma';

export type AdminRepository = typeof prisma;
export const adminRepository: AdminRepository = prisma;
