const { AppError } = require('../utils/AppError');

/**
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schemas
 */
function validate(schemas = {}) {
  return (req, _res, next) => {
    const details = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        details.push(...formatZodIssues(result.error, 'body'));
      } else {
        req.body = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        details.push(...formatZodIssues(result.error, 'query'));
      } else {
        req.query = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        details.push(...formatZodIssues(result.error, 'params'));
      } else {
        req.params = result.data;
      }
    }

    if (details.length > 0) {
      return next(
        new AppError('Validation failed', 400, 'VALIDATION_ERROR', details),
      );
    }

    return next();
  };
}

function formatZodIssues(error, source) {
  return error.issues.map((issue) => ({
    field: [source, ...issue.path].join('.'),
    message: issue.message,
  }));
}

module.exports = { validate };
