/**
 * Shared API helpers for admin screens.
 * Uses wp.apiFetch with REST nonce from wpdAdmin.
 */

const apiFetch = window.wp?.apiFetch;

/**
 * Attach REST nonce to apiFetch for the current admin session.
 * Call once before any REST request (e.g. in load/save).
 */
export function setApiDefaults() {
    if (!apiFetch) return;
    const nonce = window.wpdAdmin?.nonce;
    if (!nonce) return;
    apiFetch.use(apiFetch.createNonceMiddleware(nonce));
}

export { apiFetch };
