import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    user?: {
      id: string;
      roles?: string[];
      permissions?: string[];
    };
    onboarding?: {
      userId: string;
      stage: 'phone' | 'mfa';
      viaAccessSession: boolean;
    };
  }
}
