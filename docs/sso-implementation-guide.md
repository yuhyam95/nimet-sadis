# SSO Login Implementation Guide

This document provides a comprehensive guide for implementing the SSO (Single Sign-On) authentication system used in the NiMet-SADIS application. This implementation integrates with an external NiMet EDMS API for user authentication.

## Overview

The SSO system uses a token-based authentication flow that:
- Validates tokens against an external NiMet API
- Creates secure session cookies
- Manages client-side authentication state
- Supports both SSO and traditional login methods

## Architecture

```
External System → SSO Token → /sso-login → API Validation → Session Creation → Protected Routes
```

## Implementation Steps

### 1. Create SSO Login Route

Create a new API route at `/app/sso-login/route.ts` (Next.js App Router):

```typescript
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
  // Test mode for development
  if (req.nextUrl.searchParams.get('test')) {
    console.log('=== SSO LOGIN TEST MODE HIT ===');
    return NextResponse.json({ 
      message: 'SSO login test successful', 
      timestamp: new Date().toISOString() 
    });
  }

  console.log('=== SSO LOGIN ROUTE HIT ===');
  console.log('Request URL:', req.url);
  
  // Extract token from URL parameters
  const ssoToken = req.nextUrl.searchParams.get('token');
  const noMenu = req.nextUrl.searchParams.get('nomenu');

  // Validate token presence
  if (!ssoToken) {
    console.log('No token provided, redirecting to login');
    const baseUrl = getBaseUrl(req);
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  try {
    // Call external API to validate token
    const apiUrl = 'https://edms.nimet.gov.ng/api/sadis/checkuser';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataencrypted: ssoToken })
    });

    if (!response.ok) {
      console.error('API request failed:', response.status, response.statusText);
      const baseUrl = getBaseUrl(req);
      return NextResponse.redirect(new URL('/login', baseUrl));
    }

    const data: ApiResponse = await response.json();
    
    if (!data.IsSuccess) {
      console.error('API returned IsSuccess: false, Message:', data.Message);
      const baseUrl = getBaseUrl(req);
      return NextResponse.redirect(new URL('/login', baseUrl));
    }

    // Authentication successful - create session and redirect
    const baseUrl = getBaseUrl(req);
    const redirectUrl = new URL('/', baseUrl);
    
    // Handle menu visibility parameter
    if (noMenu === 'yes') {
      redirectUrl.searchParams.set('hideHeader', 'yes');
    }

    // Create response with session cookie
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
    const baseUrl = getBaseUrl(req);
    return NextResponse.redirect(new URL('/login', baseUrl));
  }
}

// Helper function to get base URL with proxy support
function getBaseUrl(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost || req.headers.get('host') || req.nextUrl.host;
  const protocol = req.headers.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}
```

### 2. Create Session Management Utilities

Create `/lib/session-client.ts`:

```typescript
// Client-side session management
export function setSessionToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('session', token);
  }
}

export function getSessionToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('session');
  }
  return null;
}

export function removeSessionToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('session');
  }
}

export function parseSessionToken(token: string) {
  // Parse session token format: user_{UserID}_{timestamp}_{username}
  const parts = token.split('_');
  if (parts.length >= 4 && parts[0] === 'user') {
    return {
      userId: parts[1],
      timestamp: parseInt(parts[2]),
      username: parts.slice(3).join('_')
    };
  }
  return null;
}
```

### 3. Create Authentication Actions

Create `/lib/auth-actions.ts`:

```typescript
'use server';

interface LoginCredentials {
  username: string;
  password: string;
}

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

export async function loginAction(formData: FormData): Promise<{ 
  success: boolean; 
  message: string; 
}> {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { success: false, message: "Username and password are required." };
  }

  try {
    const apiUrl = 'https://edms.nimet.gov.ng/api/sadis/checkuser';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: username,
        password: password 
      })
    });

    if (!response.ok) {
      return { success: false, message: "Authentication server error." };
    }

    const data: ApiResponse = await response.json();

    if (!data.IsSuccess) {
      return { success: false, message: data.Message || "Invalid credentials." };
    }

    return { success: true, message: "Login successful." };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: "An error occurred during login." };
  }
}

export async function logoutAction() {
  // Clear server-side session if using server sessions
  // For client-side only, this is handled by the client
}
```

### 4. Create Protected Layout Component

Create `/app/(protected)/layout.tsx`:

