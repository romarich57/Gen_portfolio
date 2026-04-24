import { env } from '../config/env';
import { buildEmailHtml, buildEmailText, sendEmail } from './email';

async function sendAccountEmail(params: {
  to: string;
  subject: string;
  title: string;
  preview: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  outro: string;
  secondaryActionLabel?: string;
  secondaryActionUrl?: string;
}) {
  const template = {
    title: params.title,
    preview: params.preview,
    intro: params.intro,
    actionLabel: params.actionLabel,
    actionUrl: params.actionUrl,
    ...(params.secondaryActionLabel ? { secondaryActionLabel: params.secondaryActionLabel } : {}),
    ...(params.secondaryActionUrl ? { secondaryActionUrl: params.secondaryActionUrl } : {}),
    outro: params.outro
  };

  await sendEmail({
    to: params.to,
    subject: params.subject,
    html: buildEmailHtml(template),
    text: buildEmailText(template)
  });
}

export async function sendEmailChangeRequestNotifications(params: {
  oldEmail: string;
  newEmail: string;
  verifyUrl: string;
  cancelUrl: string;
}) {
  await Promise.all([
    sendAccountEmail({
      to: params.newEmail,
      subject: 'Confirmez votre nouvel email',
      title: "Confirmation du changement d'email",
      preview: 'Validez votre nouvelle adresse email.',
      intro: `Vous avez demande a utiliser ${params.newEmail} comme nouvelle adresse de connexion.`,
      actionLabel: 'Confirmer le changement',
      actionUrl: params.verifyUrl,
      outro: 'Si vous n’avez pas initie ce changement, ignorez ce message.'
    }),
    sendAccountEmail({
      to: params.oldEmail,
      subject: "Alerte changement d'email",
      title: "Demande de changement d'email detectee",
      preview: 'Annulez cette demande si elle ne vient pas de vous.',
      intro: `Une demande vise a remplacer ${params.oldEmail} par ${params.newEmail} sur votre compte.`,
      actionLabel: 'Annuler cette demande',
      actionUrl: params.cancelUrl,
      outro: "Si c'etait bien vous, aucune action supplementaire n'est requise."
    })
  ]);
}

export async function sendEmailChangedNotification(params: { oldEmail: string; newEmail: string }) {
  await Promise.all([
    sendAccountEmail({
      to: params.oldEmail,
      subject: 'Votre email a ete modifie',
      title: 'Email modifie',
      preview: 'Votre adresse de connexion a ete mise a jour.',
      intro: `Votre adresse de connexion a ete remplacee par ${params.newEmail}.`,
      actionLabel: 'Verifier mon compte',
      actionUrl: `${env.appBaseUrl}/profile`,
      outro: "Si ce changement n'est pas legitime, contactez le support immediatement."
    }),
    sendAccountEmail({
      to: params.newEmail,
      subject: 'Votre nouvel email est actif',
      title: 'Nouvel email confirme',
      preview: 'Votre nouvelle adresse est maintenant active.',
      intro: `Votre adresse ${params.newEmail} est maintenant associee a votre compte.`,
      actionLabel: 'Ouvrir mon profil',
      actionUrl: `${env.appBaseUrl}/profile`,
      outro: 'Toutes les sessions actives ont ete revoquees pour proteger votre compte.'
    })
  ]);
}

export async function sendPasswordChangedNotification(email: string) {
  await sendAccountEmail({
    to: email,
    subject: 'Votre mot de passe a ete modifie',
    title: 'Mot de passe modifie',
    preview: 'Votre mot de passe vient d’etre change.',
    intro: 'Le mot de passe de votre compte a ete modifie avec succes.',
    actionLabel: 'Verifier mon compte',
    actionUrl: `${env.appBaseUrl}/profile`,
    outro: "Si vous n'etes pas a l'origine de ce changement, revoquez vos sessions et contactez le support."
  });
}

export async function sendRecoveryEmailAddedNotification(params: { email: string; recoveryEmail: string }) {
  await sendAccountEmail({
    to: params.email,
    subject: 'Email de recuperation ajoute',
    title: 'Email de recuperation ajoute',
    preview: 'Une nouvelle adresse de recuperation est en attente ou active.',
    intro: `Une adresse de recuperation (${params.recoveryEmail}) vient d'etre associee a votre compte.`,
    actionLabel: 'Verifier mon compte',
    actionUrl: `${env.appBaseUrl}/profile`,
    outro: "Si ce changement n'est pas attendu, retirez cette adresse depuis vos parametres."
  });
}

export async function sendRecoveryEmailRemovedNotification(email: string) {
  await sendAccountEmail({
    to: email,
    subject: 'Email de recuperation supprime',
    title: 'Email de recuperation supprime',
    preview: 'Votre email de recuperation a ete retire.',
    intro: 'Votre email de recuperation a ete supprime de votre compte.',
    actionLabel: 'Verifier mon compte',
    actionUrl: `${env.appBaseUrl}/profile`,
    outro: "Si ce changement n'est pas attendu, ajoutez un nouvel email de recuperation sans attendre."
  });
}

export async function sendMfaDisabledNotification(email: string) {
  await sendAccountEmail({
    to: email,
    subject: 'MFA desactivee',
    title: 'MFA desactivee',
    preview: 'La double authentification vient d’etre desactivee.',
    intro: 'La double authentification de votre compte a ete desactivee.',
    actionLabel: 'Verifier mon compte',
    actionUrl: `${env.appBaseUrl}/profile`,
    outro: "Si vous n'etes pas a l'origine de cette action, revoquez vos sessions immediatement."
  });
}

export async function sendOAuthLinkApprovedNotification(params: {
  email: string;
  provider: 'google' | 'github';
}) {
  await sendAccountEmail({
    to: params.email,
    subject: 'Provider OAuth lie',
    title: 'Provider OAuth lie',
    preview: 'Un provider OAuth a ete approuve pour votre compte.',
    intro: `Le provider ${params.provider} est maintenant autorise pour se connecter a votre compte.`,
    actionLabel: 'Verifier mon compte',
    actionUrl: `${env.appBaseUrl}/profile`,
    outro: "Si vous n'etes pas a l'origine de cette approbation, revoquez vos sessions."
  });
}

export async function sendOAuthLinkRequestNotification(params: {
  email: string;
  provider: 'google' | 'github';
  verifyUrl: string;
}) {
  await sendAccountEmail({
    to: params.email,
    subject: 'Confirmation de liaison OAuth',
    title: 'Confirmez la liaison OAuth',
    preview: 'Un provider OAuth demande l’acces a votre compte.',
    intro: `Une tentative de connexion via ${params.provider} correspond a votre adresse email. Confirmez cette liaison seulement si elle vient de vous.`,
    actionLabel: 'Approuver la liaison',
    actionUrl: params.verifyUrl,
    outro: "Si vous n'etes pas a l'origine de cette tentative, ignorez cet email."
  });
}
