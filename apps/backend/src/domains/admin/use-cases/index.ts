import { usersAdminUseCaseRouter } from './users-admin.use-case';
import { securityAdminUseCaseRouter } from './security-admin.use-case';
import { exportsAdminUseCaseRouter } from './exports-admin.use-case';
import { billingAdminUseCaseRouter } from './billing-admin.use-case';
import { auditAdminUseCaseRouter } from './audit-admin.use-case';
import { settingsAdminUseCaseRouter } from './settings-admin.use-case';

export type AdminUseCases = {
  usersAdminUseCaseRouter: typeof usersAdminUseCaseRouter;
  securityAdminUseCaseRouter: typeof securityAdminUseCaseRouter;
  exportsAdminUseCaseRouter: typeof exportsAdminUseCaseRouter;
  billingAdminUseCaseRouter: typeof billingAdminUseCaseRouter;
  auditAdminUseCaseRouter: typeof auditAdminUseCaseRouter;
  settingsAdminUseCaseRouter: typeof settingsAdminUseCaseRouter;
};

export const adminUseCases: AdminUseCases = {
  usersAdminUseCaseRouter,
  securityAdminUseCaseRouter,
  exportsAdminUseCaseRouter,
  billingAdminUseCaseRouter,
  auditAdminUseCaseRouter,
  settingsAdminUseCaseRouter
};

export {
  usersAdminUseCaseRouter,
  securityAdminUseCaseRouter,
  exportsAdminUseCaseRouter,
  billingAdminUseCaseRouter,
  auditAdminUseCaseRouter,
  settingsAdminUseCaseRouter
};
