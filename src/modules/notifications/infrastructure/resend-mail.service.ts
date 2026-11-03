import {
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  MailDeliveryResult,
  MailService,
  SendUserInviteEmailInput,
} from '../domain/mail.service';

@Injectable()
export class ResendMailService implements MailService {
  private readonly logger = new Logger(ResendMailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.resendApiKey');
    this.from = this.configService.getOrThrow<string>('email.from');
    this.client = apiKey ? new Resend(apiKey) : null;

    if (!this.client) {
      this.logger.warn(
        'RESEND_API_KEY is not set; invite emails will be skipped until configured.',
      );
    }
  }

  async sendUserInviteEmail(
    input: SendUserInviteEmailInput,
  ): Promise<MailDeliveryResult> {
    if (!this.client) {
      return {
        status: 'skipped',
        reason: 'RESEND_API_KEY is not configured',
      };
    }

    const to = input.to.trim().toLowerCase();
    const signInUrl = input.signInUrl.trim();
    const invitedBy = input.invitedByEmail?.trim();

    const text = [
      'You have been invited to Neukleos People.',
      '',
      'Sign in with your Google Workspace account using this email address:',
      to,
      '',
      `Open: ${signInUrl}`,
      '',
      invitedBy ? `Invited by: ${invitedBy}` : undefined,
      '',
      'If you were not expecting this, you can ignore this email.',
    ]
      .filter((line) => line !== undefined)
      .join('\n');

    const html = `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #171717;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">You're invited to Neukleos People</h1>
        <p style="margin: 0 0 12px;">
          Sign in with your Google Workspace account
          (<strong>${escapeHtml(to)}</strong>).
        </p>
        <p style="margin: 0 0 20px;">
          <a href="${escapeHtml(signInUrl)}"
             style="display: inline-block; background: #FDC517; color: #171717; text-decoration: none; font-weight: 600; padding: 10px 16px; border-radius: 10px;">
            Sign in to People
          </a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #555;">
          Or open this link: <a href="${escapeHtml(signInUrl)}">${escapeHtml(signInUrl)}</a>
        </p>
        ${
          invitedBy
            ? `<p style="margin: 0; font-size: 13px; color: #555;">Invited by ${escapeHtml(invitedBy)}</p>`
            : ''
        }
      </div>
    `.trim();

    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: [to],
      subject: "You're invited to Neukleos People",
      text,
      html,
      tags: [{ name: 'category', value: 'user_invite' }],
    });

    if (error) {
      this.logger.error(`Resend invite email failed for ${to}: ${error.message}`);
      throw new BadGatewayException(
        'Invite email could not be sent. Check Resend configuration and try again.',
      );
    }

    if (!data?.id) {
      throw new BadGatewayException(
        'Invite email could not be sent. Resend returned no message id.',
      );
    }

    this.logger.log(`Invite email sent to ${to} (${data.id})`);
    return { status: 'sent', id: data.id };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
