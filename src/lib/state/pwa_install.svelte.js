export const pwa_install = $state({ available: false, standalone: false, installed: false });

let install_prompt = null;

export function mount_pwa_install() {
    let mounted = true;
    let detection_version = 0;
    const detect_installed = async () => {
        if (typeof navigator.getInstalledRelatedApps !== 'function') return;
        const current_version = ++detection_version;
        try {
            const apps = await navigator.getInstalledRelatedApps();
            if (!mounted || current_version !== detection_version) return;
            const manifest_url = new URL('/manifest.webmanifest', location.origin).href;
            const app_id = new URL('/', location.origin).href;
            pwa_install.installed = apps.some((app) => app.platform === 'webapp' &&
                ((app.url && new URL(app.url, location.origin).href === manifest_url) ||
                 (app.id && new URL(app.id, location.origin).href === app_id)));
        } catch {}
    };
    const display_mode = window.matchMedia('(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)');
    const update_display_mode = () => {
        pwa_install.standalone = display_mode.matches || window.navigator.standalone === true;
    };
    const capture_prompt = (event) => {
        event.preventDefault();
        install_prompt = event;
        pwa_install.available = true;
        pwa_install.installed = false;
    };
    const installed = () => {
        detection_version++;
        pwa_install.installed = true;
        install_prompt = null;
        pwa_install.available = false;
        update_display_mode();
    };

    update_display_mode();
    void detect_installed();
    window.addEventListener('focus', detect_installed);
    display_mode.addEventListener('change', update_display_mode);
    window.addEventListener('beforeinstallprompt', capture_prompt);
    window.addEventListener('appinstalled', installed);

    return () => {
        mounted = false;
        window.removeEventListener('focus', detect_installed);
        display_mode.removeEventListener('change', update_display_mode);
        window.removeEventListener('beforeinstallprompt', capture_prompt);
        window.removeEventListener('appinstalled', installed);
        install_prompt = null;
        pwa_install.available = false;
    };
}

export async function prompt_pwa_install() {
    if (pwa_install.standalone) return;
    if (pwa_install.installed) {
        window.location.href = 'web+patter://open';
        return;
    }
    if (!install_prompt || pwa_install.standalone) return;
    const prompt = install_prompt;
    install_prompt = null;
    pwa_install.available = false;
    try {
        await prompt.prompt();
        await prompt.userChoice;
    } catch (error) {
        console.error('Could not open the Patter installation prompt', error);
    }
}
