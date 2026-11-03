import { RecordStatus } from '../../../generated/prisma/client';

export type ExternalIdentitySummary = {
  id: string;
  provider: string;
  subject: string;
  email: string | null;
};

export type UserAccountRecord = {
  id: string;
  organisationId: string;
  officialEmail: string;
  status: RecordStatus;
  employeeId: string | null;
  externalIdentities: ExternalIdentitySummary[];
  createdAt: Date;
  updatedAt: Date;
};
