import { CookieOptions } from 'express';

export function getCookieOptions(path: string = '/'): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path,
  };

  // Only set domain in production to allow local development on localhost
  if (isProd && process.env.PROOFA_COOKIE_DOMAIN) {
    options.domain = process.env.PROOFA_COOKIE_DOMAIN; // e.g., '.proofa.pro'
  }

  return options;
}
