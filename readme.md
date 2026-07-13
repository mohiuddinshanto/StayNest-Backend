# StayNest Backend API

Express and MongoDB API for the StayNest rental-property platform.

The web application is available at [staynest-next.vercel.app](https://staynest-next.vercel.app). The frontend forwards authenticated API calls to this service through its `/api/backend` proxy.

## Features

- Session authentication compatible with Better Auth cookies
- Property creation, updates, deletion, filtering, and pagination
- Listing approval workflow for administrators
- Secure rental confirmation for approved, available listings
- Renter details and confirmed-rental lookup
- Owner inquiries, viewing requests, reviews, and analytics
- Admin property management and platform analytics

## Tech stack

- Node.js and Express
- TypeScript
- MongoDB Native Driver
- dotenv and cors

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file:

```env
MONGODB_URI=your_mongodb_connection_string
PORT=5000
FRONTEND_URL=http://localhost:3000
```

For deployed environments, set `FRONTEND_URL` to the deployed frontend origin, for example `https://staynest-next.vercel.app`.

### 3. Run the API

```bash
npm run dev      # Development with ts-node
npm run build    # Compile TypeScript to dist/
npm start        # Start compiled production server
```

The local API runs on `http://localhost:5000`.

## Core endpoints

| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| GET | `/properties` | Browse and filter approved properties | No |
| GET | `/properties/:id` | Get property details | No* |
| POST | `/properties` | Create a property listing | Yes |
| PUT | `/properties/:id` | Update an owned listing | Yes |
| DELETE | `/properties/:id` | Delete an owned listing | Yes |
| POST | `/properties/:id/rent` | Confirm an available property rental | Yes |
| GET | `/my-properties` | Get the signed-in owner's listings | Yes |
| GET | `/my-rentals` | Get the signed-in renter's confirmed properties | Yes |
| POST | `/inquiries` | Send an owner message or viewing request | Yes |
| GET | `/inquiries/received` | Get owner inquiries | Yes |
| GET | `/owner/analytics` | Get owner dashboard data | Yes |
| GET | `/admin/analytics` | Get platform dashboard data | Admin |

`*` Unapproved listings are visible only to their owner or an admin.

### Property query parameters

`q`, `type`, `city`, `minPrice`, `maxPrice`, `beds`, `sort`, `page`, `limit`, `featured`, and `ownerId` are supported by `GET /properties`.

## Rental safety

`POST /properties/:id/rent` verifies that the property is approved and available, blocks owners from renting their own listing, and performs an availability-guarded update. This prevents two renters from confirming the same property.

## Authentication

Authenticated requests accept either:

- `better-auth.session_token` cookie
- `Authorization: Bearer <session_token>` header

The production frontend proxy forwards browser sessions to this API automatically.

## Project structure

```text
Backend/
  server.ts       # Express routes and application bootstrap
  db.ts           # MongoDB connection helpers
  types.ts        # API, database, and request types
  package.json    # Scripts and dependencies
  tsconfig.json   # TypeScript configuration
```

## Deployment checklist

1. Deploy this service to a Node-compatible host.
2. Set `MONGODB_URI`, `PORT`, and `FRONTEND_URL`.
3. Set the frontend's `NEXT_PUBLIC_API_URL` to this service URL.
4. Confirm CORS permits the frontend origin.
5. Run `npm run build` before starting production.

## Error format

```json
{
  "success": false,
  "message": "Description of the error"
}
```
