import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const UNWATCHED_DIRS = ['**/data/**', '**/static/data/**', '**/scratch/**'];

const runesOutsideDependencies = ({ filename }: { filename: string }) =>
	filename.split(/[/\\]/).includes('node_modules') ? undefined : true;

export default defineConfig({
	server: { watch: { ignored: UNWATCHED_DIRS } },
	build: { sourcemap: true },
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: { runes: runesOutsideDependencies },
			adapter: adapter(),
			paths: { relative: false }
		})
	]
});
