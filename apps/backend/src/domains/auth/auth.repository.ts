import { prisma } from '../../db/prisma';

export type AuthRepository = typeof prisma;
export const authRepository: AuthRepository = prisma;
