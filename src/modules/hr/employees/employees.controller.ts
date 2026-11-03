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
import { EmployeesService } from './application/employees.service';
import { EMPLOYEE_PERMISSIONS } from './domain/employee-permissions';
import { ChangeEmployeeStatusDto } from './dto/change-employee-status.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import {
  EmployeeResponseDto,
  toEmployeeResponse,
} from './dto/employee-response.dto';
import { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@ApiTags('HR / Employees')
@ApiBearerAuth('access-token')
@Controller('hr/employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Permissions(EMPLOYEE_PERMISSIONS.CREATE)
  @ApiOperation({
    summary: 'Create an employee record',
    description:
      'Creates a Person + Employee in the caller organisation. Does not create a UserAccount.',
  })
  @ApiWrappedOkResponse(EmployeeResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const actor = this.requireUser(user);
    const employee = await this.employeesService.create(actor, body);
    return toEmployeeResponse(employee);
  }

  @Get()
  @Permissions(EMPLOYEE_PERMISSIONS.READ)
  @ApiOperation({
    summary: 'List employees',
    description:
      'Paginated list scoped to the caller organisation. Supports search and filters.',
  })
  @ApiWrappedOkResponse(EmployeeResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListEmployeesQueryDto,
  ) {
    const actor = this.requireUser(user);
    const result = await this.employeesService.list(actor, query);
    return createPaginatedResult(
      result.data.map(toEmployeeResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':id')
  @Permissions(EMPLOYEE_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get one employee by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(EmployeeResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponseDto> {
    const actor = this.requireUser(user);
    const employee = await this.employeesService.findOne(actor, id);
    return toEmployeeResponse(employee);
  }

  @Patch(':id')
  @Permissions(EMPLOYEE_PERMISSIONS.UPDATE)
  @ApiOperation({
    summary: 'Update permitted employee fields',
    description:
      'Cannot change employeeNumber or organisation. Status changes use the status endpoint.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(EmployeeResponseDto)
  @ApiStandardErrors()
  async update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const actor = this.requireUser(user);
    const employee = await this.employeesService.update(actor, id, body);
    return toEmployeeResponse(employee);
  }

  @Patch(':id/status')
  @Permissions(EMPLOYEE_PERMISSIONS.STATUS_CHANGE)
  @ApiOperation({
    summary: 'Change employment status',
    description: 'Validated status transitions only. No hard delete.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiWrappedOkResponse(EmployeeResponseDto)
  @ApiStandardErrors()
  async changeStatus(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChangeEmployeeStatusDto,
  ): Promise<EmployeeResponseDto> {
    const actor = this.requireUser(user);
    const employee = await this.employeesService.changeStatus(actor, id, body);
    return toEmployeeResponse(employee);
  }

  private requireUser(user?: AuthenticatedUser): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }
    return user;
  }
}
