import twilio from 'twilio';
import { env } from '../config/env';

const useMock = env.isTest || env.twilioVerifyMode === 'mock';
const client = useMock ? null : twilio(env.twilioAccountSid, env.twilioAuthToken);

export async function startPhoneVerification(phone: string): Promise<{ sid: string; status: string }> {
  if (useMock || !client) {
    return { sid: `test-${Date.now()}`, status: 'pending' };
  }

  const verification = await client.verify.v2
    .services(env.twilioVerifyServiceSid)
    .verifications.create({ to: phone, channel: 'sms' });

  return { sid: verification.sid, status: verification.status };
}

export async function checkPhoneVerification(phone: string, code: string): Promise<{ status: string }> {
  if (useMock || !client) {
    return { status: code === '000000' ? 'approved' : 'denied' };
  }

  const verificationCheck = await client.verify.v2
    .services(env.twilioVerifyServiceSid)
    .verificationChecks.create({ to: phone, code });

  return { status: verificationCheck.status };
}

export async function sendSmsMessage(params: { to: string; body: string }): Promise<void> {
  if (useMock || !client) {
    return;
  }

  const messagingServiceSid = env.twilioMessagingServiceSid ?? null;
  const from = env.twilioSmsFrom ?? null;

  if (!messagingServiceSid && !from) {
    throw new Error('TWILIO_SMS_NOT_CONFIGURED');
  }

  await client.messages.create({
    to: params.to,
    body: params.body,
    ...(messagingServiceSid ? { messagingServiceSid } : { from: from as string })
  });
}
