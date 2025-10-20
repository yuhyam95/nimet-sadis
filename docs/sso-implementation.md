
Based on the current implementation, here's exactly what happens when you visit the sso-login route:

## What Happens When You Visit `/sso-login`

### 1. **Route Processing**
- The route expects a `token` parameter in the URL
- It also looks for an optional `nomenu` parameter
- If you visit `/sso-login` without a token, you'll be redirected to `/login`

### 2. **Token Source**
The token comes from the **URL query parameters**. The expected URL format is:
```
https://yourdomain.com/sso-login?token=<some_token_value>&nomenu=yes
```

### 3. **What Happens Step by Step**

#### **If you visit `/sso-login` without a token:**
- You get redirected to `/login` (the regular login page)
- This happens because the code checks `if (!ssoToken)` and redirects


#### **If you visit `/sso-login?token=token`:**
1. **Token Validation**: The token is sent to `https://edms.nimet.gov.ng/api/sadis/checkuser`
2. **API Call**: POST request with `{ "dataencrypted": "your_token" }`
3. **Response Handling**: 
   - If API returns `IsSuccess: false` → redirect to `/login`
   - If API returns `IsSuccess: true` → proceed with session creation
4. **Session Creation**: Creates a session cookie with format `user_{UserID}_{timestamp}_{Username}`
5. **Redirect**: Redirects you to `/` (home page)

### 4. **Where the Token Actually Comes From**

In your current implementation, the token is **expected to come from an external system** (NiMet Flight Folder system). The typical flow would be:

1. **User logs into NiMet Flight Folder system**
2. **NiMet system generates a token** for that user
3. **NiMet system redirects user** to your app with the token:
   ```
   https://yourdomain.com/sso-login?token=generated_token&nomenu=yes
   ```
4. **Your app validates the token** with NiMet's API
5. **If valid, user is logged into your app**

### 5. **Current Limitations**

Right now, if you manually visit `/sso-login` without a proper token from the NiMet system, you'll just get redirected to the login page. The SSO route is designed to work **only when called by the external NiMet system** with a valid token.


The token is essentially a "temporary password" that the NiMet system generates and passes to your application to prove that the user has already been authenticated in their system.