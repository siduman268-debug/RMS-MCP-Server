#!/usr/bin/env node

/**
 * MCP Server Test Script
 * Tests the RMS MCP Server tools registration and basic functionality
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test the MCP server by sending a list_tools request
async function testMCPServer() {
  console.log('🧪 Testing RMS MCP Server...\n');

  const serverPath = join(__dirname, '..', 'dist', 'index.js');
  console.log(`Server path: ${serverPath}\n`);

  // Create a test request to list tools
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  // Set environment variables
  const env = {
    ...process.env,
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://xsvwhctzwpfcwmmvbgmf.supabase.co',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || 'test-secret'
  };

  // Try to read from claude_desktop_config.json as fallback
  if (!env.SUPABASE_SERVICE_KEY) {
    try {
      const configPath = join(__dirname, '..', 'claude_desktop_config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      const mcpConfig = config.mcpServers?.['rms-supabase-server'];
      if (mcpConfig?.env) {
        env.SUPABASE_URL = mcpConfig.env.SUPABASE_URL || env.SUPABASE_URL;
        env.SUPABASE_SERVICE_KEY = mcpConfig.env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_KEY;
        env.JWT_SECRET = mcpConfig.env.JWT_SECRET || env.JWT_SECRET;
        console.log('📄 Loaded environment from claude_desktop_config.json\n');
      }
    } catch (e) {
      // Ignore if file doesn't exist
    }
  }

  if (!env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_KEY environment variable is required');
    console.log('Please set SUPABASE_SERVICE_KEY in your environment, .env file, or claude_desktop_config.json');
    console.log('\nFor testing purposes, you can also:');
    console.log('1. Create a .env file with SUPABASE_SERVICE_KEY');
    console.log('2. Or set environment variable: $env:SUPABASE_SERVICE_KEY="your-key"');
    process.exit(1);
  }

  console.log(`✅ Environment loaded (SUPABASE_URL: ${env.SUPABASE_URL.substring(0, 30)}...)\n`);

  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', [serverPath], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    serverProcess.on('error', (error) => {
      console.error('❌ Failed to start server:', error.message);
      reject(error);
    });

    // Send the list_tools request
    const requestJson = JSON.stringify(testRequest) + '\n';
    serverProcess.stdin.write(requestJson);

    // Give the server a moment to process
    setTimeout(() => {
      serverProcess.stdin.end();

      // Wait a bit more for response
      setTimeout(() => {
        serverProcess.kill();

        if (errorOutput) {
          console.log('Server stderr:', errorOutput);
        }

        if (output) {
          try {
            const response = JSON.parse(output.trim());
            console.log('✅ Server responded successfully!\n');
            console.log('Response:', JSON.stringify(response, null, 2));

            if (response.result && response.result.tools) {
              const tools = response.result.tools;
              console.log(`\n📋 Found ${tools.length} tools:\n`);

              // Group tools by category
              const categories = {
                'Pricing & Rates': [],
                'Vessel Schedules': [],
                'Locations & Ports': [],
                'Vendors & Carriers': [],
                'Margin Rules': [],
                'Inland Haulage': [],
                'Quotations': [],
                'Helper Tools': []
              };

              tools.forEach(tool => {
                const name = tool.name.toLowerCase();
                if (name.includes('schedule')) {
                  categories['Vessel Schedules'].push(tool.name);
                } else if (name.includes('price') || name.includes('rate') || name.includes('surcharge')) {
                  categories['Pricing & Rates'].push(tool.name);
                } else if (name.includes('location')) {
                  categories['Locations & Ports'].push(tool.name);
                } else if (name.includes('vendor') || name.includes('carrier') || name.includes('service')) {
                  categories['Vendors & Carriers'].push(tool.name);
                } else if (name.includes('margin')) {
                  categories['Margin Rules'].push(tool.name);
                } else if (name.includes('haulage')) {
                  categories['Inland Haulage'].push(tool.name);
                } else if (name.includes('quotation')) {
                  categories['Quotations'].push(tool.name);
                } else {
                  categories['Helper Tools'].push(tool.name);
                }
              });

              // Display categorized tools
              Object.entries(categories).forEach(([category, toolNames]) => {
                if (toolNames.length > 0) {
                  console.log(`  ${category}: ${toolNames.length} tools`);
                  toolNames.forEach(toolName => {
                    console.log(`    - ${toolName}`);
                  });
                  console.log('');
                }
              });

              // Verify schedule tools are present
              const scheduleTools = ['search_schedules', 'get_schedule_metrics', 'get_schedule_audit_stats', 
                                   'get_carrier_schedule_breakdown', 'list_carriers', 'list_services'];
              const foundScheduleTools = scheduleTools.filter(tool => 
                tools.some(t => t.name === tool)
              );

              console.log(`✅ Schedule Tools Status: ${foundScheduleTools.length}/${scheduleTools.length} found`);
              if (foundScheduleTools.length === scheduleTools.length) {
                console.log('   All schedule tools are registered correctly!\n');
              } else {
                console.log('   Missing tools:', scheduleTools.filter(t => !foundScheduleTools.includes(t)).join(', '), '\n');
              }

            } else {
              console.log('⚠️  Response does not contain tools list');
            }

            resolve(response);
          } catch (parseError) {
            console.log('Raw output:', output);
            console.error('❌ Failed to parse response:', parseError.message);
            reject(parseError);
          }
        } else {
          console.error('❌ No output from server');
          reject(new Error('No server output'));
        }
      }, 1000);
    }, 500);
  });
}

// Run the test
testMCPServer()
  .then(() => {
    console.log('\n✅ MCP Server test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ MCP Server test failed:', error.message);
    process.exit(1);
  });

