# RMS Salesforce Frontend - Flows + Custom Components Strategy

## Overview
This approach uses Salesforce Flows for business logic and custom components for UI, providing maximum configurability and reusability.

## Architecture
```
Salesforce Flow (Business Logic)
├── Screen Components (UI)
├── Custom Apex Actions (API Calls)
├── Flow Variables (Configuration)
├── Subflows (Reusable Components)
└── Custom Components (Advanced UI)
```

## Benefits
- ✅ **Declarative** - Visual flow builder, no-code/low-code
- ✅ **Configurable** - Flow variables for different environments
- ✅ **Reusable** - Flow templates and subflows
- ✅ **Salesforce Native** - Full platform integration
- ✅ **Maintainable** - Visual business logic
- ✅ **Deployable** - Flow packages across orgs

## Implementation Plan

### 1. Custom Apex Actions for API Integration
```apex
// Custom Apex Action: Get Ocean Freight Rates
public class GetOceanFreightRatesAction {
    @InvocableMethod(label='Get Ocean Freight Rates' description='Retrieve rates from RMS API')
    public static List<Response> getRates(List<Request> requests) {
        List<Response> responses = new List<Response>();
        
        for (Request req : requests) {
            try {
                List<Ocean_Freight_Rate__c> rates = OceanFreightRateService.listRates(req.filters);
                responses.add(new Response(true, rates, null));
            } catch (Exception e) {
                responses.add(new Response(false, null, e.getMessage()));
            }
        }
        
        return responses;
    }
    
    public class Request {
        @InvocableVariable(label='Filters' description='Filter parameters')
        public Map<String, Object> filters;
    }
    
    public class Response {
        @InvocableVariable(label='Success' description='Operation success')
        public Boolean success;
        
        @InvocableVariable(label='Rates' description='Ocean freight rates')
        public List<Ocean_Freight_Rate__c> rates;
        
        @InvocableVariable(label='Error Message' description='Error message if failed')
        public String errorMessage;
        
        public Response(Boolean success, List<Ocean_Freight_Rate__c> rates, String errorMessage) {
            this.success = success;
            this.rates = rates;
            this.errorMessage = errorMessage;
        }
    }
}
```

### 2. Flow Variables for Configuration
```xml
<!-- Flow Variables -->
<variables>
    <!-- Environment Configuration -->
    <variable name="RMS_API_URL" dataType="String" defaultValue="http://localhost:3000"/>
    <variable name="TENANT_ID" dataType="String" defaultValue="00000000-0000-0000-0000-000000000001"/>
    
    <!-- UI Configuration -->
    <variable name="MAX_RECORDS_PER_PAGE" dataType="Number" defaultValue="50"/>
    <variable name="ENABLE_MARGIN_RULES" dataType="Boolean" defaultValue="true"/>
    <variable name="ENABLE_SURCHARGES" dataType="Boolean" defaultValue="true"/>
    
    <!-- Filter Variables -->
    <variable name="POL_CODE_FILTER" dataType="String"/>
    <variable name="POD_CODE_FILTER" dataType="String"/>
    <variable name="CONTAINER_TYPE_FILTER" dataType="String"/>
    
    <!-- Data Variables -->
    <variable name="OCEAN_FREIGHT_RATES" dataType="SObject" isCollection="true" objectType="Ocean_Freight_Rate__c"/>
    <variable name="MARGIN_RULES" dataType="SObject" isCollection="true" objectType="Margin_Rule__c"/>
    <variable name="SURCHARGES" dataType="SObject" isCollection="true" objectType="Surcharge__c"/>
</variables>
```

