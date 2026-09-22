import { createElement } from 'lwc';
import McpAdminFriend from 'c/mcpAdminFriend';
import getContext from '@salesforce/apex/McpAdminFriendController.getContext';
import getObjects from '@salesforce/apex/McpAdminFriendController.getObjects';
import getMetadata from '@salesforce/apex/McpAdminFriendController.getMetadata';
import getRecentRecords from '@salesforce/apex/McpAdminFriendController.getRecentRecords';

jest.mock('@salesforce/apex/McpAdminFriendController.getContext', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/McpAdminFriendController.getObjects', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/McpAdminFriendController.getMetadata', () => ({ default: jest.fn() }), { virtual: true });
jest.mock('@salesforce/apex/McpAdminFriendController.getRecentRecords', () => ({ default: jest.fn() }), { virtual: true });

const flush = async () => { for (let index = 0; index < 15; index++) await Promise.resolve(); };
const opportunity = { apiName: 'Opportunity', label: 'Opportunity', pluralLabel: 'Opportunities',
    isQueryable: true, isSearchable: true, isCreateable: true, isUpdateable: true, isDeletable: true, isCustom: false, keyPrefix: '006' };
const account = { ...opportunity, apiName: 'Account', label: 'Account', pluralLabel: 'Accounts' };
const field = { apiName: 'Name', label: 'Opportunity Name', dataType: 'STRING', length: 120,
    precision: 0, scale: 0, isNillable: false, isRequired: true, isCreateable: true, isUpdateable: true, isCustom: false, referenceTargets: [] };
const record = { recordId: '006000000000001AAA', displayLabel: 'New opportunity', fields: [
    { apiName: 'Id', label: 'Record ID', dataType: 'ID', value: '006000000000001AAA' },
    { apiName: 'Name', label: 'Opportunity Name', dataType: 'STRING', value: 'New opportunity' }
] };
const command = (type, payload = {}) => ({ version: '1.0', source: 'testHost', type,
    timestamp: '2026-09-21T12:00:00.000Z', correlationId: 'host-123', payload });

function mount() {
    const element = createElement('c-mcp-admin-friend', { is: McpAdminFriend });
    const events = [];
    element.addEventListener('adminfriendaction', (event) => events.push({
        bubbles: event.bubbles,
        composed: event.composed,
        rawDetail: event.detail,
        detail: JSON.parse(event.detail)
    }));
    document.body.appendChild(element);
    return { element, events };
}

beforeEach(() => {
    getContext.mockResolvedValue({ fullName: 'Admin User', username: 'admin@example.invalid', userId: '005000000000001AAA',
        email: 'admin@example.invalid', profileName: 'System Administrator', userType: 'Standard', organizationName: 'Test Org', organizationId: '00D000000000001AAA' });
    getObjects.mockResolvedValue([opportunity, account]);
    getMetadata.mockResolvedValue({ objectInfo: opportunity, fields: [field] });
    getRecentRecords.mockResolvedValue([record]);
});
afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    jest.resetAllMocks();
});

it('loads identity and summaries, signals readiness and keeps detail tabs disabled', async () => {
    const { element, events } = mount();
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('lightning-spinner')).not.toBeNull();
    await flush();
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getObjects).toHaveBeenCalledTimes(1);
    expect(getMetadata).not.toHaveBeenCalled();
    expect(getRecentRecords).not.toHaveBeenCalled();
    expect(element.shadowRoot.textContent).toContain('Admin User');
    expect(element.shadowRoot.querySelector('[data-tab="metadata"]').disabled).toBe(true);
    expect(events.map((event) => event.detail.type)).toEqual(['context.loaded', 'component.ready']);
    for (const event of events) {
        expect(event.bubbles).toBe(true);
        expect(event.composed).toBe(true);
        expect(typeof event.rawDetail).toBe('string');
        expect(event.detail).toMatchObject({ version: '1.0', source: 'mcpAdminFriend', correlationId: expect.any(String) });
        expect(Number.isFinite(Date.parse(event.detail.timestamp))).toBe(true);
        expect(JSON.parse(JSON.stringify(event.detail))).toEqual(event.detail);
    }
});

