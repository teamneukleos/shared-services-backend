import * as Joi from 'joi';

function requireCommaSeparatedValues(
  value: string,
  helpers: Joi.CustomHelpers,
) {
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (items.length === 0) {
    return helpers.error('any.invalid');
  }

  return value;
}

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').required(),
  PORT: Joi.number().port().required(),
  DATABASE_URL: Joi.string().min(1).required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/i)
    .required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/i)
    .required(),
  CORS_ORIGINS: Joi.string()
    .required()
    .custom(requireCommaSeparatedValues, 'comma-separated CORS origins'),
  GOOGLE_CLIENT_ID: Joi.string().min(1).required(),
  GOOGLE_ALLOWED_DOMAINS: Joi.string()
    .required()
    .custom(
      requireCommaSeparatedValues,
      'comma-separated Google Workspace domains',
    ),
  RESEND_API_KEY: Joi.string()
    .min(1)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional().allow(''),
    }),
  EMAIL_FROM: Joi.string()
    .min(3)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional().default('Neukleos <onboarding@resend.dev>'),
    }),
  APP_WEB_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional().default('http://localhost:3001'),
    }),
  ENABLE_SWAGGER: Joi.string().optional().allow(''),
});
