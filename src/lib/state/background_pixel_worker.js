// Keep image scaling and pixel readback off the UI thread.
self.onmessage = ({ data: { id, bitmap, width, height } }) => {
    try {
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Pixel sampling is unavailable');
        context.drawImage(bitmap, 0, 0, width, height);
        const { data } = context.getImageData(0, 0, width, height);
        self.postMessage({ id, pixels: data }, [data.buffer]);
    } catch {
        self.postMessage({ id, error: true });
    } finally {
        bitmap.close();
    }
};
