import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { RequestContextMiddleware } from './common/request-context/request-context.middleware';
import { RequestContextModule } from './common/request-context/request-context.module';
import { OrganisationModule } from './modules/organisation/organisation.module';
import { IdentityModule } from './modules/identity/identity.module';
import { HrModule } from './modules/hr/hr.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { LeaveModule } from './modules/leave/leave.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AiModule } from './modules/ai/ai.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    AppConfigModule,
    RequestContextModule,
    PrismaModule,
    AuthorizationModule,
    AuthenticationModule,
    HealthModule,
    OrganisationModule,
    IdentityModule,
    HrModule,
    RecruitmentModule,
    LeaveModule,
    PerformanceModule,
    FinanceModule,
    ReconciliationModule,
    WorkflowModule,
    DocumentsModule,
    NotificationsModule,
    AuditModule,
    IntegrationsModule,
    AiModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