### 3. Main RMS Dashboard Flow
```xml
<!-- RMS_Dashboard_Flow -->
<flow>
    <start>
        <label>Start</label>
        <connectors>
            <targetReference>Initialize_Variables</targetReference>
        </connectors>
    </start>
    
    <!-- Initialize Configuration -->
    <assignment name="Initialize_Variables">
        <label>Initialize Variables</label>
        <assignmentItems>
            <assignToReference>{!RMS_API_URL}</assignToReference>
            <operator>Assign</operator>
            <value>
                <stringValue>http://localhost:3000</stringValue>
            </value>
        </assignmentItems>
        <assignmentItems>
            <assignToReference>{!TENANT_ID}</assignToReference>
            <operator>Assign</operator>
            <value>
                <stringValue>00000000-0000-0000-0000-000000000001</stringValue>
            </value>
        </assignmentItems>
        <connectors>
            <targetReference>Load_Initial_Data</targetReference>
        </connectors>
    </assignment>
    
    <!-- Load Initial Data -->
    <action name="Load_Initial_Data">
        <label>Load Initial Data</label>
        <actionName>GetOceanFreightRatesAction</actionName>
        <actionType>flow</actionType>
        <inputAssignments>
            <name>filters</name>
            <value>
                <elementReference>{!POL_CODE_FILTER}</elementReference>
            </value>
        </inputAssignments>
        <outputAssignments>
            <assignToReference>{!OCEAN_FREIGHT_RATES}</assignToReference>
            <name>rates</name>
        </outputAssignments>
        <connectors>
            <targetReference>Show_Dashboard_Screen</targetReference>
        </connectors>
    </action>
    
    <!-- Dashboard Screen -->
    <screen name="Show_Dashboard_Screen">
        <label>RMS Dashboard</label>
        <fields>
            <name>POL_CODE_FILTER</name>
            <fieldText>POL Code</fieldText>
            <fieldType>InputField</fieldType>
        </fields>
        <fields>
            <name>POD_CODE_FILTER</name>
            <fieldText>POD Code</fieldText>
            <fieldType>InputField</fieldType>
        </fields>
        <fields>
            <name>CONTAINER_TYPE_FILTER</name>
            <fieldText>Container Type</fieldText>
            <fieldType>InputField</fieldType>
        </fields>
        <choices>
            <choiceText>Search Rates</choiceText>
            <dataType>String</dataType>
            <value>
                <stringValue>SEARCH</stringValue>
            </value>
        </choices>
        <choices>
            <choiceText>Create New Rate</choiceText>
            <dataType>String</dataType>
            <value>
                <stringValue>CREATE</stringValue>
            </value>
        </choices>
        <choices>
            <choiceText>Manage Margin Rules</choiceText>
            <dataType>String</dataType>
            <value>
                <stringValue>MARGIN_RULES</stringValue>
            </value>
        </choices>
        <choices>
            <choiceText>Manage Surcharges</choiceText>
            <dataType>String</dataType>
            <value>
                <stringValue>SURCHARGES</stringValue>
            </value>
        </choices>
        <connectors>
            <targetReference>Process_User_Choice</targetReference>
        </connectors>
    </screen>
    
    <!-- Process User Choice -->
    <decision name="Process_User_Choice">
        <label>Process User Choice</label>
        <rules>
            <name>Search_Rates</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>{!Show_Dashboard_Screen}</leftValueReference>
                <operator>EqualTo</operator>
                <rightValue>
                    <stringValue>SEARCH</stringValue>
                </rightValue>
            </conditions>
            <connectors>
                <targetReference>Search_Rates_Action</targetReference>
            </connectors>
        </rules>
        <rules>
            <name>Create_Rate</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>{!Show_Dashboard_Screen}</leftValueReference>
                <operator>EqualTo</operator>
                <rightValue>
                    <stringValue>CREATE</stringValue>
                </rightValue>
            </conditions>
            <connectors>
                <targetReference>Create_Rate_Subflow</targetReference>
            </connectors>
        </rules>
        <rules>
            <name>Margin_Rules</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>{!Show_Dashboard_Screen}</leftValueReference>
                <operator>EqualTo</operator>
                <rightValue>
                    <stringValue>MARGIN_RULES</stringValue>
                </rightValue>
            </conditions>
            <connectors>
                <targetReference>Margin_Rules_Subflow</targetReference>
            </connectors>
        </rules>
        <rules>
            <name>Surcharges</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>{!Show_Dashboard_Screen}</leftValueReference>
                <operator>EqualTo</operator>
                <rightValue>
                    <stringValue>SURCHARGES</stringValue>
                </rightValue>
            </conditions>
            <connectors>
                <targetReference>Surcharges_Subflow</targetReference>
            </connectors>
        </rules>
    </decision>
    
    <!-- Search Rates Action -->
    <action name="Search_Rates_Action">
        <label>Search Rates</label>
        <actionName>GetOceanFreightRatesAction</actionName>
        <actionType>flow</actionType>
        <inputAssignments>
            <name>filters</name>
            <value>
                <elementReference>{!POL_CODE_FILTER}</elementReference>
            </value>
        </inputAssignments>
        <outputAssignments>
            <assignToReference>{!OCEAN_FREIGHT_RATES}</assignToReference>
            <name>rates</name>
        </outputAssignments>
        <connectors>
            <targetReference>Show_Rates_Results</targetReference>
        </connectors>
    </action>
    
    <!-- Show Rates Results -->
    <screen name="Show_Rates_Results">
        <label>Ocean Freight Rates</label>
        <showFooter>true</showFooter>
        <choices>
            <choiceText>Back to Dashboard</choiceText>
            <dataType>String</dataType>
            <value>
                <stringValue>BACK</stringValue>
            </value>
        </choices>
        <choices>
            <choiceText>Create New Rate</choiceText>
            <dataType>String</dataType>
            <value>
                <stringValue>CREATE</stringValue>
            </value>
        </choices>
        <connectors>
            <targetReference>Process_Results_Choice</targetReference>
        </connectors>
    </screen>
</flow>
```

