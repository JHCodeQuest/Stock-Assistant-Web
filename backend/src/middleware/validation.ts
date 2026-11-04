import { RequestHandler } from 'express';
import Joi from 'joi';

export const validateBody = (schema: Joi.ObjectSchema): RequestHandler => (req, res, next) => {
  const { error, value } = schema.required().validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    res.status(400).json({
      error: 'Invalid request body',
      fields: error.details.map((detail) => detail.path.join('.')),
    });
    return;
  }
  req.body = value;
  next();
};

const email = Joi.string().trim().email({ tlds: { allow: false } }).max(120).required();
const password = Joi.string().max(72, 'utf8').required();

export const registerBody = Joi.object({
  email,
  password: password.min(8),
  name: Joi.string().trim().max(100).allow(''),
  // Invitation verification remains in the controller and returns 403 when it fails.
  inviteCode: Joi.any(),
});

export const loginBody = Joi.object({ email, password });

const stockCount = Joi.number().integer().min(0).max(32767).strict();
const optionalText = (max: number) => Joi.string().trim().max(max).allow('');

export const inventoryBody = Joi.object({
  name: Joi.string().trim().max(150).required(),
  sku: Joi.string().trim().max(30).required(),
  quantity: stockCount.required(),
  min_stock_level: stockCount,
  unit_price: Joi.number().min(0).max(99999999.99).precision(2).strict(),
  category: optionalText(50),
  location: optionalText(15),
  description: optionalText(500),
  image_url: Joi.alternatives().try(
    Joi.string().uri({ scheme: ['http', 'https'] }).max(255),
    Joi.string().pattern(/^\/uploads\/images\/[A-Za-z0-9._-]+$/).max(255),
  ).allow(''),
});

export const adjustmentBody = Joi.object({
  productId: Joi.number().integer().positive().max(2147483647).required(),
  adjustmentType: Joi.string().valid('add', 'remove', 'set').required(),
  quantity: stockCount.required().when('adjustmentType', {
    is: 'set',
    then: Joi.number().min(0),
    otherwise: Joi.number().min(1),
  }),
  reason: optionalText(200),
});

export const matchImageBody = Joi.object({
  filename: Joi.string().trim().max(255).required(),
});
