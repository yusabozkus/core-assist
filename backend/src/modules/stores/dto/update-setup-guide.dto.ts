import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const SETUP_GUIDE_ACTIONS = [
  'VISIT_AI',
  'VISIT_CHANNELS',
  'VISIT_TEAM',
  'CONTINUE_OPTIONAL',
  'SKIP_FAQ',
  'FINISH',
  'IMPORT_LEGACY',
] as const;

export type SetupGuideAction = (typeof SETUP_GUIDE_ACTIONS)[number];

export class UpdateSetupGuideDto {
  @IsIn(SETUP_GUIDE_ACTIONS)
  action!: SetupGuideAction;

  @IsOptional()
  @IsIn(['essential', 'optional', 'done'])
  phase?: 'essential' | 'optional' | 'done';

  @IsOptional()
  @IsBoolean()
  aiSettingsVisited?: boolean;

  @IsOptional()
  @IsBoolean()
  skippedFaq?: boolean;
}
