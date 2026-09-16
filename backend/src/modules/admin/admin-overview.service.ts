import { Injectable } from '@nestjs/common';
import {
  BillingSubscriptionStatus,
  CatalogSyncStatus,
  SupportTicketStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getHeaderSummary() {
    const [openSupportTickets, paymentIssues, activeSyncs] = await Promise.all([
      this.prisma.supportTicket.count({
        where: {
          status: {
            in: [
              SupportTicketStatus.OPEN,
              SupportTicketStatus.IN_PROGRESS,
              SupportTicketStatus.WAITING_CUSTOMER,
            ],
          },
        },
      }),
      this.prisma.billingSubscription.count({
        where: { status: BillingSubscriptionStatus.PAST_DUE },
      }),
      this.prisma.catalogSyncRun.count({
        where: { status: CatalogSyncStatus.RUNNING },
      }),
    ]);

    return {
      openSupportTickets,
      paymentIssues,
      activeSyncs,
      checkedAt: new Date().toISOString(),
    };
  }
}
