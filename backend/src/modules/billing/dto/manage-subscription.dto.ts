import { IsIn, IsISO8601, Matches } from 'class-validator';

export type SubscriptionManagementAction = 'cancel' | 'reverse_cancellation';

export class ManageSubscriptionDto {
  @IsIn(['cancel', 'reverse_cancellation'])
  action: SubscriptionManagementAction;

  @Matches(/^sub_[a-z0-9]{26}$/)
  subscriptionId: string;

  @IsISO8601({ strict: true })
  updatedAt: string;
}
