import { authRepository } from './auth.repository';

export type AuthService = {
  repository: typeof authRepository;
};

export const authService: AuthService = {
  repository: authRepository
};
