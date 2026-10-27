export function fit_label(node) {
    let frame = 0;
    function measure() {
        frame = 0;
        node.style.removeProperty('font-size');
        const width = node.clientWidth;
        if (!width) return;
        const style = getComputedStyle(node);
        const range = document.createRange();
        range.selectNodeContents(node);
        const text_width = range.getBoundingClientRect().width;
        if (text_width > width) {
            const size = Number.parseFloat(style.fontSize);
            node.style.fontSize = `${Math.floor(size * (width - 2) / text_width * 100) / 100}px`;
        }
    }
    function schedule() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(measure);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    document.fonts.addEventListener('loadingdone', schedule);
    schedule();
    return {
        update: schedule,
        destroy() {
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.fonts.removeEventListener('loadingdone', schedule);
        }
    };
}
