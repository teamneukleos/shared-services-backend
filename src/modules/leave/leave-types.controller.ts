import {
  Body,
  Controller,
  Get,
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
import { LeaveService } from './application/leave.service';
import { LEAVE_PERMISSIONS } from './domain/leave-permissions';
import {
  CreateLeaveTypeDto,
  LeaveTypeResponseDto,
  ListLeaveTypesQueryDto,
  toLeaveTypeResponse,
  UpdateLeaveTypeDto,
} from './dto/leave-type.dto';

@ApiTags('HR / Leave Types')
@ApiBearerAuth('access-token')
@Controller('hr/leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @Permissions(LEAVE_PERMISSIONS.TYPE_CREATE)
  @ApiOperation({ summary: 'Create an organisation leave type' })
  @ApiWrappedOkResponse(LeaveTypeResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateLeaveTypeDto,
  ) {
    return toLeaveTypeResponse(
      await this.leaveService.createLeaveType(this.requireUser(user), body),
    );
  }

  @Get()
  @Permissions(LEAVE_PERMISSIONS.TYPE_READ)
  @ApiOperation({ summary: 'List leave types' })
  @ApiWrappedOkResponse(LeaveTypeResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListLeaveTypesQueryDto,
  ) {
    const result = await this.leaveService.listLeaveTypes(
      this.requireUser(user),
      query,
    );
    return createPaginatedResult(
      result.data.map(toLeaveTypeResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':id')
  @Permissions(LEAVE_PERMISSIONS.TYPE_READ)
  @ApiOperation({ summary: 'Get a leave type' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(LeaveTypeResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toLeaveTypeResponse(
      await this.leaveService.getLeaveType(this.requireUser(user), id),
    );
  }

  @Patch(':id')
  @Permissions(LEAVE_PERMISSIONS.TYPE_UPDATE)
  @ApiOperation({ summary: 'Update a leave type' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(LeaveTypeResponseDto)
  @ApiStandardErrors()
  async update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateLeaveTypeDto,
  ) {
    return toLeaveTypeResponse(
      await this.leaveService.updateLeaveType(this.requireUser(user), id, body),
    );
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
