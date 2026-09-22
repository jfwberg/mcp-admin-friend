/** Plain, readable-only values returned to MCP Admin Friend. */
public with sharing class McpObjectMetadataDto {
    @AuraEnabled public McpObjectSummaryDto objectInfo { get; set; }
    @AuraEnabled public List<McpFieldMetadataDto> fields { get; set; }
}

