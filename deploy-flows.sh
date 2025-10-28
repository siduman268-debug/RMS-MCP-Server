#!/bin/bash

# RMS Salesforce Flow Deployment Script
# This script deploys the RMS Flow frontend components to Salesforce

echo "🚀 Starting RMS Salesforce Flow Deployment..."

# Check if Salesforce CLI is installed
if ! command -v sf &> /dev/null; then
    echo "❌ Salesforce CLI not found. Please install it first."
    echo "   Run: npm install -g @salesforce/cli"
    exit 1
fi

# Check if we're authenticated
echo "🔐 Checking Salesforce authentication..."
if ! sf org list &> /dev/null; then
    echo "❌ Not authenticated to Salesforce. Please login first."
    echo "   Run: sf org login web"
    exit 1
fi

# Set target org (update this to your org alias)
TARGET_ORG="RMS-Scratch-Org"

echo "📦 Deploying RMS Flow Components..."

# Deploy Apex Classes
echo "   📄 Deploying Apex Classes..."
sf project deploy start --source-dir force-app/main/default/classes --target-org $TARGET_ORG

if [ $? -eq 0 ]; then
    echo "   ✅ Apex Classes deployed successfully"
else
    echo "   ❌ Apex Classes deployment failed"
    exit 1
fi

# Deploy Flows
echo "   🌊 Deploying Flows..."
sf project deploy start --source-dir force-app/main/default/flows --target-org $TARGET_ORG

if [ $? -eq 0 ]; then
    echo "   ✅ Flows deployed successfully"
else
    echo "   ❌ Flows deployment failed"
    exit 1
fi

# Deploy Named Credentials
echo "   🔑 Deploying Named Credentials..."
sf project deploy start --source-dir force-app/main/default/namedCredentials --target-org $TARGET_ORG

if [ $? -eq 0 ]; then
    echo "   ✅ Named Credentials deployed successfully"
else
    echo "   ❌ Named Credentials deployment failed"
    exit 1
fi

# Run tests (optional)
echo "🧪 Running tests..."
sf apex run test --target-org $TARGET_ORG --result-format human

echo ""
echo "🎉 RMS Salesforce Flow Frontend Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Activate the Flows in Setup → Flows"
echo "   2. Test the Flows with sample data"
echo "   3. Create custom buttons or app launcher entries"
echo "   4. Train users on Flow usage"
echo ""
echo "📚 Documentation:"
echo "   - Flow Guide: SALESFORCE_FLOW_GUIDE.md"
echo "   - API Documentation: API_DOCUMENTATION.md"
echo ""
echo "🔧 Troubleshooting:"
echo "   - Check debug logs if Flows fail"
echo "   - Verify Named Credential configuration"
echo "   - Ensure custom objects are deployed"
echo ""
