/** DOM-only test adapter. No MCP SDK and no authentication material. */
export function attachAdminFriend(component, onTrace) {
    if (!component) throw new Error('A Lightning Out component element is required.');
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const record = (direction, envelope) => {
        const entry = { direction, envelope: clone(envelope) };
        const label = direction === 'host-to-lwc' ? 'Host → LWC' : 'LWC → Host';
        console.info(`[MCP Admin Friend] ${label}`, entry.envelope);
        onTrace?.(entry);
    };
    const receive = (event) => {
        const envelope = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
        record('lwc-to-host', envelope);
    };
    component.addEventListener('adminfriendaction', receive);
    return {
        send(type, payload = {}) {
            const envelope = {
                version: '1.0', source: 'adminFriendTestHost', type,
                timestamp: new Date().toISOString(), correlationId: crypto.randomUUID(), payload
            };
            record('host-to-lwc', envelope);
            // Keep the complete command on the DOM event path as a string.
            // Calling an @api method with an object makes Lightning Out run
            // structuredClone() against an LWS proxy before the LWC receives it.
            component.dispatchEvent(new CustomEvent('adminfriendcommand', {
                bubbles: true, composed: true, detail: JSON.stringify(envelope)
            }));
            // Dispatch confirms transport only, not asynchronous command success.
            return { dispatched: true, type, correlationId: envelope.correlationId };
        },
        disconnect() { component.removeEventListener('adminfriendaction', receive); }
    };
}
