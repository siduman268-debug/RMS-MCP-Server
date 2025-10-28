# RMS Salesforce Flow Frontend Guide

## Overview
This guide explains how to use the RMS (Rate Management System) Salesforce Flow frontend to manage ocean freight rates, margin rules, and surcharges.

## Prerequisites
- Salesforce org with RMS custom objects deployed
- RMS API accessible via Named Credential
- Proper permissions to run Flows

## Available Flows

### 1. RMS Ocean Freight Rate Search
**Purpose**: Search and display ocean freight rates from the RMS API

**Flow Name**: `RMS_Ocean_Freight_Rate_Search`

**How to Use**:
1. Navigate to Flows in Setup
2. Find and activate "RMS Ocean Freight Rate Search"
3. Run the Flow from App Launcher or create a custom button
4. Enter search criteria:
   - **Port of Loading Code**: e.g., "INNSA", "USNYC"
   - **Port of Discharge Code**: e.g., "USLAX", "AEJEA"
   - **Container Type**: e.g., "20GP", "40GP", "40HC"
   - **Contract ID** (optional): Specific contract to search

**Expected Results**:
- Displays matching ocean freight rates
- Shows buy amounts, currencies, transit days
- Includes validity periods and contract information

### 2. RMS Margin Rule Management
**Purpose**: Search, create, and manage margin rules

**Flow Name**: `RMS_Margin_Rule_Management`

**Features**:
- **Search Rules**: Filter by level and mark kind
- **Create New Rule**: Add new margin rules
- **View All Rules**: Display all existing rules

**Rule Levels**:
- `global`: Applies to all routes
- `trade_zone`: Applies to specific trade zones
- `port_pair`: Applies to specific port pairs

**Mark Kinds**:
- `pct`: Percentage-based margin
- `flat`: Fixed amount margin

**How to Create a Rule**:
1. Select "Create New Rule"
2. Choose rule level
3. Set mark kind and value
4. For port_pair level: specify POL and POD codes
5. Set priority (higher numbers = higher priority)
6. Click "Create Rule"

### 3. RMS Surcharge Management
**Purpose**: Search, create, and manage surcharges

**Flow Name**: `RMS_Surcharge_Management`

**Features**:
- **Search Surcharges**: Filter by charge code and applies scope
- **Create New Surcharge**: Add new surcharge rules
- **View All Surcharges**: Display all existing surcharges

**Common Charge Codes**:
- `THC`: Terminal Handling Charge
- `BAF`: Bunker Adjustment Factor
- `CAF`: Currency Adjustment Factor
- `DOC`: Documentation Fee
- `SEC`: Security Fee

**Applies Scope Options**:
- `origin`: Applies at origin port
- `port`: Applies at specific ports
- `freight`: Applies to freight charges
- `dest`: Applies at destination
- `door`: Applies for door delivery
- `other`: Other applications

**UOM (Unit of Measure) Options**:
- `per_cntr`: Per container
- `per_bl`: Per bill of lading
- `per_shipment`: Per shipment
- `per_kg`: Per kilogram
- `per_cbm`: Per cubic meter

**Calculation Methods**:
- `flat`: Fixed amount
- `pct`: Percentage of base amount

## Custom Apex Actions

The Flows use custom Apex Actions to interact with the RMS API:

### Available Actions:
1. **Get Ocean Freight Rates**: Retrieves rates based on search criteria
2. **Get Margin Rules**: Retrieves margin rules with optional filters
3. **Get Surcharges**: Retrieves surcharges with optional filters
4. **Create Ocean Freight Rate**: Creates new ocean freight rates

### Error Handling:
- All actions include comprehensive error handling
- Success/failure status is returned for each operation
- Detailed error messages help troubleshoot issues

## Configuration

### Named Credential Setup
Ensure the `RMS_API` Named Credential is properly configured:
1. Go to Setup → Named Credentials
2. Verify `RMS_API` exists and points to your RMS server
3. Test the connection

### Environment Settings
Use the `RMS_Flow_Setting__c` custom object to configure:
- API endpoints
- Default tenant IDs
- Environment-specific settings

## Best Practices

### For Users:
1. **Search First**: Always search existing records before creating new ones
2. **Use Valid Codes**: Ensure port codes and charge codes exist in the system
3. **Check Validity**: Verify date ranges for rates and rules
4. **Test Small**: Start with small test data sets

### For Administrators:
1. **Monitor Performance**: Watch for API rate limits
2. **Regular Backups**: Export Flow configurations regularly
3. **User Training**: Provide training on Flow usage
4. **Error Monitoring**: Set up alerts for Flow failures

## Troubleshooting

### Common Issues:

**"API Error: 401 Unauthorized"**
- Check Named Credential configuration
- Verify tenant ID is correct
- Ensure API server is running

**"No results found"**
- Verify search criteria are correct
- Check if data exists in RMS database
- Try broader search criteria

**"Flow execution failed"**
- Check user permissions
- Verify custom objects are deployed
- Review Flow debug logs

### Debug Steps:
1. Enable Flow debug logs
2. Check Salesforce debug logs
3. Verify API connectivity
4. Test with minimal data

## Integration with Custom Objects

The Flows work seamlessly with Salesforce custom objects:

- **Ocean_Freight_Rate__c**: Stores ocean freight rate data
- **Margin_Rule__c**: Stores margin rule configurations
- **Surcharge__c**: Stores surcharge definitions
- **RMS_Flow_Setting__c**: Stores configuration settings

## Next Steps

1. **Deploy Flows**: Deploy the Flow metadata to your Salesforce org
2. **Test Integration**: Run test searches and create test records
3. **User Training**: Train users on Flow functionality
4. **Monitor Usage**: Track Flow usage and performance
5. **Enhance Features**: Add additional functionality as needed

## Support

For technical support:
1. Check Salesforce debug logs
2. Review RMS API documentation
3. Contact system administrator
4. Refer to this documentation

---

**Last Updated**: January 27, 2025  
**Version**: 1.0  
**Author**: RMS Development Team
