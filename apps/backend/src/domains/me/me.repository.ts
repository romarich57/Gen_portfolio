import { prisma } from '../../db/prisma';

export type MeRepository = typeof prisma;
export const meRepository: MeRepository = prisma;
