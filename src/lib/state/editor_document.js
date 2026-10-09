let markdown = '';

export function setEditorDocument(value) {
    markdown = String(value ?? '');
}

export function getEditorDocument() {
    return markdown;
}
