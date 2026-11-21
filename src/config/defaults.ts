// The only place the default app name may be written. A guard test fails `npm test`
// if it appears anywhere else under src/.
export const DEFAULT_APP_NAME = "Panna";

// Local development only; production must set NEXT_PUBLIC_SITE_URL.
export const DEFAULT_SITE_URL = "http://localhost:3000";

export const DEFAULT_FEATURE_PAGE_TURN_SOUND = true;

export const DEFAULT_MAX_IMAGE_UPLOAD_MB = 5;
