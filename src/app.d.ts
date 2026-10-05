// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	interface Window {
		patterPrimeBodyPreview?: () => void;
	}

	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties
		}

		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
	}
}

declare module 'virtual:patter-backgrounds' {
	const backgrounds: Array<{ src: string; kind: 'image' | 'video' }>;
	export default backgrounds;
}

export {};
