# RouteSync Server

Clean JavaScript REST API starter for the RouteSync company vehicle-sharing application.

## Stack

- Node.js
- Express.js
- MongoDB Node.js Driver
- CORS

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`.

3. Add your MongoDB Atlas connection string to `MONGODB_URI`.

4. Start development mode:

   ```bash
   npm run dev
   ```

## Available endpoints

- `GET /` — API welcome response
- `GET /api/v1/health` — API health information

## Test

```bash
npm test
```

The test suite does not require a running MongoDB instance because it only tests the Express application layer.
