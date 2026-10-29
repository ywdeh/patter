import { domToBlob } from 'modern-screenshot';
import { download_file } from './editor_export.js';
import { createExportFilename } from './editor_filename.js';
import { getEditorDocument } from './editor_document.js';

export async function export_editor_picture() {
    await document.fonts.ready;
    const file = await domToBlob(document.documentElement, {
        width: window.innerWidth,
        height: window.innerHeight,
        scale: window.devicePixelRatio,
        features: { restoreScrollPosition: true },
        filter: (node) => !(node instanceof Element) || !node.matches(
            'script, head, noscript, [data-patter-mask-defs], [data-zen-mode-ui="options"], .mobile_options_toggle, [role="menu"], .patter-custom-caret, [aria-label="Snapshot preview"]'
        ),
        onCloneEachNode: (node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.matches('[data-zen-mode-ui]')) node.style.opacity = '0';
            node.style.transition = 'none';
            node.style.animation = 'none';
            if (node.style.maskImage.includes('data:image/svg+xml') || node.style.maskImage.includes('patter_panel_mask_')) {
                node.style.maskImage = 'none';
                node.style.webkitMaskImage = 'none';
            }
        }
    });
    if (!file) throw new Error('Picture capture failed');
    download_file(file, createExportFilename(getEditorDocument(), 'png'));
}
