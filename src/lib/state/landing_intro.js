import { gsap } from 'gsap';
import { motionDelay, motionDuration } from '$lib/state/motion.js';

export function mountLandingIntro(root) {
	if (!root) return () => {};
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		root.classList.remove('landing_intro_pending');
		return () => {};
	}

	const letters = root.querySelectorAll('[data-landing-intro-letter]');
	const revealItems = root.querySelectorAll('[data-landing-intro-reveal]');
	if (!letters.length || !revealItems.length) {
		root.classList.remove('landing_intro_pending');
		return () => {};
	}
	const reveal_opacities = [...revealItems].map((element) => Number.parseFloat(getComputedStyle(element).opacity));

	const context = gsap.context(() => {
		gsap.set(letters, { y: -14, autoAlpha: 0 });
		gsap.set(revealItems, { y: 5, opacity: 0 });
		root.classList.remove('landing_intro_pending');

		const timeline = gsap.timeline();
		timeline.to(letters, {
			y: 0,
			autoAlpha: 1,
			duration: motionDuration('slow', 400) / 1000,
			ease: 'power2.out',
			stagger: motionDelay('short', 50) / 1000,
			clearProps: 'transform,opacity,visibility'
		});
		timeline.to(revealItems, {
			y: 0,
			opacity: (index) => reveal_opacities[index],
			duration: motionDuration('standard', 200) / 1000,
			ease: 'power1.out',
			stagger: motionDelay('short', 50) / 1000,
			clearProps: 'transform,opacity'
		});
	}, root);

	return () => context.revert();
}