### 4. Reusable Subflows

#### Create Rate Subflow
```xml
<!-- Create_Ocean_Freight_Rate_Subflow -->
<flow>
    <start>
        <label>Start</label>
        <connectors>
            <targetReference>Show_Create_Rate_Screen</targetReference>
        </connectors>
    </start>
    
    <!-- Create Rate Screen -->
    <screen name="Show_Create_Rate_Screen">
        <label>Create Ocean Freight Rate</label>
        <fields>
            <name>NEW_RATE_CONTRACT_ID</name>
            <fieldText>Contract ID</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>true</isRequired>
        </fields>
        <fields>
            <name>NEW_RATE_POL_CODE</name>
            <fieldText>POL Code</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>true</isRequired>
        </fields>
        <fields>
            <name>NEW_RATE_POD_CODE</name>
            <fieldText>POD Code</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>true</isRequired>
        </fields>
        <fields>
            <name>NEW_RATE_CONTAINER_TYPE</name>
            <fieldText>Container Type</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>true</isRequired>
        </fields>
        <fields>
            <name>NEW_RATE_BUY_AMOUNT</name>
            <fieldText>Buy Amount</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>true</isRequired>
        </fields>
        <fields>
            <name>NEW_RATE_CURRENCY</name>
            <fieldText>Currency</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>true</isRequired>
        </fields>
        <fields>
            <name>NEW_RATE_TRANSIT_DAYS</name>
            <fieldText>Transit Days</fieldText>
            <fieldType>InputField</fieldType>
        </fields>
        <fields>
            <name>NEW_RATE_VALID_FROM</name>
            <fieldText>Valid From</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>true</isRequired>
        </fields>
        <fields>
            <name>NEW_RATE_VALID_TO</name>
            <fieldText>Valid To</fieldText>
            <fieldType>InputField</fieldType>
            <isRequired>true</isRequired>
        </fields>
        <fields>
            <name>NEW_RATE_IS_PREFERRED</name>
            <fieldText>Is Preferred</fieldText>
            <fieldType>Checkbox</fieldType>
        </fields>
        <choices>
            <choiceText>Save Rate</choiceText>
            <dataType>String</dataType>
            <value>
                <stringValue>SAVE</stringValue>
            </value>
        </choices>
        <choices>
            <choiceText>Cancel</choiceText>
            <dataType>String</dataType>
            <value>
                <stringValue>CANCEL</stringValue>
            </value>
        </choices>
        <connectors>
            <targetReference>Process_Create_Choice</targetReference>
        </connectors>
    </screen>
    
    <!-- Process Create Choice -->
    <decision name="Process_Create_Choice">
        <label>Process Create Choice</label>
        <rules>
            <name>Save_Rate</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>{!Show_Create_Rate_Screen}</leftValueReference>
                <operator>EqualTo</operator>
                <rightValue>
                    <stringValue>SAVE</stringValue>
                </rightValue>
            </conditions>
            <connectors>
                <targetReference>Create_Rate_Action</targetReference>
            </connectors>
        </rules>
        <rules>
            <name>Cancel</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>{!Show_Create_Rate_Screen}</leftValueReference>
                <operator>EqualTo</operator>
                <rightValue>
                    <stringValue>CANCEL</stringValue>
                </rightValue>
            </conditions>
            <connectors>
                <targetReference>End</targetReference>
            </connectors>
        </rules>
    </decision>
    
    <!-- Create Rate Action -->
    <action name="Create_Rate_Action">
        <label>Create Rate</label>
        <actionName>CreateOceanFreightRateAction</actionName>
        <actionType>flow</actionType>
        <inputAssignments>
            <name>contractId</name>
            <value>
                <elementReference>{!NEW_RATE_CONTRACT_ID}</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <name>polCode</name>
            <value>
                <elementReference>{!NEW_RATE_POL_CODE}</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <name>podCode</name>
            <value>
                <elementReference>{!NEW_RATE_POD_CODE}</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <name>containerType</name>
            <value>
                <elementReference>{!NEW_RATE_CONTAINER_TYPE}</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <name>buyAmount</name>
            <value>
                <elementReference>{!NEW_RATE_BUY_AMOUNT}</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <name>currency</name>
            <value>
                <elementReference>{!NEW_RATE_CURRENCY}</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <name>transitDays</name>
            <value>
                <elementReference>{!NEW_RATE_TRANSIT_DAYS}</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <name>validFrom</name>
            <value>
                <elementReference>{!NEW_RATE_VALID_FROM}</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <name>validTo</name>
            <value>
                <elementReference>{!NEW_RATE_VALID_TO}</elementReference>
            </value>
        </inputAssignments>
        <inputAssignments>
            <name>isPreferred</name>
            <value>
                <elementReference>{!NEW_RATE_IS_PREFERRED}</elementReference>
            </value>
        </inputAssignments>
        <outputAssignments>
            <assignToReference>{!CREATED_RATE}</assignToReference>
            <name>rate</name>
        </outputAssignments>
        <connectors>
            <targetReference>Show_Success_Message</targetReference>
        </connectors>
    </action>
    
    <!-- Show Success Message -->
    <screen name="Show_Success_Message">
        <label>Success</label>
        <showFooter>true</showFooter>
        <textTemplates>
            <name>SUCCESS_MESSAGE</name>
            <text>Rate created successfully! Rate ID: {!CREATED_RATE.Id}</text>
        </textTemplates>
        <choices>
            <choiceText>OK</choiceText>
            <dataType>String</dataType>
            <value>
                <stringValue>OK</stringValue>
            </value>
        </choices>
        <connectors>
            <targetReference>End</targetReference>
        </connectors>
    </screen>
</flow>
```

