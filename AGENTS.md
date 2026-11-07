# AGENTS.md - Frontend-v2 Project Guide for LLMs

This file provides comprehensive guidance for Claude Code and other LLMs working on the frontend-v2 project. It covers architecture, conventions, patterns, and best practices.

## Project Overview

**Frontend-v2** is a modern React Single Page Application (SPA) built with:
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 5
- **Styling:** Tailwind CSS 3 + Shadcn UI components
- **State Management:** React Query (server state) + React Context (auth state)
- **Form Handling:** React Hook Form + Zod validation
- **Routing:** React Router 6
- **Authentication:** JWT tokens with cookie-based refresh tokens
- **Port:** Development runs on **http://localhost:3000**
- **API Base:** Backend at **http://localhost:8080** with `/api` prefix

---

## Directory Structure

```
frontend-v2/
├── src/
│   ├── components/
│   │   ├── ui/                  # Shadcn UI pre-built components
│   │   ├── auth/                # LoginForm.tsx, RegisterForm.tsx
│   │   ├── layout/              # ProtectedRoute.tsx, Layout.tsx
│   │   ├── icons/               # GoogleIcon.tsx (custom icons)
│   │   ├── Layout.tsx           # Main app layout (sidebar + main)
│   │   ├── BookCard.tsx         # Book display card component
│   │   ├── SearchBar.tsx        # Search input component
│   │   └── NavLink.tsx          # React Router NavLink wrapper
│   ├── pages/
│   │   ├── Auth.tsx             # Login/Register page
│   │   ├── Index.tsx            # Home page (redirects to Library)
│   │   ├── Library.tsx          # Book grid view
│   │   ├── AddBooks.tsx         # Add new books form
│   │   ├── Chat.tsx             # AI chat interface
│   │   ├── BookDetail.tsx       # Single book details
│   │   ├── Settings.tsx         # User settings
│   │   └── NotFound.tsx         # 404 page
│   ├── hooks/
│   │   ├── useAuth.tsx          # AuthProvider + useAuth context hook
│   │   ├── auth/
│   │   │   └── useAuth.ts       # Auth mutations with React Query
│   │   ├── use-mobile.tsx       # Mobile breakpoint detection
│   │   └── use-toast.ts         # Toast notification hook
│   ├── lib/
│   │   ├── api.ts               # Fetch-based API client
│   │   ├── utils.ts             # cn() class merging utility
│   │   └── schemas/
│   │       └── authSchema.ts    # Zod validation schemas
│   ├── types/
│   │   ├── api.ts               # PagedResult<T>, ApiError, QueryParams
│   │   ├── auth.ts              # User, LoginDto, LoginResult, etc.
│   │   └── book.ts              # Book domain type
│   ├── App.tsx                  # Root component (routing + providers)
│   ├── main.tsx                 # Entry point
│   ├── index.css                # Global styles (CSS variables)
│   ├── App.css                  # App-specific styles
│   └── vite-env.d.ts            # Vite environment type definitions
├── public/                       # Static assets
├── vite.config.ts               # Vite configuration
├── tailwind.config.ts           # Tailwind CSS config
├── tsconfig.json & variants     # TypeScript configuration
├── eslint.config.js             # ESLint rules
├── index.html                   # HTML entry point
├── .env.example                 # Environment variables template
├── package.json                 # Dependencies and scripts
├── AGENTS.md                    # This file
└── IMPLEMENTATION_PLAN.md       # Original implementation notes
```

---

## Core Architecture

### Component Hierarchy

```
App.tsx
├── QueryClientProvider          # React Query setup
├── TooltipProvider              # Radix UI tooltips
├── AuthProvider                 # Auth context
├── BrowserRouter                # React Router
│   └── Routes
│       ├── /auth → Auth page
│       └── /* → ProtectedRoute
│           └── Layout (sidebar)
│               ├── / → Library (books grid)
│               ├── /add → AddBooks (form)
│               ├── /chat → Chat (AI interface)
│               ├── /settings → Settings
│               ├── /book/:id → BookDetail
│               └── /* → NotFound
```

