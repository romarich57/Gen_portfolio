import { meRepository } from './me.repository';

export type ProfileService = {
  repository: typeof meRepository;
};

export const profileService: ProfileService = {
  repository: meRepository
};
