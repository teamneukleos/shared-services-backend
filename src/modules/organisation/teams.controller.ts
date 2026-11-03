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
  CreateTeamDto,
  ListTeamsQueryDto,
  TeamResponseDto,
  UpdateTeamDto,
  toTeamResponse,
} from './dto/organisation-structure.dto';

@ApiTags('Organisation / Teams')
@ApiBearerAuth('access-token')
@Controller('organisation/teams')
export class TeamsController {
  constructor(private readonly structureService: OrganisationStructureService) {}

  @Post()
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({
    summary: 'Create a team',
    description: 'Team must belong to a department in the caller organisation.',
  })
  @ApiWrappedOkResponse(TeamResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateTeamDto,
  ) {
    return toTeamResponse(
      await this.structureService.createTeam(this.requireUser(user), body),
    );
  }

  @Get()
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_READ)
  @ApiOperation({ summary: 'List teams' })
  @ApiWrappedOkResponse(TeamResponseDto, { isArray: true, paginated: true })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListTeamsQueryDto,
  ) {
    const result = await this.structureService.listTeams(
      this.requireUser(user),
      query,
    );
    return createPaginatedResult(
      result.data.map(toTeamResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':id')
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_READ)
  @ApiOperation({ summary: 'Get a team' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(TeamResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toTeamResponse(
      await this.structureService.getTeam(this.requireUser(user), id),
    );
  }

  @Patch(':id')
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({ summary: 'Update a team' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(TeamResponseDto)
  @ApiStandardErrors()
  async update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTeamDto,
  ) {
    return toTeamResponse(
      await this.structureService.updateTeam(this.requireUser(user), id, body),
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @Permissions(ORGANISATION_PERMISSIONS.STRUCTURE_MANAGE)
  @ApiOperation({
    summary: 'Delete a team',
    description: 'Fails if employees still reference it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(TeamResponseDto)
  @ApiStandardErrors()
  async remove(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toTeamResponse(
      await this.structureService.deleteTeam(this.requireUser(user), id),
    );
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
