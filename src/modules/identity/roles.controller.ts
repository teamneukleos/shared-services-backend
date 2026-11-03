import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
  AssignPermissionsDto,
  CreateRoleDto,
  ListRolesQueryDto,
  RoleResponseDto,
  UpdateRoleDto,
  toRoleResponse,
} from './dto/rbac.dto';

@ApiTags('Identity / Roles')
@ApiBearerAuth('access-token')
@Controller('identity/roles')
export class RolesController {
  constructor(private readonly rbacService: RbacService) {}

  @Post()
  @Permissions(IDENTITY_PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({
    summary: 'Create a role',
    description:
      'Creates an organisation-scoped role. Optional permissionCodes are attached when provided.',
  })
  @ApiWrappedOkResponse(RoleResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateRoleDto,
  ) {
    return toRoleResponse(
      await this.rbacService.createRole(this.requireUser(user), body),
    );
  }

  @Get()
  @Permissions(IDENTITY_PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'List roles for the caller organisation' })
  @ApiWrappedOkResponse(RoleResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListRolesQueryDto,
  ) {
    const result = await this.rbacService.listRoles(
      this.requireUser(user),
      query,
    );
    return createPaginatedResult(
      result.data.map(toRoleResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':roleId')
  @Permissions(IDENTITY_PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'Get a role with its permissions' })
  @ApiParam({ name: 'roleId', format: 'uuid' })
  @ApiWrappedOkResponse(RoleResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return toRoleResponse(
      await this.rbacService.getRole(this.requireUser(user), roleId),
    );
  }

  @Patch(':roleId')
  @Permissions(IDENTITY_PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({
    summary: 'Update a role',
    description: 'Updates the display name. Role code is immutable.',
  })
  @ApiParam({ name: 'roleId', format: 'uuid' })
  @ApiWrappedOkResponse(RoleResponseDto)
  @ApiStandardErrors()
  async update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() body: UpdateRoleDto,
  ) {
    return toRoleResponse(
      await this.rbacService.updateRole(this.requireUser(user), roleId, body),
    );
  }

  @Delete(':roleId')
  @HttpCode(200)
  @Permissions(IDENTITY_PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({
    summary: 'Delete a role',
    description:
      'Hard-deletes the role. Cascades role-permission links and assignments.',
  })
  @ApiParam({ name: 'roleId', format: 'uuid' })
  @ApiWrappedOkResponse(RoleResponseDto)
  @ApiStandardErrors()
  async remove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    const actor = this.requireUser(user);
    const existing = await this.rbacService.getRole(actor, roleId);
    await this.rbacService.deleteRole(actor, roleId);
    return toRoleResponse(existing);
  }

  @Post(':roleId/permissions')
  @Permissions(IDENTITY_PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({
    summary: 'Assign permissions to a role',
    description: 'Adds permission codes; existing links are left unchanged.',
  })
  @ApiParam({ name: 'roleId', format: 'uuid' })
  @ApiWrappedOkResponse(RoleResponseDto)
  @ApiStandardErrors()
  async assignPermissions(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() body: AssignPermissionsDto,
  ) {
    return toRoleResponse(
      await this.rbacService.assignPermissions(
        this.requireUser(user),
        roleId,
        body,
      ),
    );
  }

  @Delete(':roleId/permissions/:permissionCode')
  @HttpCode(200)
  @Permissions(IDENTITY_PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({ summary: 'Remove a permission from a role' })
  @ApiParam({ name: 'roleId', format: 'uuid' })
  @ApiParam({ name: 'permissionCode', example: 'employee.read' })
  @ApiWrappedOkResponse(RoleResponseDto)
  @ApiStandardErrors()
  async removePermission(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('permissionCode') permissionCode: string,
  ) {
    return toRoleResponse(
      await this.rbacService.removePermission(
        this.requireUser(user),
        roleId,
        permissionCode,
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
