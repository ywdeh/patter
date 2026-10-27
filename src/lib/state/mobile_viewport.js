// Visual viewport handles software keyboards where dvh keeps the full page height.
export function mount_mobile_viewport() {
    const viewport = window.visualViewport;
    const touch = window.matchMedia('(hover: none), (pointer: coarse)');
    let frame;
    function update() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            if (touch.matches && viewport) document.documentElement.style.setProperty('--patter_viewport_height', `${viewport.height}px`);
            else document.documentElement.style.removeProperty('--patter_viewport_height');
        });
    }
    viewport?.addEventListener('resize', update);
    touch.addEventListener('change', update);
    update();
    return () => {
        cancelAnimationFrame(frame);
        viewport?.removeEventListener('resize', update);
        touch.removeEventListener('change', update);
        document.documentElement.style.removeProperty('--patter_viewport_height');
    };
}