### Provider Setup (App.tsx)

The app wraps all functionality with multiple context providers:

1. **QueryClientProvider** - React Query for server state caching
2. **TooltipProvider** - Radix UI tooltips globally available
3. **AuthProvider** - Provides useAuth() hook throughout app
4. **BrowserRouter** - React Router for navigation
5. **Toaster/Sonner** - Toast notification components

**Important:** All providers must be in place for hooks to work. Never use useAuth, useQuery, useToast, etc. outside their providers.

---

## Styling System

### Tailwind CSS + Design Tokens

The project uses **Tailwind CSS 3.4** with a dark theme optimized for book-related content.

**Color Palette** (`src/index.css` CSS variables):

```css
:root {
  --background: 0 0% 6%;           /* Very dark gray */
  --foreground: 0 0% 98%;          /* Off-white */

  --primary: 186 100% 53%;         /* Bright cyan */
  --primary-foreground: 0 0% 6%;

  --secondary: 0 0% 12%;           /* Dark gray */
  --secondary-foreground: 0 0% 98%;

  --destructive: 0 84% 60%;        /* Red for errors */

  --sidebar: 0 0% 4%;              /* Even darker for sidebar */
  --sidebar-foreground: 0 0% 98%;
  --sidebar-accent: 186 100% 53%;  /* Cyan accent */
  --sidebar-accent-foreground: 0 0% 4%;
  --sidebar-border: 0 0% 12%;

  --nav-hover: 0 0% 12%;           /* Darker gray for hover states */
  --book-card: 0 0% 10%;           /* Book card background */
  --search-bg: 0 0% 8%;            /* Search bar background */
}

/* Dark theme enabled via class strategy */
@media (prefers-color-scheme: dark) {
  /* Applies same palette */
}
```

### Shadcn UI Components

Pre-built, accessible components from Shadcn UI (Radix UI + Tailwind):

- **Form:** Input, Label, Button, Textarea, FormField
- **Layout:** Card, Tabs, DropdownMenu, Dialog, Sheet, Sidebar
- **Data Display:** Table, Badge, Pagination, Accordion
- **Feedback:** Toast, Alert, Progress, Skeleton
- **Navigation:** Breadcrumb, NavigationMenu, Menubar

All stored in `src/components/ui/` and ready to import.

### Class Merging Utility

```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Purpose:** Combines Tailwind classes intelligently, resolving conflicts. Use when building components with conditional classes:

```typescript
<button className={cn("px-4 py-2", isPrimary && "bg-primary")}>
  Click me
</button>
```

---

## API Integration

### API Client (src/lib/api.ts)

A lightweight fetch-based HTTP client with automatic `/api` prefix:

```typescript
export const API_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api`;

const api = {
  get: async <T>(endpoint: string, params?: object): Promise<T>,
  post: async <T>(endpoint: string, body?: unknown): Promise<T>,
  put: async <T>(endpoint: string, body: unknown): Promise<T>,
  delete: async <T>(endpoint: string): Promise<T>,
  upload: async <T>(endpoint: string, formData: FormData): Promise<T>,
};
```

**Features:**
- ✅ Credentials included (cookies for refresh tokens)
- ✅ `Content-Type: application/json` set automatically
- ✅ Errors thrown as Error objects with messages
- ✅ Query parameters built from objects (handles arrays)
- ✅ FormData upload without Content-Type header

**Usage Examples:**

```typescript
// GET with query params
const books = await api.get<PagedResult<Book>>('/books', { page: 1, pageSize: 20 });

// POST with body
const result = await api.post<LoginResult>('/auth/login', { email, password });

// PUT for updates
await api.put<Book>('/books/123', { title: 'New Title' });

// DELETE
await api.delete<void>('/books/123');

// File upload
const formData = new FormData();
formData.append('file', file);
const response = await api.upload<UploadResponse>('/files/upload', formData);
```

### Environment Configuration

File: `.env.example`

```env
VITE_API_BASE_URL=http://localhost:8080
# Frontend runs on port 3000, API backend runs on port 8080
# API endpoints are automatically prefixed with /api
```

