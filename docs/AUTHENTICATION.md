# Avari - Authentication

**Last Updated:** 2026-01-09

Complete guide to authentication flows, session management, and security in Avari.

---

## Table of Contents
1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [Auth Flow Diagrams](#auth-flow-diagrams)
4. [Session Management](#session-management)
5. [Authorization Model](#authorization-model)
6. [Implementation Details](#implementation-details)
7. [Security Considerations](#security-considerations)

---

## Overview

**Provider:** Supabase Auth
**Methods:** Google OAuth, Email/Password
**Storage:** localStorage (JWT tokens)
**Context:** AuthProvider (React Context)

### Key Features
- OAuth sign-in with Google
- Email/password signup with verification (optional)
- Password reset via email link
- Auto-refresh tokens
- Profile auto-creation
- Protected routes

---

## Authentication Methods

### 1. Google OAuth

**User Flow:**
1. User clicks "Sign in with Google"
2. Redirected to Google consent screen
3. User grants permissions
4. Google redirects back to app with auth code
5. Supabase exchanges code for session
6. AuthProvider loads/creates profile
7. User lands on dashboard

**Implementation:**
```javascript
// components/LandingPage.js
const handleGoogleSignIn = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  });

  if (error) {
    alert('Google sign-in failed: ' + error.message);
  }
};
```

**Setup in Supabase:**
1. Go to Authentication → Providers
2. Enable Google
3. Add OAuth Client ID and Secret
4. Configure redirect URLs:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`

**Redirect URLs:**
- Supabase redirects to: `{redirectTo}#access_token=...`
- AuthProvider detects session in URL hash
- Cleans URL after extracting session

---

### 2. Email/Password Signup

**User Flow:**
1. User enters email, password, name
2. Supabase creates auth.users record
3. (Optional) Email verification sent
4. AuthProvider creates profile record
5. User lands on dashboard

**Implementation:**
```javascript
// components/LandingPage.js
const handleEmailSignUp = async (e) => {
  e.preventDefault();

  const { data, error } = await supabase.auth.signUp({
    email: signUpEmail,
    password: signUpPassword,
    options: {
      data: {
        name: signUpName
      },
      emailRedirectTo: `${window.location.origin}`
    }
  });

  if (error) {
    alert('Sign up failed: ' + error.message);
    return;
  }

  // Check if email confirmation required
  if (data?.user?.identities?.length === 0) {
    alert('Please check your email to confirm your account');
  }
};
```

**Email Verification:**
- **Optional** (can be disabled in Supabase settings)
- If enabled: User must click link in email before logging in
- Link format: `{redirectTo}#access_token=...&type=signup`

**To disable email verification:**
1. Supabase Dashboard → Authentication → Settings
2. Uncheck "Enable email confirmations"

---

### 3. Email/Password Login

**User Flow:**
1. User enters email and password
2. Supabase verifies credentials
3. Returns session (JWT tokens)
4. AuthProvider loads profile
5. User lands on dashboard

**Implementation:**
```javascript
// components/LandingPage.js
const handleEmailSignIn = async (e) => {
  e.preventDefault();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: signInEmail,
    password: signInPassword
  });

  if (error) {
    alert('Sign in failed: ' + error.message);
  }
};
```

---

### 4. Password Reset

**User Flow:**
1. User clicks "Forgot password"
2. Enters email
3. Supabase sends reset email
4. User clicks link in email
5. Redirected to `/reset-password` with token
6. User enters new password
7. Password updated

**Request Reset:**
```javascript
// components/LandingPage.js
const handlePasswordReset = async () => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });

  if (error) {
    alert('Error: ' + error.message);
  } else {
    alert('Password reset email sent. Check your inbox.');
  }
};
```

**Update Password:**
```javascript
// app/reset-password/page.js
const handleResetPassword = async (e) => {
  e.preventDefault();

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    alert('Error updating password: ' + error.message);
  } else {
    alert('Password updated successfully!');
    router.push('/');
  }
};
```

---

## Auth Flow Diagrams

### Sign Up Flow
```
User enters credentials
    ↓
┌────────────────────┐
│ supabase.auth      │
│  .signUp()         │
└────────┬───────────┘
         │
    ┌────▼─────┐
    │auth.users│ (created)
    └────┬─────┘
         │
    ┌────▼────────────┐
    │ Email sent?     │
    │ (if enabled)    │
    └────┬────────────┘
         │
         │ No verification
         ↓
┌────────────────────┐
│ AuthProvider       │
│  detects session   │
└────────┬───────────┘
         │
    ┌────▼────────┐
    │Load profile │
    └────┬────────┘
         │
    ┌────▼─────────────┐
    │Profile exists?   │
    └─┬────────────────┘
      │ No
      ↓
    ┌────────────────┐
    │Auto-create     │
    │profile record  │
    └────┬───────────┘
         │
         ↓
    ┌────────────┐
    │Render      │
    │MainApp     │
    └────────────┘
```

### Sign In Flow
```
User enters email/password
    ↓
┌──────────────────────────┐
│ supabase.auth            │
│  .signInWithPassword()   │
└──────────┬───────────────┘
           │
      ┌────▼─────┐
      │Verify    │
      │password  │
      └────┬─────┘
           │
      ┌────▼───────┐
      │Return      │
      │JWT tokens  │
      └────┬───────┘
           │
      ┌────▼────────────┐
      │Store in         │
      │localStorage     │
      └────┬────────────┘
           │
      ┌────▼─────────┐
      │AuthProvider  │
      │detects user  │
      └────┬─────────┘
           │
      ┌────▼────────┐
      │Load profile │
      └────┬────────┘
           │
           ↓
      ┌──────────┐
      │Render    │
      │MainApp   │
      └──────────┘
```

---

## Session Management

### Token Storage
- **Location:** localStorage
- **Keys:**
  - `sb-{project-ref}-auth-token`: Main auth token
  - Contains: access_token, refresh_token, expiry
- **Persistence:** Survives page refreshes, browser restarts

### Token Refresh
- **Auto-refresh:** Enabled by default
- **Trigger:** When access token expires (default: 1 hour)
- **Process:**
  1. Supabase detects token expiry
  2. Uses refresh_token to get new access_token
  3. Updates localStorage
  4. Continues without user interaction

### Session Detection
```javascript
// components/AuthProvider.js
useEffect(() => {
  const initAuth = async () => {
    // Check for existing session
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      setUser(session.user);
      await loadProfile(session.user.id);
    } else {
      setStatus('signed_out');
    }
  };

  initAuth();

  // Listen for auth state changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setStatus('signed_out');
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

### Sign Out
```javascript
// components/MainApp.js
const handleSignOut = async () => {
  await supabase.auth.signOut();
  router.push('/');
};
```
- Clears localStorage
- Invalidates refresh token
- Redirects to landing page

---

## Authorization Model

### User States
```javascript
const [status, setStatus] = useState('initializing');
```

**States:**
- `initializing`: Checking for existing session
- `loading_profile`: User found, loading profile
- `ready`: Authenticated with profile
- `profile_missing`: Authenticated but no profile (creates one)
- `signed_out`: No active session

### Protected Routes
```javascript
// app/layout.js
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

// Any page can check auth status
const { user, profile, status } = useAuth();

if (status === 'signed_out') {
  return <LandingPage />;
}

if (status !== 'ready') {
  return <div>Loading...</div>;
}

return <MainApp />;
```

### Permissions

**Public Access:**
- Landing page
- Password reset page

**Authenticated Access:**
- All features (meetups, chats, messages, profile)

**Resource-Based Permissions:**
- **Meetups**: Creator can edit/delete their own
- **Messages**: Users can read/send only their own
- **Coffee Chats**: Users can manage chats they're involved in
- **Profile**: Users can only edit their own

**RLS Policies** enforce permissions at database level (see [DATABASE.md](./DATABASE.md))

---

## Implementation Details

### AuthProvider Context

**File:** `components/AuthProvider.js`

**Exports:**
```javascript
{
  user,        // Supabase auth user (from auth.users)
  profile,     // User profile (from profiles table)
  status,      // Auth state
  signIn,      // Email/password sign in
  signUp,      // Email/password sign up
  signOut,     // Log out
  updateProfile // Update user profile
}
```

**Usage:**
```javascript
import { useAuth } from '@/components/AuthProvider';

function MyComponent() {
  const { user, profile, status } = useAuth();

  if (status === 'signed_out') {
    return <p>Please log in</p>;
  }

  return <p>Welcome, {profile?.name}!</p>;
}
```

### Profile Auto-creation

**When:** User signs in but has no profile record

**Process:**
```javascript
// components/AuthProvider.js
const loadProfile = async (userId) => {
  // Try to fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    // Auto-create profile
    const emailName = user.email
      .split('@')[0]
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: user.email,
        name: user.user_metadata?.name || emailName
      })
      .select()
      .single();

    setProfile(newProfile);
  } else {
    setProfile(profile);
  }

  setStatus('ready');
};
```

**Name Extraction:**
- Google OAuth: Uses `user.user_metadata.name` (from Google)
- Email signup: Uses provided name
- Fallback: Extracts from email
  - `john.doe@example.com` → "John Doe"
  - `alice_smith@company.com` → "Alice Smith"

---

## Security Considerations

### JWT Tokens
- **Signed with secret**: Only Supabase can generate valid tokens
- **Short-lived**: Access token expires in 1 hour
- **Refresh token**: Long-lived, used to get new access tokens
- **Stored in localStorage**: Acceptable risk (XSS mitigated by React)

### Password Security
- **Hashed**: bcrypt with salt (managed by Supabase)
- **Minimum length**: 6 characters (can be increased)
- **Reset via email**: Secure token sent to verified email

### XSS Protection
- **React escaping**: All user input auto-escaped
- **Content Security Policy**: Can be added via Next.js headers
- **No eval()**: No dynamic code execution

### CSRF Protection
- **SameSite cookies**: Set by Supabase
- **Origin checking**: Supabase validates request origin
- **JWT in header**: Not vulnerable to CSRF

### OAuth Security
- **State parameter**: Prevents CSRF attacks
- **PKCE flow**: Used by Supabase for extra security
- **Redirect validation**: Only whitelisted URLs allowed

### Rate Limiting
- **Built into Supabase**: Auth requests rate-limited
- **Default**: 10 requests per 5 seconds per IP
- **Can be customized**: In Supabase project settings

### Best Practices
1. ✅ Use HTTPS in production (required for OAuth)
2. ✅ Keep SUPABASE_ANON_KEY in environment variables
3. ✅ Never commit `.env.local` to git
4. ✅ Rotate secrets if compromised
5. ✅ Enable email verification for production
6. ✅ Monitor auth logs in Supabase Dashboard
7. ✅ Set up MFA (multi-factor auth) when Supabase supports it

---

**See also:**
- [Architecture](./ARCHITECTURE.md)
- [Database](./DATABASE.md)
- [Deployment](./DEPLOYMENT.md)
