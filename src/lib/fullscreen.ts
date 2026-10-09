const FULLSCREEN_FADE_FALLBACK_MS = 400;

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

export async function enterFullscreen() {
    try {
        if (!document.fullscreenElement) {
            await fadeOutBeforeFullscreen();
            await document.documentElement.requestFullscreen();
        }
        const entered = !!document.fullscreenElement;
        if (!entered) revealAfterFailedToggle();
        return entered;
    } catch (err) {
        revealAfterFailedToggle();
        console.error("Fullscreen failed:", err);
        return false;
    }
}

export async function exitFullscreen() {
    try {
        if (document.fullscreenElement) {
            await fadeOutBeforeFullscreen();
            await document.exitFullscreen();
        }
        const exited = !document.fullscreenElement;
        if (!exited) revealAfterFailedToggle();
        return exited;
    } catch (err) {
        revealAfterFailedToggle();
        console.error("Exit fullscreen failed:", err);
        return false;
    }
}
