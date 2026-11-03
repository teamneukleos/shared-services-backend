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
  CreateLeaveApplicationDto,
  LeaveApplicationResponseDto,
  ListLeaveApplicationsQueryDto,
  RejectLeaveApplicationDto,
  toLeaveApplicationResponse,
} from './dto/leave-application.dto';

@ApiTags('HR / Leave Applications')
@ApiBearerAuth('access-token')
@Controller('hr/leave-applications')
export class LeaveApplicationsController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @Permissions(LEAVE_PERMISSIONS.APPLICATION_SUBMIT)
  @ApiOperation({
    summary: 'Submit a leave application for the authenticated employee',
    description:
      'Employee is derived from UserAccount.employeeId. Duration is inclusive calendar days. Reserves balance immediately.',
  })
  @ApiWrappedOkResponse(LeaveApplicationResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateLeaveApplicationDto,
  ) {
    return toLeaveApplicationResponse(
      await this.leaveService.submitApplication(this.requireUser(user), body),
    );
  }

  @Get()
  @Permissions(LEAVE_PERMISSIONS.APPLICATION_READ)
  @ApiOperation({ summary: 'List leave applications' })
  @ApiWrappedOkResponse(LeaveApplicationResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListLeaveApplicationsQueryDto,
  ) {
    const result = await this.leaveService.listApplications(
      this.requireUser(user),
      query,
    );
    return createPaginatedResult(
      result.data.map(toLeaveApplicationResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':id')
  @Permissions(LEAVE_PERMISSIONS.APPLICATION_READ)
  @ApiOperation({ summary: 'Get leave application details' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(LeaveApplicationResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toLeaveApplicationResponse(
      await this.leaveService.getApplication(this.requireUser(user), id),
    );
  }

  @Patch(':id/approve')
  @Permissions(LEAVE_PERMISSIONS.APPLICATION_REVIEW)
  @ApiOperation({
    summary: 'Approve a pending leave application',
    description:
      'Consumes reserved balance into used. Self-approval is rejected.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(LeaveApplicationResponseDto)
  @ApiStandardErrors()
  async approve(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toLeaveApplicationResponse(
      await this.leaveService.approveApplication(this.requireUser(user), id),
    );
  }

  @Patch(':id/reject')
  @Permissions(LEAVE_PERMISSIONS.APPLICATION_REVIEW)
  @ApiOperation({
    summary: 'Reject a pending leave application',
    description:
      'Releases reserved balance back to available. No used increase.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(LeaveApplicationResponseDto)
  @ApiStandardErrors()
  async reject(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectLeaveApplicationDto,
  ) {
    return toLeaveApplicationResponse(
      await this.leaveService.rejectApplication(
        this.requireUser(user),
        id,
        body,
      ),
    );
  }

  @Patch(':id/withdraw')
  @Permissions(LEAVE_PERMISSIONS.APPLICATION_WITHDRAW)
  @ApiOperation({
    summary: 'Withdraw own pending leave application',
    description:
      'Only the linked employee applicant may withdraw. Approved applications cannot be withdrawn in this slice.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(LeaveApplicationResponseDto)
  @ApiStandardErrors()
  async withdraw(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toLeaveApplicationResponse(
      await this.leaveService.withdrawApplication(this.requireUser(user), id),
    );
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
