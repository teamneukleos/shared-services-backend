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
} from '../../../common/swagger/api-wrapped-response.decorator';
import { createPaginatedResult } from '../../../common/utils/pagination.util';
import { CurrentUser } from '../../authentication/decorators/current-user.decorator';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../authorization/domain/authenticated-user.interface';
import { OnboardingService } from './application/onboarding.service';
import { ONBOARDING_PERMISSIONS } from './domain/onboarding-permissions';
import { ChangeOnboardingStatusDto } from './dto/change-onboarding-status.dto';
import { ChangeOnboardingTaskStatusDto } from './dto/change-onboarding-task-status.dto';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { CreateOnboardingTaskDto } from './dto/create-onboarding-task.dto';
import { ListOnboardingQueryDto } from './dto/list-onboarding-query.dto';
import {
  OnboardingResponseDto,
  OnboardingTaskResponseDto,
  toOnboardingResponse,
  toOnboardingTaskResponse,
} from './dto/onboarding-response.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { UpdateOnboardingTaskDto } from './dto/update-onboarding-task.dto';

@ApiTags('HR / Onboarding')
@ApiBearerAuth('access-token')
@Controller('hr/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post()
  @Permissions(ONBOARDING_PERMISSIONS.CREATE)
  @ApiOperation({
    summary: 'Create an onboarding record for an existing employee',
    description:
      'Does not create a UserAccount. Rejects if the employee already has an active (NOT_STARTED or IN_PROGRESS) plan.',
  })
  @ApiWrappedOkResponse(OnboardingResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateOnboardingDto,
  ): Promise<OnboardingResponseDto> {
    const actor = this.requireUser(user);
    const record = await this.onboardingService.create(actor, body);
    return toOnboardingResponse(record);
  }

  @Get()
  @Permissions(ONBOARDING_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List onboarding records with filters' })
  @ApiWrappedOkResponse(OnboardingResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListOnboardingQueryDto,
  ) {
    const actor = this.requireUser(user);
    const result = await this.onboardingService.list(actor, query);
    return createPaginatedResult(
      result.data.map(toOnboardingResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':id')
  @Permissions(ONBOARDING_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get onboarding details including tasks' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(OnboardingResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OnboardingResponseDto> {
    const actor = this.requireUser(user);
    const record = await this.onboardingService.findOne(actor, id);
    return toOnboardingResponse(record);
  }

  @Patch(':id')
  @Permissions(ONBOARDING_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update permitted onboarding fields' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(OnboardingResponseDto)
  @ApiStandardErrors()
  async update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOnboardingDto,
  ): Promise<OnboardingResponseDto> {
    const actor = this.requireUser(user);
    const record = await this.onboardingService.update(actor, id, body);
    return toOnboardingResponse(record);
  }

  @Post(':id/tasks')
  @Permissions(ONBOARDING_PERMISSIONS.TASK_MANAGE)
  @ApiOperation({ summary: 'Add a task to an onboarding plan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(OnboardingTaskResponseDto, { status: 201 })
  @ApiStandardErrors()
  async addTask(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateOnboardingTaskDto,
  ): Promise<OnboardingTaskResponseDto> {
    const actor = this.requireUser(user);
    const task = await this.onboardingService.addTask(actor, id, body);
    return toOnboardingTaskResponse(task);
  }

  @Patch(':id/tasks/:taskId')
  @Permissions(ONBOARDING_PERMISSIONS.TASK_MANAGE)
  @ApiOperation({ summary: 'Update an onboarding task' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'taskId', format: 'uuid' })
  @ApiWrappedOkResponse(OnboardingTaskResponseDto)
  @ApiStandardErrors()
  async updateTask(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: UpdateOnboardingTaskDto,
  ): Promise<OnboardingTaskResponseDto> {
    const actor = this.requireUser(user);
    const task = await this.onboardingService.updateTask(
      actor,
      id,
      taskId,
      body,
    );
    return toOnboardingTaskResponse(task);
  }

  @Patch(':id/tasks/:taskId/status')
  @Permissions(ONBOARDING_PERMISSIONS.TASK_MANAGE)
  @ApiOperation({
    summary: 'Transition an onboarding task status',
    description:
      'Required tasks cannot be SKIPPED. Completing a task records completedAt and completedByUserId.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'taskId', format: 'uuid' })
  @ApiWrappedOkResponse(OnboardingTaskResponseDto)
  @ApiStandardErrors()
  async changeTaskStatus(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() body: ChangeOnboardingTaskStatusDto,
  ): Promise<OnboardingTaskResponseDto> {
    const actor = this.requireUser(user);
    const task = await this.onboardingService.changeTaskStatus(
      actor,
      id,
      taskId,
      body,
    );
    return toOnboardingTaskResponse(task);
  }

  @Patch(':id/status')
  @Permissions(ONBOARDING_PERMISSIONS.STATUS_CHANGE)
  @ApiOperation({
    summary: 'Transition onboarding status',
    description:
      'COMPLETED is blocked while any required task is not COMPLETED. SKIPPED does not satisfy required tasks.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(OnboardingResponseDto)
  @ApiStandardErrors()
  async changeStatus(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeOnboardingStatusDto,
  ): Promise<OnboardingResponseDto> {
    const actor = this.requireUser(user);
    const record = await this.onboardingService.changeStatus(actor, id, body);
    return toOnboardingResponse(record);
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
