#!/usr/bin/env node

/**
 * Test script to verify MCP server functionality
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing RMS MCP Server...\n');

// Test 1: Check if the built file exists
console.log('1. Checking built file...');
try {
  const fs = await import('fs');
  const builtFile = join(__dirname, 'dist', 'index.js');
  if (fs.existsSync(builtFile)) {
    console.log('✅ Built file exists:', builtFile);
  } else {
    console.log('❌ Built file not found');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Error checking built file:', error.message);
  process.exit(1);
}

// Test 2: Check package.json
console.log('\n2. Checking package.json...');
try {
  const packageJson = JSON.parse(await import('fs').then(fs => fs.readFileSync('package.json', 'utf8')));
  console.log('✅ Package name:', packageJson.name);
  console.log('✅ MCP SDK version:', packageJson.dependencies['@modelcontextprotocol/sdk']);
  console.log('✅ Bin entry:', packageJson.bin);
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
}

// Test 3: Test MCP server startup
console.log('\n3. Testing MCP server startup...');
try {
  const serverPath = join(__dirname, 'dist', 'index.js');
  
  // Set minimal environment variables for testing
  const env = {
    ...process.env,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    JWT_SECRET: 'test-secret'
  };
  
  const server = spawn('node', [serverPath], {
    env,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let output = '';
  let errorOutput = '';
  
  server.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  server.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });
  
  // Wait a bit for startup
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  if (errorOutput.includes('RMS MCP Server running on stdio')) {
    console.log('✅ MCP server started successfully');
    console.log('✅ Server output:', errorOutput.trim());
  } else if (errorOutput.includes('Error:')) {
    console.log('❌ MCP server error:', errorOutput.trim());
  } else {
    console.log('⚠️  MCP server status unclear');
    console.log('Output:', output.trim());
    console.log('Error:', errorOutput.trim());
  }
  
  server.kill();
  
} catch (error) {
  console.log('❌ Error testing MCP server:', error.message);
}

// Test 4: Check MCP configuration for Claude Desktop
console.log('\n4. MCP Configuration for Claude Desktop:');
console.log('To configure Claude Desktop, add this to your claude_desktop_config.json:');
console.log(`
{
  "mcpServers": {
    "rms-supabase-server": {
      "command": "node",
      "args": ["${join(__dirname, 'dist', 'index.js')}"],
      "env": {
        "SUPABASE_URL": "YOUR_SUPABASE_URL",
        "SUPABASE_SERVICE_KEY": "YOUR_SUPABASE_SERVICE_KEY",
        "JWT_SECRET": "YOUR_JWT_SECRET"
      }
    }
  }
}
`);

console.log('\n🎯 Troubleshooting Tips:');
console.log('1. Make sure Claude Desktop is updated to the latest version');
console.log('2. Check that the MCP server path is correct in claude_desktop_config.json');
console.log('3. Verify environment variables are set correctly');
console.log('4. Check Claude Desktop logs for MCP connection errors');
console.log('5. Ensure the built file (dist/index.js) exists and is executable');

console.log('\n✅ Test completed!');
