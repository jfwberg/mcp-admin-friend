/** Behavioral and security tests. All business records are isolated test fixtures. */
@IsTest
private with sharing class McpAdminFriendControllerTest {
    @IsTest
    static void returnsCurrentContext() {
        Test.startTest();
        McpAdminContextDto context = McpAdminFriendController.getContext();
        Test.stopTest();
        Assert.areEqual(UserInfo.getUserId(), context.userId, 'Must identify the caller.');
        Assert.areEqual(UserInfo.getUserName(), context.username, 'Must return the caller username.');
        Assert.areEqual(UserInfo.getOrganizationId(), context.organizationId, 'Must return the current organization.');
        Assert.areEqual(UserInfo.getName(), context.fullName, 'Must return the full name.');
        Assert.isNotNull(context.profileName, 'Profile must be populated.');
        Map<String, Object> serialized = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(context));
        Assert.areEqual(8, serialized.size(), 'Context contains only the eight documented identity fields.');
    }

    @IsTest
    static void listsOnlyAccessibleQueryableObjects() {
        Test.startTest();
        List<McpObjectSummaryDto> objects = McpAdminFriendController.getObjects();
        Test.stopTest();
        Assert.isFalse(objects.isEmpty(), 'Caller should have queryable objects.');
        Map<String, Schema.SObjectType> types = Schema.getGlobalDescribe();
        Set<String> actualNames = new Set<String>();
        for (McpObjectSummaryDto item : objects) {
            Schema.DescribeSObjectResult description = types.get(item.apiName).getDescribe();
            Assert.isTrue(description.isAccessible() && description.isQueryable(), 'Every result must be permitted.');
            actualNames.add(item.apiName);
        }
        Assert.isTrue(actualNames.contains('Account'), 'Account should be discoverable by the admin test runner.');
    }

    @IsTest
    static void metadataIncludesOnlyReadableFields() {
        Test.startTest();
        McpObjectMetadataDto metadata = McpAdminFriendController.getMetadata('Account');
        Test.stopTest();
        Assert.areEqual('Account', metadata.objectInfo.apiName, 'Canonical API name is returned.');
        Map<String, Schema.SObjectField> fields = Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).fields.getMap();
        Set<String> expected = new Set<String>();
        for (Schema.SObjectField token : fields.values()) {
            if (token.getDescribe().isAccessible()) {
                expected.add(token.getDescribe().getName());
            }
        }
        Set<String> actual = new Set<String>();
        for (McpFieldMetadataDto field : metadata.fields) {
            actual.add(field.apiName);
            Assert.areEqual(fields.get(field.apiName).getDescribe().isUpdateable(), field.isUpdateable, 'Field permissions must match describe.');
        }
        Assert.areEqual(expected, actual, 'The metadata must contain exactly the readable fields.');
    }

    @IsTest static void rejectsUnknownObject() { assertInvalidObject('NotAnObject__c'); }
    @IsTest static void rejectsNullObject() { assertInvalidObject(null); }
    @IsTest static void rejectsEmptyObject() { assertInvalidObject(''); }
    @IsTest static void rejectsSoqlInjection() { assertInvalidObject('Account WHERE Name != null'); }
    @IsTest static void rejectsRelationshipSyntax() { assertInvalidObject('Account.Owner'); }

    private static void assertInvalidObject(String name) {
        Test.startTest();
        try {
            McpAdminFriendController.getMetadata(name);
            Assert.fail('Expected a controlled error for an invalid identifier.');
        } catch (AuraHandledException error) {
            Assert.areEqual('Choose a valid Salesforce object API name.', error.getMessage(), 'Error should be safe to display.');
        }
        Test.stopTest();
    }

    @IsTest
    static void recentRecordsRejectInjectionBeforeQuery() {
        Test.startTest();
        Integer beforeQueries = Limits.getQueries();
        try {
            McpAdminFriendController.getRecentRecords('Account LIMIT 1');
            Assert.fail('Query fragments must be rejected.');
        } catch (AuraHandledException error) {
            Assert.areEqual(beforeQueries, Limits.getQueries(), 'Invalid identifiers must never reach SOQL.');
        }
        Test.stopTest();
    }

    @IsTest
    static void rejectsNonQueryableObject() {
        String nonQueryable;
        for (Schema.SObjectType token : Schema.getGlobalDescribe().values()) {
            if (!token.getDescribe().isQueryable()) {
                nonQueryable = token.getDescribe().getName();
                break;
            }
        }
        Assert.isNotNull(nonQueryable, 'The org must expose a non-queryable describe type for this security test.');
        Test.startTest();
        try {
            McpAdminFriendController.getRecentRecords(nonQueryable);
            Assert.fail('Non-queryable objects must be rejected.');
        } catch (AuraHandledException error) {
            Assert.areEqual('This object is not accessible or queryable for your user.', error.getMessage(), 'Expected controlled access error.');
        }
        Test.stopTest();
    }

    @IsTest
    static void restrictedUserCannotReadAccounts() {
        User restricted = McpAdminFriendTestDataFactory.createRestrictedUser();
        System.runAs(restricted) {
            Assert.isFalse(Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible(), 'Fixture must deny Account read.');
            Test.startTest();
            try {
                McpAdminFriendController.getMetadata('Account');
                Assert.fail('Inaccessible metadata must be rejected.');
            } catch (AuraHandledException error) {
                Assert.areEqual('This object is not accessible or queryable for your user.', error.getMessage(), 'Expected safe denial.');
            }
            List<McpObjectSummaryDto> objects = McpAdminFriendController.getObjects();
            Test.stopTest();
            for (McpObjectSummaryDto item : objects) {
                Assert.areNotEqual('Account', item.apiName, 'Inaccessible objects must not appear in the selector.');
            }
        }
    }

    @IsTest
    static void returnsTenRecordsInModifiedOrderWithSmallDisplayPayload() {
        McpAdminFriendTestDataFactory.createAccounts(251);
        List<Account> expected = [SELECT Id, Name FROM Account WITH USER_MODE ORDER BY LastModifiedDate DESC, Id ASC LIMIT 10];
        Test.startTest();
        List<McpRecentRecordDto> records = McpAdminFriendController.getRecentRecords('Account');
        Test.stopTest();
        Assert.areEqual(10, records.size(), 'Records must be bounded even with hundreds of available rows.');
        for (Integer index = 0; index < records.size(); index++) {
            Assert.areEqual(expected[index].Id, records[index].recordId, 'Ordering must follow LastModifiedDate then ID.');
            Assert.areEqual(expected[index].Name, records[index].displayLabel, 'Use the object name field.');
            Assert.isTrue(records[index].fields.size() <= 6, 'No more than six display fields.');
            Set<String> names = new Set<String>();
            for (McpDisplayFieldDto field : records[index].fields) {
                names.add(field.apiName);
                Assert.isTrue(Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).fields.getMap().get(field.apiName).getDescribe().isAccessible(), 'Only readable values.');
            }
            Assert.isTrue(names.contains('Id') && names.contains('Name'), 'Include ID and available name field.');
            Assert.isFalse(names.contains('Description'), 'Do not return arbitrary long text.');
        }
    }

    @IsTest
    static void supportsObjectWithoutName() {
        Task taskRecord = McpAdminFriendTestDataFactory.createTask();
        Test.startTest();
        List<McpRecentRecordDto> records = McpAdminFriendController.getRecentRecords('Task');
        Test.stopTest();
        Assert.areEqual(1, records.size(), 'Only the isolated test task should be returned.');
        Assert.areEqual(taskRecord.Id, records[0].recordId, 'Task ID should be returned.');
        String expectedLabel = Task.Subject.getDescribe().isAccessible()
            ? taskRecord.Subject
            : String.valueOf(taskRecord.Id);
        Assert.areEqual(expectedLabel, records[0].displayLabel,
            'Use Subject when readable and otherwise preserve the secure record-ID fallback.');
        Set<String> returnedFields = new Set<String>();
        for (McpDisplayFieldDto displayField : records[0].fields) {
            returnedFields.add(displayField.apiName);
        }
        Assert.areEqual(Task.Subject.getDescribe().isAccessible(), returnedFields.contains('Subject'),
            'Return the Task Subject exactly when field-level security permits it.');
    }

    @IsTest
    static void returnsFriendlyEmptyCollection() {
        Test.startTest();
        List<McpRecentRecordDto> records = McpAdminFriendController.getRecentRecords('Contact');
        Test.stopTest();
        Assert.areEqual(0, records.size(), 'No fabricated records should be returned.');
    }
}
