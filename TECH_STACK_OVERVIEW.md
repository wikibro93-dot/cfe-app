# Community Food Exchange (CFE) - Technology Stack Overview

## 📋 Project Overview

**Project Name:** Community Food Exchange (CFE)  
**Project Type:** Food Swapping Platform  
**Version:** 0.1.0  
**Purpose:** A platform where users can share homemade dishes with neighbors worldwide using a credit-based swapping system.

---

## 🏗️ Core Technologies

### 1. **Next.js 16.1.6** - React Framework
**What it is:** A full-stack React framework for building web applications.

**Why it's used:**
- Server-side rendering (SSR) for better SEO and performance
- API routes for backend functionality
- File-based routing system
- Built-in optimization features
- Great developer experience

**Key Features Used:**
- App Router (modern routing system)
- Server Components for performance
- API Routes (`/api/*`)
- Image optimization
- Font optimization
- Middleware support

**Files:**
- [`next.config.ts`](next.config.ts) - Next.js configuration
- [`app/`](app/) - Application pages and routes
- [`app/api/`](app/api/) - API endpoints

---

### 2. **TypeScript 5** - Type-Safe JavaScript
**What it is:** A strongly typed programming language that builds on JavaScript.

**Why it's used:**
- Catch errors at compile time
- Better IDE support with autocomplete
- Self-documenting code
- Easier refactoring
- Improved code quality

**Configuration:**
- Strict mode enabled
- Path aliases configured (`@/*` maps to root)

**Files:**
- [`tsconfig.json`](tsconfig.json) - TypeScript configuration
- All `.ts` and `.tsx` files throughout the project

---

### 3. **React 19.2.3** - UI Library
**What it is:** A JavaScript library for building user interfaces.

**Why it's used:**
- Component-based architecture
- Virtual DOM for performance
- Rich ecosystem of libraries
- Hooks for state management
- Server Components support

**Key Features Used:**
- Server Components (for performance)
- Client Components (for interactivity)
- Hooks (`useState`, `useEffect`, `useCallback`, etc.)
- Context API for global state

**Files:**
- [`app/layout.tsx`](app/layout.tsx) - Root layout
- [`app/page.tsx`](app/page.tsx) - Home page
- All component files in [`components/`](components/)

---

## 🗄️ Database Technologies

### 4. **PostgreSQL** - Relational Database
**What it is:** A powerful, open-source object-relational database system.

**Why it's used:**
- Robust and reliable
- ACID compliance for data integrity
- Supports complex queries
- Excellent for transactional applications
- Scalable for production

**Hosting:** Neon (serverless PostgreSQL)

