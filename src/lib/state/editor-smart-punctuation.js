const EN_DASH = '\u2013';
const EM_DASH = '\u2014';
const LEFT_GUILLEMET = '\u00ab';
const RIGHT_GUILLEMET = '\u00bb';
const LEFT_ARROW = '\u2190';
const RIGHT_ARROW = '\u2192';
const backspaceReplacements = new Map([
    [EN_DASH, '--'],
    [EM_DASH, '---'],
    [LEFT_GUILLEMET, '""'],
    [RIGHT_GUILLEMET, `${LEFT_GUILLEMET}"`],
    [LEFT_ARROW, '<-'],
    [RIGHT_ARROW, '->']
]);

function getCollapsedTextSelection(element) {
    const selection = window.getSelection();
    if (!selection?.isCollapsed || !selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !element.contains(node)) return null;

    return { selection, node, offset: range.startOffset };
}

function setCaret(selection, node, offset) {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

function selectText(selection, node, start, end) {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    selection.removeAllRanges();
    selection.addRange(range);
}

let handlingReplacementInput = false;

export function handleSmartPunctuationInput(event) {
    if (handlingReplacementInput) {
        handlingReplacementInput = false;
        return true;
    }
    if (event.isComposing || event.inputType !== 'insertText' || !['-', '"', '>'].includes(event.data)) return;

    const element = event.currentTarget;
    const caret = getCollapsedTextSelection(element);
    if (!caret || caret.offset < 2) return;

    const typedSequence = caret.node.data.slice(caret.offset - 2, caret.offset);
    const replacement = event.data === '-'
        ? typedSequence === '<-'
            ? LEFT_ARROW
            : typedSequence === '--'
                ? EN_DASH
                : typedSequence === `${EN_DASH}-`
                    ? EM_DASH
                    : null
        : event.data === '>'
            ? typedSequence === '->' ? RIGHT_ARROW : null
            : typedSequence === '""'
                ? LEFT_GUILLEMET
                : typedSequence === `${LEFT_GUILLEMET}"`
                    ? RIGHT_GUILLEMET
                    : null;
    if (!replacement) return;

    const start = caret.offset - 2;
    selectText(caret.selection, caret.node, start, caret.offset);
    handlingReplacementInput = true;
    const inserted = document.execCommand('insertText', false, replacement);
    // Most contenteditable implementations emit input synchronously here.
    // If one does not, let the original input handler finish normally.
    if (handlingReplacementInput) handlingReplacementInput = false;
    if (!inserted) {
        caret.node.replaceData(start, 2, replacement);
        setCaret(caret.selection, caret.node, start + replacement.length);
    }
}

export function handleSmartPunctuationKeydown(event) {
    if (event.key !== 'Backspace' || event.isComposing) return false;

    const element = event.currentTarget;
    const caret = getCollapsedTextSelection(element);
    if (!caret || caret.offset < 1) return false;

    const previousCharacter = caret.node.data[caret.offset - 1];
    const replacement = backspaceReplacements.get(previousCharacter);
    if (!replacement) return false;

    event.preventDefault();
    const start = caret.offset - 1;
    selectText(caret.selection, caret.node, start, caret.offset);
    const inserted = document.execCommand('insertText', false, replacement);
    if (!inserted) {
        caret.node.replaceData(start, 1, replacement);
        // Keep the caret after the restored character sequence.
        setCaret(caret.selection, caret.node, start + replacement.length);
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: replacement }));
    }
    return true;
}
