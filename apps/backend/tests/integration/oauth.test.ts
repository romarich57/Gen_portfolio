import test, { describe, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import '../setupEnv';
import '../helpers/db';
import { app } from '../../src/app';
import { prisma } from '../../src/db/prisma';
import { UserStatus } from '@prisma/client';

function hasLiveSessionCookie(cookies: string[] | undefined, name: 'access_token' | 'refresh_token') {
    return (cookies ?? []).some((cookie) => new RegExp(`^${name}=[^;]+`).test(cookie) && !cookie.startsWith(`${name}=;`));
}

describe('OAuth Flow (GitHub)', () => {
    let fetchMock: any;

    beforeEach(() => {
        // Reset mocks before each test
        if (fetchMock) fetchMock.mock.restore();

        // Mock global fetch
        fetchMock = mock.method(global, 'fetch', async (input: RequestInfo | URL, _init?: RequestInit) => {
            const url = input.toString();

            // Mock GitHub Token Exchange
            if (url === 'https://github.com/login/oauth/access_token') {
                return {
                    ok: true,
                    json: async () => ({ access_token: 'mock_gh_access_token', token_type: 'bearer' }),
                };
            }

            // Mock GitHub User Profile
            if (url === 'https://api.github.com/user') {
                return {
                    ok: true,
                    json: async () => ({ id: 123456, email: 'githubuser@example.com' }),
                };
            }

            // Mock GitHub User Emails (Critical for our fix)
            if (url === 'https://api.github.com/user/emails') {
                return {
                    ok: true,
                    json: async () => [
                        { email: 'githubuser@example.com', primary: true, verified: true, visibility: 'public' }
                    ],
                };
            }

            return { ok: false, status: 404 };
        });
    });

    after(() => {
        if (fetchMock) fetchMock.mock.restore();
    });

    test('GET /auth/oauth/github/start redirects to GitHub', async () => {
        const res = await request(app).get('/auth/oauth/github/start');

        assert.equal(res.status, 302);
        assert.ok(res.header.location.startsWith('https://github.com/login/oauth/authorize'));

        // Check cookies are set
        const cookies = res.headers['set-cookie'] as unknown as string[];
        assert.ok(cookies.some((c: string) => c.includes('oauth_state_github')));
        assert.ok(cookies.some((c: string) => c.includes('oauth_nonce_github')));
        assert.ok(cookies.some((c: string) => c.includes('oauth_verifier_github')));
    });

    test('GET /auth/oauth/github/callback handles successful login', async () => {
        // Extract values for query params
        // Node: signed cookies have a signature. The app checks req.signedCookies.
        // Supertest agent automatically handles cookies if we use it, but here we manually extracting.
        // Easier to use request.agent().

        const agent = request.agent(app);
        const startAgentRes = await agent.get('/auth/oauth/github/start');

        // Parse state from cookie to build query param
        // The state cookie value is signed. The server expects the UN-signed value in the query param `state`.
        // Wait, the code says:
        // const state = typeof req.query.state === 'string' ? req.query.state : null;
        // ...
        // const stateCookie = req.signedCookies?.[`oauth_state_${provider}`];
        // if (!stateCookie || stateCookie !== state) ...

        // So req.query.state must MATCH req.signedCookies value (unwrapped).
        // Getting the unsigned value from a signed cookie client-side is hard without the secret.
        // BUT, the start endpoint redirects to: authorizationUrl.
        // The authorizationUrl CONTAINS the plain state!

        const redirectUrl = new URL(startAgentRes.header.location);
        const stateParam = redirectUrl.searchParams.get('state');
        // Code: const nonceFromState = state.split('.')[1];

        assert.ok(stateParam);

        // 2. Call callback with code and state
        const callbackRes = await agent.get('/auth/oauth/github/callback')
            .query({ code: 'mock_gh_code', state: stateParam });

        assert.equal(callbackRes.status, 302);
        const finalLocation = callbackRes.header.location;
        assert.ok(finalLocation.includes('/oauth/callback'));
        assert.ok(finalLocation.includes('next=complete-profile'));

        // 3. Verify user is created in DB
        const user = await prisma.user.findUnique({ where: { email: 'githubuser@example.com' } });
        assert.ok(user);
        assert.equal(user.email, 'githubuser@example.com');
        assert.ok(user.emailVerifiedAt);
    });

    test('GET /auth/oauth/github/callback rejects unverified email', async () => {
        // Update mock for this test
        fetchMock.mock.restore();
        fetchMock = mock.method(global, 'fetch', async (input: RequestInfo | URL) => {
            const url = input.toString();
            if (url === 'https://github.com/login/oauth/access_token') {
                return { ok: true, json: async () => ({ access_token: 'mock_gh_access_token' }) };
            }
            if (url === 'https://api.github.com/user') {
                return { ok: true, json: async () => ({ id: 123456, email: 'unverified@example.com' }) };
            }
            if (url === 'https://api.github.com/user/emails') {
                return {
                    ok: true,
                    json: async () => [
                        { email: 'unverified@example.com', primary: true, verified: false } // VERIFIED FALSE
                    ],
                };
            }
            return { ok: false, status: 404 };
        });

        const agent = request.agent(app);
        const startAgentRes = await agent.get('/auth/oauth/github/start');
        const redirectUrl = new URL(startAgentRes.header.location);
        const stateParam = redirectUrl.searchParams.get('state');

        const callbackRes = await agent
            .get('/auth/oauth/github/callback')
            .query({ code: 'mock_gh_code', state: stateParam });

        assert.equal(callbackRes.status, 302);
        assert.ok(callbackRes.header.location.includes('/oauth/callback'));
        assert.ok(callbackRes.header.location.includes('status=error'));
        assert.ok(callbackRes.header.location.includes('reason=email_not_verified'));

        const user = await prisma.user.findUnique({ where: { email: 'unverified@example.com' } });
        assert.ok(user);
        assert.equal(user?.emailVerifiedAt, null);
    });

    test('GET /auth/oauth/github/callback requires email-owner approval on collision', async () => {
        await prisma.user.create({
            data: {
                email: 'githubuser@example.com',
                status: UserStatus.active,
                emailVerifiedAt: new Date(),
                roles: ['user']
            }
        });

        const agent = request.agent(app);
        const startAgentRes = await agent.get('/auth/oauth/github/start');
        const redirectUrl = new URL(startAgentRes.header.location);
        const stateParam = redirectUrl.searchParams.get('state');

        const callbackRes = await agent
            .get('/auth/oauth/github/callback')
            .query({ code: 'mock_gh_code', state: stateParam });

        assert.equal(callbackRes.status, 302);
        assert.ok(callbackRes.header.location.includes('status=error'));
        assert.ok(callbackRes.header.location.includes('reason=link_confirmation_required'));
        assert.ok(!hasLiveSessionCookie(callbackRes.headers['set-cookie'] as string[] | undefined, 'access_token'));
        assert.ok(!hasLiveSessionCookie(callbackRes.headers['set-cookie'] as string[] | undefined, 'refresh_token'));

        const linkRequest = await prisma.oAuthLinkRequest.findFirst({
            where: { emailAtProvider: 'githubuser@example.com', provider: 'github' }
        });
        assert.ok(linkRequest);

        const linkedAccount = await prisma.oAuthAccount.findFirst({
            where: { provider: 'github', providerUserId: '123456' }
        });
        assert.equal(linkedAccount, null);
    });

    test('GET /auth/oauth/github/callback sets onboarding token instead of session when MFA setup is required', async () => {
        const user = await prisma.user.create({
            data: {
                email: 'githubuser@example.com',
                status: UserStatus.active,
                emailVerifiedAt: new Date(),
                roles: ['user'],
                onboardingCompletedAt: new Date(),
                firstName: 'Git',
                lastName: 'Hub',
                username: `github_${Date.now()}`,
                nationality: 'FR'
            }
        });
        await prisma.featureFlag.create({
            data: { key: 'mfa_required_global', valueBoolean: true }
        });
        await prisma.oAuthAccount.create({
            data: {
                provider: 'github',
                providerUserId: '123456',
                userId: user.id,
                emailAtProvider: user.email
            }
        });

        const agent = request.agent(app);
        const startAgentRes = await agent.get('/auth/oauth/github/start');
        const redirectUrl = new URL(startAgentRes.header.location);
        const stateParam = redirectUrl.searchParams.get('state');

        const callbackRes = await agent
            .get('/auth/oauth/github/callback')
            .query({ code: 'mock_gh_code', state: stateParam });

        assert.equal(callbackRes.status, 302);
        assert.ok(callbackRes.header.location.includes('next=setup-mfa'));
        const cookies = callbackRes.headers['set-cookie'] as string[] | undefined;
        assert.ok((cookies ?? []).some((cookie) => cookie.startsWith('onboarding_token=')));
        assert.ok(!hasLiveSessionCookie(cookies, 'access_token'));
        assert.ok(!hasLiveSessionCookie(cookies, 'refresh_token'));
    });
});
