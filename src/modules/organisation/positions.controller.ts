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
  CreatePositionDto,
  ListPositionsQueryDto,
  PositionResponseDto,
  UpdatePositionDto,
  toPositionResponse,
} from './dto/organisation-structure.dto';

@ApiTags('Organisation / Positions')
@ApiBearerAuth('access-token')
@Controller('organisation/positions')
export class PositionsController {
  constructor(private readonly structureService: OrganisationStructureService) {}

  @Post()
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({
    summary: 'Create a position',
    description:
      'Position must belong to a department in the caller organisation.',
  })
  @ApiWrappedOkResponse(PositionResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreatePositionDto,
  ) {
    return toPositionResponse(
      await this.structureService.createPosition(this.requireUser(user), body),
    );
  }

  @Get()
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_READ)
  @ApiOperation({ summary: 'List positions' })
  @ApiWrappedOkResponse(PositionResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListPositionsQueryDto,
  ) {
    const result = await this.structureService.listPositions(
      this.requireUser(user),
      query,
    );
    return createPaginatedResult(
      result.data.map(toPositionResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':id')
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_READ)
  @ApiOperation({ summary: 'Get a position' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(PositionResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toPositionResponse(
      await this.structureService.getPosition(this.requireUser(user), id),
    );
  }

  @Patch(':id')
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({ summary: 'Update a position' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(PositionResponseDto)
  @ApiStandardErrors()
  async update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePositionDto,
  ) {
    return toPositionResponse(
      await this.structureService.updatePosition(
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
    summary: 'Delete a position',
    description: 'Fails if employees or requisitions still reference it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(PositionResponseDto)
  @ApiStandardErrors()
  async remove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toPositionResponse(
      await this.structureService.deletePosition(this.requireUser(user), id),
    );
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
