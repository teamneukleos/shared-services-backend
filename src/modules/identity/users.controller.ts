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
import { UsersService } from './application/users.service';
import {
  CreateUserDto,
  InviteUserDto,
  LinkGoogleIdentityDto,
  ListUsersQueryDto,
  UpdateUserDto,
  UserAccountResponseDto,
  toUserAccountResponse,
} from './dto/users.dto';

@ApiTags('Identity / Users')
@ApiBearerAuth('access-token')
@Controller('identity/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions(IDENTITY_PERMISSIONS.USER_MANAGE)
  @ApiOperation({
    summary: 'Create a user account',
    description:
      'Creates a UserAccount in the caller organisation. Does not create a Google identity — use invite or the link endpoint.',
  })
  @ApiWrappedOkResponse(UserAccountResponseDto, { status: 201 })
  @ApiStandardErrors()
  async create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateUserDto,
  ) {
    return toUserAccountResponse(
      await this.usersService.create(this.requireUser(user), body),
    );
  }

  @Post('invite')
  @Permissions(IDENTITY_PERMISSIONS.USER_MANAGE)
  @ApiOperation({
    summary: 'Invite / provision a Workspace user',
    description:
      'Creates a UserAccount and links a GOOGLE_WORKSPACE ExternalIdentity in one step. There is no public signup — the user logs in with Google once the subject matches.',
  })
  @ApiWrappedOkResponse(UserAccountResponseDto, { status: 201 })
  @ApiStandardErrors()
  async invite(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: InviteUserDto,
  ) {
    return toUserAccountResponse(
      await this.usersService.invite(this.requireUser(user), body),
    );
  }

  @Get()
  @Permissions(IDENTITY_PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'List user accounts' })
  @ApiWrappedOkResponse(UserAccountResponseDto, {
    isArray: true,
    paginated: true,
  })
  @ApiStandardErrors()
  async list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListUsersQueryDto,
  ) {
    const result = await this.usersService.list(this.requireUser(user), query);
    return createPaginatedResult(
      result.data.map(toUserAccountResponse),
      result.meta.page,
      result.meta.size,
      result.meta.totalItems,
    );
  }

  @Get(':userId')
  @Permissions(IDENTITY_PERMISSIONS.USER_READ)
  @ApiOperation({ summary: 'Get a user account' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiWrappedOkResponse(UserAccountResponseDto)
  @ApiStandardErrors()
  async findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return toUserAccountResponse(
      await this.usersService.findOne(this.requireUser(user), userId),
    );
  }

  @Patch(':userId')
  @Permissions(IDENTITY_PERMISSIONS.USER_MANAGE)
  @ApiOperation({
    summary: 'Update a user account',
    description:
      'Update email, status, and optional employee link. Organisation is never changed.',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiWrappedOkResponse(UserAccountResponseDto)
  @ApiStandardErrors()
  async update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: UpdateUserDto,
  ) {
    return toUserAccountResponse(
      await this.usersService.update(this.requireUser(user), userId, body),
    );
  }

  @Post(':userId/google-identity')
  @Permissions(IDENTITY_PERMISSIONS.USER_MANAGE)
  @ApiOperation({
    summary: 'Link a Google Workspace identity',
    description:
      'Attaches a GOOGLE_WORKSPACE ExternalIdentity (subject + email). Fails if one is already linked.',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiWrappedOkResponse(UserAccountResponseDto, { status: 201 })
  @ApiStandardErrors()
  async linkGoogleIdentity(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: LinkGoogleIdentityDto,
  ) {
    return toUserAccountResponse(
      await this.usersService.linkGoogleIdentity(
        this.requireUser(user),
        userId,
        body,
      ),
    );
  }

  @Delete(':userId/google-identity')
  @HttpCode(200)
  @Permissions(IDENTITY_PERMISSIONS.USER_MANAGE)
  @ApiOperation({
    summary: 'Unlink the Google Workspace identity',
    description:
      'Removes GOOGLE_WORKSPACE ExternalIdentity rows for the user. Login will fail until re-linked.',
  })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiWrappedOkResponse(UserAccountResponseDto)
  @ApiStandardErrors()
  async unlinkGoogleIdentity(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return toUserAccountResponse(
      await this.usersService.unlinkGoogleIdentity(
        this.requireUser(user),
        userId,
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
