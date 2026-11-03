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
import { ORGANISATION_PERMISSIONS } from '../authorization/domain/permission-catalogue';
import { OrganisationStructureService } from './application/organisation-structure.service';
import {
  CreateDepartmentDto,
  DepartmentResponseDto,
  ListDepartmentsQueryDto,
  UpdateDepartmentDto,
  toDepartmentResponse,
} from './dto/organisation-structure.dto';

@ApiTags('Organisation / Departments')
@ApiBearerAuth('access-token')
@Controller('organisation/departments')
export class DepartmentsController {
  constructor(private readonly structureService: OrganisationStructureService) {}

  @Post()
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({
    summary: 'Create a department',
    description: 'Department must belong to a business unit in the caller organisation.',
  })
  @ApiWrappedOkResponse(DepartmentResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateDepartmentDto,
  ) {
    return toDepartmentResponse(
      await this.structureService.createDepartment(this.requireUser(user), body),
    );
  }

  @Get()
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_READ)
  @ApiOperation({ summary: 'List departments' })
  @ApiWrappedOkResponse(DepartmentResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListDepartmentsQueryDto,
  ) {
    const result = await this.structureService.listDepartments(
      this.requireUser(user),
      query,
    );
    return createPaginatedResult(
      result.data.map(toDepartmentResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':id')
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_READ)
  @ApiOperation({ summary: 'Get a department' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(DepartmentResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toDepartmentResponse(
      await this.structureService.getDepartment(this.requireUser(user), id),
    );
  }

  @Patch(':id')
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({ summary: 'Update a department' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(DepartmentResponseDto)
  @ApiStandardErrors()
  async update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDepartmentDto,
  ) {
    return toDepartmentResponse(
      await this.structureService.updateDepartment(
        this.requireUser(user),
        id,
        body,
      ),
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({
    summary: 'Delete a department',
    description: 'Fails if teams, positions, or employees still reference it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(DepartmentResponseDto)
  @ApiStandardErrors()
  async remove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toDepartmentResponse(
      await this.structureService.deleteDepartment(this.requireUser(user), id),
    );
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