**Configuration:**
```env
DATABASE_URL="postgresql://neondb_owner:xxx@ep-nameless-frost-aij09qo8-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

---

### 5. **Prisma 7.4.2** - Database ORM
**What it is:** A next-generation Node.js and TypeScript ORM (Object-Relational Mapper).

**Why it's used:**
- Type-safe database queries
- Auto-completion in IDE
- Easy migrations
- Excellent developer experience
- Works with PostgreSQL, MySQL, SQLite, and more

**Key Features Used:**
- Schema definition ([`prisma/schema.prisma`](prisma/schema.prisma))
- Type-safe queries
- Migrations
- Seed data
- Client generation

**Database Models:**
- [`User`](prisma/schema.prisma:12-44) - User accounts and profiles
- [`Dish`](prisma/schema.prisma:57-89) - Food dishes
- [`Swap`](prisma/schema.prisma:91-115) - Swap transactions
- [`CreditTransaction`](prisma/schema.prisma:117-129) - Credit history
- [`Rating`](prisma/schema.prisma:131-145) - User ratings
- [`Notification`](prisma/schema.prisma:147-160) - User notifications
- [`ChatMessage`](prisma/schema.prisma:162-171) - Chat messages
- [`OTP`](prisma/schema.prisma:46-55) - One-time passwords

**Files:**
- [`prisma/schema.prisma`](prisma/schema.prisma) - Database schema
- [`prisma/seed.ts`](prisma/seed.ts) - Seed data
- [`lib/db.ts`](lib/db.ts) - Database client configuration
- [`prisma.config.ts`](prisma.config.ts) - Prisma configuration

---

## 🎨 Frontend Technologies

### 6. **Tailwind CSS 4** - CSS Framework
**What it is:** A utility-first CSS framework for rapidly building custom designs.

**Why it's used:**
- Rapid development
- Consistent design system
- Responsive design utilities
- Dark mode support
- Small bundle size

**Key Features Used:**
- Utility classes for styling
- Responsive breakpoints
- Custom theme configuration
- Dark mode support

**Files:**
- [`app/globals.css`](app/globals.css) - Global styles
- [`postcss.config.mjs`](postcss.config.mjs) - PostCSS configuration

---

### 7. **Framer Motion 12.35.0** - Animation Library
**What it is:** A production-ready motion library for React.

**Why it's used:**
- Smooth animations
- Gesture support
- Performance optimized
- Easy to use

**Files:**
- Used throughout components for animations

---

### 8. **Lucide React 0.577.0** - Icon Library
**What it is:** A collection of beautifully designed, consistent icons.

**Why it's used:**
- Consistent icon style
- Tree-shakeable (small bundle)
- Easy to use
- Customizable

**Files:**
- Used throughout the application for icons

---

### 9. **React Hot Toast 2.6.0** - Toast Notifications
**What it is:** A notification library for React.

**Why it's used:**
- Beautiful notifications
- Easy to use
- Customizable
- Great UX

**Files:**
- [`app/layout.tsx`](app/layout.tsx:48-62) - Toast configuration

---

### 10. **Leaflet 1.9.4 + React Leaflet 5.0.0** - Map Library
**What it is:** An open-source JavaScript library for interactive maps.

**Why it's used:**
- Interactive maps
- Location-based features
- Free and open-source
- Customizable

**Files:**
- [`components/map/DishMap.tsx`](components/map/DishMap.tsx) - Map component
- [`lib/geo.ts`](lib/geo.ts) - Geolocation utilities

---

## 🔧 State Management

### 11. **Zustand 5.0.11** - State Management
**What it is:** A small, fast, and scalable state-management solution.

**Why it's used:**
- Simple API
- No boilerplate
- TypeScript support
- Performance optimized
- Persistence support

**Files:**
- [`store/appStore.ts`](store/appStore.ts) - Global application state

**State Managed:**
- User authentication
- User profile data
- Language preferences
- Currency preferences
- User location
- Notification count
- Credits balance

---

### 12. **TanStack Query 5.90.21** - Data Fetching
**What it is:** A powerful data synchronization library for React.

**Why it's used:**
- Caching
- Automatic refetching
- Optimistic updates
- Pagination support
- Loading states

**Files:**
- Used throughout components for data fetching

---

## 🔐 Authentication & Security

### 13. **JSON Web Token (JWT) 9.0.3** - Authentication
**What it is:** A compact, URL-safe means of representing claims to be transferred between two parties.

**Why it's used:**
- Stateless authentication
- Cross-platform support
- Secure token-based auth
- Easy to implement

**⚠️ Note:** Current implementation has critical security issues (see production report)

**Files:**
- [`lib/jwt.ts`](lib/jwt.ts) - JWT utilities
- [`lib/auth.ts`](lib/auth.ts) - Authentication functions

---

### 14. **bcryptjs 3.0.3** - Password Hashing
**What it is:** A library to help you hash passwords.

**Why it's used:**
- Secure password hashing
- Salt generation
- Industry standard

**Note:** Currently not used (phone-based auth only)

---

### 15. **Upstash Redis 1.36.3 + Ratelimit 2.0.8** - Rate Limiting
**What it is:** A serverless Redis-compatible data store.

**Why it's used:**
- Rate limiting
- Caching (planned)
- Session storage (planned)

**Files:**
- [`lib/ratelimit.ts`](lib/ratelimit.ts) - Rate limiting implementation

---

## 💬 Real-time Features

### 16. **Socket.IO 4.8.3** - Real-time Communication
**What it is:** A library that enables real-time, bidirectional and event-based communication.

**Why it's used:**
- Real-time notifications
- Live chat
- Instant updates
- WebSocket support

**Files:**
- [`lib/socket.ts`](lib/socket.ts) - Socket.IO server configuration
- [`hooks/useSocket.ts`](hooks/useSocket.ts) - Socket client hook
- [`components/providers/SocketProvider.tsx`](components/providers/SocketProvider.tsx) - Socket provider

**Real-time Features:**
- Live notifications
- Chat messages
- Swap status updates
- New dish alerts

---

## 📤 File Upload

### 17. **Cloudinary** - Image Hosting
**What it is:** A cloud-based image and video management platform.

**Why it's used:**
- Image optimization
- Automatic resizing
- CDN delivery
- Free tier available

**Files:**
- [`lib/upload.ts`](lib/upload.ts) - Upload utilities

---

## 🌍 Internationalization

### 18. **Custom i18n Implementation**
**What it is:** Internationalization support for multiple languages.

**Why it's used:**
- Multi-language support
- Currency conversion
- Localized content

**Files:**
- [`lib/i18n.ts`](lib/i18n.ts) - i18n utilities
- [`lib/currency.ts`](lib/currency.ts) - Currency conversion

---

## 🧪 Testing

### 19. **Jest 30.2.0** - Testing Framework
**What it is:** A delightful JavaScript testing framework.

**Why it's used:**
- Unit testing
- Component testing
- Snapshot testing
- Easy to set up

**Files:**
- [`jest.config.ts`](jest.config.ts) - Jest configuration
- [`jest.setup.ts`](jest.setup.ts) - Test setup
- [`__tests__/`](__tests__/) - Test files

**Testing Libraries:**
- `@testing-library/react` - React component testing
- `@testing-library/jest-dom` - Custom Jest matchers
- `@testing-library/user-event` - User interaction simulation

---

## 🚀 Deployment

### 20. **Vercel** - Deployment Platform
**What it is:** A cloud platform for static sites and serverless functions.

**Why it's used:**
- Easy deployment
- Automatic HTTPS
- Edge network
- Preview deployments
- Great Next.js support

**Files:**
- [`vercel.json`](vercel.json) - Vercel configuration

---

## 📦 Package Management

### 21. **npm** - Package Manager
**What it is:** The default package manager for Node.js.

**Why it's used:**
- Dependency management
- Script execution
- Version control

**Files:**
- [`package.json`](package.json) - Project dependencies and scripts
- [`package-lock.json`](package-lock.json) - Locked dependency versions

---

## 🎯 Key Dependencies Breakdown

### Production Dependencies
```json
{
  "@neondatabase/serverless": "^1.0.2",      // Neon PostgreSQL client
  "@prisma/adapter-neon": "^7.4.2",          // Prisma adapter for Neon
  "@prisma/client": "^7.4.2",                // Prisma client
  "@tanstack/react-query": "^5.90.21",       // Data fetching
  "@upstash/ratelimit": "^2.0.8",           // Rate limiting
  "@upstash/redis": "^1.36.3",              // Redis client
  "bcryptjs": "^3.0.3",                      // Password hashing
  "clsx": "^2.1.1",                         // Class name utility
  "date-fns": "^4.1.0",                     // Date utilities
  "framer-motion": "^12.35.0",              // Animations
  "jsonwebtoken": "^9.0.3",                  // JWT
  "leaflet": "^1.9.4",                      // Maps
  "lucide-react": "^0.577.0",               // Icons
  "next": "16.1.6",                         // Next.js framework
  "next-pwa": "^5.6.0",                     // PWA support
  "next-themes": "^0.4.6",                  // Theme switching
  "prisma": "^7.4.2",                       // Prisma CLI
  "react": "19.2.3",                        // React
  "react-dom": "19.2.3",                    // React DOM
  "react-hot-toast": "^2.6.0",              // Toast notifications
  "react-leaflet": "^5.0.0",                // React Leaflet
  "socket.io": "^4.8.3",                    // Socket.IO server
  "socket.io-client": "^4.8.3",             // Socket.IO client
  "tailwind-merge": "^3.5.0",               // Tailwind utilities
  "ws": "^8.19.0",                          // WebSocket
  "zustand": "^5.0.11"                      // State management
}
```

### Development Dependencies
```json
{
  "@tailwindcss/postcss": "^4",              // Tailwind PostCSS
  "@testing-library/dom": "^10.4.1",         // DOM testing
  "@testing-library/jest-dom": "^6.9.1",     // Jest matchers
  "@testing-library/react": "^16.3.2",       // React testing
  "@testing-library/user-event": "^14.6.1",  // User events
  "@types/bcryptjs": "^2.4.6",              // TypeScript types
  "@types/jest": "^30.0.0",                 // Jest types
  "@types/jsonwebtoken": "^9.0.10",          // JWT types
  "@types/node": "^20",                     // Node types
  "@types/react": "^19",                    // React types
  "@types/react-dom": "^19",                // React DOM types
  "@types/ws": "^8.18.1",                   // WebSocket types
  "eslint": "^9",                           // Linting
  "eslint-config-next": "16.1.6",          // Next.js ESLint
  "jest": "^30.2.0",                       // Testing framework
  "jest-environment-jsdom": "^30.2.0",      // Jest DOM environment
  "tailwindcss": "^4",                      // Tailwind CSS
  "ts-jest": "^29.4.6",                    // TypeScript Jest
  "typescript": "^5"                        // TypeScript compiler
}
```

---

## 🏗️ Architecture Overview

### Frontend Architecture
```
┌─────────────────────────────────────────┐
│           Next.js App Router            │
│  ┌───────────────────────────────────┐  │
│  │     Pages (app/)                  │  │
│  │  ├── feed/                        │  │
│  │  ├── swaps/                       │  │
│  │  ├── post/                        │  │
│  │  ├── profile/                     │  │
│  │  └── admin/                       │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │     API Routes (app/api/)         │  │
│  │  ├── auth/                        │  │
│  │  ├── dishes/                      │  │
│  │  ├── swaps/                       │  │
│  │  ├── credits/                     │  │
│  │  ├── users/                       │  │
│  │  └── admin/                       │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Backend Architecture
```
┌─────────────────────────────────────────┐
│         API Layer                      │
│  ┌───────────────────────────────────┐  │
│  │  Authentication (JWT)             │  │
│  │  Rate Limiting (Upstash Redis)    │  │
│  │  Input Validation                 │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Business Logic                    │
│  ┌───────────────────────────────────┐  │
│  │  Swap Management                 │  │
│  │  Credit System                   │  │
│  │  Notifications                   │  │
│  │  Chat System                     │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Data Layer                        │
│  ┌───────────────────────────────────┐  │
│  │  Prisma ORM                      │  │
│  │  PostgreSQL (Neon)               │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Real-time Architecture
```
┌─────────────────────────────────────────┐
│      Socket.IO Server                   │
│  ┌───────────────────────────────────┐  │
│  │  WebSocket Connections            │  │
│  │  Room Management                 │  │
│  │  Event Broadcasting              │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
         ↓                    ↓
