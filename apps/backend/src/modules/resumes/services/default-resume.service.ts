import type { Prisma } from '@prisma/client';

export function defaultResumeData(title: string): Prisma.InputJsonValue {
  return {
    title,
    basic: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      birthDate: '',
      employementStatus: '',
      photo: '',
      customFields: []
    },
    education: [],
    experience: [],
    projects: [],
    certificates: [],
    customData: {},
    skillContent: '',
    selfEvaluationContent: '',
    menuSections: [],
    globalSettings: {}
  };
}
