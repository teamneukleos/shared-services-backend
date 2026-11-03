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
  BusinessUnitResponseDto,
  CreateBusinessUnitDto,
  ListBusinessUnitsQueryDto,
  UpdateBusinessUnitDto,
  toBusinessUnitResponse,
} from './dto/organisation-structure.dto';

@ApiTags('Organisation / Business Units')
@ApiBearerAuth('access-token')
@Controller('organisation/business-units')
export class BusinessUnitsController {
  constructor(private readonly structureService: OrganisationStructureService) {}

  @Post()
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({ summary: 'Create a business unit' })
  @ApiWrappedOkResponse(BusinessUnitResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateBusinessUnitDto,
  ) {
    return toBusinessUnitResponse(
      await this.structureService.createBusinessUnit(
        this.requireUser(user),
        body,
      ),
    );
  }

  @Get()
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_READ)
  @ApiOperation({ summary: 'List business units' })
  @ApiWrappedOkResponse(BusinessUnitResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListBusinessUnitsQueryDto,
  ) {
    const result = await this.structureService.listBusinessUnits(
      this.requireUser(user),
      query,
    );
    return createPaginatedResult(
      result.data.map(toBusinessUnitResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':id')
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_READ)
  @ApiOperation({ summary: 'Get a business unit' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(BusinessUnitResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toBusinessUnitResponse(
      await this.structureService.getBusinessUnit(this.requireUser(user), id),
    );
  }

  @Patch(':id')
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({ summary: 'Update a business unit' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(BusinessUnitResponseDto)
  @ApiStandardErrors()
  async update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBusinessUnitDto,
  ) {
    return toBusinessUnitResponse(
      await this.structureService.updateBusinessUnit(
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
    summary: 'Delete a business unit',
    description: 'Fails if departments or cost centres still reference it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(BusinessUnitResponseDto)
  @ApiStandardErrors()
  async remove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toBusinessUnitResponse(
      await this.structureService.deleteBusinessUnit(this.requireUser(user), id),
    );
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