it('selects Opportunity from the host, loads only that object and sends displayed fields on explicit action', async () => {
    const { element, events } = mount();
    const result = await element.handleHostAction(command('object.select', { objectApiName: 'Opportunity' }));
    await flush();
    expect(result).toEqual({ success: true, type: 'object.select', correlationId: 'host-123' });
    expect(getMetadata).toHaveBeenCalledWith({ objectApiName: 'Opportunity' });
    expect(getRecentRecords).toHaveBeenCalledWith({ objectApiName: 'Opportunity' });
    expect(element.shadowRoot.querySelector('[data-tab="metadata"]').getAttribute('aria-selected')).toBe('true');
    element.shadowRoot.querySelector('.field-choice').click();
    expect(events.at(-1).detail).toMatchObject({ type: 'field.selected', payload: { field, object: opportunity } });
    await element.handleHostAction(command('tab.select', { tab: 'records' }));
    await flush();
    element.shadowRoot.querySelector('[data-id]').click();
    await flush();
    expect(events.some((event) => event.detail.type === 'record.selected')).toBe(false);
    element.shadowRoot.querySelector('lightning-button').click();
    await flush();
    expect(events.at(-1).detail).toMatchObject({ type: 'record.selected', payload: {
        objectApiName: 'Opportunity', objectLabel: 'Opportunity', recordId: record.recordId,
        recordDisplayLabel: record.displayLabel, fields: record.fields, originatingAction: 'user.sendRecord'
    } });
    expect(element.shadowRoot.textContent).toContain('sent to host');
    // Detached event values must not allow a host to mutate the component state.
    events.at(-1).detail.payload.fields[1].value = 'tampered';
    element.shadowRoot.querySelector('lightning-button').click();
    expect(events.at(-1).detail.payload.fields[1].value).toBe('New opportunity');
});

it('preserves selection across tabs and supports keyboard tab navigation', async () => {
    const { element } = mount();
    await flush();
    element.shadowRoot.querySelector('[data-name="Opportunity"]').click();
    await flush();
    const tab = element.shadowRoot.querySelector('[data-tab="metadata"]');
    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await flush();
    expect(element.shadowRoot.querySelector('[data-tab="records"]').getAttribute('aria-selected')).toBe('true');
    await element.handleHostAction(command('tab.select', { tab: 'admin' }));
    await flush();
    expect(element.shadowRoot.querySelector('[data-name="Opportunity"]').getAttribute('aria-pressed')).toBe('true');
});

it('handles mirrored inbound commands and renders notification text without HTML execution', async () => {
    const { element } = mount();
    await flush();
    element.dispatchEvent(new CustomEvent('adminfriendcommand', {
        detail: JSON.stringify(command('ui.notify', { message: '<script>alert(1)</script>' }))
    }));
    await flush();
    expect(element.shadowRoot.querySelector('[role="status"]').textContent).toBe('<script>alert(1)</script>');
    expect(element.shadowRoot.querySelector('script')).toBeNull();
});

it.each([null, [], {}, command('unsupported'), command('tab.select', { tab: 'bad' }),
    command('tab.select', { tab: 'records' }), command('object.select', { objectApiName: 'Account LIMIT 1' }),
    command('ui.notify', { message: '' }), command('metadata.refresh'), command('records.refresh')])(
    'safely rejects malformed or unavailable commands: %j', async (message) => {
        const { element, events } = mount();
        const result = await element.handleHostAction(message);
        expect(result.success).toBe(false);
        expect(typeof result.error).toBe('string');
        expect(events.some((event) => event.detail.type === 'component.error')).toBe(true);
        expect(() => JSON.stringify(result)).not.toThrow();
    }
);

