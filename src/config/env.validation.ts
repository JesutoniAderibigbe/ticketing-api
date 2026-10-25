import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  STAGE: Joi.string().required(),
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  JWT_SECRET: Joi.string().optional(),
  JWT_EXPIRES_IN: Joi.number().default(3600),
  PAYSTACK_SECRET_KEY: Joi.string().required(),
  RESEND_API_KEY: Joi.string().required(),
  MAIL_FROM_ADDRESS: Joi.string().required(),
});
