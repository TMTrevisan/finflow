// Allowed browser origins for CORS.
//
// In production the deployed Vercel frontend is the only browser client, so it
// is allow-listed by default. Set TRUSTED_ORIGINS (comma-separated) to override
// the list entirely — e.g. to add preview deployments or another frontend.
// Local development keeps the Vite dev-server defaults.
const PRODUCTION_BROWSER_ORIGINS = ['https://finflow-mu-nine.vercel.app'];
const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

export function resolveAllowedOrigins(env = process.env) {
  if (env.TRUSTED_ORIGINS !== undefined) {
    return env.TRUSTED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  }
  return env.NODE_ENV === 'production'
    ? [...PRODUCTION_BROWSER_ORIGINS]
    : [...LOCAL_DEV_ORIGINS];
}
