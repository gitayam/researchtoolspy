# Complete API Architecture & Implementation Plan

## Overview
Muse & Co needs a robust API layer to connect all three portals (customer, admin, staff) with centralized data management using Cloudflare's edge infrastructure.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND APPS                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│  customer.app   │   admin.app     │      staff.app          │
│  (Pages)        │   (Pages)       │      (Pages)            │
└────────┬────────┴────────┬────────┴────────┬────────────────┘
         │                 │                  │
         ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY (Cloudflare Worker)                │
│                    api.museandco.com                        │
├─────────────────────────────────────────────────────────────┤
│  • Authentication & Authorization                           │
│  • Rate Limiting                                           │
│  • Request Routing                                         │
│  • CORS Management                                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌──────────────────┐       ┌──────────────────┐
│  Service Workers │       │   Cloudflare D1   │
├──────────────────┤       ├──────────────────┤
│ • Orders API     │       │ • Orders DB       │
│ • Menu API       │       │ • Menu DB         │
│ • Users API      │       │ • Users DB        │
│ • Bookings API   │       │ • Bookings DB     │
│ • Analytics API  │       │ • Analytics DB    │
└──────────────────┘       └──────────────────┘
```

## 1. Database Schema (Cloudflare D1)

### Core Tables

```sql
-- Users & Authentication
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('ADMIN', 'MANAGER', 'BARISTA', 'ARTIST', 'CUSTOMER')),
  name TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Menu Items (Boba Tea Focus)
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  description TEXT,
  available BOOLEAN DEFAULT true,
  customizable BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Menu Customizations
CREATE TABLE menu_customizations (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT REFERENCES menu_items(id),
  type TEXT CHECK(type IN ('size', 'topping', 'sweetness', 'ice')),
  name TEXT NOT NULL,
  price_adjustment DECIMAL(10,2) DEFAULT 0
);

