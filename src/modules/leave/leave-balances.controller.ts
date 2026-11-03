import {
  Body,
  Controller,
  Get,
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
import { LeaveService } from './application/leave.service';
import { LEAVE_PERMISSIONS } from './domain/leave-permissions';
import {
  CreateLeaveBalanceDto,
  LeaveBalanceResponseDto,
  ListLeaveBalancesQueryDto,
  toLeaveBalanceResponse,
} from './dto/leave-balance.dto';

@ApiTags('HR / Leave Balances')
@ApiBearerAuth('access-token')
@Controller('hr/leave-balances')
export class LeaveBalancesController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @Permissions(LEAVE_PERMISSIONS.BALANCE_CREATE)
  @ApiOperation({
    summary: 'Initialise a leave balance',
    description:
      'Creates entitled/available for an employee + leave type. Duplicates are rejected.',
  })
  @ApiWrappedOkResponse(LeaveBalanceResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateLeaveBalanceDto,
  ) {
    return toLeaveBalanceResponse(
      await this.leaveService.createLeaveBalance(this.requireUser(user), body),
    );
  }

  @Get()
  @Permissions(LEAVE_PERMISSIONS.BALANCE_READ)
  @ApiOperation({ summary: 'List leave balances' })
  @ApiWrappedOkResponse(LeaveBalanceResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListLeaveBalancesQueryDto,
  ) {
    const result = await this.leaveService.listLeaveBalances(
      this.requireUser(user),
      query,
    );
    return createPaginatedResult(
      result.data.map(toLeaveBalanceResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':id')
  @Permissions(LEAVE_PERMISSIONS.BALANCE_READ)
  @ApiOperation({ summary: 'Get a leave balance' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(LeaveBalanceResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toLeaveBalanceResponse(
      await this.leaveService.getLeaveBalance(this.requireUser(user), id),
    );
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
