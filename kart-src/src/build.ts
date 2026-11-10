// Kennung dieses Builds, von Vite beim Bauen eingesetzt (siehe vite.config.ts).

declare const __BUILD__: string | undefined;

export const BUILD_ID: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev';
