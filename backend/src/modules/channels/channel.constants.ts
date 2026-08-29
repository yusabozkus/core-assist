import { ChannelProvider, ChannelType } from '../../generated/prisma/enums';

export const CHANNEL_TYPE_BY_PROVIDER: Record<ChannelProvider, ChannelType> = {
  [ChannelProvider.TRENDYOL]: ChannelType.COMMERCE,
  [ChannelProvider.HEPSIBURADA]: ChannelType.COMMERCE,
  [ChannelProvider.INSTAGRAM]: ChannelType.SOCIAL,
  [ChannelProvider.WHATSAPP]: ChannelType.MESSAGING,
  [ChannelProvider.WOOCOMMERCE]: ChannelType.COMMERCE,
};

export const channelConnectionSelect = {
  id: true,
  provider: true,
  type: true,
  status: true,
  connectedAt: true,
  lastSyncAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
