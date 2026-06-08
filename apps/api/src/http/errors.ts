import type { ErrorRequestHandler, RequestHandler } from "express";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function sanitizePublicErrorMessage(message: string): string {
  return message
    .replace(/OPENAI_API_KEY\s*=\s*[^\s,"']+/gi, "OPENAI_API_KEY=[redacted]")
    .replace(/DATABASE_URL\s*=\s*[^\s,"']+/gi, "DATABASE_URL=[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s,"']+/gi, "postgres://[redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[redacted]");
}

export function notFoundHandler(): RequestHandler {
  return (req, _res, next) => {
    next(new ApiError(404, `Route not found: ${req.method} ${req.path}`));
  };
}

export function errorHandler(): ErrorRequestHandler {
  return (error, _req, res, _next) => {
    const statusCode =
      error instanceof ApiError && error.statusCode >= 400
        ? error.statusCode
        : 500;

    if (statusCode >= 500) {
      console.error("Unhandled API error", error);
    }

    res.status(statusCode).json({
      error: {
        message:
          statusCode >= 500
            ? "Something went wrong inside MindBloom API."
            : sanitizePublicErrorMessage(error.message),
      },
    });
  };
}
