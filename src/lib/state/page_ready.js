let complete;
let readiness = new Promise((resolve) => { complete = resolve; });

export function begin_page_reveal() {
    complete();
    readiness = new Promise((resolve) => { complete = resolve; });
}

export function finish_page_reveal() {
    complete();
}

export async function wait_for_page_reveal() {
    let pending;
    do {
        pending = readiness;
        await pending;
    } while (pending !== readiness);
}
