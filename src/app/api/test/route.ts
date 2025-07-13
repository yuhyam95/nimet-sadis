import { NextResponse } from 'next/server';

export async function GET() {
  console.log('=== TEST API ROUTE HIT ===');
  console.log('This is a test log message');
  return NextResponse.json({ message: 'Test successful', timestamp: new Date().toISOString() });
} 