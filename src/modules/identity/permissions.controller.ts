import {
  Controller,
  Get,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardErrors,
  ApiWrappedOkResponse,
} from '../../common/swagger/api-wrapped-response.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';
import { PermissionSyncService } from '../authorization/application/permission-sync.service';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { AuthenticatedUser } from '../authorization/domain/authenticated-user.interface';
import { IDENTITY_PERMISSIONS } from '../authorization/domain/permission-catalogue';
import {
  ListPermissionsQueryDto,
  PermissionResponseDto,
  PermissionSyncResponseDto,
  toPermissionResponse,
} from './dto/rbac.dto';

@ApiTags('Identity / Permissions')
@ApiBearerAuth('access-token')
@Controller('identity/permissions')
export class PermissionsController {
  constructor(private readonly permissionSyncService: PermissionSyncService) {}

  @Get()
  @Permissions(IDENTITY_PERMISSIONS.ROLE_READ)
  @ApiOperation({
    summary: 'List permission catalogue',
    description:
      'Paginated permissions stored in the database. Sync from code constants first if empty.',
  })
  @ApiWrappedOkResponse(PermissionResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListPermissionsQueryDto,
  ) {
    this.requireUser(user);
    const result = await this.permissionSyncService.list(query);
    return createPaginatedResult(
      result.data.map(toPermissionResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Post('sync')
  @Permissions(IDENTITY_PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({
    summary: 'Sync permission catalogue from code',
    description:
      'Upserts all entries from permission-catalogue.data.json into the Permission table. Does not delete orphan rows.',
  })
  @ApiWrappedOkResponse(PermissionSyncResponseDto)
  @ApiStandardErrors()
  async sync(@CurrentUser() user: AuthenticatedUser | undefined) {
    const actor = this.requireUser(user);
    return this.permissionSyncService.syncCatalogue(actor);
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
