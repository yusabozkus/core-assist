import type { NormalizedSizeGuide } from '../channels/providers/catalog-connector';

export type RegisterSizeGuideInput = {
  productId: string;
  externalProductId: string;
  sizeGuide: NormalizedSizeGuide;
};

export type SizeGuideExtractionJobData = {
  sizeGuideId: string;
};

export abstract class SizeGuideDispatcher {
  abstract register(input: RegisterSizeGuideInput): Promise<void>;
}
