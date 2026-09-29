import { defineConfig } from 'astro/config';
import brand from '@undrwrldcub/brand';

export default defineConfig({
  site: 'https://SITE-NAME.undrwrldcub.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [brand()],
});
