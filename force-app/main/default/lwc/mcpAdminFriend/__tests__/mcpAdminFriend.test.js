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
function mount(objectApiName) {
    const element = createElement('c-mcp-admin-friend', { is: McpAdminFriend });
    if (objectApiName) element.objectApiName = objectApiName;
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
    expect(events).toHaveLength(0);
});

it('applies the initial object input and sends displayed fields on explicit actions', async () => {
    const { element, events } = mount('Opportunity');
    await flush();
    expect(getMetadata).toHaveBeenCalledWith({ objectApiName: 'Opportunity' });
    expect(getRecentRecords).toHaveBeenCalledWith({ objectApiName: 'Opportunity' });
    expect(element.shadowRoot.querySelector('[data-tab="metadata"]').getAttribute('aria-selected')).toBe('true');
    element.shadowRoot.querySelector('.field-choice').click();
    expect(events).toHaveLength(0);
    element.shadowRoot.querySelector('[data-tab="records"]').click();
    await flush();
    element.shadowRoot.querySelector('[data-id]').click();
    await flush();
    expect(events).toHaveLength(0);
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
    element.shadowRoot.querySelector('[data-tab="admin"]').click();
    await flush();
    expect(element.shadowRoot.querySelector('[data-name="Opportunity"]').getAttribute('aria-pressed')).toBe('true');
});

it('refreshes context, metadata and records without sending host events', async () => {
    const { element, events } = mount();
    await flush();
    element.shadowRoot.querySelector('lightning-button-icon[title="Refresh user context"]').click();
    await flush();
    expect(events).toHaveLength(0);
    element.shadowRoot.querySelector('[data-name="Opportunity"]').click();
    await flush();
    element.shadowRoot.querySelector('lightning-button-icon[title="Refresh metadata"]').click();
    element.shadowRoot.querySelector('[data-tab="records"]').click();
    await flush();
    element.shadowRoot.querySelector('lightning-button-icon[title="Refresh recent records"]').click();
    await flush();
    expect(getContext).toHaveBeenCalledTimes(2);
    expect(getMetadata).toHaveBeenCalledTimes(2);
    expect(getRecentRecords).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(0);
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
    search.value = '';
    search.dispatchEvent(new CustomEvent('change'));
    await flush();
    element.shadowRoot.querySelector('[data-name="Opportunity"]').click();
    await flush();
    const fieldSearch = element.shadowRoot.querySelector('lightning-input');
    fieldSearch.value = 'no matching field';
    fieldSearch.dispatchEvent(new CustomEvent('change'));
    await flush();
    expect(element.shadowRoot.textContent).toContain('No readable fields match');
    element.shadowRoot.querySelector('[data-tab="records"]').click();
    await flush();
    expect(element.shadowRoot.textContent).toContain('No recent records are available');
});

it('reports record loading errors from object selection', async () => {
    getRecentRecords.mockRejectedValue({ body: { message: 'Access changed. Please refresh.' } });
    const { element, events } = mount();
    await flush();
    element.shadowRoot.querySelector('[data-name="Opportunity"]').click();
    await flush();
    element.shadowRoot.querySelector('[data-tab="records"]').click();
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]').textContent).toContain('Access changed');
    expect(events).toHaveLength(0);
});

it('remains usable when initial context and object retrieval fail', async () => {
    getContext.mockRejectedValue(new Error('Context unavailable'));
    getObjects.mockRejectedValue(new Error('Objects unavailable'));
    const { element, events } = mount();
    await flush();
    expect(events).toHaveLength(0);
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
    element.shadowRoot.querySelector('[data-name="Opportunity"]').click();
    await flush();
    getMetadata.mockResolvedValue({ objectInfo: account, fields: [] });
    getRecentRecords.mockResolvedValue([]);
    element.shadowRoot.querySelector('[data-tab="admin"]').click();
    await flush();
    element.shadowRoot.querySelector('[data-name="Account"]').click();
    await flush();
    finishMetadata({ objectInfo: opportunity, fields: [field] });
    finishRecords([record]);
    await flush();
    expect(element.shadowRoot.querySelector('h2').textContent).toBe('Account metadata');
    element.shadowRoot.querySelector('[data-tab="records"]').click();
    await flush();
    expect(element.shadowRoot.textContent).toContain('No recent records');
    expect(element.shadowRoot.querySelector('[data-id]')).toBeNull();
});
