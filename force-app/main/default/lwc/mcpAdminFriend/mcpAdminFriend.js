import { LightningElement, api } from 'lwc';
import getContext from '@salesforce/apex/McpAdminFriendController.getContext';
import getObjects from '@salesforce/apex/McpAdminFriendController.getObjects';
import getMetadata from '@salesforce/apex/McpAdminFriendController.getMetadata';
import getRecentRecords from '@salesforce/apex/McpAdminFriendController.getRecentRecords';

const COMMON_OBJECTS = ['Account', 'Contact', 'Opportunity', 'Lead', 'Case', 'Task', 'User'];
const clone = (value) => JSON.parse(JSON.stringify(value));
let sequence = 0;
const uniqueId = () => `adminfriend-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`;

export default class McpAdminFriend extends LightningElement {
    context;
    objects = [];
    selectedObject;
    metadata;
    records = [];
    selectedRecord;
    selectedFieldName;
    objectSearch = '';
    fieldSearch = '';
    activeTab = 'admin';
    notification = 'Initializing Salesforce access…';
    ready = false;
    contextLoading = false;
    objectsLoading = false;
    metadataLoading = false;
    recordsLoading = false;
    contextError;
    objectsError;
    metadataError;
    recordsError;
    _contextRequest = 0;
    _metadataRequest = 0;
    _recordsRequest = 0;
    _selectionRequest = 0;
    _initialized = false;
    _objectApiName = '';

    @api
    get objectApiName() {
        return this._objectApiName;
    }
    set objectApiName(value) {
        this._objectApiName = typeof value === 'string' ? value.trim() : '';
        if (this.ready && this._objectApiName) this.applyInitialObject();
    }

    renderedCallback() {
        if (!this._initialized) {
            this._initialized = true;
            this._initialization = this.initialize();
        }
    }

    async initialize() {
        await Promise.all([this.loadContext(false), this.loadObjects()]);
        if (this._objectApiName && !this.objectsError) await this.applyInitialObject();
        this.ready = true;
        this.notification = this.contextError || this.objectsError
            ? 'Ready. Some Salesforce data could not be loaded.'
            : 'Ready. Select an object to explore Salesforce.';
    }

    async applyInitialObject() {
        try {
            await this.selectObject(this._objectApiName, uniqueId(), 'initial.input');
        } catch (error) {
            this.notification = this.reportError('initial.object.select', error);
        }
    }

    emit(type, payload, correlationId = uniqueId()) {
        const envelope = clone({ version: '1.0', source: 'mcpAdminFriend', type,
            timestamp: new Date().toISOString(), correlationId, payload });
        this.dispatchEvent(new CustomEvent('adminfriendaction', {
            // A primitive JSON string crosses the LWS and Lightning Out iframe
            // boundaries without retaining an uncloneable proxy wrapper.
            bubbles: true, composed: true, detail: JSON.stringify(envelope)
        }));
    }

    reportError(operation, error, correlationId) {
        const message = error?.body?.message || error?.message || 'Salesforce data could not be loaded. Please retry.';
        return message;
    }

    async loadContext(refresh, correlationId) {
        const request = ++this._contextRequest;
        this.contextLoading = true;
        this.contextError = undefined;
        try {
            const context = await getContext();
            if (request !== this._contextRequest) return false;
            this.context = clone(context);
            return true;
        } catch (error) {
            if (request === this._contextRequest) {
                this.context = undefined;
                this.contextError = this.reportError('context.refresh', error, correlationId);
            }
            return false;
        } finally {
            if (request === this._contextRequest) this.contextLoading = false;
        }
    }

