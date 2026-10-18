import { countEditorText } from './editor_counts.js';

self.onmessage = ({ data }) => {
    self.postMessage({ version: data.version, counts: countEditorText(data.text) });
};
