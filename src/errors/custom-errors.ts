export class CustomError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends CustomError {
  constructor(message: string = '参数校验失败', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class BadRequestError extends CustomError {
  constructor(message: string = '请求参数错误', code: string = 'BAD_REQUEST', details?: any) {
    super(message, 400, code, details);
  }
}

export class UnauthorizedError extends CustomError {
  constructor(message: string = '未授权', code: string = 'UNAUTHORIZED', details?: any) {
    super(message, 401, code, details);
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string = '无权限访问', code: string = 'FORBIDDEN', details?: any) {
    super(message, 403, code, details);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string = '资源不存在', code: string = 'NOT_FOUND', details?: any) {
    super(message, 404, code, details);
  }
}

export class ConflictError extends CustomError {
  constructor(message: string = '资源已存在', code: string = 'CONFLICT', details?: any) {
    super(message, 409, code, details);
  }
}

export class RateLimitError extends CustomError {
  constructor(message: string = '请求过于频繁，请稍后再试', details?: any) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }
}

export class InternalError extends CustomError {
  constructor(message: string = '服务器内部错误', code: string = 'INTERNAL_SERVER_ERROR', details?: any) {
    super(message, 500, code, details);
  }
}