    async loadObjects() {
        this.objectsLoading = true;
        this.objectsError = undefined;
        try {
            const rank = (name) => COMMON_OBJECTS.includes(name) ? COMMON_OBJECTS.indexOf(name) : 100;
            this.objects = clone(await getObjects()).sort((a, b) =>
                rank(a.apiName) - rank(b.apiName) || a.label.localeCompare(b.label) || a.apiName.localeCompare(b.apiName));
            return true;
        } catch (error) {
            this.objectsError = this.reportError('objects.load', error);
            return false;
        } finally {
            this.objectsLoading = false;
        }
    }

    async selectObject(apiName, correlationId, originatingAction) {
        const object = this.objects.find((item) => item.apiName.toLowerCase() === apiName.toLowerCase());
        if (!object) throw new Error('Choose an accessible, queryable object from the object selector.');
        const request = ++this._selectionRequest;
        this.selectedObject = object;
        this.metadata = undefined;
        this.records = [];
        this.selectedRecord = undefined;
        this.selectedFieldName = undefined;
        this.fieldSearch = '';
        this.activeTab = 'metadata';
        const results = await Promise.all([this.loadMetadata(correlationId), this.loadRecords(correlationId)]);
        return request === this._selectionRequest && results.every(Boolean);
    }

    async loadMetadata(correlationId) {
        if (!this.selectedObject) throw new Error('Select an object first.');
        const request = ++this._metadataRequest;
        const apiName = this.selectedObject.apiName;
        this.metadataLoading = true;
        this.metadataError = undefined;
        this.metadata = undefined;
        this.selectedFieldName = undefined;
        try {
            const result = await getMetadata({ objectApiName: apiName });
            if (request !== this._metadataRequest) return false;
            this.metadata = clone(result);
            return true;
        } catch (error) {
            if (request === this._metadataRequest) this.metadataError = this.reportError('metadata.refresh', error, correlationId);
            return false;
        } finally {
            if (request === this._metadataRequest) this.metadataLoading = false;
        }
    }

    async loadRecords(correlationId) {
        if (!this.selectedObject) throw new Error('Select an object first.');
        const request = ++this._recordsRequest;
        const apiName = this.selectedObject.apiName;
        this.recordsLoading = true;
        this.recordsError = undefined;
        this.records = [];
        this.selectedRecord = undefined;
        try {
            const result = await getRecentRecords({ objectApiName: apiName });
            if (request !== this._recordsRequest) return false;
            this.records = clone(result);
            return true;
        } catch (error) {
            if (request === this._recordsRequest) this.recordsError = this.reportError('records.refresh', error, correlationId);
            return false;
        } finally {
            if (request === this._recordsRequest) this.recordsLoading = false;
        }
    }