### 5. Custom Components for Advanced UI

#### Ocean Freight Rate Table Component
```typescript
// Custom Component: OceanFreightRateTable
import { LightningElement, api, track } from 'lwc';

export default class OceanFreightRateTable extends LightningElement {
    @api rates = [];
    @api isLoading = false;
    @track selectedRate = null;
    
    handleRowClick(event) {
        const rateId = event.currentTarget.dataset.id;
        this.selectedRate = this.rates.find(rate => rate.Id === rateId);
        
        // Dispatch custom event
        const selectEvent = new CustomEvent('rateselect', {
            detail: { rate: this.selectedRate }
        });
        this.dispatchEvent(selectEvent);
    }
    
    handleEdit(event) {
        const rateId = event.target.dataset.id;
        const editEvent = new CustomEvent('rateedit', {
            detail: { rateId: rateId }
        });
        this.dispatchEvent(editEvent);
    }
    
    handleDelete(event) {
        const rateId = event.target.dataset.id;
        const deleteEvent = new CustomEvent('ratedelete', {
            detail: { rateId: rateId }
        });
        this.dispatchEvent(deleteEvent);
    }
    
    get hasRates() {
        return this.rates && this.rates.length > 0;
    }
}
```

### 6. Flow Integration with Custom Components
```xml
<!-- Flow Screen with Custom Component -->
<screen name="Show_Rates_With_Custom_Component">
    <label>Ocean Freight Rates</label>
    <components>
        <componentName>c:oceanFreightRateTable</componentName>
        <componentInputs>
            <name>rates</name>
            <value>
                <elementReference>{!OCEAN_FREIGHT_RATES}</elementReference>
            </value>
        </componentInputs>
        <componentInputs>
            <name>isLoading</name>
            <value>
                <elementReference>{!IS_LOADING}</elementReference>
            </value>
        </componentInputs>
    </components>
    <choices>
        <choiceText>Back to Dashboard</choiceText>
        <dataType>String</dataType>
        <value>
            <stringValue>BACK</stringValue>
        </value>
    </choices>
    <choices>
        <choiceText>Create New Rate</choiceText>
        <dataType>String</dataType>
        <value>
            <stringValue>CREATE</stringValue>
        </value>
    </choices>
</screen>
```

### 7. Configuration Management

#### Flow Settings Custom Object
```xml
<!-- RMS_Flow_Settings__c Custom Object -->
<CustomObject>
    <fields>
        <fullName>Setting_Name__c</fullName>
        <label>Setting Name</label>
        <type>Text</type>
        <length>100</length>
        <required>true</required>
        <unique>true</unique>
    </fields>
    <fields>
        <fullName>Setting_Value__c</fullName>
        <label>Setting Value</label>
        <type>LongTextArea</type>
        <length>32768</length>
    </fields>
    <fields>
        <fullName>Environment__c</fullName>
        <label>Environment</label>
        <type>Picklist</type>
        <valueSet>
            <value>
                <fullName>Development</fullName>
                <default>true</default>
            </value>
            <value>
                <fullName>Staging</fullName>
            </value>
            <value>
                <fullName>Production</fullName>
            </value>
        </valueSet>
    </fields>
</CustomObject>
```

