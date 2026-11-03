export const MAIL_SERVICE = Symbol('MAIL_SERVICE');

export type MailDeliveryResult =
  | { status: 'sent'; id: string }
  | { status: 'skipped'; reason: string };

export interface SendUserInviteEmailInput {
  to: string;
  signInUrl: string;
  invitedByEmail?: string;
}

export interface MailService {
  sendUserInviteEmail(
    input: SendUserInviteEmailInput,
  ): Promise<MailDeliveryResult>;
}
