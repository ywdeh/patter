import fs from 'node:fs/promises';
import sharp from 'sharp';

const sourcePath = 'unused/media_ripples.svg';
const outputPath = 'unused/ripples.webp';
const durationMs = 12_000;
const framesPerSecond = 15;
const frameCount = (durationMs / 1000) * framesPerSecond;
const width = 1000;
const height = 438;
const keyPoint = 0.5007;

function cubicBezier(progress, x1, y1, x2, y2) {
	let lower = 0;
	let upper = 1;
	let t = progress;
	for (let i = 0; i < 16; i += 1) {
		const inverse = 1 - t;
		const x = 3 * inverse * inverse * t * x1 + 3 * inverse * t * t * x2 + t * t * t;
		if (x < progress) lower = t;
		else upper = t;
		t = (lower + upper) / 2;
	}
	const inverse = 1 - t;
	return 3 * inverse * inverse * t * y1 + 3 * inverse * t * t * y2 + t * t * t;
}

function animatedValue(progress, start, middle, end, firstCurve, secondCurve) {
	if (progress <= keyPoint) {
		const amount = cubicBezier(progress / keyPoint, ...firstCurve);
		return start + (middle - start) * amount;
	}
	const amount = cubicBezier((progress - keyPoint) / (1 - keyPoint), ...secondCurve);
	return middle + (end - middle) * amount;
}

function makeStaticSvg(template, opacity, displacementScale) {
	let svg = template.replace(/<style>[\s\S]*?<\/style>/, '');
	svg = svg.replace('id="Vector" opacity="0.04"', `id="Vector" opacity="${opacity}"`);
	svg = svg.replace('scale="110"', `scale="${displacementScale}"`);
	const animationStart = svg.indexOf('<animate attributeName="scale"');
	if (animationStart >= 0) {
		const animationEnd = svg.indexOf('/>', animationStart) + 2;
		svg = svg.slice(0, animationStart) + svg.slice(animationEnd);
	}
	return Buffer.from(svg);
}

const template = await fs.readFile(sourcePath, 'utf8');
const delays = Array.from({ length: frameCount }, (_, index) =>
	Math.floor((index + 1) * durationMs / frameCount) - Math.floor(index * durationMs / frameCount)
);
const frameBuffers = [];

for (let index = 0; index < frameCount; index += 1) {
	const progress = index / frameCount;
	const opacity = animatedValue(progress, 0.04, 0.7, 0.04, [0.5, 0, 0.5, 1], [0.5, 0, 0.5, 1]);
	const displacementScale = animatedValue(progress, 110, 200, 110, [0.42, 0, 0.58, 1], [0.5, 0, 0.5, 1]);
	const frame = await sharp(makeStaticSvg(template, opacity.toFixed(5), displacementScale.toFixed(2)))
		.ensureAlpha()
		.raw()
		.toBuffer();
	frameBuffers.push(frame);
	if ((index + 1) % 30 === 0) console.log(`Rendered ${index + 1}/${frameCount} frames`);
}

await fs.mkdir('unused', { recursive: true });
await sharp(Buffer.concat(frameBuffers), {
	raw: { width, height: height * frameCount, channels: 4, pageHeight: height }
})
	.webp({ quality: 82, alphaQuality: 100, effort: 6, loop: 0, delay: delays })
	.toFile(outputPath);

console.log(`Wrote ${outputPath} (${frameCount} frames, ${durationMs} ms loop)`);
