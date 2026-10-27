const inline_markers = ['***', '**', '*'];

    function syntax(parent, value) {
        const marker = document.createElement('span');
        marker.className = 'markdown_syntax';
        marker.textContent = value;
        parent.append(marker);
    }

    function closing_marker(text, marker, from) {
        let index = text.indexOf(marker, from);
        while (index !== -1) {
            if (index > from && text[index - 1] !== '\\' && (marker !== '*' || (text[index - 1] !== '*' && text[index + 1] !== '*'))) return index;
            index = text.indexOf(marker, index + marker.length);
        }
        return -1;
    }

    function append_inline(parent, text, depth = 0) {
        if (depth > 8) {
            parent.append(document.createTextNode(text));
            return;
        }

        let plain = '';
        let index = 0;
        const flush = () => {
            if (plain) parent.append(document.createTextNode(plain));
            plain = '';
        };

        while (index < text.length) {
            if (text[index] === '\\' && text[index + 1] === '*') {
                plain += text.slice(index, index + 2);
                index += 2;
                continue;
            }

            const marker = inline_markers.find((value) => text.startsWith(value, index));
            if (!marker) {
                plain += text[index++];
                continue;
            }

            const end = closing_marker(text, marker, index + marker.length);
            if (end < 0 || !text.slice(index + marker.length, end).trim()) {
                plain += marker;
                index += marker.length;
                continue;
            }

            flush();
            syntax(parent, marker);
            const formatted = document.createElement(marker === '*' ? 'em' : 'strong');
            if (marker === '***') {
                const italic = document.createElement('em');
                append_inline(italic, text.slice(index + marker.length, end), depth + 1);
                formatted.append(italic);
            } else append_inline(formatted, text.slice(index + marker.length, end), depth + 1);
            parent.append(formatted);
            syntax(parent, marker);
            index = end + marker.length;
        }
        flush();
    }

    export function render_markdown_line(line, index) {
        const element = document.createElement('div');
        element.dataset.line = String(index);
        element.className = 'markdown_line';
        element._source_text = line;

        const heading = /^(#{1,3}) (.*)$/u.exec(line);
        const bullet = /^([-*]) (.*)$/u.exec(line);
        const numbered = /^(\d+\.) (.*)$/u.exec(line);
        let visible_content = line;
        if (heading) {
            element.classList.add(`heading_${heading[1].length}`);
            syntax(element, `${heading[1]} `);
            append_inline(element, heading[2]);
            visible_content = heading[2];
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

