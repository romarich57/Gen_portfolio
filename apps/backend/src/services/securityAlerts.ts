import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { sendEmail, buildEmailHtml, buildEmailText } from './email';
import { sendSmsMessage } from './twilio';
import { writeAuditLog } from './audit';
import { logger } from '../middleware/logger';
import { generateRandomToken, hashToken } from '../utils/crypto';

type LoginAlertParams = {
  userId: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  emailEnabled: boolean;
  smsEnabled: boolean;
  requestId: string;
  knownDevice?: boolean;
};

const ALERT_ACTION_TTL_MINUTES = 30;

async function lookupVerifiedPhone(userId: string): Promise<string | null> {
  const record = await prisma.phoneVerification.findFirst({
    where: { userId, status: 'approved' },
    orderBy: { createdAt: 'desc' }
  });
  return record?.phoneE164 ?? null;
}

async function isKnownDevice(params: { userId: string; ip?: string | null; userAgent?: string | null }) {
  if (!params.ip || !params.userAgent) return false;
  const existing = await prisma.session.findFirst({
    where: {
      userId: params.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ip: params.ip,
      userAgent: params.userAgent
    }
  });
  return Boolean(existing);
}

async function createSecurityActionToken(userId: string, action: 'REVOKE_SESSIONS' | 'ACK_ALERT'): Promise<string> {
  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ALERT_ACTION_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction([
    prisma.securityActionToken.deleteMany({ where: { userId, action } }),
    prisma.securityActionToken.create({
      data: {
        userId,
        action,
        tokenHash,
        expiresAt
      }
    })
  ]);

  return rawToken;
}

export async function maybeSendLoginAlert(params: LoginAlertParams): Promise<void> {
  try {
    const { emailEnabled, smsEnabled } = params;
    if (!emailEnabled && !smsEnabled) return;

    const knownDevice = params.knownDevice ?? await isKnownDevice({
      userId: params.userId,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null
    });
    if (knownDevice) return;

    const ip = params.ip ?? 'inconnue';
    const ua = params.userAgent ?? 'agent inconnu';
    let actionUrl = `${env.appBaseUrl}/profile`;
    let actionLabel = 'Verifier mon compte';
    let secondaryActionUrl: string | undefined;
    let secondaryActionLabel: string | undefined;

    try {
      const revokeToken = await createSecurityActionToken(params.userId, 'REVOKE_SESSIONS');
      const ackToken = await createSecurityActionToken(params.userId, 'ACK_ALERT');
      actionUrl = `${env.appBaseUrl}/security/revoke-sessions?token=${encodeURIComponent(revokeToken)}`;
      actionLabel = 'Revoquer toutes les sessions';
      secondaryActionUrl = `${env.appBaseUrl}/security/acknowledge-alert?token=${encodeURIComponent(ackToken)}`;
      secondaryActionLabel = "C'etait moi";
    } catch (error) {
      logger.warn({ error }, 'Failed to create security revoke token');
    }

    const sendTasks: Promise<void>[] = [];

    if (emailEnabled) {
      sendTasks.push(
        sendEmail({
          to: params.email,
          subject: 'Nouvelle connexion detectee',
          html: buildEmailHtml({
            title: 'Nouvelle connexion detectee',
            preview: 'Connexion inhabituelle sur votre compte.',
            intro: `Une nouvelle connexion a ete detectee depuis l'adresse IP ${ip}.`,
            actionLabel,
            actionUrl,
            ...(secondaryActionLabel && secondaryActionUrl
              ? { secondaryActionLabel, secondaryActionUrl }
              : {}),
            outro: `Agent: ${ua}`
          }),
          text: buildEmailText({
            title: 'Nouvelle connexion detectee',
            preview: 'Connexion inhabituelle sur votre compte.',
            intro: `Une nouvelle connexion a ete detectee depuis l'adresse IP ${ip}.`,
            actionLabel,
            actionUrl,
            ...(secondaryActionLabel && secondaryActionUrl
              ? { secondaryActionLabel, secondaryActionUrl }
              : {}),
            outro: `Agent: ${ua}`
          })
        })
      );
    }

    if (smsEnabled) {
      const phone = await lookupVerifiedPhone(params.userId);
      if (phone) {
        sendTasks.push(
          sendSmsMessage({
            to: phone,
            body: `Nouvelle connexion sur votre compte CV Genius. IP: ${ip}`
          })
        );
      }
    }

    if (sendTasks.length === 0) return;

    const results = await Promise.allSettled(sendTasks);
    const failed = results.filter((result) => result.status === 'rejected');

    if (failed.length > 0) {
      failed.forEach((result) => {
        if (result.status === 'rejected') {
          logger.warn({ error: result.reason }, 'Failed to send security alert');
        }
      });
    }

    await writeAuditLog({
      actorUserId: params.userId,
      actorIp: params.ip ?? null,
      action: 'SECURITY_ALERT_SENT',
      targetType: 'user',
      targetId: params.userId,
      metadata: { channels: { email: emailEnabled, sms: smsEnabled } },
      requestId: params.requestId
    });
  } catch (error) {
    logger.warn({ error }, 'Security alert flow failed');
  }
}
