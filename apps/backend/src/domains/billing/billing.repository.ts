import { prisma } from '../../db/prisma';

export type BillingRepository = typeof prisma;
export const billingRepository: BillingRepository = prisma;
