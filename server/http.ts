import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';

export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = req.header('x-request-id')?.trim() || randomUUID();
  const startedAt = Date.now();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    if (req.path.startsWith('/api/')) {
      console.info(JSON.stringify({
        type: 'http_request',
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt
      }));
    }
  });
  next();
};

export const apiNotFound: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    requestId: res.locals.requestId
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const isMalformedJson = error instanceof SyntaxError && 'body' in error;
  const status = isMalformedJson ? 400 : Number(error?.status || error?.statusCode) || 500;
  console.error(JSON.stringify({
    type: 'http_error',
    requestId: res.locals.requestId,
    status,
    message: error?.message || 'Unknown server error'
  }));
  res.status(status).json({
    success: false,
    error: isMalformedJson ? '请求 JSON 格式无效' : (status >= 500 ? '服务器内部错误' : error.message),
    requestId: res.locals.requestId
  });
};
