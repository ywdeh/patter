<script>
    let {
        src,
        kind = 'image',
        selected = false,
        position = 'center',
        label = 'Select background',
        onselect,
        onposition
    } = $props();

    const positions = ['top', 'center', 'bottom'];
</script>

<div class="group/inputpill relative w-full aspect-video">
    <button
        type="button"
        onclick={onselect}
        aria-label={label}
        aria-pressed={selected}
        class="absolute inset-0 w-full cursor-pointer">
        <div
            class="media-viewport absolute inset-0 rounded-lg bg-center bg-size-[500%] patter_shadow overflow-hidden {selected ? 'is-selected' : ''}">
            {#if kind === 'video'}
                <video
                    class="absolute inset-0 h-full w-full object-cover"
                    style="transform: scale(5)"
                    src={src}
                    muted
                    loop
                    autoplay
                    playsinline
                    aria-hidden="true"></video>
            {:else}
                <div
                    class="absolute inset-0 bg-cover bg-center"
                    style={`background-image: url("${src}"); background-size: 500%`}></div>
            {/if}
        </div>
        <div
            class="absolute rounded-lg outline-2 outline-offset-2 patter_shadow pointer-events-none transition-[inset,border-radius,outline] duration-200 ease-out
            {selected
                ? 'inset-1 outline-mauve-100/40'
                : 'inset-0 outline-mauve-100/12 group-hover/inputpill:outline-mauve-100/24 group-hover/inputpill:inset-1 group-active/inputpill:inset-2'}"></div>
    </button>

    <div
        class="pointer-events-none absolute inset-0 z-10 grid grid-rows-3 gap-2 overflow-hidden rounded-lg p-2 opacity-0 transition-opacity duration-200 group-hover/inputpill:opacity-100 group-focus-within/inputpill:opacity-100 justify-end"
        role="group"
        aria-label="Choose image position">
        {#each positions as choice}
            <button
                type="button"
                onclick={() => onposition?.(choice)}
                aria-label={`${label}, align ${choice}`}
                aria-pressed={position === choice}
                class="pointer-events-auto relative aspect-square h-full cursor-pointer rounded-sm bg-mauve-100/40 transition-colors hover:bg-mauve-100/60 focus-visible:bg-mauve-100/60 {position === choice ? 'bg-mauve-100/45' : ''}"
            >
                {#if position === choice}
                    <span aria-hidden="true" class="pointer-events-none absolute inset-0 outline-2 outline-offset-2 rounded-sm outline-inset outline-mauve-100/55"></span>
                {/if}
            </button>
        {/each}
    </div>
</div>

<style>
    .media-viewport {
        clip-path: inset(0 round 0.5rem);
        transition: clip-path 200ms ease-out;
    }

    button:hover .media-viewport,
    button:focus-visible .media-viewport {
        clip-path: inset(0.25rem round 0.5rem);
    }

    button:active .media-viewport:not(.is-selected) {
        clip-path: inset(0.5rem round 0.5rem);
    }

    .media-viewport.is-selected {
        clip-path: inset(0.25rem round 0.5rem);
    }
</style>
