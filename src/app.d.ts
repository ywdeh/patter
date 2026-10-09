declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties
		}
	}
}

declare module 'virtual:patter-backgrounds' {
	const backgrounds: Array<{ src: string; kind: 'image' | 'video'; thumbnail?: string | null }>;
	export default backgrounds;
}

export {};
