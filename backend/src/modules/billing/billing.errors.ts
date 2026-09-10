import { HttpException, HttpStatus } from '@nestjs/common';

export class BillingAccessRequiredException extends HttpException {
  constructor(
    message = 'Deneme süreniz veya aboneliğiniz aktif değil. Devam etmek için bir plan seçin.',
  ) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'BILLING_ACCESS_REQUIRED',
        message,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

export class BillingQuotaExceededException extends HttpException {
  constructor(limit: number) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'AI_QUESTION_QUOTA_EXCEEDED',
        message:
          'Bu dönem için AI soru hakkınız doldu. Manuel yanıtlamaya devam edebilir veya planınızı yükseltebilirsiniz.',
        limit,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

export class BillingPlanLimitException extends HttpException {
  constructor(
    resource: 'stores' | 'members' | 'activeProducts',
    limit: number,
  ) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'BILLING_PLAN_LIMIT_REACHED',
        message: 'Planınızın kapasite sınırına ulaştınız.',
        resource,
        limit,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
