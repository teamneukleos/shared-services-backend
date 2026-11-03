export type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  database: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  cors: {
    origins: string[];
  };
  google: {
    clientId: string;
    allowedDomains: string[];
  };
  email: {
    resendApiKey?: string;
    from: string;
    appWebUrl: string;
  };
}

function parseCommaSeparatedList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV as NodeEnv,
  port: Number(process.env.PORT),
  database: {
    url: process.env.DATABASE_URL as string,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN as string,
  },
  cors: {
    origins: parseCommaSeparatedList(process.env.CORS_ORIGINS),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    allowedDomains: parseCommaSeparatedList(
      process.env.GOOGLE_ALLOWED_DOMAINS,
    ).map((domain) => domain.toLowerCase()),
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY?.trim() || undefined,
    from: (process.env.EMAIL_FROM as string) || 'Neukleos <onboarding@resend.dev>',
    appWebUrl: (process.env.APP_WEB_URL as string) || 'http://localhost:3001',
  },
});
