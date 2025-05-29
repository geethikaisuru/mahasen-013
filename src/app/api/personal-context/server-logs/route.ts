import { NextRequest, NextResponse } from 'next/server';

// Store logs in memory (will be cleared on server restart)
let serverLogs: {timestamp: string, message: string}[] = [];
let logIntercepted = false;

// Intercept console.log on the server side if not already intercepted
if (typeof global !== 'undefined' && global.console) {
  const originalConsoleLog = global.console.log;
  
  // Only intercept if not already intercepted
  if (!logIntercepted) {
    global.console.log = function(...args) {
      // Call original function
      originalConsoleLog.apply(console, args);
      
      // Store the log
      const logMessage = args.map(arg => 
        typeof arg === 'string' ? arg : 
        typeof arg === 'object' ? JSON.stringify(arg) : 
        String(arg)
      ).join(' ');
      
      // Add timestamp
      const timestamp = new Date().toISOString();
      
      // Add to logs array, limiting size to prevent memory issues
      serverLogs.push({ timestamp, message: logMessage });
      
      // Keep only last 1000 logs
      if (serverLogs.length > 1000) {
        serverLogs = serverLogs.slice(-1000);
      }
    };
    
    // Mark as intercepted to prevent double-interception
    logIntercepted = true;
  }
}

// Get server logs endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const after = searchParams.get('after');
  
  let filteredLogs = serverLogs;
  
  // Filter logs after a specific timestamp if provided
  if (after) {
    filteredLogs = filteredLogs.filter(log => log.timestamp > after);
  }
  
  // Return limited logs, most recent first
  return NextResponse.json({
    logs: filteredLogs.slice(-limit).reverse()
  });
}

// Clear logs endpoint
export async function DELETE() {
  serverLogs = [];
  return NextResponse.json({ success: true });
}

// Add a log manually endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;
    
    if (!message) {
      return NextResponse.json(
        { error: 'Missing message parameter' },
        { status: 400 }
      );
    }
    
    // Add timestamp
    const timestamp = new Date().toISOString();
    
    // Add to logs array
    serverLogs.push({ timestamp, message });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to add log: ${(error as Error).message}` },
      { status: 500 }
    );
  }
} 