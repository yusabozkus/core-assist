import 'dotenv/config';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../modules/audit/audit-log.service';
import { resolveAnswerDeliveryReview } from '../modules/question-answer/answer-delivery-review';

async function main() {
  const [answerId, resolution, operator, note, confirmation] =
    process.argv.slice(2);
  if (
    !answerId ||
    !['sent', 'not-sent'].includes(resolution) ||
    !operator ||
    !note ||
    confirmation !== '--workers-stopped'
  ) {
    throw new Error(
      'Usage: npm run repair:answer -- <answer-id> <sent|not-sent> <operator> "marketplace evidence" --workers-stopped. Stop ALL backend/answer workers first.',
    );
  }
  const prisma = new PrismaService();
  try {
    await prisma.onModuleInit();
    const result = await resolveAnswerDeliveryReview(
      prisma,
      new AuditLogService(prisma),
      {
        answerId,
        resolution: resolution as 'sent' | 'not-sent',
        operator,
        note,
      },
    );
    console.log(JSON.stringify(result));
  } finally {
    await prisma.onModuleDestroy();
  }
}
void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Review failed.');
  process.exitCode = 1;
});
