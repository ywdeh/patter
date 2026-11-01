<script>
    import Button from '$lib/components/button.svelte';
    import { motionDuration } from '$lib/state/motion.js';
    import { playSound } from '$lib/state/sound.js';

    function accordion(node) {
        const summary = node.querySelector('summary');
        const content = node.querySelector('.accordion_content');
        let expanded = node.open;
        let animation;
        const toggle = (event) => {
            event.preventDefault();
            const start = node.open ? content.getBoundingClientRect().height : 0;
            const opacity = node.open ? Number(getComputedStyle(content).opacity) : 0;
            animation?.cancel();
            expanded = !expanded;
            summary.setAttribute('aria-expanded', String(expanded));
            node.dataset.expanded = String(expanded);
            content.inert = !expanded;
            playSound('click');
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                node.open = expanded;
                content.style.removeProperty('overflow');
                return;
            }
            node.open = true;
            const end = expanded ? content.getBoundingClientRect().height : 0;
            content.style.overflow = 'hidden';
            animation = content.animate({ height: [`${start}px`, `${end}px`], opacity: [opacity, expanded ? 1 : 0] }, {
                duration: motionDuration('standard', 200),
                easing: 'cubic-bezier(0.23, 1, 0.32, 1)'
            });
            animation.onfinish = () => {
                node.open = expanded;
                content.style.removeProperty('overflow');
                animation = null;
            };
        };
        node.dataset.expanded = String(expanded);
        summary.setAttribute('aria-expanded', String(expanded));
        content.inert = !expanded;
        summary.addEventListener('click', toggle);
        return { destroy() { animation?.cancel(); summary.removeEventListener('click', toggle); } };
    }

</script>

<svelte:head>
    <title>Privacy policy - Patter</title>
    <meta name="description" content="What Patter stores on your device and how usage analytics works." />
</svelte:head>

<main class="privacy_page patter_page_frame">
    <article class="privacy_content patter_text_main">
        <nav class="patter_editor_controls" aria-label="Page navigation"><Button href="/" text="Back to Patter" icon="/chevron_left.svg" /></nav>
        <header data-selectable-text>
            <h1>Privacy policy</h1>
            <p class="privacy_intro patter_text_secondary">Patter values your privacy and comfort. Here you can see what<br>information we collect and what we do with it.</p>
            <p class="patter_text_small patter_text_muted">Updated <time datetime="2026-11-01">1 November 2026</time></p>
        </header>

        <div class="privacy_sections">
            <details use:accordion open>
                <summary class="patter_control patter_unselectable group/hitbox" data-ui-hover-sound="true"><h2>Your writing</h2><span class="accordion_toggle patter_control_round" aria-hidden="true"><span class="patter_surface patter_hover patter_active patter_surface_gradient absolute inset-0 rounded-full pointer-events-none"></span><svg class="patter_icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 6 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></span></summary>
                <div class="accordion_content"><div class="privacy_answer" data-selectable-text>
                    <p>Patter does not collect your writing or files, and never saves their contents to a server. Everything you write or import is processed locally in your browser.</p>
                </div></div>
            </details>
            <details use:accordion>
                <summary class="patter_control patter_unselectable group/hitbox" data-ui-hover-sound="true"><h2>Usage analytics</h2><span class="accordion_toggle patter_control_round" aria-hidden="true"><span class="patter_surface patter_hover patter_active patter_surface_gradient absolute inset-0 rounded-full pointer-events-none"></span><svg class="patter_icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 6 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></span></summary>
                <div class="accordion_content"><div class="privacy_answer" data-selectable-text>
                    <p>Basic analytics helps understand how Patter is used, including visits, feature usage, and time spent in the editor. These usage statistics are sent to an analytics service, but do not include your writing or file contents.</p>
                </div></div>
            </details>
            <details use:accordion>
                <summary class="patter_control patter_unselectable group/hitbox" data-ui-hover-sound="true"><h2>Saved data</h2><span class="accordion_toggle patter_control_round" aria-hidden="true"><span class="patter_surface patter_hover patter_active patter_surface_gradient absolute inset-0 rounded-full pointer-events-none"></span><svg class="patter_icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m5 6 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></span></summary>
                <div class="accordion_content"><div class="privacy_answer" data-selectable-text>
                    <p>Your writing, snapshots, custom backgrounds, and settings are saved in your browser. Clearing this site's data in your browser settings and reloading returns Patter to its original state. This does not delete usage statistics already collected.</p>
                </div></div>
            </details>
        </div>
        <footer class="patter_text_small patter_text_muted" data-selectable-text>Questions? <a href="mailto:patter@hedwy.art">patter@hedwy.art</a></footer>
    </article>
</main>

<style>
    .privacy_page {
        height: var(--patter_viewport_height, 100dvh);
        overflow-y: auto;
    }
    .privacy_content { max-width: 40rem; margin-inline: auto; }
    nav { display: flex; justify-content: flex-start; margin-bottom: var(--patter_space_16); }
    header { display: grid; justify-items: center; gap: var(--patter_space_4); text-align: center; margin-bottom: var(--patter_space_12); }
    h1 { font-family: var(--patter_font_header); font-size: clamp(2.5rem, 7vw, 4.5rem); line-height: 1.1; letter-spacing: -0.025em; text-wrap: balance; }
    .privacy_intro { line-height: 1.6; }
    p { margin: 0; }
    .privacy_sections { display: grid; }
    details { position: relative; }
    details::before { content: ''; position: absolute; inset: 0 0 auto; height: 1px; background: var(--patter_divider); pointer-events: none; }
    summary { display: flex; align-items: center; justify-content: space-between; gap: var(--patter_space_4); padding-block: var(--patter_space_4); min-height: var(--patter_control_height); cursor: pointer; list-style: none; border-radius: var(--patter_space_3); transition: var(--patter_focus_transition); }
    summary::-webkit-details-marker { display: none; }
    summary:focus-visible { outline: none; background: var(--patter_surface_fill); box-shadow: 0 0 0 var(--patter_space_2) var(--patter_surface_fill); }
    h2 { font: inherit; font-size: 1.125rem; }
    .accordion_toggle { position: relative; display: grid; place-items: center; width: var(--patter_control_height); height: var(--patter_control_height); flex-shrink: 0; }
    summary svg { position: relative; width: 1rem; height: 1rem; transition: transform var(--patter_motion_standard) cubic-bezier(0.23, 1, 0.32, 1); }
    details[open]:not([data-expanded='false']) summary svg { transform: rotate(180deg); }
    .privacy_answer { display: grid; gap: var(--patter_space_4); padding: 0 calc(var(--patter_control_height) + var(--patter_space_4)) var(--patter_space_6) 0; opacity: var(--patter_opacity_secondary); line-height: 1.65; }
    footer { margin-top: var(--patter_space_12); text-align: center; }
    a { color: inherit; text-decoration: none; border-bottom: 2px solid var(--patter_surface_normal); overflow-wrap: anywhere; transition: border-color var(--patter_motion_short) ease-out; }
    @media (hover: hover) and (pointer: fine) { a:hover { border-color: currentColor; } }
    @media (prefers-reduced-motion: reduce) { summary svg { transition: none; } }
    @media (max-width: 639px) {
        nav { margin-bottom: var(--patter_space_12); }
        header { margin-bottom: var(--patter_space_8); }
        .privacy_answer { padding-right: 0; }
    }
</style>
