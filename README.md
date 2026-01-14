GigFlow – Backend

GigFlow Backend is the server-side application for the GigFlow – Mini Freelance Marketplace Platform.

This backend handles authentication, authorization, database operations, and core business logic for gigs and bids.

🔗 Live Backend URL

Backend (Render):
https://gigflow-backend-p324.onrender.com

🧠 Backend Responsibilities

The backend is responsible for:

User authentication and authorization

Secure cookie-based session handling

Gig creation and retrieval

Bid placement and retrieval

Role-based access control

Database management using MongoDB

🛠 Tech Stack

Node.js

Express.js

MongoDB

Mongoose

JSON Web Tokens (JWT)

Cookie Parser

CORS

dotenv

📁 Folder Structure
src/
├── config/
│   ├── db.js
│
├── controllers/
│   ├── auth.controller.js
│   ├── gig.controller.js
│   ├── bid.controller.js
│
├── middleware/
│   ├── auth.middleware.js
│
├── models/
│   ├── User.js
│   ├── Gig.js
│   ├── Bid.js
│
├── routes/
│   ├── auth.routes.js
│   ├── gig.routes.js
│   ├── bid.routes.js
│
├── app.js
│
server.js

🔐 Authentication System

JWT-based authentication

Tokens stored securely in HTTP-only cookies

Persistent login using /api/auth/me

Protected routes using custom middleware

🔒 Auth Endpoints
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

📦 Gig Endpoints
GET    /api/gigs
GET    /api/gigs/:id
POST   /api/gigs


Gig creation is protected and requires authentication.

💰 Bid Endpoints
POST   /api/bids/:gigId
GET    /api/bids/:gigId


Only authenticated users can place bids.

🧬 Database Models
User Model

name

email

password (hashed)

role (client / freelancer)

timestamps

Gig Model

title

description

budget

createdBy (User reference)

timestamps

Bid Model

amount

message

gigId (Gig reference)

bidder (User reference)

timestamps

🌐 CORS Configuration

CORS is configured to allow:

Local development origins

Deployed Netlify frontend

Cookie-based authentication (credentials: true)

Example:

origin: [
  "http://localhost:5173",
  "https://glowing-flan-20b600.netlify.app"
]

⚙️ Setup Instructions (Local Development)
1️⃣ Clone the Repository
git clone <backend-repo-url>
cd backend

2️⃣ Install Dependencies
npm install

3️⃣ Environment Variables

Create a .env file in the root directory.

Example .env.example:

PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
NODE_ENV=development

4️⃣ Start the Server
npm run dev


The server will run at:

http://localhost:5000

🚀 Deployment

Backend deployed on Render

Environment variables configured securely on Render dashboard

MongoDB hosted using MongoDB Atlas


📌 Key Highlights

Secure authentication using cookies

Clean MVC architecture

Proper separation of concerns

Scalable folder structure

Production-ready backend setup

📄 License

This project is developed exclusively for the ServiceHive Internship Assignment and is intended for evaluation purposes only.
