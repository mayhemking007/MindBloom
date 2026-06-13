import type { RequestHandler } from "express";

import { readCookie } from "../cookies.js";
import { ApiError } from "../errors.js";
import { authStore, sessionCookieName } from "../../services/auth.service.js";

export const requireAuth: RequestHandler = (req, _res, next) => {
  void authStore
    .getUserForToken(readCookie(req.get("cookie"), sessionCookieName))
    .then((user) => {
      if (!user) {
        next(new ApiError(401, "Authentication is required"));
        return;
      }

      next();
    })
    .catch(next);
};
