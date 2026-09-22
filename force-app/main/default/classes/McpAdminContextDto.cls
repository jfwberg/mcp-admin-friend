/** Plain, readable-only values returned to MCP Admin Friend. */
public with sharing class McpAdminContextDto {
    @AuraEnabled public String fullName { get; set; }
    @AuraEnabled public String username { get; set; }
    @AuraEnabled public String userId { get; set; }
    @AuraEnabled public String email { get; set; }
    @AuraEnabled public String profileName { get; set; }
    @AuraEnabled public String userType { get; set; }
    @AuraEnabled public String organizationName { get; set; }
    @AuraEnabled public String organizationId { get; set; }
}

