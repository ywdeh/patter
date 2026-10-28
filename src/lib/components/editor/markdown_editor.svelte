<script>
    import { render_markdown_line as render_line } from '$lib/state/markdown_render.js';
    import { recovery_preview } from '$lib/state/recovery_preview.js';
    import { editor_font_transition } from '$lib/state/editor_font_transition.js';
    import { editor_fonts } from '$lib/state/editor_fonts.js';
    import { background_values } from '$lib/state/background_state.svelte.js';
    import { onMount } from 'svelte';
    import { DEFAULT_EDITOR_PLACEHOLDER } from '$lib/state/editor_placeholders.js';
    import { placeholder_ink } from '$lib/state/placeholder_ink.js';

    let { onchange = () => {}, onrender = () => {}, onkey = () => {}, placeholder = DEFAULT_EDITOR_PLACEHOLDER } = $props();
    const history_limit = 100;
    const grapheme_segmenter = typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;

    let editor;
    let source = '';
    let indexed_source = null;
    let source_lines = [];
    let line_offsets = [];
    let composing = $state(false);
    let markdown_enabled = background_values.markdown;
    let history = [{ text: '', start: 0, end: 0 }];
    let history_index = 0;
    let last_edit = null;

    function index_source() {
        if (source === indexed_source) return;
        indexed_source = source;
        source_lines = source.split('\n');
        let offset = 0;
        line_offsets = source_lines.map((line) => {
            const start = offset;
            offset += line.length + 1;
            return start;
        });
    }

    function line_at(offset) {
        index_source();
        let first = 0, last = line_offsets.length - 1;
        while (first < last) {
            const middle = Math.ceil((first + last) / 2);
            if (line_offsets[middle] <= offset) first = middle;
            else last = middle - 1;
        }
        return first;
    }
    function render(force = false) {
        if (!editor) return;
        index_source();
        const lines = source_lines;
        const existing = Array.from(editor.children);
        let first = 0;
        while (!force && first < lines.length && first < existing.length && existing[first]._source_text === lines[first]) first++;
        let old_end = existing.length - 1;
        let new_end = lines.length - 1;
        while (!force && old_end >= first && new_end >= first && existing[old_end]._source_text === lines[new_end]) {
            old_end--;
            new_end--;
        }

        for (let index = first; index <= old_end; index++) existing[index].remove();
        const fragment = document.createDocumentFragment();
        for (let index = first; index <= new_end; index++) fragment.append(render_line(lines[index], index, markdown_enabled));
        editor.insertBefore(fragment, editor.children[first] ?? null);
        if (existing.length !== lines.length) {
            for (let index = new_end + 1; index < editor.children.length; index++) editor.children[index].dataset.line = String(index);
        }
    }

    function point_offset(node, offset) {
        if (node === editor) {
            index_source();
            return line_offsets[offset] ?? source.length;
        }
        const line = node?.nodeType === Node.ELEMENT_NODE
            ? node.closest?.('[data-line]')
            : node?.parentElement?.closest('[data-line]');
        if (!line || !editor.contains(line)) return 0;

        const line_number = Number(line.dataset.line);
        index_source();
        const before_line = line_offsets[line_number];
        const range = document.createRange();
        range.selectNodeContents(line);
        try {
            range.setEnd(node, offset);
            return before_line + range.toString().length;
        } catch {
            return before_line;
        }
    }

    function selection_offsets() {
        const selection = window.getSelection();
        if (!selection?.rangeCount || !selection.getRangeAt(0).intersectsNode(editor)) {
            return { start: source.length, end: source.length };
        }
        const range = selection.getRangeAt(0);
        const start = editor.contains(range.startContainer) ? point_offset(range.startContainer, range.startOffset) : 0;
        const end = range.collapsed ? start : editor.contains(range.endContainer) ? point_offset(range.endContainer, range.endOffset) : source.length;
        if (selection.isCollapsed) {
            const line = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
                ? selection.anchorNode.closest?.('[data-line]')
                : selection.anchorNode?.parentElement?.closest('[data-line]');
            if (line) {
                let trailing_markers = 0;
                const text_nodes = [];
                const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
                while (walker.nextNode()) text_nodes.push(walker.currentNode);
                for (let index = text_nodes.length - 1; index >= 0; index--) {
                    const node = text_nodes[index];
                    if (!node.parentElement?.closest('.markdown_syntax')) break;
                    trailing_markers += node.length;
                }
                const line_number = Number(line.dataset.line);
                index_source();
                const lines = source_lines;
                const line_end = line_offsets[line_number]
                    + lines[line_number].length;
                if (trailing_markers && start === line_end - trailing_markers) {
                    return { start: line_end, end: line_end };
                }
            }
        }
        return { start, end };
    }

    function source_selection() {
        let { start, end } = selection_offsets();
        if (start === end || (start === 0 && end === source.length)) return { start, end };

        const first_line = line_at(start);
        const last_line = line_at(end);
        for (const index of new Set([first_line, last_line])) {
            const line = editor.children[index];
            if (!line) continue;
            for (const formatted of Array.from(line.querySelectorAll('strong, em')).reverse()) {
                const opening = formatted.previousSibling;
                const closing = formatted.nextSibling;
                if (!opening?.classList?.contains('markdown_syntax') ||
                    !closing?.classList?.contains('markdown_syntax')) continue;

                const parent = formatted.parentNode;
                const index = Array.prototype.indexOf.call(parent.childNodes, formatted);
                const content_start = point_offset(parent, index);
                const content_end = point_offset(parent, index + 1);
                if (start <= content_start && end >= content_end) {
                    start = Math.min(start, point_offset(parent, index - 1));
                    end = Math.max(end, point_offset(parent, index + 2));
                }
            }

            const prefix = line.firstElementChild;
            if (prefix?.classList.contains('markdown_syntax') &&
                (line.classList.contains('list_line') || line.classList.contains('caption_line') || line.className.includes('heading_'))) {
                const prefix_end = point_offset(line, 1);
                const line_end = point_offset(line, line.childNodes.length);
                if (start <= prefix_end && end >= line_end) {
                    start = Math.min(start, point_offset(line, 0));
                }
            }
        }

        return { start, end };
    }

    function place_point(raw_offset) {
        const offset = Math.max(0, Math.min(raw_offset, source.length));
        const line_index = line_at(offset);
        let remaining = offset - line_offsets[line_index];
        const line = editor.children[line_index];
        if (!line) return { node: editor, offset: 0 };
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
            if (remaining <= node.length) {
                const hidden_marker = node.parentElement?.closest('.markdown_syntax');
                if (hidden_marker) {
                    const parent = hidden_marker.parentNode;
                    const marker_index = Array.prototype.indexOf.call(parent.childNodes, hidden_marker);
                    return { node: parent, offset: marker_index + (remaining > 0 ? 1 : 0) };
                }
                return { node, offset: remaining };
            }
            remaining -= node.length;
        }
        if (line.lastChild?.nodeName === 'BR') return { node: line, offset: line.childNodes.length - 1 };
        return { node: line, offset: line.childNodes.length };
    }

    function set_selection(start, end = start) {
        const range = document.createRange();
        if (start === 0 && end === source.length && start !== end) {
            range.selectNodeContents(editor);
        } else {
            const first = place_point(start);
            const last = start === end ? first : place_point(end);
            range.setStart(first.node, first.offset);
            range.setEnd(last.node, last.offset);
        }
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    function record_history(snapshot, merge = false) {
        history = history.slice(0, history_index + 1);
        if (merge) history[history_index] = snapshot;
        else {
            history.push(snapshot);
            history_index++;
            if (history.length > history_limit + 1) {
                history.shift();
                history_index--;
            }
        }
    }

    function commit(text, caret, kind = 'edit') {
        if (text === source) {
            last_edit = null;
            set_selection(caret);
            editor.dispatchEvent(new Event('input'));
            return;
        }
        const previous_selection = source_selection();
        const previous_caret = previous_selection.end;
        history[history_index].start = previous_selection.start;
        history[history_index].end = previous_selection.end;
        source = text;
        const now = performance.now();
        const merge = last_edit?.kind === kind && now - last_edit.time < 600
            && last_edit.caret === previous_caret && ['insert', 'delete'].includes(kind);
        record_history({ text, start: caret, end: caret }, merge);
        last_edit = { kind, time: now, caret };
        render();
        set_selection(caret);
        onchange(source);
        editor.dispatchEvent(new Event('input'));
    }

    function previous_character(offset) {
        if (offset <= 0) return 0;
        if (!grapheme_segmenter) return offset - 1;
        return grapheme_segmenter.segment(source.slice(0, offset)).containing(offset - 1)?.index ?? 0;
    }

    function next_character(offset) {
        if (offset >= source.length) return source.length;
        if (!grapheme_segmenter) return offset + 1;
        const part = grapheme_segmenter.segment(source.slice(offset))[Symbol.iterator]().next().value;
        return offset + (part?.segment.length ?? 1);
    }

    function replace_selection(text, kind = 'insert', selection = source_selection()) {
        const { start, end } = selection;
        const normalized = String(text).replace(/\r\n?/gu, '\n');
        commit(source.slice(0, start) + normalized + source.slice(end), start + normalized.length, kind);
    }

    function paragraph_at(offset) {
        if (!markdown_enabled) return null;
        const line_start = source.lastIndexOf('\n', Math.max(0, offset - 1)) + 1;
        const line_end = source.indexOf('\n', offset);
        const line = source.slice(line_start, line_end < 0 ? source.length : line_end);
        const bullet = /^([-*]) /u.exec(line);
        const numbered = /^(\d+)\. /u.exec(line);
        const caption = /^(>{1,2}) (?:#{1,3} )?/u.exec(line);
        if (caption) return { line_start, prefix: caption[0], next: '' };
        if (!bullet && !numbered) return null;
        const prefix = bullet ? `${bullet[1]} ` : `${numbered[1]}. `;
        return { line_start, prefix, next: bullet ? prefix : `${Number(numbered[1]) + 1}. ` };
    }

    function undo(direction) {
        const next = history_index + direction;
        if (next < 0 || next >= history.length) return;
        history_index = next;
        const snapshot = history[next];
        source = snapshot.text;
        last_edit = null;
        render();
        set_selection(snapshot.start, snapshot.end);
        onchange(source);
        editor.dispatchEvent(new Event('input'));
    }

    function handle_before_input(event) {
        if (composing || event.isComposing) return;
        const { inputType, data } = event;
        if (inputType === 'historyUndo' || inputType === 'historyRedo') {
            event.preventDefault();
            undo(inputType === 'historyUndo' ? -1 : 1);
            return;
        }
        if (inputType === 'insertFromPaste') {
            event.preventDefault();
            const text = event.dataTransfer?.getData('text/plain') ?? '';
            if (text) replace_selection(text, 'paste');
            return;
        }
        if (inputType === 'insertFromDrop') {
            event.preventDefault();
            return;
        }
        if (inputType === 'insertText' || inputType === 'insertReplacementText') {
            event.preventDefault();
            replace_selection(data ?? '', 'insert');
            return;
        }
        if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
            event.preventDefault();
            const { start, end } = source_selection();
            const paragraph = inputType === 'insertParagraph' ? paragraph_at(start) : null;
            const next_line = paragraph && start >= paragraph.line_start + paragraph.prefix.length
                ? `\n${paragraph.next}`
                : '\n';
            commit(source.slice(0, start) + next_line + source.slice(end), start + next_line.length, 'paragraph');
            return;
        }
        if (inputType.startsWith('delete')) {
            event.preventDefault();
            let { start, end } = source_selection();
            if (start === end) {
                if (inputType === 'deleteContentBackward') {
                    const paragraph = paragraph_at(start);
                    if (paragraph && start === paragraph.line_start + paragraph.prefix.length) {
                        commit(source.slice(0, paragraph.line_start) + source.slice(start), paragraph.line_start, 'delete');
                        return;
                    }
                }
                if (inputType === 'deleteWordBackward') start = Math.max(0, start - (source.slice(0, start).match(/(?:\s+|\S+)$/u)?.[0].length ?? 0));
                else if (inputType === 'deleteWordForward') end = Math.min(source.length, end + (source.slice(end).match(/^(?:\s+|\S+)/u)?.[0].length ?? 0));
                else if (inputType.includes('Forward')) end = next_character(end);
                else start = previous_character(start);
            }
            commit(source.slice(0, start) + source.slice(end), start, 'delete');
            return;
        }
        event.preventDefault();
    }

    function handle_keydown(event) {
        onkey(event);
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
        if (event.key.toLowerCase() === 'a') {
            event.preventDefault();
            set_selection(0, source.length);
        } else if (event.key.toLowerCase() === 'z') {
            event.preventDefault();
            undo(event.shiftKey ? 1 : -1);
        } else if (event.key.toLowerCase() === 'y') {
            event.preventDefault();
            undo(1);
        } else if (['b', 'i', 'u'].includes(event.key.toLowerCase())) {
            event.preventDefault();
        }
    }

    function handle_paste(event) {
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (text) replace_selection(text, 'paste');
    }

    function handle_drop(event) {
        event.preventDefault();
        const text = event.dataTransfer?.getData('text/plain') ?? '';
        if (!text) return;
        const selection = document.getSelection();
        const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
        if (range) {
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
        replace_selection(text, 'paste');
    }

    function handle_clipboard(event) {
        const selection = source_selection();
        const { start, end } = selection;
        if (start === end || !event.clipboardData) return;
        event.preventDefault();
        event.clipboardData.setData('text/plain', source.slice(start, end));
        if (event.type === 'cut') replace_selection('', 'cut', selection);
    }

    function handle_composition_end() {
        composing = false;
        const text = Array.from(editor.querySelectorAll('[data-line]'), (line) => line.textContent ?? '').join('\n');
        const caret = selection_offsets().end;
        if (text !== source) commit(text, Math.min(caret, text.length), 'composition');
        else {
            for (const line of editor.children) line._source_text = null;
            render();
            set_selection(caret);
        }
    }

    export function getSource() {
        return source;
    }

    export function getVisibleText() {
        return Array.from(editor.children, (line) => line._visible_text ?? '').join('\n');
    }

    export function getSelectedVisibleText() {
        const selection = document.getSelection();
        if (!selection?.rangeCount || selection.isCollapsed) return null;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;
        const fragment = range.cloneContents();
        for (const syntax of fragment.querySelectorAll('.markdown_syntax')) syntax.remove();
        let text = '';
        for (const child of fragment.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE && child.classList.contains('markdown_line') && text) text += '\n';
            text += child.textContent ?? '';
        }
        return text;
    }

    export function getElement() {
        return editor;
    }

    export function setSource(text, { undoable = false } = {}) {
        const focused = document.activeElement === editor;
        const next = String(text ?? '').replace(/\r\n?/gu, '\n');
        if (undoable) {
            if (next !== source) {
                const selection = source_selection();
                history[history_index].start = selection.start;
                history[history_index].end = selection.end;
                record_history({ text: next, start: next.length, end: next.length });
            }
        } else {
            history = [{ text: next, start: 0, end: 0 }];
            history_index = 0;
        }
        source = next;
        last_edit = null;
        render();
        if (focused) set_selection(source.length);
    }

    export function setSelectionToEnd() {
        set_selection(source.length);
    }

    onMount(() => render());

    $effect(() => {
        const enabled = background_values.markdown;
        if (!editor || composing || enabled === markdown_enabled) return;
        const selection = document.getSelection();
        const has_selection = selection?.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode);
        const offsets = has_selection ? selection_offsets() : null;
        const scroll = editor.parentElement;
        const scroll_top = scroll.scrollTop;
        markdown_enabled = enabled;
        render(true);
        if (offsets) set_selection(offsets.start, offsets.end);
        scroll.scrollTop = scroll_top;
        onrender();
        editor.dispatchEvent(new Event('input'));
    });
