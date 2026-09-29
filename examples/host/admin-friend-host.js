/** DOM-only test adapter. No MCP SDK and no authentication material. */
export function attachAdminFriend(component, onTrace) {
    if (!component) throw new Error('A Lightning Out component element is required.');
    const receive = (event) => {
        const envelope = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
        const entry = { direction: 'lwc-to-host', envelope: JSON.parse(JSON.stringify(envelope)) };
        console.info('[MCP Admin Friend] LWC to Host', entry.envelope);
        onTrace?.(entry);
    };
    component.addEventListener('adminfriendaction', receive);
    return { disconnect() { component.removeEventListener('adminfriendaction', receive); } };
}
