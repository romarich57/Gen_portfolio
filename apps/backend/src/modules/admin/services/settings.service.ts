import { prisma } from '../../../db/prisma';
import { adminMeResponse } from '../shared/helpers';

export async function getAdminMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  return adminMeResponse({ id: user.id, email: user.email, roles: user.roles });
}
