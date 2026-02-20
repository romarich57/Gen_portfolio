import { billingRepository } from './billing.repository';

export type BillingDomainService = {
  repository: typeof billingRepository;
};

export const billingDomainService: BillingDomainService = {
  repository: billingRepository
};
