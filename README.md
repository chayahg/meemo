# Mee-Mo

A full-stack application with React frontend and Node.js/Express backend.

## Project Structure

```
mee-mo/
│
├── client/              # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   │   └── vite.svg
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/              # Node.js/Express backend
│   ├── routes/
│   │   └── api.js
│   ├── controllers/
│   │   └── apiController.js
│   ├── middleware/
│   ├── config/
│   ├── index.js
│   ├── package.json
│   └── .env
│
└── README.md
```

## Installation

### Frontend Setup

```bash
cd client
npm install
```

### Backend Setup

```bash
cd server
npm install
```

## Running the Application

### Start Backend Server

```bash
cd server
npm start
```

The backend will run on `http://localhost:5000`

### Start Frontend Development Server

```bash
cd client
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### GET /api/ping

Returns a test message to verify backend connectivity.

**Response:**
```json
{
  "message": "Mee-Mo backend running"
}
```

## Technologies Used

### Frontend
- React 18
- Vite
- React Router DOM

### Backend
- Node.js
- Express
- CORS
- dotenv

## Development

- Frontend uses Vite's hot module replacement for fast development
- Backend can use `npm run dev` for auto-restart on file changes (requires Node 18+)
- API proxy is configured in Vite to forward `/api` requests to the backend

## License

ISC
