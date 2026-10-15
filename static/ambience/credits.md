# Ambient recordings

Rain, flute, and campfire recordings supplied by the project owner. Original source and license information were not provided.

Optimized copies retain the full recording and original channel count. Encoded as variable-bitrate MP3 (LAME quality 5, 44.1 kHz), without embedded metadata or artwork.

Recordings are loudness-normalized to -23 LUFS with a -3 dBTP encoding target. The player prepares an equal-power overlap between each recording's tail and head once after decoding, using the shared gentle motion duration (600 ms). Native Web Audio looping then repeats that buffer without relying on background timers.

Every decoded loop, including future tracks, also receives automatic gated RMS normalization in ambient_normalization.js. It ignores silence, targets -26 dBFS RMS, limits boost to 18 dB, and caps sample peaks at -3 dBFS. This is approximate level matching, not an in-browser LUFS measurement; sounds with sharp peaks may remain quieter to preserve headroom. Processing happens once per loaded buffer and does not alter the MP3 files.

