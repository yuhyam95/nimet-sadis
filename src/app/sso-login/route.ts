import { NextRequest, NextResponse } from 'next/server';

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
  const noMenu = searchParams.get('nomenu'); // Still read nomenu to decide whether to add hideHeader to redirect

  console.log('SSO token received:', ssoToken);
  console.log('nomenu parameter:', noMenu);

  if (!ssoToken) {
    console.log('No token provided, redirecting to login');
    // Check for X-Forwarded-Host first, then host, then request host
    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host') || req.nextUrl.host;
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;
    return NextResponse.redirect(new URL('/login', baseUrl));
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
      // Check for X-Forwarded-Host first, then host, then request host
      const forwardedHost = req.headers.get('x-forwarded-host');
      const host = forwardedHost || req.headers.get('host') || req.nextUrl.host;
      const protocol = req.headers.get('x-forwarded-proto') || 'https';
      const baseUrl = `${protocol}://${host}`;
      return NextResponse.redirect(new URL('/login', baseUrl));
    }

    const data: ApiResponse = JSON.parse(responseText);
    console.log('SSO API parsed response:', data);
    
    if (!data.IsSuccess) {
      console.error('API returned IsSuccess: false, Message:', data.Message);
      // Check for X-Forwarded-Host first, then host, then request host
      const forwardedHost = req.headers.get('x-forwarded-host');
      const host = forwardedHost || req.headers.get('host') || req.nextUrl.host;
      const protocol = req.headers.get('x-forwarded-proto') || 'https';
      const baseUrl = `${protocol}://${host}`;
      return NextResponse.redirect(new URL('/login', baseUrl));
    }

    // Authentication successful, redirect to home
    console.log('SSO login successful.');
    
    // Get the correct host from headers or use the request host
    // Check for X-Forwarded-Host first, then host, then request host
    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host') || req.nextUrl.host;
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;
    
    const redirectUrl = new URL('/', baseUrl);
    
    // If nomenu=yes, add hideHeader=yes to the redirect URL for the client to handle
    if (noMenu === 'yes') {
        console.log('Adding hideHeader=yes to redirect URL');
        redirectUrl.searchParams.set('hideHeader', 'yes');
    }
    console.log('Redirecting to:', redirectUrl.toString());
    
    // Create response with session token in a cookie
    const redirectResponse = NextResponse.redirect(redirectUrl);
    const sessionToken = `user_${data.UserID}_${Date.now()}_${data.Username}`;
    redirectResponse.cookies.set('session', sessionToken, {
        httpOnly: false, // Allow client-side access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 // 24 hours
    });
    
    return redirectResponse;
    
  } catch (error) {
    console.error('SSO login error:', error);
    // Check for X-Forwarded-Host first, then host, then request host
    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host') || req.nextUrl.host;
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;
    return NextResponse.redirect(new URL('/login', baseUrl));
  }
}
