/** Plain, readable-only values returned to MCP Admin Friend. */
public with sharing class McpDisplayFieldDto {
    @AuraEnabled public String apiName { get; set; }
    @AuraEnabled public String label { get; set; }
    @AuraEnabled public String dataType { get; set; }
    @AuraEnabled public String value { get; set; }
}

