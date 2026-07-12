# 🏠 StayNest Backend API

A robust RESTful API for a rental property management platform, built with **Node.js**, **Express**, and **MongoDB**. Handles property listings, authentication, reviews, and more.

🔗 **Live URL:** [https://staynest-next.vercel.app](https://staynest-next.vercel.app)

---

## ✨ Features

- ✅ CRUD operations for property listings
- ✅ Search & filter by location, price, type, bedrooms, and more
- ✅ Session-based authentication via **Better Auth**
- ✅ Review system with automatic rating updates
- ✅ Owner verification for property modifications
- ✅ Pagination & sorting for efficient data fetching
- ✅ CORS support for frontend integration
- ✅ MongoDB aggregation for real-time property stats
- ✅ Seed script for test data generation

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express.js | Web framework |
| MongoDB | NoSQL database |
| MongoDB Native Driver | Database connectivity |
| dotenv | Environment variables |
| cors | Cross-origin resource sharing |

---

## 🚀 Quick Start

```bash
# Clone & install
git clone https://github.com/yourusername/staynest-backend.git
cd staynest-backend
npm install

# Set up environment
cp .env.example .env

# Seed database (optional)
npm run seed

# Start server
npm run dev   # development
npm start     # production
```

Server runs at `http://localhost:5000` by default.

### Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/StayNest
PORT=5000
FRONTEND_URL=http://localhost:3000
```

---

## 📡 API Endpoints

### 🏘️ Properties

| Method | Endpoint | Description | Auth |
|---|---|---|:---:|
| GET | `/properties` | Get all properties (with filters) | ❌ |
| GET | `/properties/:id` | Get a single property | ❌ |
| POST | `/properties` | Create a new property | ✅ |
| PUT | `/properties/:id` | Update a property | ✅ |
| DELETE | `/properties/:id` | Delete a property | ✅ |

**Query params for `GET /properties`:** `q`, `type`, `city`, `minPrice`, `maxPrice`, `beds`, `sort` (`newest` / `price-asc` / `price-desc` / `rating`), `page`, `limit`, `featured`, `ownerId`

<details>
<summary>Response example</summary>

```json
{
  "success": true,
  "message": "Properties fetched successfully",
  "data": [
    {
      "id": "674a00000000000000000001",
      "title": "Luxury Oceanfront Villa with Private Pool",
      "rent": 4500,
      "city": "Miami"
    }
  ],
  "pagination": { "page": 1, "limit": 12, "total": 42, "totalPages": 4 }
}
```
</details>

### ⭐ Reviews

| Method | Endpoint | Description | Auth |
|---|---|---|:---:|
| GET | `/reviews/:propertyId` | Get all reviews for a property | ❌ |
| POST | `/reviews` | Add a review | ✅ |

<details>
<summary>Request body example</summary>

```json
{
  "propertyId": "674a00000000000000000001",
  "rating": 5,
  "comment": "Amazing place to stay!"
}
```
</details>

---

## 🔐 Authentication

Session-based auth via **Better Auth**, using either:
- `Authorization: Bearer <session_token>` header, or
- `better-auth.session_token` cookie

All `POST`, `PUT`, and `DELETE` routes require authentication. Users can only modify properties they own; any authenticated user can post reviews.

---

## 📊 Data Models

<details>
<summary><strong>User</strong></summary>

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  image: String,
  phone: String,
  role: String // "host" | "user"
}
```
</details>

<details>
<summary><strong>Property</strong></summary>

```javascript
{
  _id: ObjectId,
  title: String,
  shortDescription: String,
  fullDescription: String,
  rent: Number,
  type: String, // "apartment" | "house" | "villa" | "studio" | "loft" | "cabin"
  bedrooms: Number,
  bathrooms: Number,
  area: Number,
  city: String,
  address: String,
  images: [String],
  amenities: [String],
  rating: Number, // 0-5
  reviewCount: Number,
  ownerId: String,
  ownerName: String,
  status: String, // "available" | "rented" | "pending"
  featured: Boolean,
  createdAt: String
}
```
</details>

<details>
<summary><strong>Review</strong></summary>

```javascript
{
  _id: ObjectId,
  propertyId: ObjectId,
  userName: String,
  rating: Number, // 1-5
  comment: String,
  date: String,
  createdAt: String
}
```
</details>

---

## 🛡️ Error Handling

```json
{ "success": false, "message": "Error description" }
```

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## 🧪 Testing

```bash
node check_db.js                 # test DB connection
curl http://localhost:5000/properties   # get all properties
```

---

## 🚢 Deployment

**Render:** create a Web Service → connect GitHub repo → set `MONGODB_URI`, `PORT`, `FRONTEND_URL` → deploy.

**Docker:**
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

---

## 📁 Project Structure

```
staynest-backend/
├── server.js       # App entry point
├── db.js           # Database connection
├── seed.js         # Seed script
├── check_db.js     # DB connection test
├── package.json
└── .env
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit & push your changes
4. Open a Pull Request

---

## 📝 License
ISC License

## 📬 Contact
- Email: support@staynest.com
- GitHub: github.com/yourusername/staynest-backend

---

<p align="center">Happy Coding! 🎉</p>