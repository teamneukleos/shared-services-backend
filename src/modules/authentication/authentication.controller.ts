import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardErrors,
  ApiWrappedOkResponse,
} from '../../common/swagger/api-wrapped-response.decorator';
import { Public } from '../authorization/decorators/public.decorator';
import { AuthenticatedUser } from '../authorization/domain/authenticated-user.interface';
import { AuthenticationService } from './application/authentication.service';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  AuthSessionResponseDto,
  CurrentUserResponseDto,
  LogoutResponseDto,
} from './dto/auth-session-response.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Authentication')
@Controller('authentication')
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Public()
  @Post('google')
  @ApiOperation({
    summary: 'Sign in with a Google Workspace ID token',
    description:
      'Verifies the Google ID token, resolves the ERP user account, and returns access + refresh tokens. Does not create users.',
  })
  @ApiWrappedOkResponse(AuthSessionResponseDto, { status: 201 })
  @ApiStandardErrors()
  loginWithGoogle(@Body() body: GoogleLoginDto) {
    return this.authenticationService.loginWithGoogle(body.idToken);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  @ApiWrappedOkResponse(AuthSessionResponseDto)
  @ApiStandardErrors()
  refresh(@Body() body: RefreshTokenDto) {
    return this.authenticationService.refreshSession(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke the refresh-token family for the presented token',
  })
  @ApiOkResponse({
    description:
      'Returns a minimal success payload (not fully envelope-wrapped).',
    type: LogoutResponseDto,
  })
  @ApiStandardErrors()
  logout(@Body() body: RefreshTokenDto) {
    return this.authenticationService.logout(body.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Return the authenticated principal' })
  @ApiWrappedOkResponse(CurrentUserResponseDto)
  @ApiStandardErrors()
  me(@CurrentUser() user?: AuthenticatedUser) {
    if (!user) {
      throw new UnauthorizedException('Authentication is required');
    }

    return {
      id: user.id,
      organisationId: user.organisationId,
      email: user.email,
      employeeId: user.employeeId,
      permissions: user.permissions,
    };
  }
}
