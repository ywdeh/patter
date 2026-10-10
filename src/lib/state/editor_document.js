let text = '';

export function setEditorDocument(value) {
    text = String(value ?? '');
}

export function getEditorDocument() {
    return text;
}
