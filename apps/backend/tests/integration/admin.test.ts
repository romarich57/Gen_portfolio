import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';
import { app } from '../../src/app';
import { env } from '../../src/config/env';

describe('Admin Integration', () => {
    const adminHeaders = {
        'x-test-user-id': 'admin-user',
        'x-test-user-roles': 'admin'
    };
    const userHeaders = {
        'x-test-user-id': 'basic-user',
        'x-test-user-roles': 'user'
    };

    const origin = env.corsOrigins[0] ?? 'http://localhost:3000';

    async function getCsrf() {
        const res = await request(app).get('/auth/csrf').set('Origin', origin);
        const cookie = res.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
        return { token: res.body.csrfToken as string, cookie };
    }

    test('GET /admin/status/services - Admin access allowed', async () => {
        const res = await request(app).get('/admin/status/services').set(adminHeaders);
        assert.equal(res.status, 200);
        assert.equal(typeof res.body.ok, 'boolean');
        assert.ok(res.body.services);
    });

    test('GET /admin/status/services - User access denied', async () => {
        const res = await request(app).get('/admin/status/services').set(userHeaders);
        assert.equal(res.status, 403);
    });

    test('PUT /admin/security/mfa-flags - Admin can update', async () => {
        const { token, cookie } = await getCsrf();
        const res = await request(app)
            .put('/admin/security/mfa-flags')
            .set('Origin', origin)
            .set('X-CSRF-Token', token)
            .set('Cookie', cookie)
            .set(adminHeaders)
            .send({ mfaRequiredGlobal: true });

        assert.equal(res.status, 200);
        assert.equal(res.body.ok, true);
    });

    test('PUT /admin/security/mfa-flags - User access denied', async () => {
        const { token, cookie } = await getCsrf();
        const res = await request(app)
            .put('/admin/security/mfa-flags')
            .set('Origin', origin)
            .set('X-CSRF-Token', token)
            .set('Cookie', cookie)
            .set(userHeaders)
            .send({ mfaRequiredGlobal: true });

        assert.equal(res.status, 403);
    });
});
