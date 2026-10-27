import { goto } from '$app/navigation';
import { finish_route_fade } from './page_motion.js';

let pending;

export function route_navigation_is_urgent() {
    return pending?.urgent === true;
}

export function navigate_route(href) {
    const destination = new URL(href, window.location.href).href;
    if (pending?.destination === destination) {
        pending.urgent = true;
        finish_route_fade();
        return pending.result;
    }
    const request = { destination, urgent: false, result: null };
    pending = request;
    request.result = goto(href);
    const clear = () => { if (pending === request) pending = null; };
    request.result.then(clear, clear);
    return request.result;
}
