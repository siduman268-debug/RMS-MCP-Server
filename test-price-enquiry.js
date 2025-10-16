#!/usr/bin/env node

/**
 * Test script for price_enquiry MCP tool
 */

import { spawn } from 'child_process';

// Set environment variables
process.env.SUPABASE_URL = "https://xsvwhctzwpfcwmmvbgmf.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdndoY3R6d3BmY3dtbXZiZ21mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIwMzUwMiwiZXhwIjoyMDc0Nzc5NTAyfQ.kY0FKyzntAj0RXgLyfe2y1dIeMlnGMfV50FSoyW0J2I";

// Test MCP request for price_enquiry
const testRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "price_enquiry",
    arguments: {
      pol_code: "INNSA",
      pod_code: "NLRTM", 
      container_type: "40HC",
      container_count: 1
    }
  }
};

console.log("Starting MCP server test...");
console.log("Test request:", JSON.stringify(testRequest, null, 2));

// Start the MCP server
const mcpServer = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

// Handle server output
mcpServer.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString());
});

mcpServer.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

mcpServer.on('close', (code) => {
  console.log(`MCP server exited with code ${code}`);
});

// Send the test request after a short delay
setTimeout(() => {
  console.log("\nSending test request...");
  mcpServer.stdin.write(JSON.stringify(testRequest) + '\n');
  
  // Wait for response and then close
  setTimeout(() => {
    mcpServer.kill();
  }, 5000);
}, 2000);
