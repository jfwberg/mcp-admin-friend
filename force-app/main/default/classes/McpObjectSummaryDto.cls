/** Plain, readable-only values returned to MCP Admin Friend. */
public with sharing class McpObjectSummaryDto {
    @AuraEnabled public String apiName { get; set; }
    @AuraEnabled public String label { get; set; }
    @AuraEnabled public String pluralLabel { get; set; }
    @AuraEnabled public String keyPrefix { get; set; }
    @AuraEnabled public Boolean isCustom { get; set; }
    @AuraEnabled public Boolean isQueryable { get; set; }
    @AuraEnabled public Boolean isSearchable { get; set; }
    @AuraEnabled public Boolean isCreateable { get; set; }
    @AuraEnabled public Boolean isUpdateable { get; set; }
    @AuraEnabled public Boolean isDeletable { get; set; }
}

