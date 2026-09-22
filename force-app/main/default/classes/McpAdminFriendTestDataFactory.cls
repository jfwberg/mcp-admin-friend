/** Isolated fixtures for the read-only controller tests. */
@IsTest
public with sharing class McpAdminFriendTestDataFactory {
    /** @param count Number of accounts to insert. @return Inserted accounts. */
    public static List<Account> createAccounts(Integer count) {
        List<Account> accounts = new List<Account>();
        for (Integer index = 0; index < count; index++) {
            accounts.add(new Account(Name = 'Admin Friend ' + index));
        }
        insert accounts;
        return accounts;
    }

    /** @return An inserted task, which has Subject rather than Name. */
    public static Task createTask() {
        Task taskRecord = new Task(Subject = 'Admin Friend follow-up');
        insert taskRecord;
        return taskRecord;
    }

    /** @return A user with the standard minimum-access profile and no permission sets. */
    public static User createRestrictedUser() {
        List<Profile> profiles = [SELECT Id FROM Profile WHERE Name IN
            ('Minimum Access - Salesforce', 'Minimum Access - Salesforce (API Only Integrations)')
            AND UserType = 'Standard' ORDER BY Name LIMIT 1];
        Assert.isFalse(profiles.isEmpty(), 'Permission tests require the standard Minimum Access - Salesforce profile.');
        String suffix = UserInfo.getOrganizationId() + '.' + String.valueOf(DateTime.now().getTime());
        User restricted = new User(Alias = 'mcpmin', Email = 'mcpmin@example.invalid',
            EmailEncodingKey = 'UTF-8', LastName = 'MCP Restricted', LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US', TimeZoneSidKey = 'Europe/London',
            Username = 'mcpmin.' + suffix + '@example.invalid', ProfileId = profiles[0].Id);
        insert restricted;
        return restricted;
    }
}
