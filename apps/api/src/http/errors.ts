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
            : error.message,
      },
    });
  };
}
