import { defineConfig } from 'astro/config';
import { storyblok } from '@storyblok/astro';
import { loadEnv } from 'vite';
import mkcert from 'vite-plugin-mkcert';

import vercel from '@astrojs/vercel';
import netlify from '@astrojs/netlify';

import react from '@astrojs/react';

const env = loadEnv(import.meta.env.MODE, process.cwd(), '');
const {
    NETLIFY,
    STORYBLOK_DELIVERY_API_TOKEN,
    STORYBLOK_API_BASE_URL,
    STORYBLOK_REGION,
} = env;

export default defineConfig({
    devToolbar: {
        enabled: false,
    },
    integrations: [storyblok({
        accessToken: STORYBLOK_DELIVERY_API_TOKEN,
        apiOptions: {
            /** Set the correct region for your space. Learn more: https://www.storyblok.com/docs/packages/storyblok-js#example-region-parameter */
            region: STORYBLOK_REGION || 'eu',
            /** The following code is only required when creating a Storyblok space directly via the Blueprints feature. */
            endpoint: STORYBLOK_API_BASE_URL
                ? `${new URL(STORYBLOK_API_BASE_URL).origin}/v2`
                : undefined,
        },
        components: {
            page: 'storyblok/Page',
            grid: 'storyblok/Grid',
            feature: 'storyblok/Feature',
            teaser: 'storyblok/Teaser',
            'hero-section': 'storyblok/HeroSection',
            'default-page': 'storyblok/Page',
        },
		}), react()],
    output: 'server',
    adapter: NETLIFY ? netlify() : vercel(),
    vite: {
        plugins: [mkcert()],
        // Evita que la precompilación JSX de desarrollo contamine el build de producción.
        cacheDir: process.env.NODE_ENV === 'production' ? 'node_modules/.vite-build' : 'node_modules/.vite-dev',
    },
});