```typescript
'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSessionToken, removeSessionToken } from '@/lib/session-client';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hideHeader, setHideHeader] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const hideHeaderParam = searchParams.get('hideHeader');
    const ssoSuccessParam = searchParams.get('sso_success');

    // Handle SSO success flag
    if (ssoSuccessParam === '1') {
      console.log('SSO login detected, creating session token');
      const sessionToken = `user_${Date.now()}`;
      localStorage.setItem('session', sessionToken);
      
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('sso_success');
      window.history.replaceState({}, '', url.pathname + url.search);
      
      setIsAuthenticated(true);
      setIsCheckingAuth(false);
    }

    // Handle header visibility
    if (hideHeaderParam !== null) {
      setHideHeader(hideHeaderParam === 'yes');
      
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('hideHeader');
      window.history.replaceState({}, '', url.pathname + url.search);
    }

    // Check existing session
    const sessionToken = getSessionToken();
    if (sessionToken) {
      setIsAuthenticated(true);
    }
    
    setIsCheckingAuth(false);
  }, [searchParams]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isCheckingAuth && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isCheckingAuth, router]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen">
      {!hideHeader && (
        <header className="border-b">
          <div className="container mx-auto px-4 py-2 flex justify-between items-center">
            <h1 className="text-xl font-bold">Your App</h1>
            <button 
              onClick={() => {
                removeSessionToken();
                router.push('/login');
              }}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    }>
      <LayoutContent>{children}</LayoutContent>
    </Suspense>
  );
}
```

### 5. Create Login Page

Create `/app/login/page.tsx`:

```typescript
'use client';
import { useTransition } from 'react';
import { loginAction } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result && !result.success) {
        toast({
          title: 'Login Failed',
          description: result.message,
          variant: 'destructive',
        });
      } else if (result && result.success) {
        // Create session token and redirect
        const sessionToken = `user_${Date.now()}`;
        localStorage.setItem('session', sessionToken);
        window.location.href = '/';
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isPending}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6. Create Middleware (Optional)

Create `/middleware.ts` for route protection:

```typescript
import { NextResponse, NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Add any additional middleware logic here
  // The main authentication is handled in the layout component
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|sso-login).*)'],
};
```

## Usage

### SSO Integration

To integrate with an external system that supports SSO:

1. **Configure External System**: Set up the external system to redirect to:
   ```
   https://yourdomain.com/sso-login?token=<sso_token>&nomenu=yes
   ```

2. **Token Format**: Ensure the external system provides a valid token that can be validated by your API endpoint.

### API Endpoint Configuration

Update the API URL in the SSO route to match your authentication service:

```typescript
const apiUrl = 'https://your-api-domain.com/api/checkuser';
```

### Environment Variables

Set up environment variables for different environments:

```env
# .env.local
NODE_ENV=development
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
```

## Security Considerations

1. **HTTPS Only**: Ensure all communication uses HTTPS in production
2. **Token Validation**: Always validate tokens against your authentication service
3. **Session Expiry**: Implement appropriate session timeouts
4. **Error Handling**: Never expose sensitive information in error messages
5. **Logging**: Implement comprehensive logging for security monitoring

## Testing

### Test Mode

Use the test parameter for development:

```
https://yourdomain.com/sso-login?test=1
```

### Manual Testing

1. **SSO Flow**: Test the complete SSO flow from external system
2. **Login Flow**: Test traditional username/password login
3. **Session Management**: Verify session creation and cleanup
4. **Error Handling**: Test various error scenarios

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your API endpoint allows requests from your domain
2. **Cookie Issues**: Check cookie settings and domain configuration
3. **Redirect Loops**: Verify authentication state management
4. **Token Validation**: Ensure token format matches API expectations

### Debug Logging

Enable debug logging by adding console.log statements at key points:

```typescript
console.log('SSO token received:', ssoToken);
console.log('API response:', data);
console.log('Session created:', sessionToken);
```

## Customization

### Session Token Format

Modify the session token format in the SSO route:

```typescript
const sessionToken = `custom_${data.UserID}_${Date.now()}_${data.Username}`;
```

### API Response Handling

Adapt the `ApiResponse` interface to match your API:

```typescript
interface ApiResponse {
  // Add your API response fields
  userId: string;
  email: string;
  roles: string[];
  isAuthenticated: boolean;
}
```

### Additional Features

Consider adding:
- Role-based access control
- Multi-factor authentication
- Session refresh mechanisms
- Audit logging
- User profile management

This implementation provides a robust foundation for SSO authentication that can be adapted to various external systems and requirements.
