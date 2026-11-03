import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardErrors,
  ApiWrappedOkResponse,
} from '../../common/swagger/api-wrapped-response.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { CurrentUser } from '../authentication/decorators/current-user.decorator';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { AuthenticatedUser } from '../authorization/domain/authenticated-user.interface';
import { IDENTITY_PERMISSIONS } from '../authorization/domain/permission-catalogue';
import { RbacService } from './application/rbac.service';
import {
  AssignRoleDto,
  ListUserRolesQueryDto,
  RoleAssignmentResponseDto,
  toRoleAssignmentResponse,
} from './dto/rbac.dto';

@ApiTags('Identity / User Roles')
@ApiBearerAuth('access-token')
@Controller('identity/users/:userId/roles')
export class UserRolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Get()
  @Permissions(IDENTITY_PERMISSIONS.ROLE_READ)
  @ApiOperation({
    summary: 'List roles assigned to a user',
    description: 'Defaults to active assignments only.',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiWrappedOkResponse(RoleAssignmentResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ListUserRolesQueryDto,
  ) {
    const result = await this.rbacService.listUserRoles(
      this.requireUser(user),
      userId,
      query,
    );
    return createPaginatedResult(
      result.data.map(toRoleAssignmentResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Post()
  @Permissions(IDENTITY_PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({
    summary: 'Assign a role to a user',
    description: 'User and role must belong to the caller organisation.',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiWrappedOkResponse(RoleAssignmentResponseDto, { status: 201 })
  @ApiStandardErrors()
  async assign(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: AssignRoleDto,
  ) {
    return toRoleAssignmentResponse(
      await this.rbacService.assignRoleToUser(
        this.requireUser(user),
        userId,
        body,
      ),
    );
  }

  @Delete(':roleId')
  @HttpCode(200)
  @Permissions(IDENTITY_PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({
    summary: 'Remove a role from a user',
    description:
      'Ends the active assignment (sets endsAt). Historical rows are retained.',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiParam({ name: 'roleId', format: 'uuid' })
  @ApiWrappedOkResponse(RoleAssignmentResponseDto)
  @ApiStandardErrors()
  async remove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return toRoleAssignmentResponse(
      await this.rbacService.removeRoleFromUser(
        this.requireUser(user),
        userId,
        roleId,
      ),
    );
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
