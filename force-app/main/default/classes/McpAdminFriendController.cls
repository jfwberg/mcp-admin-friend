/** Read-only, user-context data boundary for MCP Admin Friend. */
public with sharing class McpAdminFriendController {
    private static final Integer RECORD_LIMIT = 10;
    private static final Integer FIELD_LIMIT = 6;
    private static Map<String, Schema.SObjectType> objectTypes;
    private static final Set<String> DISPLAY_TYPES = new Set<String>{
        'ID', 'STRING', 'COMBOBOX', 'BOOLEAN', 'CURRENCY', 'DATE', 'DATETIME', 'DOUBLE',
        'INTEGER', 'LONG', 'PERCENT', 'PICKLIST', 'REFERENCE', 'EMAIL', 'PHONE', 'URL'
    };

    /** @return Identity of the authenticated caller; never authentication material. */
    @AuraEnabled
    public static McpAdminContextDto getContext() {
        try {
            User currentUser = [SELECT Id, Name, Username, Email, Profile.Name, UserType
                FROM User WHERE Id = :UserInfo.getUserId() WITH USER_MODE LIMIT 1];
            McpAdminContextDto result = new McpAdminContextDto();
            result.fullName = currentUser.Name;
            result.username = currentUser.Username;
            result.userId = currentUser.Id;
            result.email = currentUser.Email;
            result.profileName = currentUser.Profile.Name;
            result.userType = currentUser.UserType;
            result.organizationName = UserInfo.getOrganizationName();
            result.organizationId = UserInfo.getOrganizationId();
            return result;
        } catch (Exception error) {
            throw controlledError('Your user context could not be loaded. Check access to User and Profile fields.');
        }
    }

    /** @return Accessible queryable object summaries, without field or record data. */
    @AuraEnabled(cacheable=true)
    public static List<McpObjectSummaryDto> getObjects() {
        List<McpObjectSummaryDto> results = new List<McpObjectSummaryDto>();
        for (Schema.SObjectType objectType : getObjectTypes().values()) {
            Schema.DescribeSObjectResult description = objectType.getDescribe();
            if (description.isAccessible() && description.isQueryable() && !description.isDeprecatedAndHidden()) {
                results.add(objectSummary(description));
            }
        }
        return results;
    }

    /** @param objectApiName Describe-validated API name. @return Readable object and field metadata. */
    @AuraEnabled
    public static McpObjectMetadataDto getMetadata(String objectApiName) {
        Schema.DescribeSObjectResult description = requireObject(objectApiName);
        McpObjectMetadataDto result = new McpObjectMetadataDto();
        result.objectInfo = objectSummary(description);
        result.fields = new List<McpFieldMetadataDto>();
        Map<String, Schema.SObjectField> fields = description.fields.getMap();
        List<String> names = new List<String>(fields.keySet());
        names.sort();
        for (String fieldName : names) {
            Schema.DescribeFieldResult field = fields.get(fieldName).getDescribe();
            if (field.isAccessible()) {
                result.fields.add(fieldMetadata(field));
            }
        }
        return result;
    }

    /** @param objectApiName Describe-validated API name. @return At most ten records with six display fields. */
    @AuraEnabled
    public static List<McpRecentRecordDto> getRecentRecords(String objectApiName) {
        Schema.DescribeSObjectResult description = requireObject(objectApiName);
        Map<String, Schema.SObjectField> fields = description.fields.getMap();
        if (!fields.containsKey('Id') || !fields.get('Id').getDescribe().isAccessible()) {
            throw controlledError('Records are unavailable because this object has no readable record ID.');
        }
        List<String> displayNames = selectDisplayFields(fields);
        String query = 'SELECT ' + String.join(displayNames, ',') + ' FROM ' + description.getName();
        if (fields.containsKey('LastModifiedDate') && fields.get('LastModifiedDate').getDescribe().isAccessible()
            && fields.get('LastModifiedDate').getDescribe().isSortable()) {
            query += ' ORDER BY LastModifiedDate DESC, Id ASC';
        } else if (fields.get('Id').getDescribe().isSortable()) {
            query += ' ORDER BY Id ASC';
        }
        query += ' LIMIT :recordLimit';
        List<SObject> records;
        try {
            // Identifiers above come exclusively from describe; all values are bound.
            records = Database.queryWithBinds(query, new Map<String, Object>{'recordLimit' => RECORD_LIMIT}, AccessLevel.USER_MODE);
        } catch (Exception error) {
            throw controlledError('Recent records are unavailable. This object may require a filtered query, or your access may have changed.');
        }
        return recordDtos(records, displayNames, fields);
    }

    private static Map<String, Schema.SObjectType> getObjectTypes() {
        if (objectTypes == null) {
            objectTypes = Schema.getGlobalDescribe();
        }
        return objectTypes;
    }

    private static Schema.DescribeSObjectResult requireObject(String objectApiName) {
        if (String.isBlank(objectApiName) || !Pattern.matches('^[A-Za-z][A-Za-z0-9_]*$', objectApiName)
            || !getObjectTypes().containsKey(objectApiName)) {
            throw controlledError('Choose a valid Salesforce object API name.');
        }
        Schema.DescribeSObjectResult description = getObjectTypes().get(objectApiName).getDescribe();
        if (!description.isAccessible() || !description.isQueryable() || description.isDeprecatedAndHidden()) {
            throw controlledError('This object is not accessible or queryable for your user.');
        }
        return description;
    }

    private static McpObjectSummaryDto objectSummary(Schema.DescribeSObjectResult description) {
        McpObjectSummaryDto result = new McpObjectSummaryDto();
        result.apiName = description.getName();
        result.label = description.getLabel();
        result.pluralLabel = description.getLabelPlural();
        result.keyPrefix = description.getKeyPrefix();
        result.isCustom = description.isCustom();
        result.isQueryable = description.isQueryable();
        result.isSearchable = description.isSearchable();
        result.isCreateable = description.isCreateable();
        result.isUpdateable = description.isUpdateable();
        result.isDeletable = description.isDeletable();
        return result;
    }

    private static McpFieldMetadataDto fieldMetadata(Schema.DescribeFieldResult field) {
        McpFieldMetadataDto result = new McpFieldMetadataDto();
        result.apiName = field.getName();
        result.label = field.getLabel();
        result.dataType = String.valueOf(field.getType());
        result.length = field.getLength();
        result.precision = field.getPrecision();
        result.scale = field.getScale();
        result.isNillable = field.isNillable();
        result.isRequired = !field.isNillable() && !field.isDefaultedOnCreate() && !field.isCalculated();
        result.isCustom = field.isCustom();
        result.isCreateable = field.isCreateable();
        result.isUpdateable = field.isUpdateable();
        result.referenceTargets = new List<String>();
        for (Schema.SObjectType referenceType : field.getReferenceTo()) {
            Schema.DescribeSObjectResult reference = referenceType.getDescribe();
            if (reference.isAccessible()) {
                result.referenceTargets.add(reference.getName());
            }
        }
        return result;
    }

    private static List<String> selectDisplayFields(Map<String, Schema.SObjectField> fields) {
        List<String> names = new List<String>{'Id'};
        List<String> sortedNames = new List<String>(fields.keySet());
        sortedNames.sort();
        for (String fieldName : sortedNames) {
            Schema.DescribeFieldResult field = fields.get(fieldName).getDescribe();
            if (field.isNameField()) {
                addDisplayField(names, fields, fieldName);
            }
        }
        for (String preferred : new List<String>{'Subject', 'Title', 'CaseNumber', 'Status', 'StageName',
            'Amount', 'CloseDate', 'LastModifiedDate', 'CreatedDate'}) {
            addDisplayField(names, fields, preferred);
        }
        // Do not fill remaining slots with arbitrary readable fields (tokens, long text, etc.).
        return names;
    }

    private static void addDisplayField(List<String> names, Map<String, Schema.SObjectField> fields, String name) {
        if (names.size() >= FIELD_LIMIT || names.contains(name) || !fields.containsKey(name)) {
            return;
        }
        Schema.DescribeFieldResult field = fields.get(name).getDescribe();
        if (field.isAccessible() && !field.isEncrypted() && !field.isHtmlFormatted()
            && DISPLAY_TYPES.contains(String.valueOf(field.getType()).toUpperCase())) {
            names.add(field.getName());
        }
    }

    private static List<McpRecentRecordDto> recordDtos(List<SObject> records, List<String> names,
        Map<String, Schema.SObjectField> fields) {
        List<McpRecentRecordDto> results = new List<McpRecentRecordDto>();
        for (SObject record : records) {
            McpRecentRecordDto result = new McpRecentRecordDto();
            result.recordId = String.valueOf(record.get('Id'));
            result.displayLabel = result.recordId;
            result.fields = new List<McpDisplayFieldDto>();
            for (String name : names) {
                Schema.DescribeFieldResult field = fields.get(name).getDescribe();
                Object value = record.get(name);
                McpDisplayFieldDto display = new McpDisplayFieldDto();
                display.apiName = field.getName();
                display.label = field.getLabel();
                display.dataType = String.valueOf(field.getType());
                display.value = value == null ? null : String.valueOf(value).left(255);
                result.fields.add(display);
                if (value != null && (field.isNameField() || (result.displayLabel == result.recordId
                    && new Set<String>{'Subject', 'Title', 'CaseNumber'}.contains(name)))) {
                    result.displayLabel = display.value;
                }
            }
            results.add(result);
        }
        return results;
    }

    private static AuraHandledException controlledError(String message) {
        AuraHandledException error = new AuraHandledException(message);
        error.setMessage(message);
        return error;
    }
}
