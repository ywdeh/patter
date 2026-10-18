export const pwa_install = $state({ available: false, standalone: false });

let install_prompt = null;

export function mount_pwa_install() {
    const display_mode = window.matchMedia('(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)');
    const update_display_mode = () => {
        pwa_install.standalone = display_mode.matches || window.navigator.standalone === true;
    };
    const capture_prompt = (event) => {
        event.preventDefault();
        install_prompt = event;
        pwa_install.available = true;
    };
    const installed = () => {
        install_prompt = null;
        pwa_install.available = false;
        update_display_mode();
    };

    update_display_mode();
    display_mode.addEventListener('change', update_display_mode);
    window.addEventListener('beforeinstallprompt', capture_prompt);
    window.addEventListener('appinstalled', installed);

    return () => {
        display_mode.removeEventListener('change', update_display_mode);
        window.removeEventListener('beforeinstallprompt', capture_prompt);
        window.removeEventListener('appinstalled', installed);
        install_prompt = null;
        pwa_install.available = false;
    };
}

export async function prompt_pwa_install() {
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
