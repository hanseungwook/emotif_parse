# Emotif Backend

![Node.js](https://img.shields.io/badge/Node.js-v6%2B-green?logo=node.js)
![Express](https://img.shields.io/badge/Express-4.x-lightgrey?logo=express)
![Parse Server](https://img.shields.io/badge/Parse%20Server-2.x-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-3.x-brightgreen?logo=mongodb)
![Stripe](https://img.shields.io/badge/Stripe-Payments-blueviolet?logo=stripe)

A Node.js/Express backend powered by Parse Server for user management and data persistence, with Stripe integration for payment processing and AWS S3 for file storage. Built to serve as the backend for the Emotif application.

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express.js | HTTP server framework |
| Parse Server | Backend-as-a-service (users, data, cloud functions) |
| MongoDB | Database |
| Stripe API | Payment processing (tokens, customers, charges) |
| AWS S3 | File storage adapter |

## Project Structure

```
emotif-backend/
├── server.js            # Express server setup and Parse Server configuration
├── cloud/
│   └── main.js          # Parse Cloud Functions (Stripe, ACL, etc.)
├── package.json         # Dependencies and scripts
├── .env                 # Environment variables (not committed)
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

### Architecture Overview

```
Client Request
      │
      ▼
  Express.js (port 1337)
      │
      ├── GET /           → Health check
      └── /parse/*        → Parse Server API
              │
              ├── Cloud Functions    → Business logic (Stripe payments)
              ├── MongoDB            → Data persistence (Users, UserProfiles)
              └── S3 Adapter         → File uploads and storage
```

Express serves as the HTTP layer, mounting Parse Server at `/parse`. Cloud functions in `cloud/main.js` handle business logic — primarily Stripe payment operations (token creation, customer management, and charges). MongoDB stores all application data through Parse, and the S3 adapter handles file uploads with direct access enabled.

## Getting Started

### Prerequisites

- **Node.js** (v6 or higher)
- **MongoDB** instance (local or hosted, e.g. MongoDB Atlas)
- **Stripe account** with API key
- **AWS S3 bucket** for file storage

### Installation

```bash
# Clone the repository
git clone https://github.com/hanseungwook/emotif_parse.git
cd emotif_parse

# Install dependencies
npm install

# Create environment file
cp .env.example .env  # then edit with your values
```

### Environment Variables

Create a `.env` file in the project root with the following variables:

| Variable | Description |
|---|---|
| `PORT` | Server port (default: `1337`) |
| `MONGODB_URI` | MongoDB connection string |
| `APP_ID` | Parse application ID |
| `MASTER_KEY` | Parse master key |
| `SERVER_URL` | Parse Server URL (e.g. `http://localhost:1337/parse`) |
| `CLOUD_CODE_MAIN` | Path to cloud code (default: `./cloud/main.js`) |
| `STRIPEAPIKEY` | Stripe secret API key |
| `AWS_ACCESS_KEY_ID` | AWS access key for S3 |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for S3 |
| `BUCKET_NAME` | S3 bucket name |
| `AWS_REGION` | AWS region for S3 bucket |

### Running the Server

```bash
npm start
```

The server will start on the configured `PORT` (default: `1337`).

## API Reference

All cloud functions are called via the Parse Server endpoint at `/parse/functions/<functionName>`.

### Express Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check — returns `"Routing working"` |

### Parse Cloud Functions

#### `hello`

Test function that returns a greeting.

```bash
curl -X POST http://localhost:1337/parse/functions/hello \
  -H "X-Parse-Application-Id: YOUR_APP_ID" \
  -H "Content-Type: application/json"
```

**Response:** `{ "result": "hi" }`

---

#### `test`

Echo function that returns the provided email parameter.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `email` | String | Email address to echo back |

**Response:** `{ "result": "user@example.com" }`

---

#### `createStripeToken`

Creates a Stripe token from raw card details.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `number` | String | Card number |
| `exp_month` | String | Expiration month |
| `exp_year` | String | Expiration year |
| `cvc` | String | Card CVC |

**Response:** Returns the full Stripe token object.

---

#### `createStripeCustomer`

Creates a Stripe customer and links it to a Parse user. Looks up the user by email, creates a card token, then creates a Stripe customer. The Stripe customer ID is saved to the user's `stripeId` field.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `email` | String | User's email (must match a Parse user) |
| `number` | String | Card number |
| `exp_month` | String | Expiration month |
| `exp_year` | String | Expiration year |
| `cvc` | String | Card CVC |

**Response:** `{ "result": { "stripeId": "cus_..." } }`

**Errors:**
- `"Already has stripe account"` — User already has a `stripeId`

---

#### `createTransaction`

Creates an idempotent Stripe charge in USD against an existing Stripe customer.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `email` | String | Customer's email (must match a Parse user with `stripeId`) |
| `amount` | Number | Charge amount in cents |

**Response:** Returns the full Stripe charge object.

**Errors:**
- `"No stripe registration for the customer"` — User has no `stripeId`

---

### Parse Triggers

#### `beforeSave` — UserProfile

Automatically sets private ACL on `UserProfile` objects before saving, restricting read/write access to the owning user only.

## Contributing

Contributions are welcome. Please fork the repository, create a feature branch, and submit a pull request. Ensure your changes are tested and consistent with the existing code style.

## License

This project is licensed under the MIT License. See [package.json](package.json) for details.