**To configure locally:** Copy `.env.example` to `.env.local` and update values.

---

## Authentication Flow

### Overview

1. User visits `/auth` page
2. Fills LoginForm or RegisterForm
3. Form submits to `/auth/login` or `/auth/register`
4. Backend returns `LoginResult` with tokens
5. `useAuth` hook fetches `/auth/me` to store user data
6. User redirected to `/` (protected routes)
7. Layout shows sidebar with user email and logout button
8. On logout: `/auth/logout` called, cache cleared, redirect to `/auth`

### AuthProvider & useAuth Hook

**Location:** `src/hooks/useAuth.tsx` (Context Provider)

Wraps the entire app and provides `AuthContext` with:
- `user: User | null` - Current authenticated user
- `isAuthenticated: boolean` - Whether user is logged in
- Persistence via localStorage (user data stored on login)

**Location:** `src/hooks/auth/useAuth.ts` (React Query Mutations)

Provides mutations for authentication:
- `useLoginMutation()` - POST `/auth/login`
- `useRegisterMutation()` - POST `/auth/register`
- `useLogoutMutation()` - POST `/auth/logout`
- `useCurrentUserQuery()` - GET `/auth/me`

**Usage in Components:**

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) return <div>Not logged in</div>;
  return <div>Welcome {user?.email}</div>;
}
```

### ProtectedRoute Component

**Location:** `src/components/layout/ProtectedRoute.tsx`

Wrapper component that:
1. Checks if user is authenticated
2. Shows loading state while checking auth
3. Redirects unauthenticated users to `/auth`
4. Allows authenticated users to see protected content

```typescript
<ProtectedRoute>
  <Dashboard />
</ProtectedRoute>
```

### Token Management

- **Access Token:** Stored in memory, sent in request body if needed
- **Refresh Token:** Stored in secure HTTPOnly cookie
- **Session Persistence:** localStorage stores user object (email, name)
- **Logout:** Clears all auth data and invalidates query cache

---

## Form Handling & Validation

### React Hook Form + Zod Pattern

**Technology Stack:**
- **React Hook Form** - Performant form state management
- **Zod** - TypeScript-first schema validation

**Validation Schemas** (`src/lib/schemas/authSchema.ts`):

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address'),
  password: z.string()
    .min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
    .min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
```

### Form Component Pattern

**Example:** `src/components/auth/LoginForm.tsx`

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/lib/schemas/authSchema';

export function LoginForm() {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      // Call API
      const result = await api.post('/auth/login', data);
      // Handle success
    } catch (error) {
      form.setError('root', { message: error.message });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input placeholder="you@example.com" {...field} />
            </FormControl>
            <FormMessage /> {/* Error displays here */}
          </FormItem>
        )}
      />
      {/* More fields... */}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? 'Logging in...' : 'Login'}
      </Button>
    </form>
  );
}
```

### Key Patterns

1. **Use `zodResolver`** - Connects Zod schema to React Hook Form
2. **Type inference with `z.infer<typeof schema>`** - Get TypeScript types from Zod
3. **FormField wrapper** - Provides validation and error display
4. **Conditional button state** - Disable during submission
5. **Error handling** - Display errors via FormMessage or manual setError

---

## State Management

### Architecture: React Query + Context

**Server State** (data from API) → **React Query**
```typescript
const { data: books, isLoading } = useQuery({
  queryKey: ['books', page],
  queryFn: () => api.get<PagedResult<Book>>('/books', { page }),
});
```

**Auth State** (user info) → **React Context**
```typescript
const { user, isAuthenticated } = useAuth();
```

**Local Component State** (form inputs, UI toggles) → **useState**
```typescript
const [message, setMessage] = useState('');
```

### React Query Configuration

**File:** `src/App.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,                    // Retry once on failure
      refetchOnWindowFocus: false,  // Don't refetch when window regains focus
    },
  },
});
```

### Query Keys Pattern

Use array-based query keys for caching:
```typescript
// Keys by feature
['auth', 'me']           // Current user
['books']                // All books
['books', { page: 2 }]   // Books with filters
['book', bookId]         // Single book detail
['chat', 'messages']     // Chat messages
```

### Mutation Pattern with React Query

```typescript
import { useMutation } from '@tanstack/react-query';

