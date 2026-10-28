// Only the dedicated demo build uses browser-only authentication and checkout.
export const IS_DEMO = import.meta.env.MODE === 'demo';
export const IS_PREPRODUCTION = import.meta.env.MODE === 'preproduction';
