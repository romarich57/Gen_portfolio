import dotenv from 'dotenv';
import { PrismaClient, PlanCode, Currency, BillingInterval, UserStatus } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

dotenv.config();

const prisma = new PrismaClient();

async function ensurePlan(params: {
  code: PlanCode;
  name: string;
  amountCents: number;
  projectLimit: number | null;
  creditsMonthly: number | null;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
}) {
  const existing = await prisma.plan.findFirst({ where: { code: params.code } });
  if (existing) {
    // Update existing plan with Stripe IDs if provided
    if (params.stripePriceId || params.stripeProductId) {
      return prisma.plan.update({
        where: { id: existing.id },
        data: {
          stripePriceId: params.stripePriceId ?? existing.stripePriceId,
          stripeProductId: params.stripeProductId ?? existing.stripeProductId,
          amountCents: params.amountCents,
          isActive: true
        }
      });
    }
    return existing;
  }
  return prisma.plan.create({
    data: {
      code: params.code,
      name: params.name,
      currency: Currency.EUR,
      amountCents: params.amountCents,
      interval: BillingInterval.month,
      projectLimit: params.projectLimit,
      creditsMonthly: params.creditsMonthly,
      stripePriceId: params.stripePriceId ?? null,
      stripeProductId: params.stripeProductId ?? null,
      isActive: true
    }
  });
}

async function main() {
  await ensurePlan({ code: PlanCode.FREE, name: 'Gratuit', amountCents: 0, projectLimit: 1, creditsMonthly: 50 });
  await ensurePlan({
    code: PlanCode.PREMIUM,
    name: 'Premium',
    amountCents: 1000,
    projectLimit: 5,
    creditsMonthly: 200,
    stripePriceId: process.env.STRIPE_PRICE_ID_PREMIUM ?? null,
    stripeProductId: process.env.STRIPE_PRODUCT_ID_PREMIUM ?? null
  });
  await ensurePlan({
    code: PlanCode.VIP,
    name: 'VIP',
    amountCents: 3000,
    projectLimit: null,
    creditsMonthly: 999,
    stripePriceId: process.env.STRIPE_PRICE_ID_VIP ?? null,
    stripeProductId: process.env.STRIPE_PRODUCT_ID_VIP ?? null
  });

  const adminPassword = await hashPassword('AdminStrongPassw0rd!');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@saas.local' },
    update: {},
    create: {
      email: 'superadmin@saas.local',
      passwordHash: adminPassword,
      status: UserStatus.active,
      roles: ['super_admin'],
      firstName: 'Super',
      lastName: 'Admin',
      username: 'superadmin',
      nationality: 'FR',
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  await prisma.user.upsert({
    where: { email: 'admin@saas.local' },
    update: {},
    create: {
      email: 'admin@saas.local',
      passwordHash: adminPassword,
      status: UserStatus.active,
      roles: ['admin'],
      firstName: 'Admin',
      lastName: 'User',
      username: 'adminuser',
      nationality: 'FR',
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date()
    }
  });

  const userPassword = await hashPassword('UserStrongPassw0rd!');

  const freeUser = await prisma.user.upsert({
    where: { email: 'free@saas.local' },
    update: {},
    create: {
      email: 'free@saas.local',
      passwordHash: userPassword,
      status: UserStatus.active,
      roles: ['user'],
      firstName: 'Free',
      lastName: 'User',
      username: 'freeuser',
      nationality: 'FR',
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date(),
      creditsBalance: 10
    }
  });

  const premiumUser = await prisma.user.upsert({
    where: { email: 'premium@saas.local' },
    update: {},
    create: {
      email: 'premium@saas.local',
      passwordHash: userPassword,
      status: UserStatus.active,
      roles: ['premium'],
      firstName: 'Premium',
      lastName: 'User',
      username: 'premiumuser',
      nationality: 'FR',
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date(),
      creditsBalance: 50
    }
  });

  const vipUser = await prisma.user.upsert({
    where: { email: 'vip@saas.local' },
    update: {},
    create: {
      email: 'vip@saas.local',
      passwordHash: userPassword,
      status: UserStatus.active,
      roles: ['vip'],
      firstName: 'VIP',
      lastName: 'User',
      username: 'vipuser',
      nationality: 'FR',
      onboardingCompletedAt: new Date(),
      emailVerifiedAt: new Date(),
      creditsBalance: 200
    }
  });

  const periodStart = new Date();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: 'sub_test_premium' },
    update: {},
    create: {
      userId: premiumUser.id,
      stripeSubscriptionId: 'sub_test_premium',
      planCode: PlanCode.PREMIUM,
      status: 'active',
      currency: Currency.EUR,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false
    }
  });

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: 'sub_test_vip' },
    update: {},
    create: {
      userId: vipUser.id,
      stripeSubscriptionId: 'sub_test_vip',
      planCode: PlanCode.VIP,
      status: 'active',
      currency: Currency.EUR,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false
    }
  });

  await prisma.creditsLedger.createMany({
    data: [
      { userId: freeUser.id, delta: 10, reason: 'seed', createdByAdminId: superAdmin.id },
      { userId: premiumUser.id, delta: 50, reason: 'seed', createdByAdminId: superAdmin.id },
      { userId: vipUser.id, delta: 200, reason: 'seed', createdByAdminId: superAdmin.id }
    ],
    skipDuplicates: true
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