function useCreateBook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newBook: BookInput) =>
      api.post<Book>('/books', newBook),

    onSuccess: (newBook) => {
      // Invalidate list to refetch
      queryClient.invalidateQueries({ queryKey: ['books'] });
      // Or optimistically update
      queryClient.setQueryData(['book', newBook.id], newBook);
      toast.success('Book created!');
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
```

---

## Routing Structure

### React Router Configuration

**File:** `src/App.tsx`

```
/auth                    → Auth page (login/register)
/                        → Library (protected) - home page
/add                     → AddBooks form (protected)
/chat                    → AI Chat interface (protected)
/settings                → User Settings (protected)
/book/:id                → Book Details (protected)
/*                       → NotFound 404 page
```

### Navigation

**Programmatic Navigation:**
```typescript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/books');        // Navigate to page
navigate('/book/123');     // With param
navigate(-1);              // Go back
```

**Link Component:**
```typescript
import { Link } from 'react-router-dom';
<Link to="/book/123">View Book</Link>
```

**Active Link with Styles:**
```typescript
import { NavLink } from 'react-router-dom';
<NavLink
  to="/"
  className={({ isActive }) => isActive ? 'active' : ''}
>
  Home
</NavLink>
```

**Custom NavLink Wrapper:** `src/components/NavLink.tsx`

Wraps React Router's NavLink to add active class automatically.

---

## Custom Hooks

### useAuth()
**Location:** `src/hooks/useAuth.tsx`
- Returns: `{ user, isAuthenticated, login, register, logout }`
- Provides auth state and methods
- Must be used inside AuthProvider

### useAuth (Query Hooks)
**Location:** `src/hooks/auth/useAuth.ts`
- `useLoginMutation()` - Handle login
- `useRegisterMutation()` - Handle registration
- `useLogoutMutation()` - Handle logout
- `useCurrentUserQuery()` - Fetch current user

### useIsMobile()
**Location:** `src/hooks/use-mobile.tsx`
- Returns: `boolean` (true if screen < 768px)
- Useful for responsive design
```typescript
const isMobile = useIsMobile();
return isMobile ? <MobileView /> : <DesktopView />;
```

### useToast()
**Location:** `src/hooks/use-toast.ts` (from Radix UI)
- Returns: `{ toast(options) }`
- Trigger notifications
```typescript
const { toast } = useToast();
toast({
  title: 'Success',
  description: 'Book added!',
  variant: 'default', // or 'destructive'
});
```

---

## Types and Interfaces

### API Types (src/types/api.ts)

```typescript
// Generic paginated response
interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// Standard error response
interface ApiError {
  code: string;
  message: string;
}

// Query parameters
interface QueryParams {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  ascending?: boolean;
}
```

### Auth Types (src/types/auth.ts)

```typescript
interface User {
  id: string;
  email: string;
  name?: string;
}

interface LoginDto {
  email: string;
  password: string;
}

interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
}

interface UserResponse {
  user: User;
}
```

### Book Types (src/types/book.ts)

```typescript
interface Book {
  id: string;
  title: string;
  author: string;
  cover?: string;
  year?: number;
  addedDate: string;
  // Additional fields as needed
}

interface BookInput {
  title: string;
  author: string;
  year?: number;
  // For add/edit operations
}
```

---

## Build & Development

### Development Commands

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Build with source maps (development)
npm run build:dev

# Preview production build locally
npm run preview

# Lint code
npm run lint
```

### Vite Configuration (vite.config.ts)

```typescript
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,        // Frontend dev port
  },
  plugins: [
    react(),           // React JSX transform
    componentTagger()  // For Lovable Cloud integration
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),  // @ = src/
    },
  },
}));
```

### TypeScript Configuration

**tsconfig.app.json:**
- Target: ES2020
- Module: ESNext
- Strict mode: disabled
- Path aliases: `@/*` → `./src/*`

---

## Code Conventions

### File Organization

```
src/
├── components/        # React components
├── pages/            # Page-level components
├── hooks/            # Custom React hooks
├── lib/              # Utilities & helpers
├── types/            # TypeScript interfaces
└── [root files]      # App.tsx, main.tsx, etc.
```

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `BookCard.tsx`, `LoginForm.tsx` |
| Hooks | camelCase + 'use' | `useAuth.ts`, `useIsMobile.tsx` |
| Pages | PascalCase | `Library.tsx`, `AddBooks.tsx` |
| Utilities | camelCase | `cn()`, `api` |
| Constants | camelCase | `MOBILE_BREAKPOINT` |
| Types | PascalCase | `Book`, `LoginDto` |
| Type files | snake_case | `auth.ts`, `api.ts` |
| Interfaces | PascalCase | `User`, `PagedResult<T>` |

### Component Template

```typescript
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  children: ReactNode;
  variant?: 'default' | 'outlined';
  className?: string;
}

const MyComponent = ({
  children,
  variant = 'default',
  className
}: MyComponentProps) => {
  return (
    <div className={cn(
      'base-styles',
      variant === 'outlined' && 'border border-gray-300',
      className
    )}>
      {children}
    </div>
  );
};

export default MyComponent;
```

### Error Handling Patterns

```typescript
// Try-catch with user feedback
try {
  const result = await api.post('/books', data);
  toast.success('Book added!');
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  toast.error(message);
}

// In mutations
mutationFn: async (data) => api.post('/books', data),
onError: (error: Error) => {
  toast.error(error.message || 'Failed to save');
},
```

### Loading States

```typescript
// Query loading
const { data, isLoading } = useQuery({...});
if (isLoading) return <Skeleton />;

// Mutation loading
const mutation = useMutation({...});
<Button disabled={mutation.isPending}>
  {mutation.isPending ? 'Saving...' : 'Save'}
</Button>

// Manual state
const [isLoading, setIsLoading] = useState(false);
<button disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Click me'}
</button>
```

---

## Important Files Reference

### Core Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root component with routing and providers |
| `src/main.tsx` | Entry point, mounts React to DOM |
| `src/lib/api.ts` | HTTP client for API calls |
| `src/hooks/useAuth.tsx` | Authentication context provider |
| `src/components/Layout.tsx` | Main layout with sidebar |
| `src/components/layout/ProtectedRoute.tsx` | Route guard for auth |
| `src/lib/utils.ts` | `cn()` class utility |
| `src/index.css` | Global styles & CSS variables |

### Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite build configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `tsconfig.json` | Root TypeScript config |
| `tsconfig.app.json` | App TypeScript config |
| `eslint.config.js` | Code linting rules |
| `.env.example` | Environment variable template |

---

## Best Practices

### ✅ DO

- Use TypeScript for type safety
- Use React Query for server state
- Use useAuth hook for auth state
- Use Tailwind + cn() for styling
- Use Shadcn UI components for UI
- Use zod + React Hook Form for forms
- Create reusable components in /components
- Keep pages thin (mostly imports and layout)
- Validate API responses with types
- Handle errors with toast notifications
- Use loading/skeleton states

### ❌ DON'T

- Don't use inline styles (use Tailwind)
- Don't create CSS modules (use Tailwind)
- Don't call API outside of hooks/components
- Don't use useAuth outside AuthProvider
- Don't hardcode API URLs (use env vars)
- Don't forget loading/error states in UI
- Don't mutate objects directly (use setters)
- Don't nest components deeply (extract to separate files)
- Don't over-abstract (keep components simple)
- Don't forget to handle async errors

---

## Common Tasks

### Adding a New Page

1. Create file in `src/pages/MyPage.tsx`
2. Add route to `App.tsx` routes
3. Create types in `src/types/` if needed
4. Use Layout wrapper for sidebar
5. Use useQuery/useMutation for API calls

### Adding a New API Endpoint

1. Define types in `src/types/api.ts` or domain file
2. Call via `api.get()`, `api.post()`, etc.
3. Use React Query for caching (useQuery/useMutation)
4. Handle errors with try-catch or onError callback
5. Show feedback with toast notifications

### Adding a Form

1. Define Zod schema in `src/lib/schemas/`
2. Create component with useForm + zodResolver
3. Use FormField for each input with validation
4. Handle submission with mutation
5. Show loading/error states

### Adding a Component

1. Create in `src/components/` (or subdirectory)
2. Define TypeScript interface for props
3. Use Tailwind for styling
4. Use cn() for conditional classes
5. Export as default

### Styling a Component

1. Use Tailwind utility classes
2. Use cn() to merge conditional classes
3. Reference CSS variables from src/index.css
4. Use Shadcn UI components when available
5. Avoid inline styles completely

---

## Debugging Tips

### React DevTools

- Install React DevTools browser extension
- Inspect component props, state, hooks
- Check context values in AuthProvider

### Vite HMR

- Hot Module Replacement (HMR) enabled
- Changes appear instantly without refresh
- Check console for HMR messages

### Network Debugging

- Open browser DevTools → Network tab
- Check API requests/responses
- Verify `http://localhost:8080/api/*` endpoints
- Check response bodies for errors

### Console Logging

```typescript
console.log('Variable:', variable);
console.error('Error:', error);
console.table(arrayOfObjects);  // Nice table view
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "useAuth must be used within AuthProvider" | Hook called outside provider | Move component inside AuthProvider |
| "Cannot read property of undefined" | Async data not loaded | Add loading/skeleton state |
| "API 404 Not Found" | Wrong endpoint or missing /api prefix | Check API_URL in src/lib/api.ts |
| "CORS error" | Backend not accepting requests | Check backend CORS config |
| "Tailwind classes not working" | Class name conditional wrong | Use cn() to merge classes properly |

---

## Performance Considerations

### Optimization Checklist

- ✅ React Query caching reduces unnecessary API calls
- ✅ memoization available via React.memo for expensive components
- ✅ Code splitting automatic via Vite
- ✅ Tailwind purges unused CSS in production
- ✅ Images should be optimized/lazy loaded

### Tips

1. Use React.memo for components receiving same props
2. Use useCallback for memoizing callbacks
3. Paginate large lists (already done via PagedResult)
4. Lazy load routes with React.lazy() if needed
5. Monitor bundle size with build stats

---

## Testing

In restricted ChatGPT Work Linux environments, if headless Chromium fails with EGL errors, try Playwright launch args `--disable-gpu` and `--disable-software-rasterizer` (verified with `@sparticuz/chromium`).

**Current State:** No testing framework set up.

**Recommended Setup (future):**
- Vitest for unit tests
- Testing Library for component tests
- MSW (Mock Service Worker) for API mocking

**Pattern when testing is added:**
```typescript
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './MyComponent';

test('renders correctly', () => {
  render(
    <QueryClientProvider client={queryClient}>
      <MyComponent />
    </QueryClientProvider>
  );
  expect(screen.getByText('Expected text')).toBeInTheDocument();
});
```

---

## Summary

This frontend is a **modern, production-ready React SPA** featuring:

- 🔒 Secure JWT-based authentication with cookie refresh tokens
- 📦 React Query for intelligent server state caching
- 🎨 Dark-themed design system with Tailwind CSS
- ✅ Type-safe forms with React Hook Form + Zod
- 🛣️ Clean routing with React Router v6
- 🧩 Accessible UI components from Shadcn/Radix
- ⚡ Vite for fast development and production builds
- 📱 Mobile-responsive design with Tailwind
- 🎯 Clear separation of concerns (pages, components, hooks, types)
- 🚀 Ready to scale with established patterns and conventions

**When working on this project:**
1. Read this file first for context
2. Follow the established patterns in similar files
3. Use TypeScript for type safety
4. Keep components focused and reusable
5. Test your changes locally before committing
6. Refer to specific sections when implementing features
