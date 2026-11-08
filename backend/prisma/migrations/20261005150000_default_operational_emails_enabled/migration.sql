-- Only change the default for new settings; preserve every existing opt-out.
ALTER TABLE "notification_delivery_setting"
  ALTER COLUMN "emailEnabled" SET DEFAULT true;
