export async function enterFullscreen() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        }
    } catch (err) {
        console.error("Fullscreen failed:", err);
    }
}

export async function exitFullscreen() {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        }
    } catch (err) {
        console.error("Exit fullscreen failed:", err);
    }
}