    handleRefreshContext() { this.loadContext(true); }
    handleRetryObjects() { this.loadObjects(); }
    handleRefreshMetadata() { this.loadMetadata(); }
    handleRefreshRecords() { this.loadRecords(); }
    handleObjectSearch(event) { this.objectSearch = event.target.value; }
    handleFieldSearch(event) { this.fieldSearch = event.target.value; }
    handleObjectSelect(event) {
        this.selectObject(event.currentTarget.dataset.name, uniqueId(), 'user.object.select')
            .catch((error) => { this.reportError('object.select', error); });
    }
    handleTabSelect(event) { this.activeTab = event.currentTarget.dataset.tab; }
    handleTabKeydown(event) {
        const tabs = [...this.template.querySelectorAll('[role="tab"]')].filter((tab) => !tab.disabled);
        const index = tabs.indexOf(event.currentTarget);
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) {
            event.preventDefault();
            this.activeTab = tabs[next].dataset.tab;
            tabs[next].focus();
        }
    }
    handleFieldSelect(event) {
        const field = this.metadata?.fields.find((item) => item.apiName === event.currentTarget.dataset.name);
        if (!field) return;
        this.selectedFieldName = field.apiName;
        this.notification = `${field.label} selected.`;
    }
    handleRecordSelect(event) {
        this.selectedRecord = this.records.find((item) => item.recordId === event.currentTarget.dataset.id);
    }
    handleSendRecord() {
        if (!this.selectedRecord || !this.selectedObject) return;
        this.emit('record.selected', {
            objectApiName: this.selectedObject.apiName, objectLabel: this.selectedObject.label,
            recordId: this.selectedRecord.recordId, recordDisplayLabel: this.selectedRecord.displayLabel,
            fields: this.selectedRecord.fields, originatingAction: 'user.sendRecord'
        });
        this.notification = `${this.selectedRecord.displayLabel} sent to host for the MCP client.`;
    }

    get readiness() { return this.ready ? 'Ready' : 'Connecting'; }
    get noObject() { return !this.selectedObject; }
    get isAdmin() { return this.activeTab === 'admin'; }
    get isMetadata() { return this.activeTab === 'metadata'; }
    get isRecords() { return this.activeTab === 'records'; }
    get adminTabIndex() { return this.isAdmin ? '0' : '-1'; }
    get metadataTabIndex() { return this.isMetadata ? '0' : '-1'; }
    get recordsTabIndex() { return this.isRecords ? '0' : '-1'; }
    get contextFields() {
        if (!this.context) return [];
        return Object.entries({ fullName: 'Full name', username: 'Username', userId: 'User ID', email: 'Email',
            profileName: 'Profile', userType: 'User type', organizationName: 'Organization', organizationId: 'Organization ID' })
            .map(([key, label]) => ({ key, label, value: this.context[key] || 'Not available' }));
    }
    get filteredObjects() {
        const search = this.objectSearch.trim().toLowerCase();
        return this.objects.filter((item) => `${item.label} ${item.apiName}`.toLowerCase().includes(search));
    }
    get visibleObjects() {
        return this.filteredObjects.slice(0, 75).map((item) => ({ ...item, selected: item.apiName === this.selectedObject?.apiName }));
    }
    get objectCountLabel() { return `${this.filteredObjects.length} objects · showing up to 75. Search to narrow results.`; }
    get noObjectResults() { return !this.objectsLoading && !this.objectsError && !this.filteredObjects.length; }
    get metadataSummary() {
        const item = this.metadata?.objectInfo;
        if (!item) return [];
        return [{ key: 'Plural label', value: item.pluralLabel }, { key: 'API name', value: item.apiName },
            { key: 'Key prefix', value: item.keyPrefix || 'Not available' }, { key: 'Object type', value: item.isCustom ? 'Custom' : 'Standard' }];
    }
    get permissionBadges() {
        const item = this.metadata?.objectInfo;
        return item ? ['Queryable', 'Searchable', 'Createable', 'Updateable', 'Deletable']
            .map((label) => ({ label, text: `${label}: ${item[`is${label}`] ? 'Yes' : 'No'}` })) : [];
    }
    get visibleFields() {
        const search = this.fieldSearch.trim().toLowerCase();
        return (this.metadata?.fields || []).filter((field) => `${field.label} ${field.apiName}`.toLowerCase().includes(search))
            .map((field) => ({ ...field, selected: field.apiName === this.selectedFieldName,
                size: field.precision ? `${field.precision}, ${field.scale}` : field.length || '—',
                nullable: field.isNillable ? 'Yes' : 'No', required: field.isRequired ? 'Yes' : 'No',
                kind: field.isCustom ? 'Custom' : 'Standard', createable: field.isCreateable ? 'Yes' : 'No',
                updateable: field.isUpdateable ? 'Yes' : 'No', references: field.referenceTargets.join(', ') || '—' }));
    }
    get noFields() { return this.metadata && !this.visibleFields.length; }
    get recordItems() { return this.records.map((record) => ({ ...record, selected: record.recordId === this.selectedRecord?.recordId })); }
    get noRecords() { return !this.recordsLoading && !this.recordsError && !this.records.length; }
    get recordDetails() { return (this.selectedRecord?.fields || []).filter((field) => field.value !== null && field.value !== ''); }
}
