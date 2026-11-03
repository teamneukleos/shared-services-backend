import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacService } from './application/rbac.service';
import { UsersService } from './application/users.service';
import { PrismaRbacRepository } from './infrastructure/prisma-rbac.repository';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { PermissionsController } from './permissions.controller';
import { RolesController } from './roles.controller';
import { UserRolesController } from './user-roles.controller';
import { UsersController } from './users.controller';

@Module({
  imports: [AuditModule, AuthorizationModule, NotificationsModule],
  controllers: [
    PermissionsController,
    RolesController,
    UsersController,
    UserRolesController,
  ],
  providers: [
    RbacService,
    PrismaRbacRepository,
    UsersService,
    PrismaUsersRepository,
  ],
  exports: [RbacService, UsersService],
})
export class IdentityModule {}
