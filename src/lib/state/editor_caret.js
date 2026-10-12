export const CUSTOM_CARET_ENABLED = true;

const CARET_WIDTH = 2;
const CARET_LEFT_PADDING = 1;
const EMPTY_CARET_LEFT_OFFSET = 4;
const CARET_COLOR = 'currentColor';
const BLINK_DURATION = '1s';
const STYLE_ID = 'patter-custom-caret-style';

function ensureStyles() {
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.textContent = `
		@keyframes patter-caret-blink {
			0%, 48% { opacity: var(--patter_custom_caret_visible_opacity, 1); }
			49%, 100% { opacity: 0; }
		}
		.patter-custom-caret {
			position: absolute;
			z-index: 5;
			width: ${CARET_WIDTH}px;
			border-radius: 9999px;
			pointer-events: none;
			user-select: none;
			visibility: hidden;
			animation: patter-caret-blink ${BLINK_DURATION} steps(1, end) infinite;
		}
		@media (prefers-reduced-motion: reduce) {
			.patter-custom-caret { animation: none; opacity: var(--patter_custom_caret_visible_opacity, 1); }
		}
	`;
	document.head.append(style);
}

function getLineHeight(editor, range) {
	const node = range.startContainer;
	const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
	const lineContainer = element?.closest('p, h1, h2, h3, li, blockquote, pre, div') ?? editor;
	const style = getComputedStyle(lineContainer);
	const fontSize = Number.parseFloat(style.fontSize) || 16;
	return Number.parseFloat(style.lineHeight) || fontSize * 1.5;
}

export function getCaretRect(range, editor) {
	if (!range?.collapsed || !editor?.contains(range.startContainer)) return null;

	const editorStyle = getComputedStyle(editor);
	const editorRect = editor.getBoundingClientRect();
	const lineHeight = getLineHeight(editor, range);
	if (!editor.textContent?.length) {
		return {
			left: editorRect.left + (Number.parseFloat(editorStyle.paddingLeft) || 0),
			top: range.startContainer.nodeType === Node.ELEMENT_NODE
				? range.startContainer.getBoundingClientRect().top + (Number.parseFloat(getComputedStyle(range.startContainer).paddingTop) || 0)
				: editorRect.top + (Number.parseFloat(editorStyle.paddingTop) || 0),
			width: 0,
			height: lineHeight
		};
	}

	// Prefer the browser's native collapsed-range geometry. Inserting a measuring
	// marker here mutates the editable DOM and can make the first typed character
	// move the live selection into a neighboring line.
	const nativeRect = range.getBoundingClientRect();
	if (nativeRect.height > 0) {
		return { left: nativeRect.left, top: nativeRect.top, width: nativeRect.width, height: nativeRect.height };
	}

	const startContainer = range.startContainer;
	const startOffset = range.startOffset;
	const marker = document.createElement('span');
	marker.setAttribute('aria-hidden', 'true');
	marker.style.cssText = `display:inline-block;width:0;height:${lineHeight}px;overflow:hidden;vertical-align:top;pointer-events:none;`;
	const probe = range.cloneRange();
	probe.insertNode(marker);
	const markerRect = marker.getBoundingClientRect();
	const previous = marker.previousSibling;
	const next = marker.nextSibling;
	marker.remove();

	if (startContainer.nodeType === Node.TEXT_NODE && previous === startContainer && next?.nodeType === Node.TEXT_NODE) {
		startContainer.appendData(next.data);
		next.remove();
	}

	const safeOffset = startContainer.nodeType === Node.TEXT_NODE
		? Math.min(startOffset, startContainer.length)
		: Math.min(startOffset, startContainer.childNodes.length);
	const selection = window.getSelection();
	if (selection && (selection.anchorNode !== startContainer || selection.anchorOffset !== safeOffset)) {
		selection.collapse(startContainer, safeOffset);
	}

	if (markerRect.height <= 0) return null;
	return { left: markerRect.left, top: markerRect.top, width: 0, height: markerRect.height };
}

export function mountCustomCaret(scroller, editor) {
	if (!CUSTOM_CARET_ENABLED || !scroller || !editor) return () => {};

	ensureStyles();
	const caret = document.createElement('span');
	caret.className = 'patter-custom-caret';
	caret.setAttribute('aria-hidden', 'true');
	caret.style.backgroundColor = CARET_COLOR;
	scroller.append(caret);

	const originalCaretColor = editor.style.caretColor;
	let frame = 0;
	let lastPosition = null;
	let destroyed = false;

	function showNativeCaret() {
		caret.style.visibility = 'hidden';
		editor.style.caretColor = originalCaretColor;
	}

	function restartBlink() {
		caret.style.animation = 'none';
		void caret.offsetWidth;
		caret.style.animation = '';
	}

	function update() {
		frame = 0;
		if (destroyed) return;
		const selection = window.getSelection();
		const focused = document.activeElement === editor || editor.contains(document.activeElement);
		if (!focused || !selection?.isCollapsed || !selection.rangeCount || !editor.contains(selection.anchorNode)) {
			lastPosition = null;
			showNativeCaret();
			return;
		}

		const rect = getCaretRect(selection.getRangeAt(0), editor);
		if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) || !Number.isFinite(rect.height) || rect.height <= 0) {
			lastPosition = null;
			showNativeCaret();
			return;
		}

		const bounds = scroller.getBoundingClientRect();
		const isEmpty = editor.dataset.empty === 'true';
		const left = rect.left - bounds.left + scroller.scrollLeft - scroller.clientLeft
			+ CARET_LEFT_PADDING - (isEmpty ? EMPTY_CARET_LEFT_OFFSET : 0);
		const top = rect.top - bounds.top + scroller.scrollTop - scroller.clientTop;
		const height = rect.height;
		const moved = !lastPosition
			|| Math.abs(lastPosition.left - left) > 0.25
			|| Math.abs(lastPosition.top - top) > 0.25
			|| Math.abs(lastPosition.height - height) > 0.25;

		caret.style.left = `${left}px`;
		caret.style.top = `${top}px`;
		caret.style.height = `${height}px`;
		caret.style.color = getComputedStyle(editor).color;
		caret.style.setProperty(
			'--patter_custom_caret_visible_opacity',
			isEmpty ? 'var(--patter_opacity_placeholder, 0.3)' : '1'
		);
		caret.style.visibility = 'visible';
		editor.style.caretColor = 'transparent';
		lastPosition = { left, top, height };
		if (moved) restartBlink();
	}

	function schedule() {
		if (!frame) frame = requestAnimationFrame(update);
	}

	function updateNow() {
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
		update();
	}

	document.addEventListener('selectionchange', schedule);
	editor.addEventListener('focus', schedule);
	editor.addEventListener('blur', updateNow);
	editor.addEventListener('input', updateNow);
	editor.addEventListener('keyup', schedule);
	editor.addEventListener('mouseup', schedule);
	editor.addEventListener('compositionend', updateNow);
	scroller.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule);
	schedule();

	return () => {
		destroyed = true;
		if (frame) cancelAnimationFrame(frame);
		document.removeEventListener('selectionchange', schedule);
		editor.removeEventListener('focus', schedule);
		editor.removeEventListener('blur', updateNow);
		editor.removeEventListener('input', updateNow);
		editor.removeEventListener('keyup', schedule);
		editor.removeEventListener('mouseup', schedule);
		editor.removeEventListener('compositionend', updateNow);
		scroller.removeEventListener('scroll', schedule);
		window.removeEventListener('resize', schedule);
		editor.style.caretColor = originalCaretColor;
		caret.remove();
	};
}


