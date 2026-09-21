import { Prisma } from '../../generated/prisma/client';
import { BillingCheckoutStatus } from '../../generated/prisma/enums';
import { paddleCheckoutEnvironment } from './paddle-billing.config';

export function billingReconciliationTargetWhere(): Prisma.BillingSubscriptionWhereInput {
  return {
    OR: [
      { paddleSubscriptionId: { not: null } },
      {
        workspace: {
          billingCheckouts: {
            some: {
              environment: paddleCheckoutEnvironment(),
              status: BillingCheckoutStatus.OPEN,
              paddleTransactionId: { not: null },
              boundAt: null,
            },
          },
        },
      },
    ],
  };
}

export function billingReconciliationCandidateWhere(
  reconcileBefore: Date,
): Prisma.BillingSubscriptionWhereInput {
  return {
    AND: [
      billingReconciliationTargetWhere(),
      { reconcileAfter: { lte: reconcileBefore } },
    ],
  };
}