#### Flow Configuration Subflow
```xml
<!-- Load_Configuration_Subflow -->
<flow>
    <start>
        <label>Start</label>
        <connectors>
            <targetReference>Load_Settings</targetReference>
        </connectors>
    </start>
    
    <!-- Load Settings -->
    <recordLookups name="Load_Settings">
        <label>Load Settings</label>
        <filterLogic>and</filterLogic>
        <filters>
            <field>RMS_Flow_Settings__c.Environment__c</field>
            <operator>EqualTo</operator>
            <value>
                <elementReference>{!CURRENT_ENVIRONMENT}</elementReference>
            </value>
        </filters>
        <getFirstRecordOnly>false</getFirstRecordOnly>
        <object>RMS_Flow_Settings__c</object>
        <storeOutputAutomatically>true</storeOutputAutomatically>
        <connectors>
            <targetReference>Process_Settings</targetReference>
        </connectors>
    </recordLookups>
    
    <!-- Process Settings -->
    <assignment name="Process_Settings">
        <label>Process Settings</label>
        <assignmentItems>
            <assignToReference>{!RMS_API_URL}</assignToReference>
            <operator>Assign</operator>
            <value>
                <elementReference>{!Load_Settings.RMS_Flow_Settings__c.Setting_Value__c}</elementReference>
            </value>
        </assignmentItems>
        <connectors>
            <targetReference>End</targetReference>
        </connectors>
    </assignment>
</flow>
```

## Deployment Strategy

### 1. Flow Package Structure
```
RMS_Flow_Package/
├── flows/
│   ├── RMS_Dashboard_Flow.flow-meta.xml
│   ├── Create_Ocean_Freight_Rate_Subflow.flow-meta.xml
│   ├── Manage_Margin_Rules_Subflow.flow-meta.xml
│   └── Manage_Surcharges_Subflow.flow-meta.xml
├── customObjects/
│   ├── Ocean_Freight_Rate__c/
│   ├── Margin_Rule__c/
│   ├── Surcharge__c/
│   └── RMS_Flow_Settings__c/
├── classes/
│   ├── OceanFreightRateService.cls
│   ├── MarginRuleService.cls
│   ├── SurchargeService.cls
│   └── RMSApiUtil.cls
├── lwc/
│   ├── oceanFreightRateTable/
│   ├── marginRuleTable/
│   └── surchargeTable/
└── settings/
    ├── RMS_Flow_Settings__c/
    └── Custom_Settings__c/
```

### 2. Environment Configuration
```xml
<!-- Package.xml -->
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>RMS_Dashboard_Flow</members>
        <members>Create_Ocean_Freight_Rate_Subflow</members>
        <members>Manage_Margin_Rules_Subflow</members>
        <members>Manage_Surcharges_Subflow</members>
        <name>Flow</name>
    </types>
    <types>
        <members>Ocean_Freight_Rate__c</members>
        <members>Margin_Rule__c</members>
        <members>Surcharge__c</members>
        <members>RMS_Flow_Settings__c</members>
        <name>CustomObject</name>
    </types>
    <types>
        <members>OceanFreightRateService</members>
        <members>MarginRuleService</members>
        <members>SurchargeService</members>
        <members>RMSApiUtil</members>
        <name>ApexClass</name>
    </types>
    <types>
        <members>oceanFreightRateTable</members>
        <members>marginRuleTable</members>
        <members>surchargeTable</members>
        <name>LightningComponentBundle</name>
    </types>
    <version>60.0</version>
</Package>
```

## Benefits Over Pure LWC

1. **Declarative Business Logic** ✅
   - Visual flow builder
   - No-code/low-code approach
   - Easy to understand and maintain

2. **Configurable** ✅
   - Flow variables for different environments
   - Custom settings object
   - Environment-specific configurations

3. **Reusable** ✅
   - Flow templates and subflows
   - Custom components
   - Package deployment

4. **Salesforce Native** ✅
   - Full platform integration
   - Built-in security and sharing
   - Native UI components

5. **Maintainable** ✅
   - Visual business logic
   - Declarative updates
   - Easy debugging

## Next Steps

1. **Create Flow Package** with all components
2. **Set up Environment Configuration** system
3. **Deploy to Development Org** for testing
4. **Create Deployment Scripts** for multiple orgs
5. **Set up CI/CD Pipeline** for updates

Would you like me to create the complete Flow package with all the components?

