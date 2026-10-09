import { $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';

const replacements = new Map([
    ['--', '\u2013'],
    ['\u2013-', '\u2014'],
    ['""', '\u00ab'],
    ['\u00ab"', '\u00bb'],
    ['<-', '\u2190'],
    ['->', '\u2192']
]);
const restoreOnBackspace = new Map([
    ['\u2013', '--'], ['\u2014', '---'], ['\u00ab', '""'],
    ['\u00bb', '\u00ab"'], ['\u2190', '<-'], ['\u2192', '->']
]);

export const smartPunctuation = $prose(() => new Plugin({
    props: {
        handleTextInput(view, from, to, text) {
            if (!['-', '"', '>'].includes(text) || from !== to) return false;
            const prefix = view.state.doc.textBetween(Math.max(0, from - 2), from, '', '');
            const replacement = replacements.get(prefix + text);
            if (!replacement) return false;
            view.dispatch(view.state.tr.insertText(replacement, from - prefix.length, to));
            return true;
        },
        handleKeyDown(view, event) {
            if (event.key !== 'Backspace' || !view.state.selection.empty) return false;
            const { from } = view.state.selection;
            const previous = view.state.doc.textBetween(Math.max(0, from - 1), from, '', '');
            const replacement = restoreOnBackspace.get(previous);
            if (!replacement) return false;
            view.dispatch(view.state.tr.insertText(replacement, from - 1, from));
            return true;
        }
    }
}));
