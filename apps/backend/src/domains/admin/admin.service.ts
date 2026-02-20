import { adminRepository } from './admin.repository';

export type AdminUserService = {
  repository: typeof adminRepository;
};

export type AdminBillingService = {
  repository: typeof adminRepository;
};

export const adminUserService: AdminUserService = {
  repository: adminRepository
};

export const adminBillingService: AdminBillingService = {
  repository: adminRepository
};