</script>

<div
    bind:this={editor}
    use:recovery_preview={background_values.markdown}
    use:placeholder_ink={placeholder}
    use:editor_font_transition={{ font: editor_fonts[background_values.editorFont], size: background_values.textSize }}
    data-patter-body
    data-empty="true"
    data-placeholder={placeholder}
    class="markdown_surface flex min-h-full flex-col gap-4 p-4 outline-none sm:p-8"
    contenteditable="true"
    role="textbox"
    tabindex="0"
    aria-label="Writing area"
    aria-multiline="true"
    aria-placeholder={placeholder}
    onbeforeinput={handle_before_input}
    onkeydown={handle_keydown}
    onpaste={handle_paste}
    ondrop={handle_drop}
    oncopy={handle_clipboard}
    oncut={handle_clipboard}
    oncompositionstart={() => composing = true}
    oncompositionend={handle_composition_end}
></div>

<style>
    .markdown_surface { font-family: var(--patter_editor_font, var(--patter_font_body)); font-size: var(--patter_body_text_size, 18px); line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; position: relative; }
    .markdown_surface :global(.markdown_line) { min-height: 1.5em; }
    .markdown_surface :global(.markdown_syntax) { display: none; }
    .markdown_surface :global(.heading_1) { font-size: 1.65em; font-weight: 700; }
    .markdown_surface :global(.heading_2) { font-size: 1.35em; font-weight: 700; }
    .markdown_surface :global(.heading_3) { font-size: 1.15em; font-weight: 700; }
    .markdown_surface :global(.caption_line) { color: #f2d77a; text-align: start; text-shadow: -1px 0 2px rgb(0 0 0 / 70%), 1px 0 2px rgb(0 0 0 / 70%), 0 -1px 2px rgb(0 0 0 / 70%), 0 1px 2px rgb(0 0 0 / 70%), 0 0 5px rgb(0 0 0 / 45%); }
    .markdown_surface :global(.caption_centered) { text-align: center; }
    .markdown_surface :global(.list_line) { position: relative; padding-left: 1.5em; }
    .markdown_surface :global(.list_line::before) { content: attr(data-list-marker); position: absolute; left: 0; opacity: var(--patter_opacity_secondary); }
</style>
