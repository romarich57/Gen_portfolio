import { profileUseCaseRouter } from './profile.use-case';
import { avatarUseCaseRouter } from './avatar.use-case';
import { gdprUseCaseRouter } from './gdpr.use-case';
import { sessionsUseCaseRouter } from './sessions.use-case';
import { securityUseCaseRouter } from './security.use-case';
import { emailUseCaseRouter } from './email.use-case';

export type MeUseCases = {
  profileUseCaseRouter: typeof profileUseCaseRouter;
  avatarUseCaseRouter: typeof avatarUseCaseRouter;
  gdprUseCaseRouter: typeof gdprUseCaseRouter;
  sessionsUseCaseRouter: typeof sessionsUseCaseRouter;
  securityUseCaseRouter: typeof securityUseCaseRouter;
  emailUseCaseRouter: typeof emailUseCaseRouter;
};

export const meUseCases: MeUseCases = {
  profileUseCaseRouter,
  avatarUseCaseRouter,
  gdprUseCaseRouter,
  sessionsUseCaseRouter,
  securityUseCaseRouter,
  emailUseCaseRouter
};

export {
  profileUseCaseRouter,
  avatarUseCaseRouter,
  gdprUseCaseRouter,
  sessionsUseCaseRouter,
  securityUseCaseRouter,
  emailUseCaseRouter
};
