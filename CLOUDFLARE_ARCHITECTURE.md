# Cloudflare Multi-App Architecture Plan

## Current Issue
We have everything (customer, admin, staff) in a single app, which creates:
- Security concerns (admin code exposed to customers)
- Bundle size issues (customers download admin features)
- Deployment complexity (all changes affect all users)

## Recommended Architecture

### 1. **Separate Cloudflare Pages Projects**

```
muse-and-co/
├── muse-customer/          → customer.museandco.com
├── muse-admin/            → admin.museandco.com
├── muse-staff/            → staff.museandco.com
└── muse-api-workers/      → Cloudflare Workers for APIs
```

### 2. **Project Breakdown**

#### **muse-customer** (Current Project - Refactor)
Public-facing customer portal
- Home, Menu, Gallery, Events
- Customer Dashboard
- Booking System
- Shopping Cart & Checkout
- **Remove:** Admin, Employee, Artist dashboards

#### **muse-admin** (NEW PROJECT)
Admin-only portal with strict authentication
- Admin Dashboard
- Space Rental Management
- Revenue Analytics
- User Management
- System Settings
- Menu Management
- **Protected:** Requires admin authentication

#### **muse-staff** (NEW PROJECT)
Employee/Staff portal
- Employee Dashboard
- POS System (Boba customization)
- Order Queue Management
- Shift Management
- Inventory Tracking
- Artist Dashboard
- **Protected:** Requires staff/artist authentication

### 3. **Cloudflare Workers for Routing**

Create a main worker to route based on subdomain:

```javascript
// main-router.js (Cloudflare Worker)
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Route based on subdomain
    if (url.hostname.startsWith('admin.')) {
      return fetch('https://muse-admin.pages.dev' + url.pathname);
    }
    if (url.hostname.startsWith('staff.')) {
      return fetch('https://muse-staff.pages.dev' + url.pathname);
    }
    // Default to customer
    return fetch('https://muse-customer.pages.dev' + url.pathname);
  }
}
```

### 4. **Shared Code Strategy**

Create shared packages:
```
shared/
├── ui-components/     # Shared UI components
├── auth-utils/        # Authentication utilities
├── api-client/        # API client library
└── constants/         # Shared constants (menu, etc.)
```

### 5. **Authentication Flow**

1. **Central Auth Service** (Cloudflare Worker)
   - Handles all authentication
   - Issues JWT tokens
   - Validates permissions

2. **App-Specific Auth**
   - Customer: Public + optional auth
   - Admin: Required admin role
   - Staff: Required employee/artist role

### 6. **Database Access**

- Use Cloudflare D1 for data
- Access through Workers API
- Never expose database to frontend

## Implementation Steps

### Phase 1: Prepare Current Project (muse-customer)
1. ✅ Already have customer features
2. TODO: Remove admin/staff components
3. TODO: Clean up routes
4. TODO: Update build configs

### Phase 2: Create muse-admin Project
```bash
# Create new project
mkdir muse-admin
cd muse-admin
npm create vite@latest . -- --template react-ts

# Copy necessary files
cp -r ../muse-customer/src/pages/AdminDashboard.tsx src/pages/
cp -r ../muse-customer/src/components/admin/* src/components/admin/
cp -r ../muse-customer/src/lib/permissions.ts src/lib/

# Install dependencies
npm install

# Configure for Cloudflare Pages
```

### Phase 3: Create muse-staff Project
```bash
# Create new project
mkdir muse-staff
cd muse-staff
npm create vite@latest . -- --template react-ts

# Copy necessary files
cp -r ../muse-customer/src/pages/EmployeeDashboard.tsx src/pages/
cp -r ../muse-customer/src/pages/ArtistDashboard.tsx src/pages/
cp -r ../muse-customer/src/components/pos/* src/components/pos/

# Configure for Cloudflare Pages
```

### Phase 4: Deploy to Cloudflare

1. **Customer Portal**
```bash
cd muse-customer
wrangler pages deploy dist --project-name muse-customer
# → https://muse-customer.pages.dev
```

2. **Admin Portal**
```bash
cd muse-admin
wrangler pages deploy dist --project-name muse-admin
# → https://muse-admin.pages.dev
```

3. **Staff Portal**
```bash
cd muse-staff
wrangler pages deploy dist --project-name muse-staff
# → https://muse-staff.pages.dev
```

### Phase 5: Setup Custom Domains

In Cloudflare Dashboard:
1. customer.museandco.com → muse-customer.pages.dev
2. admin.museandco.com → muse-admin.pages.dev
3. staff.museandco.com → muse-staff.pages.dev

## Benefits of This Architecture

1. **Security**
   - Admin code never reaches customers
   - Separate authentication per app
   - Role-based access at infrastructure level

2. **Performance**
   - Smaller bundles per app
   - Faster load times
   - Independent caching strategies

3. **Development**
   - Teams can work independently
   - Separate deployment pipelines
   - Different tech stacks if needed

4. **Scalability**
   - Scale each app independently
   - Different edge locations per app
   - Separate rate limiting

## Current Status

- ✅ Customer features built in muse-customer
- ✅ Admin/Staff dashboards created (need extraction)
- ⏳ Need to split into separate projects
- ⏳ Need to setup Workers routing
- ⏳ Need to configure authentication

## Next Actions

1. **Immediate**: Clean up muse-customer (remove admin/staff)
2. **Next Sprint**: Create muse-admin project
3. **Following**: Create muse-staff project
4. **Final**: Setup routing and authentication

## Environment Variables Per Project

### muse-customer
```env
VITE_API_URL=https://api.museandco.com
VITE_APP_TYPE=customer
VITE_AUTH_DOMAIN=auth.museandco.com
```

### muse-admin
```env
VITE_API_URL=https://api.museandco.com
VITE_APP_TYPE=admin
VITE_AUTH_DOMAIN=auth.museandco.com
VITE_REQUIRE_AUTH=true
VITE_MIN_ROLE=ADMIN
```

### muse-staff
```env
VITE_API_URL=https://api.museandco.com
VITE_APP_TYPE=staff
VITE_AUTH_DOMAIN=auth.museandco.com
VITE_REQUIRE_AUTH=true
VITE_MIN_ROLE=TRAINEE
```