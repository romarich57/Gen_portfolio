import { registrationUseCaseRouter } from './registration.use-case';
import { authenticationUseCaseRouter } from './authentication.use-case';
import { passwordUseCaseRouter } from './password.use-case';
import { phoneUseCaseRouter } from './phone.use-case';
import { mfaUseCaseRouter } from './mfa.use-case';
import { oauthUseCaseRouter } from './oauth.use-case';
import { emailUseCaseRouter } from './email.use-case';

export type AuthUseCases = {
  registrationUseCaseRouter: typeof registrationUseCaseRouter;
  authenticationUseCaseRouter: typeof authenticationUseCaseRouter;
  passwordUseCaseRouter: typeof passwordUseCaseRouter;
  phoneUseCaseRouter: typeof phoneUseCaseRouter;
  mfaUseCaseRouter: typeof mfaUseCaseRouter;
  oauthUseCaseRouter: typeof oauthUseCaseRouter;
  emailUseCaseRouter: typeof emailUseCaseRouter;
};

export const authUseCases: AuthUseCases = {
  registrationUseCaseRouter,
  authenticationUseCaseRouter,
  passwordUseCaseRouter,
  phoneUseCaseRouter,
  mfaUseCaseRouter,
  oauthUseCaseRouter,
  emailUseCaseRouter
};

export {
  registrationUseCaseRouter,
  authenticationUseCaseRouter,
  passwordUseCaseRouter,
  phoneUseCaseRouter,
  mfaUseCaseRouter,
  oauthUseCaseRouter,
  emailUseCaseRouter
};
