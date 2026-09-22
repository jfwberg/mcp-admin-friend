/** Plain, readable-only values returned to MCP Admin Friend. */
public with sharing class McpFieldMetadataDto {
    @AuraEnabled public String apiName { get; set; }
    @AuraEnabled public String label { get; set; }
    @AuraEnabled public String dataType { get; set; }
    @AuraEnabled public Integer length { get; set; }
    @AuraEnabled public Integer precision { get; set; }
    @AuraEnabled public Integer scale { get; set; }
    @AuraEnabled public Boolean isNillable { get; set; }
    @AuraEnabled public Boolean isRequired { get; set; }
    @AuraEnabled public Boolean isCustom { get; set; }
    @AuraEnabled public Boolean isCreateable { get; set; }
    @AuraEnabled public Boolean isUpdateable { get; set; }
    @AuraEnabled public List<String> referenceTargets { get; set; }
}

