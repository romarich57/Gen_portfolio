import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';
import { prisma } from '../../src/db/prisma';
import { app } from '../../src/app';
import { signAccessToken } from '../../src/utils/jwt';

describe('Billing Integration', () => {
    async function getCsrf() {
        const res = await request(app).get('/auth/csrf').set('Origin', 'http://localhost:3000');
        const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
        return { token: res.body.csrfToken as string, cookie };
    }

    test('POST /billing/checkout-session - Unauthenticated denied', async () => {
        const { token, cookie } = await getCsrf();
        const res = await request(app)
            .post('/billing/checkout-session')
            .set('Origin', 'http://localhost:3000')
            .set('X-CSRF-Token', token)
            .set('Cookie', cookie)
            .send({ planCode: 'PREMIUM' });
        assert.equal(res.status, 401);
    });

    test('POST /billing/checkout-session - Authenticated allowed', async () => {
        const user = await prisma.user.create({
            data: {
                email: `billing-${Date.now()}@example.com`,
                status: 'active',
                roles: ['user'],
                onboardingCompletedAt: new Date()
            }
        });

        await prisma.plan.upsert({
            where: { code: 'PREMIUM' },
            update: {},
            create: {
                id: 'plan_premium_integration',
                code: 'PREMIUM',
                name: 'Premium',
                currency: 'EUR',
                stripePriceId: 'price_premium_test',
                amountCents: 1000,
                interval: 'month',
                isActive: true,
                features: { projects_limit: 5 }
            }
        });

        const accessToken = signAccessToken({ sub: user.id, roles: ['user'] }, 15);
        const { token, cookie } = await getCsrf();
        const cookieHeader = `${cookie}; access_token=${accessToken}`;

        const res = await request(app)
            .post('/billing/checkout-session')
            .set('Origin', 'http://localhost:3000')
            .set('X-CSRF-Token', token)
            .set('Cookie', cookieHeader)
            .send({ planCode: 'PREMIUM' });

        assert.equal(res.status, 200);
        assert.ok(res.body.checkout_url);
    });
});
