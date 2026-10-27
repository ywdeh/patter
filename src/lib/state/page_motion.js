import { gsap } from 'gsap';
import { motionDuration } from '$lib/state/motion.js';

let latest_page_motion = Promise.resolve();

export function get_page_motion_targets() {
	return ['.route_surface', '.route_background']
		.map((selector) => document.querySelector(selector))
		.filter((element) => element instanceof HTMLElement);
}

function normalize_targets(targets) {
	return [...targets].filter((element) => element instanceof HTMLElement);
}

function animate_opacity(targets, opacity, token, fallback_ms, ease, transition = null) {
	const elements = normalize_targets(targets);
	if (!elements.length) return Promise.resolve();

	for (const element of elements) {
		element.classList.remove('route_initial_hidden');
	}

	gsap.killTweensOf(elements, 'opacity');
	const reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (reduced_motion) {
		gsap.set(elements, { opacity, clearProps: 'opacity' });
		latest_page_motion = Promise.resolve();
		return latest_page_motion;
	}

	latest_page_motion = new Promise((resolve) => {
		let finished = false;
		const finish = () => {
			if (finished) return;
			finished = true;
			if (opacity === 1) gsap.set(elements, { clearProps: 'opacity' });
			resolve();
		};

		const tween_options = {
            data: transition,
			opacity,
			duration: motionDuration(token, fallback_ms) / 1000,
			ease,
			overwrite: 'auto',
			onComplete: finish,
			onInterrupt: finish
		};

		if (opacity === 1) gsap.fromTo(elements, { opacity: 0 }, tween_options);
		else gsap.to(elements, tween_options);
	});

	return latest_page_motion;
}

export function fade_page_in(targets) {
	return animate_opacity(
		targets,
		1,
		'slow',
		400,
		'power1.inOut'
	);
}

export function fade_page_out(targets, transition = 'route') {
	const fullscreen = transition === 'fullscreen';
	return animate_opacity(
		targets,
		0,
		fullscreen ? 'fullscreen_out' : 'slow',
		fullscreen ? 250 : 400,
		'power1.inOut',
        transition
	);
}

export function wait_for_page_motion() {
	return latest_page_motion;
}

export function finish_route_fade() {
    for (const tween of gsap.getTweensOf(get_page_motion_targets())) {
        if (tween.data === 'route' && tween.vars.opacity === 0) tween.progress(1);
    }
}
