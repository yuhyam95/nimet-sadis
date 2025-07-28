import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth';

interface ApiResponse {
  UserID: number;
  Surname: string;
  FirstName: string;
  Othernames: string;
  Username: string;
  StaffID: string;
  IsSuccess: boolean;
  DownloadRight: boolean;
  Message: string;
  ViewRight: boolean;
}

export async function GET(req: NextRequest) {
  // Test mode: if ?test=1 is present, just log and return
  if (req.nextUrl.searchParams.get('test')) {
    console.log('=== SSO LOGIN TEST MODE HIT ===');
    return NextResponse.json({ message: 'SSO login test successful', timestamp: new Date().toISOString() });
  }

  console.log('=== SSO LOGIN ROUTE HIT ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);

  // Log all search params
  console.log('All search params:');
  const searchParams = req.nextUrl.searchParams;
  for (const [key, value] of searchParams.entries()) {
    console.log(`${key}: ${value}`);
  }

  const ssoToken = searchParams.get('token');
  const noMenu = searchParams.get('nomenu');

  console.log('SSO token received:', ssoToken);
  console.log('nomenu parameter:', noMenu);

  if (!ssoToken) {
    console.log('No token provided, redirecting to login');
    return NextResponse.redirect('/login');
  }

  try {
    console.log('About to call external API...');
    // Call the external API to validate the token (POST with JSON body)
    const apiUrl = 'https://edms.nimet.gov.ng/api/sadis/checkuser';
    console.log('API URL:', apiUrl);
    // Remove encryption: Pass token directly
    console.log('Request body:', JSON.stringify({ dataencrypted: ssoToken }));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataencrypted: ssoToken })
    });
    console.log('SSO API response status:', response.status, response.statusText);
    const responseText = await response.text();
    console.log('SSO API raw response:', responseText);
    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      return NextResponse.redirect('/login');
    }

    const data: ApiResponse = JSON.parse(responseText);
    console.log('SSO API parsed response:', data);

    if (!data.IsSuccess) {
      console.error('API returned IsSuccess: false, Message:', data.Message);
      return NextResponse.redirect('/login');
    }

    // Authentication successful, redirect to home
    console.log('SSO login successful.');
    const redirectUrl = new URL('/', req.url);

    // Set hideHeader=yes if nomenu=yes, otherwise set hideHeader=no
    if (noMenu === 'yes') {
        console.log('Adding hideHeader=yes to redirect URL');
        redirectUrl.searchParams.set('hideHeader', 'yes');
    } else {
        console.log('Adding hideHeader=no to redirect URL');
        redirectUrl.searchParams.set('hideHeader', 'no');
    }

    console.log('Redirecting to:', redirectUrl.toString());
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('SSO login error:', error);
    return NextResponse.redirect(new URL('/login', req.url));
  }
}
