# ecommerce-backend

A standalone Express.js + TypeORM backend for the multi-vendor ecommerce platform.

## Tech Stack
- Node.js + Express
- TypeORM + PostgreSQL (Neon)
- Redis (Upstash)
- Cloudinary (file uploads)
- Razorpay (payments)
- JWT authentication

## Getting Started

### Prerequisites
- Node.js >= 20
- PostgreSQL database (local or Neon)
- Redis instance (local or Upstash)

### Installation
```bash
npm install
cp .env.example .env
# Fill in your .env values
npm run dev
```

### Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm start` | Run compiled production server |

## Deployment (Railway)
1. Create a new Railway project
2. Connect this GitHub repository
3. Add all environment variables from `.env.example`
4. Railway will auto-detect and run `npm start`

## Environment Variables
See `.env.example` for the full list of required variables.
