import { z } from 'zod';
import { resumeDataSchema } from '../../resumes/schemas/resume.schema';

export const aiResumeImportSchema = z
  .object({
    text: z.string().trim().min(1).max(25000),
    locale: z.enum(['fr', 'en']).default('fr')
  })
  .strict();

export const aiResumePolishSchema = z
  .object({
    resume_id: z.string().optional(),
    content: z.string().trim().min(1).max(12000),
    section: z.string().trim().max(80).default('general'),
    custom_instructions: z.string().trim().max(1000).optional()
  })
  .strict();

export const aiResumeGrammarSchema = z
  .object({
    resume_id: z.string().optional(),
    content: z.string().trim().min(1).max(12000),
    locale: z.enum(['fr', 'en']).default('fr')
  })
  .strict();

export const aiResumeImportOutputSchema = resumeDataSchema;

export const aiGrammarOutputSchema = z
  .object({
    errors: z
      .array(
        z
          .object({
            context: z.string().max(500),
            text: z.string().max(160),
            suggestion: z.string().max(160),
            reason: z.string().max(200),
            type: z.enum(['spelling', 'punctuation', 'grammar']).default('grammar')
          })
          .strict()
      )
      .max(50)
  })
  .strict();
