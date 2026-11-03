import { Module } from '@nestjs/common';
import { MAIL_SERVICE } from './domain/mail.service';
import { ResendMailService } from './infrastructure/resend-mail.service';

@Module({
  providers: [
    ResendMailService,
    {
      provide: MAIL_SERVICE,
      useExisting: ResendMailService,
    },
  ],
  exports: [MAIL_SERVICE],
})
export class NotificationsModule {}
