import { fade_page_in, fade_page_out, get_page_motion_targets, wait_for_page_motion } from '$lib/state/page_motion.js';

export function isFullscreenActive() {
    return !!document.fullscreenElement || window.matchMedia('(display-mode: fullscreen)').matches;
}

const FULLSCREEN_FADE_FALLBACK_MS = 400;
let fullscreen_transition_pending = false;

async function fade_out_before_fullscreen() {
	await fade_page_out(get_page_motion_targets(), 'fullscreen');
}

async function wait_for_fullscreen_fade_in() {
	await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	await Promise.race([
		wait_for_page_motion(),
		new Promise<void>((resolve) => window.setTimeout(resolve, FULLSCREEN_FADE_FALLBACK_MS + 350))
	]);
}

function reveal_after_failed_toggle() {
	void fade_page_in(get_page_motion_targets());
}

export async function enterFullscreen() {
	if (fullscreen_transition_pending) return false;
	if (isFullscreenActive()) return true;
	fullscreen_transition_pending = true;
	try {
		await fade_out_before_fullscreen();
		await document.documentElement.requestFullscreen();
		const entered = !!document.fullscreenElement;
		if (!entered) reveal_after_failed_toggle();
		else await wait_for_fullscreen_fade_in();
		return entered;
	} catch (err) {
		reveal_after_failed_toggle();
		console.error('Fullscreen failed:', err);
		return false;
	} finally {
		fullscreen_transition_pending = false;
	}
}

export async function exitFullscreen() {
	if (fullscreen_transition_pending) return false;
	if (!document.fullscreenElement) return !isFullscreenActive();
	fullscreen_transition_pending = true;
	try {
		await fade_out_before_fullscreen();
		await document.exitFullscreen();
		const exited = !isFullscreenActive();
		if (!exited) reveal_after_failed_toggle();
		else await wait_for_fullscreen_fade_in();
		return exited;
	} catch (err) {
		reveal_after_failed_toggle();
		console.error('Exit fullscreen failed:', err);
		return false;
	} finally {
		fullscreen_transition_pending = false;
	}
}
