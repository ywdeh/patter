    function syntax(parent, value) {
        const marker = document.createElement('span');
        marker.className = 'markdown_syntax';
        marker.textContent = value;
        parent.append(marker);
    }

    function append_inline(parent, text) {
        const whitespace = (value) => !value || /\s/u.test(value);
        const punctuation = (value) => /[\p{P}\p{S}]/u.test(value);
        const bottoms = Array(6).fill(null);
        let last = null;
        let first = null;
        let index = 0;
        let plain_start = 0;

        while (index < text.length) {
            if (text[index] === '\\' && (text[index + 1] === '*' || text[index + 1] === '\\')) {
                index += 2;
                continue;
            }
            if (text[index] !== '*') {
                index++;
                continue;
            }
            if (index > plain_start) parent.append(document.createTextNode(text.slice(plain_start, index)));
            const start = index;
            while (text[index] === '*') index++;
            const before = text[start - 1] ?? '';
            const after = text[index] ?? '';
            const before_space = whitespace(before);
            const after_space = whitespace(after);
            const before_punctuation = punctuation(before);
            const after_punctuation = punctuation(after);
            const node = document.createTextNode(text.slice(start, index));
            parent.append(node);
            const delimiter = {
                node, length: index - start, original_length: index - start,
                open: !after_space && (!after_punctuation || before_space || before_punctuation),
                close: !before_space && (!before_punctuation || after_space || after_punctuation),
                previous: last, next: null
            };
            if (last) last.next = delimiter;
            else first = delimiter;
            last = delimiter;
            plain_start = index;
        }
        if (plain_start < text.length) parent.append(document.createTextNode(text.slice(plain_start)));

        const remove = (delimiter) => {
            if (delimiter.previous) delimiter.previous.next = delimiter.next;
            if (delimiter.next) delimiter.next.previous = delimiter.previous;
        };
        let closer = first;
        while (closer) {
            if (!closer.close) {
                closer = closer.next;
                continue;
            }
            const bottom_index = (closer.open ? 3 : 0) + closer.original_length % 3;
            let opener = closer.previous;
            while (opener && opener !== bottoms[bottom_index]) {
                const odd_match = (opener.close || closer.open)
                    && (opener.original_length + closer.original_length) % 3 === 0
                    && (opener.original_length % 3 !== 0 || closer.original_length % 3 !== 0);
                if (opener.open && !odd_match) break;
                opener = opener.previous;
            }
            if (!opener || opener === bottoms[bottom_index]) {
                bottoms[bottom_index] = closer.previous;
                const next = closer.next;
                if (!closer.open) remove(closer);
                closer = next;
                continue;
            }

            const count = opener.length >= 2 && closer.length >= 2 ? 2 : 1;
            const formatted = document.createElement(count === 2 ? 'strong' : 'em');
            let node = opener.node.nextSibling;
            while (node !== closer.node) {
                const next = node.nextSibling;
                formatted.append(node);
                node = next;
            }
            const container = closer.node.parentNode;
            const opening = document.createDocumentFragment();
            syntax(opening, '*'.repeat(count));
            opening.append(formatted);
            syntax(opening, '*'.repeat(count));
            container.insertBefore(opening, closer.node);
            opener.length -= count;
            closer.length -= count;
            opener.node.data = '*'.repeat(opener.length);
            closer.node.data = '*'.repeat(closer.length);
            let middle = opener.next;
            while (middle !== closer) {
                const next = middle.next;
                remove(middle);
                middle = next;
            }
            if (!opener.length) {
                remove(opener);
                opener.node.remove();
            }
            if (!closer.length) {
                const next = closer.next;
                remove(closer);
                closer.node.remove();
                closer = next;
            }
        }
    }

    export function render_markdown_line(line, index, markdown = true) {
        const element = document.createElement('div');
        element.dataset.line = String(index);
        element.className = 'markdown_line';
        element._source_text = line;
        if (!markdown) {
            element.textContent = line;
            if (!line) element.append(document.createElement('br'));
            element._visible_text = line;
            return element;
        }

        const caption = /^(>{1,2}) (?:(#{1,3}) )?(.*)$/u.exec(line);
        const heading = /^(#{1,3}) (.*)$/u.exec(line);
        const bullet = /^([-*]) (.*)$/u.exec(line);
        const numbered = /^(\d+\.) (.*)$/u.exec(line);
        let visible_content = line;
        if (caption || heading) {
            visible_content = caption ? caption[3] : heading[2];
            const heading_marker = caption ? caption[2] : heading[1];
            if (caption) {
                element.classList.add('caption_line');
                if (caption[1] === '>>') element.classList.add('caption_centered');
            }
            if (heading_marker) element.classList.add(`heading_${heading_marker.length}`);
            syntax(element, line.slice(0, line.length - visible_content.length));
            append_inline(element, visible_content);
        } else if (bullet || numbered) {
            const match = bullet ?? numbered;
            element.classList.add('list_line');
            element.dataset.listMarker = bullet ? '•' : match[1];
            syntax(element, `${match[1]} `);
            append_inline(element, match[2]);
            visible_content = match[2];
        } else {
            append_inline(element, line);
        }

        if (!visible_content) element.append(document.createElement('br'));
        let plain_text = '';
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.parentElement?.closest('.markdown_syntax')) plain_text += node.data;
        }
        element._visible_text = plain_text;
        return element;
    }

