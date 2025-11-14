#!/usr/bin/env node

/**
 * Simple Tool Verification Script
 * Verifies that all schedule tools are properly defined in the MCP server
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verifying MCP Server Tools...\n');

// Expected schedule tools
const expectedScheduleTools = [
  'search_schedules',
  'get_schedule_metrics',
  'get_schedule_audit_stats',
  'get_carrier_schedule_breakdown',
  'list_carriers',
  'list_services'
];

// Read the compiled JavaScript file
const distPath = join(__dirname, '..', 'dist', 'index.js');
const srcPath = join(__dirname, '..', 'src', 'index.ts');

let sourceCode = '';
try {
  sourceCode = readFileSync(srcPath, 'utf-8');
  console.log('✅ Source file found\n');
} catch (error) {
  console.error('❌ Could not read source file:', error.message);
  process.exit(1);
}

// Check for tool definitions
console.log('📋 Checking tool definitions...\n');

const toolDefs = [];
const toolHandlers = [];

// Find tool definitions (name: "tool_name")
// Look for tool definitions in the tools array - they appear after "tools: [" and before the handler section
const toolsSection = sourceCode.split('TOOL IMPLEMENTATIONS')[0]; // Only check definitions section
const toolDefRegex = /name:\s*["']([^"']+)["']/g;
let match;
while ((match = toolDefRegex.exec(toolsSection)) !== null) {
  const toolName = match[1];
  // Filter out server names and config values
  if (!toolName.includes('-') || toolName.includes('_')) {
    toolDefs.push(toolName);
  }
}

// Find tool handlers (if (name === "tool_name"))
const toolHandlerRegex = /if\s*\(\s*name\s*===\s*["']([^"']+)["']/g;
while ((match = toolHandlerRegex.exec(sourceCode)) !== null) {
  toolHandlers.push(match[1]);
}

// Display all tools found
const allTools = [...new Set([...toolDefs, ...toolHandlers])].sort();
console.log(`📊 Found ${allTools.length} tools in total:\n`);

// Categorize tools
const categories = {
  'Pricing & Rates': ['price_enquiry', 'search_rates', 'get_surcharges'],
  'Vessel Schedules': expectedScheduleTools,
  'Locations & Ports': ['search_locations', 'create_location', 'update_location'],
  'Vendors & Carriers': ['list_vendors', 'update_vendor', 'list_carriers', 'list_services'],
  'Margin Rules': ['create_margin_rule', 'update_margin_rule', 'delete_margin_rule', 'list_margin_rules'],
  'Inland Haulage': ['get_inland_haulage'],
  'Quotations': ['create_quotation', 'get_quotation'],
  'Helper Tools': ['list_charge_codes']
};

// Check each category
let totalFound = 0;
let totalExpected = 0;

Object.entries(categories).forEach(([category, expectedTools]) => {
  totalExpected += expectedTools.length;
  const found = expectedTools.filter(tool => allTools.includes(tool));
  totalFound += found.length;
  
  const status = found.length === expectedTools.length ? '✅' : '⚠️';
  console.log(`${status} ${category}: ${found.length}/${expectedTools.length} tools`);
  
  expectedTools.forEach(tool => {
    const exists = allTools.includes(tool) ? '✓' : '✗';
    const icon = allTools.includes(tool) ? '✓' : '✗';
    console.log(`   ${icon} ${tool}`);
  });
  
  if (found.length < expectedTools.length) {
    const missing = expectedTools.filter(tool => !allTools.includes(tool));
    console.log(`   Missing: ${missing.join(', ')}`);
  }
  console.log('');
});

// Verify schedule tools specifically
console.log('🎯 Schedule Tools Verification:\n');
let allScheduleToolsFound = true;

expectedScheduleTools.forEach(tool => {
  const hasDefinition = toolDefs.includes(tool);
  const hasHandler = toolHandlers.includes(tool);
  const status = hasDefinition && hasHandler ? '✅' : '❌';
  
  console.log(`${status} ${tool}`);
  console.log(`   Definition: ${hasDefinition ? '✓' : '✗'}`);
  console.log(`   Handler: ${hasHandler ? '✓' : '✗'}`);
  
  if (!hasDefinition || !hasHandler) {
    allScheduleToolsFound = false;
  }
  console.log('');
});

// Summary
console.log('📊 Summary:\n');
console.log(`Total tools defined: ${toolDefs.length}`);
console.log(`Total tool handlers: ${toolHandlers.length}`);
console.log(`Unique tools: ${allTools.length}`);
console.log(`Tools with both definition and handler: ${toolDefs.filter(t => toolHandlers.includes(t)).length}\n`);

// Check for mismatches
const onlyDefined = toolDefs.filter(t => !toolHandlers.includes(t));
const onlyHandlers = toolHandlers.filter(t => !toolDefs.includes(t));

if (onlyDefined.length > 0) {
  console.log('⚠️  Tools defined but no handler found:');
  onlyDefined.forEach(tool => console.log(`   - ${tool}`));
  console.log('');
}

if (onlyHandlers.length > 0) {
  console.log('⚠️  Handlers found but no definition:');
  onlyHandlers.forEach(tool => console.log(`   - ${tool}`));
  console.log('');
}

// Final result
if (allScheduleToolsFound && onlyDefined.length === 0 && onlyHandlers.length === 0) {
  console.log('✅ All schedule tools are properly defined and have handlers!');
  console.log('✅ All tools are correctly paired (definition + handler)');
  console.log('\n🎉 MCP Server tool verification PASSED!\n');
  process.exit(0);
} else {
  console.log('❌ Some issues found in tool definitions');
  process.exit(1);
}