it('refreshes context, metadata and records using fresh Apex requests and original correlation IDs', async () => {
    const { element, events } = mount();
    await flush();
    await element.handleHostAction(command('context.refresh'));
    expect(events.at(-1).detail).toMatchObject({ type: 'context.refreshed', correlationId: 'host-123' });
    await element.handleHostAction(command('object.select', { objectApiName: 'Opportunity' }));
    await element.handleHostAction(command('metadata.refresh'));
    await element.handleHostAction(command('records.refresh'));
    expect(getContext).toHaveBeenCalledTimes(2);
    expect(getMetadata).toHaveBeenCalledTimes(2);
    expect(getRecentRecords).toHaveBeenCalledTimes(2);
});

it('shows empty records and searchable object and field empty states', async () => {
    getRecentRecords.mockResolvedValue([]);
    const { element } = mount();
    await flush();
    const search = element.shadowRoot.querySelector('lightning-input');
    search.value = 'no matching object';
    search.dispatchEvent(new CustomEvent('change'));
    await flush();
    expect(element.shadowRoot.textContent).toContain('No accessible objects match');
    await element.handleHostAction(command('object.select', { objectApiName: 'Opportunity' }));
    await flush();
    const fieldSearch = element.shadowRoot.querySelector('lightning-input');
    fieldSearch.value = 'no matching field';
    fieldSearch.dispatchEvent(new CustomEvent('change'));
    await flush();
    expect(element.shadowRoot.textContent).toContain('No readable fields match');
    await element.handleHostAction(command('tab.select', { tab: 'records' }));
    await flush();
    expect(element.shadowRoot.textContent).toContain('No recent records are available');
});

it('reports loading errors without claiming an object command succeeded', async () => {
    getRecentRecords.mockRejectedValue({ body: { message: 'Access changed. Please refresh.' } });
    const { element, events } = mount();
    const result = await element.handleHostAction(command('object.select', { objectApiName: 'Opportunity' }));
    expect(result.success).toBe(false);
    await element.handleHostAction(command('tab.select', { tab: 'records' }));
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('Access changed');
    expect(events.find((event) => event.detail.type === 'component.error').detail.correlationId).toBe('host-123');
});

it('remains command-ready when initial context and object retrieval fail', async () => {
    getContext.mockRejectedValue(new Error('Context unavailable'));
    getObjects.mockRejectedValue(new Error('Objects unavailable'));
    const { element, events } = mount();
    await flush();
    expect(events.at(-1).detail).toMatchObject({ type: 'component.ready', payload: { contextAvailable: false } });
    expect(element.shadowRoot.querySelectorAll('[role="alert"]')).toHaveLength(2);
    getObjects.mockResolvedValue([opportunity]);
    element.shadowRoot.querySelector('lightning-button-icon[title="Reload object selector"]').click();
    await flush();
    expect(element.shadowRoot.querySelector('[data-name="Opportunity"]')).not.toBeNull();
});

it('ignores stale detail responses when another object is selected', async () => {
    let finishMetadata;
    let finishRecords;
    getMetadata.mockImplementationOnce(() => new Promise((resolve) => { finishMetadata = resolve; }));
    getRecentRecords.mockImplementationOnce(() => new Promise((resolve) => { finishRecords = resolve; }));
    const { element } = mount();
    await flush();
    const first = element.handleHostAction(command('object.select', { objectApiName: 'Opportunity' }));
    await flush();
    getMetadata.mockResolvedValue({ objectInfo: account, fields: [] });
    getRecentRecords.mockResolvedValue([]);
    const second = await element.handleHostAction(command('object.select', { objectApiName: 'Account' }));
    finishMetadata({ objectInfo: opportunity, fields: [field] });
    finishRecords([record]);
    expect((await first).success).toBe(false);
    expect(second.success).toBe(true);
    await flush();
    expect(element.shadowRoot.querySelector('h2').textContent).toBe('Account metadata');
    await element.handleHostAction(command('tab.select', { tab: 'records' }));
    await flush();
    expect(element.shadowRoot.textContent).toContain('No recent records');
    expect(element.shadowRoot.querySelector('[data-id]')).toBeNull();
});
