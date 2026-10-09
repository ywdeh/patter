
function inlineMarkdown(node) {
	if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
	if (node.nodeType !== Node.ELEMENT_NODE) return '';
	if (node.tagName === 'BR') return '\n';
	const content = Array.from(node.childNodes, inlineMarkdown).join('');
	if (node.tagName === 'STRONG' || node.tagName === 'B') return `**${content}**`;
	if (node.tagName === 'EM' || node.tagName === 'I') return `*${content}*`;
	return content;
}

function blockMarkdown(node) {
	if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
	if (node.nodeType !== Node.ELEMENT_NODE) return '';
	if (node.tagName === 'UL') {
		return Array.from(node.children).filter((child) => child.tagName === 'LI').map((item) => `- ${inlineMarkdown(item)}`).join('\n');
	}
	if (/^H[1-3]$/u.test(node.tagName)) return `${'#'.repeat(Number(node.tagName[1]))} ${inlineMarkdown(node)}`;
	return inlineMarkdown(node);
}

export function serializeEditorMarkdown(element) {
	return Array.from(element.childNodes, blockMarkdown).join('\n');
}