-- Orders
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES users(id),
  staff_id TEXT REFERENCES users(id),
  status TEXT CHECK(status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  total_amount DECIMAL(10,2) NOT NULL,
  pickup_time DATETIME,
  order_type TEXT CHECK(order_type IN ('walk-in', 'order-ahead', 'delivery')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Order Items
CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  menu_item_id TEXT REFERENCES menu_items(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  customizations JSON,
  notes TEXT
);

-- Space Rentals
CREATE TABLE space_rentals (
  id TEXT PRIMARY KEY,
  space_name TEXT NOT NULL,
  renter_name TEXT NOT NULL,
  renter_email TEXT,
  renter_phone TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  event_type TEXT,
  capacity INTEGER,
  total_price DECIMAL(10,2) NOT NULL,
  status TEXT CHECK(status IN ('pending', 'confirmed', 'cancelled')),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workshop Bookings
CREATE TABLE workshop_bookings (
  id TEXT PRIMARY KEY,
  workshop_id TEXT,
  customer_id TEXT REFERENCES users(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  spots_booked INTEGER DEFAULT 1,
  total_price DECIMAL(10,2) NOT NULL,
  status TEXT CHECK(status IN ('pending', 'confirmed', 'cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analytics Events
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 2. API Workers Implementation

### Main API Gateway Worker

```javascript
// wrangler.toml
name = "muse-api-gateway"
main = "src/gateway.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "muse-database"
database_id = "your-database-id"

[env.production]
vars = { JWT_SECRET = "your-secret-key" }
```

```javascript
// src/gateway.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route to appropriate service
    const path = url.pathname;

    try {
      // Authentication check (except for public endpoints)
      if (!isPublicEndpoint(path)) {
        const auth = await verifyAuth(request, env);
        if (!auth.valid) {
          return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }
        request.auth = auth;
      }

      // Route to service
      if (path.startsWith('/api/menu')) {
        return handleMenuAPI(request, env, ctx);
      } else if (path.startsWith('/api/orders')) {
        return handleOrdersAPI(request, env, ctx);
      } else if (path.startsWith('/api/bookings')) {
        return handleBookingsAPI(request, env, ctx);
      } else if (path.startsWith('/api/users')) {
        return handleUsersAPI(request, env, ctx);
      } else if (path.startsWith('/api/analytics')) {
        return handleAnalyticsAPI(request, env, ctx);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
```

### Menu API Service

```javascript
// src/services/menu.js
export async function handleMenuAPI(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /api/menu - Public endpoint
  if (request.method === 'GET' && path === '/api/menu') {
    const { results } = await env.DB.prepare(
      `SELECT m.*,
        GROUP_CONCAT(
          JSON_OBJECT(
            'type', c.type,
            'name', c.name,
            'price', c.price_adjustment
          )
        ) as customizations
       FROM menu_items m
       LEFT JOIN menu_customizations c ON m.id = c.menu_item_id
       WHERE m.available = true
       GROUP BY m.id`
    ).all();

    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST /api/menu - Admin only
  if (request.method === 'POST' && request.auth?.role === 'ADMIN') {
    const data = await request.json();
    const stmt = env.DB.prepare(
      `INSERT INTO menu_items (id, name, category, base_price, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const result = await stmt.bind(
      crypto.randomUUID(),
      data.name,
      data.category,
      data.base_price,
      data.description,
      data.image_url
    ).run();

    return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // PUT /api/menu/:id - Admin only
  if (request.method === 'PUT' && path.match(/\/api\/menu\/[\w-]+$/)) {
    if (request.auth?.role !== 'ADMIN') {
      return new Response('Forbidden', { status: 403 });
    }

    const id = path.split('/').pop();
    const data = await request.json();

    const stmt = env.DB.prepare(
      `UPDATE menu_items
       SET name = ?, category = ?, base_price = ?, description = ?, available = ?
       WHERE id = ?`
    );

    await stmt.bind(
      data.name,
      data.category,
      data.base_price,
      data.description,
      data.available,
      id
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
```

### Orders API Service

```javascript
// src/services/orders.js
export async function handleOrdersAPI(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // POST /api/orders - Create new order
  if (request.method === 'POST') {
    const data = await request.json();
    const orderId = crypto.randomUUID();

    // Start transaction
    const tx = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO orders (id, customer_id, status, total_amount, pickup_time, order_type)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        orderId,
        request.auth?.userId || data.customer_id,
        'pending',
        data.total_amount,
        data.pickup_time,
        data.order_type || 'walk-in'
      ),

      ...data.items.map(item =>
        env.DB.prepare(
          `INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, customizations)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          orderId,
          item.menu_item_id,
          item.quantity,
          item.unit_price,
          JSON.stringify(item.customizations)
        )
      )
    ]);

    // Send notification to staff
    await notifyStaff(orderId, env);

    return new Response(JSON.stringify({ success: true, order_id: orderId }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET /api/orders - Staff can see all, customers see own
  if (request.method === 'GET') {
    let query;
    if (['ADMIN', 'MANAGER', 'BARISTA'].includes(request.auth?.role)) {
      // Staff sees all orders
      query = env.DB.prepare(
        `SELECT o.*, u.name as customer_name
         FROM orders o
         LEFT JOIN users u ON o.customer_id = u.id
         ORDER BY o.created_at DESC
         LIMIT 100`
      );
    } else {
      // Customers see only their orders
      query = env.DB.prepare(
        `SELECT * FROM orders
         WHERE customer_id = ?
         ORDER BY created_at DESC`
      ).bind(request.auth?.userId);
    }

    const { results } = await query.all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // PUT /api/orders/:id/status - Update order status (Staff only)
  if (request.method === 'PUT' && path.match(/\/api\/orders\/[\w-]+\/status$/)) {
    if (!['ADMIN', 'MANAGER', 'BARISTA'].includes(request.auth?.role)) {
      return new Response('Forbidden', { status: 403 });
    }

    const orderId = path.split('/')[3];
    const { status } = await request.json();

    await env.DB.prepare(
      `UPDATE orders SET status = ?, staff_id = ? WHERE id = ?`
    ).bind(status, request.auth.userId, orderId).run();

    // Notify customer of status change
    await notifyCustomer(orderId, status, env);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
```

### Space Rental API

```javascript
// src/services/bookings.js
export async function handleBookingsAPI(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /api/bookings/availability - Check space availability
  if (request.method === 'GET' && path === '/api/bookings/availability') {
    const { date, space } = Object.fromEntries(url.searchParams);

    const { results } = await env.DB.prepare(
      `SELECT * FROM space_rentals
       WHERE event_date = ?
       AND space_name = ?
       AND status != 'cancelled'`
    ).bind(date, space).all();

    return new Response(JSON.stringify({ available: results.length === 0, bookings: results }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST /api/bookings/space - Book a space
  if (request.method === 'POST' && path === '/api/bookings/space') {
    const data = await request.json();

    // Check availability first
    const existing = await env.DB.prepare(
      `SELECT id FROM space_rentals
       WHERE event_date = ?
       AND space_name = ?
       AND status != 'cancelled'
       AND (
         (start_time <= ? AND end_time > ?) OR
         (start_time < ? AND end_time >= ?) OR
         (start_time >= ? AND end_time <= ?)
       )`
    ).bind(
      data.event_date,
      data.space_name,
      data.start_time, data.start_time,
      data.end_time, data.end_time,
      data.start_time, data.end_time
    ).first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Space not available at this time' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create booking
    const bookingId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO space_rentals
       (id, space_name, renter_name, renter_email, renter_phone, event_date,
        start_time, end_time, event_type, capacity, total_price, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      bookingId,
      data.space_name,
      data.renter_name,
      data.renter_email,
      data.renter_phone,
      data.event_date,
      data.start_time,
      data.end_time,
      data.event_type,
      data.capacity,
      data.total_price,
      'pending',
      data.notes
    ).run();

    // Send confirmation email
    await sendBookingConfirmation(bookingId, data.renter_email, env);

    return new Response(JSON.stringify({ success: true, booking_id: bookingId }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // GET /api/bookings/space - Admin sees all, others see own
  if (request.method === 'GET' && path === '/api/bookings/space') {
    let query;
    if (request.auth?.role === 'ADMIN') {
      query = env.DB.prepare(
        `SELECT * FROM space_rentals
         ORDER BY event_date DESC, start_time DESC`
      );
    } else {
      query = env.DB.prepare(
        `SELECT * FROM space_rentals
         WHERE renter_email = ?
         ORDER BY event_date DESC`
      ).bind(request.auth?.email);
    }

    const { results } = await query.all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405 });
}
```

## 3. Frontend API Client

### API Client Library

```typescript
// shared/api-client/src/index.ts
export class MuseAPIClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string = 'https://api.museandco.com') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('auth_token');
  }

  private async request(path: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.token = data.token;
    localStorage.setItem('auth_token', data.token);
    return data;
  }

  // Menu
  async getMenu() {
    return this.request('/api/menu');
  }

  async updateMenuItem(id: string, data: any) {
    return this.request(`/api/menu/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Orders
  async createOrder(orderData: any) {
    return this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrders() {
    return this.request('/api/orders');
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Space Rentals
  async checkSpaceAvailability(date: string, space: string) {
    return this.request(`/api/bookings/availability?date=${date}&space=${space}`);
  }

  async bookSpace(bookingData: any) {
    return this.request('/api/bookings/space', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  // Analytics
  async trackEvent(eventType: string, metadata: any) {
    return this.request('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ event_type: eventType, metadata }),
    });
  }

  async getAnalytics(startDate: string, endDate: string) {
    return this.request(`/api/analytics?start=${startDate}&end=${endDate}`);
  }
}
```

### Usage in React Components

```typescript
// In Admin Dashboard
import { MuseAPIClient } from '@muse/api-client';

const AdminDashboard = () => {
  const api = new MuseAPIClient();
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  useEffect(() => {
    // Fetch orders
    api.getOrders().then(setOrders);

    // Fetch menu
    api.getMenu().then(setMenuItems);
  }, []);

  const updateMenuPrice = async (itemId: string, newPrice: number) => {
    await api.updateMenuItem(itemId, { base_price: newPrice });
    // Refresh menu
    const updated = await api.getMenu();
    setMenuItems(updated);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await api.updateOrderStatus(orderId, status);
    // Refresh orders
    const updated = await api.getOrders();
    setOrders(updated);
  };

  return (
    // Dashboard UI
  );
};
```

## 4. Deployment Steps

### Step 1: Setup Cloudflare D1 Database

```bash
# Create database
wrangler d1 create muse-database

# Create tables
wrangler d1 execute muse-database --file=./schema.sql

# Seed initial data
wrangler d1 execute muse-database --file=./seed.sql
```

### Step 2: Deploy API Workers

```bash
# Deploy main gateway
cd api-gateway
wrangler publish

# Get the API URL
# → https://muse-api-gateway.your-subdomain.workers.dev
```

### Step 3: Deploy Frontend Apps

```bash
# Customer Portal
cd muse-customer
npm run build
wrangler pages deploy dist --project-name muse-customer

# Admin Portal
cd ../muse-admin
npm run build
wrangler pages deploy dist --project-name muse-admin

# Staff Portal
cd ../muse-staff
npm run build
wrangler pages deploy dist --project-name muse-staff
```

### Step 4: Configure Custom Domains

In Cloudflare Dashboard:
1. api.museandco.com → API Worker
2. customer.museandco.com → muse-customer
3. admin.museandco.com → muse-admin
4. staff.museandco.com → muse-staff

## 5. Security Considerations

### Authentication Flow
1. User logs in → API returns JWT token
2. Token stored in localStorage
3. Token sent with every API request
4. API validates token and checks permissions

### Rate Limiting
```javascript
// In API Gateway
const rateLimiter = {
  async check(ip, env) {
    const key = `rate_limit:${ip}`;
    const count = await env.KV.get(key) || 0;

    if (count > 100) { // 100 requests per minute
      return false;
    }

    await env.KV.put(key, count + 1, { expirationTtl: 60 });
    return true;
  }
};
```

### CORS Configuration
- Customer app: Allow all origins
- Admin app: Restrict to admin.museandco.com
- API: Validate origin against whitelist

## 6. Monitoring & Analytics

### Real-time Dashboard
```javascript
// Track key metrics
await api.trackEvent('order_created', {
  order_id: orderId,
  amount: totalAmount,
  items_count: items.length
});

await api.trackEvent('space_booked', {
  space: spaceName,
  date: eventDate,
  revenue: totalPrice
});
```

### Error Tracking
```javascript
// In API Gateway
export default {
  async fetch(request, env, ctx) {
    try {
      // ... handle request
    } catch (error) {
      // Log to analytics
      await env.DB.prepare(
        `INSERT INTO error_logs (error_message, stack_trace, request_path, user_id)
         VALUES (?, ?, ?, ?)`
      ).bind(
        error.message,
        error.stack,
        request.url,
        request.auth?.userId
      ).run();

      // Return error response
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
```

## Next Implementation Steps

1. **Immediate (Week 1)**
   - Set up D1 database with schema
   - Deploy basic API gateway
   - Test authentication flow

2. **Short-term (Week 2-3)**
   - Implement all API endpoints
   - Integrate frontend apps with API
   - Set up monitoring

3. **Medium-term (Month 2)**
   - Add advanced features (webhooks, subscriptions)
   - Implement caching strategy
   - Performance optimization

4. **Long-term (Month 3+)**
   - Analytics dashboard
   - Machine learning for demand prediction
   - Multi-location support