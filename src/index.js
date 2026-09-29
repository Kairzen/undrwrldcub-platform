import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Astro integration: copies the canonical brand kit into <site>/public/brand/
 * before every dev or build run. Sites gitignore public/brand/, so the kit has
 * exactly one source: this package.
 */
export default function brand() {
  return {
    name: '@undrwrldcub/brand',
    hooks: {
      'astro:config:setup': ({ config, logger }) => {
        const src = fileURLToPath(new URL('../assets/', import.meta.url));
        if (!existsSync(src)) {
          throw new Error('@undrwrldcub/brand: assets/ is missing from the installed package.');
        }
        const dest = fileURLToPath(new URL('brand/', config.publicDir));
        mkdirSync(dest, { recursive: true });
        cpSync(src, dest, { recursive: true });
        logger.info('brand kit synced to public/brand/');
      },
    },
  };
}
