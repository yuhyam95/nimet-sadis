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
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect('/login');

  try {
    // Call the external API to validate the token
    const apiUrl = `https://edms.nimet.gov.ng/api/sadis/checkuser?dataencrypted=${encodeURIComponent(token)}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      return NextResponse.redirect('/login');
    }

    const data: ApiResponse = await response.json();
    
    if (!data.IsSuccess) {
      console.error('API returned IsSuccess: false, Message:', data.Message);
      return NextResponse.redirect('/login');
    }

    // Create session with user data from API response
    const username = data.Username;
    const fullName = `${data.FirstName} ${data.Othernames} ${data.Surname}`.trim();
    
    await createSession(username, fullName, []);
    return NextResponse.redirect('/');
    
  } catch (error) {
    console.error('SSO login error:', error);
    return NextResponse.redirect('/login');
  }
} 