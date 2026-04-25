import { z } from 'zod';

const htmlText = z.string().max(12000);
const shortText = z.string().trim().min(1).max(160);
const optionalShortText = z.string().trim().max(160).optional();
const urlText = z.string().trim().max(500).optional();

const basicSchema = z
  .object({
    name: z.string().max(160).default(''),
    title: z.string().max(160).default(''),
    email: z.string().max(200).default(''),
    phone: z.string().max(80).default(''),
    location: z.string().max(200).default(''),
    birthDate: z.string().max(40).default(''),
    employementStatus: z.string().max(120).default(''),
    photo: z.string().max(1000).default(''),
    customFields: z.array(z.unknown()).max(20).default([])
  })
  .passthrough();

const educationSchema = z
  .object({
    id: z.string().max(80),
    school: z.string().max(200),
    major: z.string().max(200).default(''),
    degree: z.string().max(120).default(''),
    startDate: z.string().max(40).default(''),
    endDate: z.string().max(40).default(''),
    gpa: z.string().max(80).optional(),
    description: htmlText.optional(),
    visible: z.boolean().optional()
  })
  .strict();

const experienceSchema = z
  .object({
    id: z.string().max(80),
    company: z.string().max(200),
    position: z.string().max(200),
    date: z.string().max(120).default(''),
    details: htmlText.default(''),
    visible: z.boolean().optional()
  })
  .strict();

const projectSchema = z
  .object({
    id: z.string().max(80),
    name: z.string().max(200),
    role: z.string().max(200).default(''),
    date: z.string().max(120).default(''),
    description: htmlText.default(''),
    visible: z.boolean().default(true),
    link: urlText,
    linkLabel: optionalShortText
  })
  .strict();

export const resumeDataSchema = z
  .object({
    title: z.string().max(160).optional(),
    templateId: z.string().max(120).nullable().optional(),
    basic: basicSchema.default({
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      birthDate: '',
      employementStatus: '',
      photo: '',
      customFields: []
    }),
    education: z.array(educationSchema).max(30).default([]),
    experience: z.array(experienceSchema).max(40).default([]),
    projects: z.array(projectSchema).max(40).default([]),
    certificates: z.array(z.unknown()).max(30).default([]),
    customData: z.record(z.string(), z.array(z.unknown()).max(30)).default({}),
    skillContent: htmlText.default(''),
    selfEvaluationContent: htmlText.default(''),
    menuSections: z.array(z.unknown()).max(30).default([]),
    globalSettings: z.record(z.string(), z.unknown()).default({})
  })
  .passthrough();

export const createResumeSchema = z
  .object({
    title: shortText.optional(),
    template_id: z.string().trim().max(120).nullable().optional(),
    locale: z.enum(['fr', 'en']).default('fr'),
    data: resumeDataSchema.optional()
  })
  .strict();

export const patchResumeSchema = z
  .object({
    title: shortText.optional(),
    template_id: z.string().trim().max(120).nullable().optional(),
    data: resumeDataSchema.optional(),
    expected_version: z.number().int().positive()
  })
  .strict();

export const exportRequestSchema = z
  .object({
    format: z.enum(['pdf', 'json', 'markdown', 'zip'])
  })
  .strict();

export const assetUploadSchema = z
  .object({
    kind: z.enum(['photo', 'certificate', 'import_source', 'export', 'other']).default('other'),
    mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/json', 'text/markdown']),
    size_bytes: z.number().int().positive().max(10 * 1024 * 1024),
    checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional()
  })
  .strict();

export const assetConfirmSchema = z
  .object({
    file_id: z.string().uuid(),
    kind: z.enum(['photo', 'certificate', 'import_source', 'export', 'other']).default('other'),
    alt_text: z.string().trim().max(200).optional()
  })
  .strict();

export const importTextSchema = z
  .object({
    text: z.string().trim().min(1).max(25000),
    locale: z.enum(['fr', 'en']).default('fr')
  })
  .strict();

export const importFileSchema = z
  .object({
    file_id: z.string().uuid(),
    locale: z.enum(['fr', 'en']).default('fr')
  })
  .strict();
