GigFlow Backend
GigFlow – A Freelance Marketplace connecting clients and freelancers seamlessly.

Overview
This is the backend of GigFlow, built using Node.js, Express.js, and MongoDB.
It handles user authentication, project management, payment workflows, and admin functionalities. The backend exposes RESTful APIs that the frontend consumes.

Table of Contents
Technologies Used
Features
Folder Structure
Installation
Environment Variables
API Endpoints
Testing
Deployment
Contributing
License

Technologies Used
Node.js – Server-side runtime
Express.js – Web framework for routing & middleware
MongoDB – Database for storing users, projects, and transactions
Mongoose – MongoDB object modeling for Node.js
JWT – Authentication & authorization
Bcrypt – Password hashing
Nodemailer – Sending emails
Axios – API requests for internal service communication

Features
User Management – Register, login, update profile, user roles (freelancer/client/admin)
Project Management – Create projects, submit proposals, assign tasks
Payment Integration – Process payments between clients and freelancers
Admin Panel APIs – Monitor users, projects, and payments
Notifications – Email alerts for project updates, payments, etc.
Security – JWT authentication, password hashing, input validation

Folder Structure
backend/
├─ config/          # DB connection and environment configs
├─ controllers/     # Route logic
├─ middlewares/     # Authentication & error handling
├─ models/          # MongoDB schemas
├─ routes/          # API routes
├─ utils/           # Helper functions
├─ app.js           # Express server setup
├─ server.js        # Server listener
├─ package.json     # Project dependencies
└─ README.md

Installation
Clone the repo:
git clone https://github.com/NeerajYadav-coder/GigFlow-Backend.git
cd GigFlow-Backend

Install dependencies:
npm install

Setup environment variables (see below)
Run the server:

npm run dev   # For development with nodemon
npm start     # For production

Environment Variables
Create a .env file in the root folder:
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email_address
EMAIL_PASS=your_email_password
PAYMENT_GATEWAY_KEY=your_payment_gateway_key
FRONTEND_URL=http://localhost:3000

API Endpoints
Auth
POST /api/auth/register – Register new user
POST /api/auth/login – Login
GET /api/auth/profile – Get logged-in user profile
Users
GET /api/users/ – Get all users (Admin)
PATCH /api/users/:id – Update user profile

Projects
POST /api/projects/ – Create project
GET /api/projects/ – Get all projects
GET /api/projects/:id – Get single project
PATCH /api/projects/:id – Update project
DELETE /api/projects/:id – Delete project

Testing
Use Postman or Insomnia to test API routes
Run automated tests (if added):

npm test

Deployment
The backend is production-ready and can be deployed to:
Render – https://render.com
Heroku – https://heroku.com
Vercel (Serverless) – https://vercel.com

Steps (Render example):
Connect GitHub repo to Render
Set environment variables on Render dashboard

Deploy the service
Update frontend axios baseURL to the deployed backend URL

Contributing
Fork the repository
Create a branch (git checkout -b feature/feature-name)
Make your changes
Commit changes (git commit -m 'Add feature')
Push to branch (git push origin feature/feature-name)
Open a Pull Request

License
This project is MIT Licensed – see LICENSE for details.
