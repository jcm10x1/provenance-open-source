import { Request } from 'express';
import { REVIEWER_SESSION_TOKEN, REVIEWER_USER_ID } from '../constants';
import { HttpError } from '../types/http_errors';

// Rate limiting configuration
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT = 10; // requests
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// Configuration interface
export interface AuthConfig {
  appId: string;
  reviewerToken?: string;
  reviewerUserId?: string;
  ownerField?: string;
}

/**
 * Retrieves authentication configuration from environment variables with defaults
 * @returns AuthConfig object
 */
export const getAuthConfig = (): AuthConfig => ({
  appId: process.env.FOUNDATION_APP_ID || 'default-app-id',
  reviewerToken: process.env.REVIEWER_SESSION_TOKEN || REVIEWER_SESSION_TOKEN,
  reviewerUserId: process.env.REVIEWER_USER_ID || REVIEWER_USER_ID,
  ownerField: process.env.OWNER_FIELD || 'owner_id', // Updated to snake_case
});

/**
 * Checks rate limit for a given key (userId or IP)
 * @param key - User ID or undefined (falls back to IP)
 * @param req - Express Request object
 * @throws {HttpError} If rate limit is exceeded
 */
export const checkRateLimit = (key: string | undefined, req: Request) => {
  const now = Date.now();
  const rateKey = key || req.ip || 'anonymous';
  const limitData = rateLimitMap.get(rateKey) || { count: 0, lastReset: now };

  if (now - limitData.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(rateKey, { count: 1, lastReset: now });
    return true;
  }

  if (limitData.count >= RATE_LIMIT) {
    throw new HttpError('Too many requests', 429);
  }

  rateLimitMap.set(rateKey, { count: limitData.count + 1, lastReset: limitData.lastReset });
  return true;
};