export const imageBackgroundExtensions = ['avif', 'gif', 'jpg', 'jpeg', 'png', 'webp'];
export const videoBackgroundExtensions = ['mp4', 'webm', 'ogv', 'ogg'];
export const backgroundExtensions = [...imageBackgroundExtensions, ...videoBackgroundExtensions];

export function backgroundKindFromFilename(filename) {
    const extension = filename.split('.').pop()?.toLowerCase();
    return videoBackgroundExtensions.includes(extension) ? 'video' : 'image';
}

export const backgroundFileAccept = backgroundExtensions.map((extension) => `.${extension}`).join(',');
