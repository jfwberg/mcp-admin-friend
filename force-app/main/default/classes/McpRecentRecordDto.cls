/** Plain, readable-only values returned to MCP Admin Friend. */
public with sharing class McpRecentRecordDto {
    @AuraEnabled public String recordId { get; set; }
    @AuraEnabled public String displayLabel { get; set; }
    @AuraEnabled public List<McpDisplayFieldDto> fields { get; set; }
}

