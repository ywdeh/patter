const target_rms_db = -26;
const peak_ceiling_db = -3;
const maximum_boost_db = 18;
const silence_threshold_db = -60;

export function normalize_ambient_buffer(buffer) {
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
    if (!channels.length || !buffer.length) return buffer;

    const block_size = Math.max(1, Math.round(buffer.sampleRate * 0.4));
    const silence_energy = 10 ** (silence_threshold_db / 10);
    const blocks = [];
    let peak = 0;
    let energy_sum = 0;
    let sample_count = 0;

    for (let start = 0; start < buffer.length; start += block_size) {
        const end = Math.min(start + block_size, buffer.length);
        let energy = 0;
        for (const channel of channels) {
            for (let index = start; index < end; index++) {
                const sample = channel[index];
                energy += sample * sample;
                peak = Math.max(peak, Math.abs(sample));
            }
        }
        const count = (end - start) * channels.length;
        if (energy / count > silence_energy) {
            blocks.push({ energy, count });
            energy_sum += energy;
            sample_count += count;
        }
    }

    if (!sample_count || !peak) return buffer;
    const relative_threshold = (energy_sum / sample_count) / 10;
    energy_sum = 0;
    sample_count = 0;
    for (const block of blocks) {
        if (block.energy / block.count >= relative_threshold) {
            energy_sum += block.energy;
            sample_count += block.count;
        }
    }
    if (!sample_count) return buffer;

    const rms = Math.sqrt(energy_sum / sample_count);
    const gain = Math.min(
        10 ** (target_rms_db / 20) / rms,
        10 ** (peak_ceiling_db / 20) / peak,
        10 ** (maximum_boost_db / 20)
    );
    for (const channel of channels) {
        for (let index = 0; index < channel.length; index++) channel[index] *= gain;
    }
    return buffer;
}
