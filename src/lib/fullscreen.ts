const FULLSCREEN_FADE_FALLBACK_MS = 400;
let fullscreen_transition_pending = false;

function getFadeTargets() {
    return [
        document.querySelector<HTMLElement>('.route_surface'),
        document.querySelector<HTMLElement>('.route_background'),
    ].filter((element): element is HTMLElement => !!element);
}

function revealAfterFailedToggle() {
    for (const element of getFadeTargets()) {
        element.classList.remove('route_initial_hidden', 'route_fade_out', 'route_fade_in', 'route_fullscreen_fade_in', 'route_fullscreen_fade_out');
        void element.getBoundingClientRect();
        element.classList.add('route_fade_in');
    }
}

async function fadeOutBeforeFullscreen() {
    const targets = getFadeTargets();
    await Promise.all(targets.map((element) => new Promise<void>((resolve) => {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(fallback);
            element.removeEventListener('animationend', onAnimationEnd);
            resolve();
        };
        const onAnimationEnd = (event: AnimationEvent) => {
            if (event.target === element && event.animationName === 'route_fade_out') finish();
        };
        const fallback = window.setTimeout(finish, FULLSCREEN_FADE_FALLBACK_MS);

        element.classList.remove('route_initial_hidden', 'route_fade_in', 'route_fullscreen_fade_in', 'route_fade_out', 'route_fullscreen_fade_out');
        void element.getBoundingClientRect();
        element.addEventListener('animationend', onAnimationEnd);
        element.classList.add('route_fullscreen_fade_out');
    })));
}

async function waitForFullscreenFadeIn() {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const animations = getFadeTargets()
        .flatMap((element) => element.getAnimations())
        .filter((animation) => 'animationName' in animation && animation.animationName === 'route_fade_in');
    if (animations.length === 0) return;

    await Promise.race([
        Promise.allSettled(animations.map((animation) => animation.finished)),
        new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
    ]);
}

export async function enterFullscreen() {
    if (fullscreen_transition_pending) return false;
    if (document.fullscreenElement) return true;
    fullscreen_transition_pending = true;
    try {
        await fadeOutBeforeFullscreen();
        await document.documentElement.requestFullscreen();
        const entered = !!document.fullscreenElement;
        if (!entered) revealAfterFailedToggle();
        else await waitForFullscreenFadeIn();
        return entered;
    } catch (err) {
        revealAfterFailedToggle();
        console.error("Fullscreen failed:", err);
        return false;
    } finally {
        fullscreen_transition_pending = false;
    }
}

export async function exitFullscreen() {
    if (fullscreen_transition_pending) return false;
    if (!document.fullscreenElement) return true;
    fullscreen_transition_pending = true;
    try {
        await fadeOutBeforeFullscreen();
        await document.exitFullscreen();
        const exited = !document.fullscreenElement;
        if (!exited) revealAfterFailedToggle();
        else await waitForFullscreenFadeIn();
        return exited;
    } catch (err) {
        revealAfterFailedToggle();
        console.error("Exit fullscreen failed:", err);
        return false;
    } finally {
        fullscreen_transition_pending = false;
    }
}