┌──────────────┐    ┌──────────────┐
│   Browser    │    │   Browser    │
│  (Client)    │    │  (Client)    │
└──────────────┘    └──────────────┘
```

---

## 📊 Technology Stack Summary

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | Next.js 16 | Full-stack React framework |
| **Language** | TypeScript 5 | Type-safe JavaScript |
| **Database** | PostgreSQL (Neon) | Relational database |
| **ORM** | Prisma 7 | Database ORM |
| **Styling** | Tailwind CSS 4 | CSS framework |
| **State** | Zustand 5 | State management |
| **Data Fetching** | TanStack Query 5 | Server state |
| **Real-time** | Socket.IO 4 | WebSockets |
| **Authentication** | JWT | Token-based auth |
| **Rate Limiting** | Upstash Redis | Rate limiting |
| **Maps** | Leaflet | Interactive maps |
| **Icons** | Lucide React | Icon library |
| **Animations** | Framer Motion | UI animations |
| **Testing** | Jest 30 | Testing framework |
| **Deployment** | Vercel | Hosting platform |

---

## 🎓 Learning Resources

If you're new to any of these technologies, here are some recommended resources:

### Next.js
- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js Learn Course](https://nextjs.org/learn)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

### Prisma
- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Blog](https://www.prisma.io/blog)

### React
- [React Documentation](https://react.dev)
- [React Patterns](https://reactpatterns.com/)

### Tailwind CSS
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Tailwind UI Components](https://tailwindui.com/)

---

## 📝 Conclusion

This project uses a **modern, production-ready tech stack** with:

✅ **Type-safe** development with TypeScript  
✅ **Server-side rendering** with Next.js  
✅ **Robust database** with PostgreSQL and Prisma  
✅ **Real-time features** with Socket.IO  
✅ **Beautiful UI** with Tailwind CSS  
✅ **State management** with Zustand  
✅ **Testing** with Jest  
✅ **Easy deployment** with Vercel  

The technology choices are well-suited for a food swapping platform and follow industry best practices. However, as noted in the production readiness report, there are critical security issues that need to be addressed before deployment.

---

**Last Updated:** 2026-03-08  
**Project Version:** 0.1.0
