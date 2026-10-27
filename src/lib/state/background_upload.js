export async function optimize_background_upload(file) {
    if (!/\.(?:png|jpe?g)$/i.test(file.name)) return file;
    const image = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 2560 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image conversion is unavailable.');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
        if (!blob || blob.type !== 'image/webp') throw new Error('WebP conversion is unavailable.');
        return new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: blob.type });
    } finally {
        image.close();
    }
}
