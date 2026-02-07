#!/bin/bash

# Function to kill all background processes on script exit
cleanup() {
    echo "Stopping all services..."
    # Kill all child processes of this script
    pkill -P $$
    exit
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT SIGTERM

echo "======================================"
echo "Starting DietKaro Development Environment"
echo "======================================"

# Start Backend
echo "🚀 Starting Backend on PORT 3000..."
(cd backend && PORT=3000 npm run dev) &

# Start Frontend
echo "💻 Starting Frontend on PORT 3001..."
(cd frontend && PORT=3001 npm run dev) &

# Start Client App
echo "📱 Starting Client App (Expo)..."
(cd client-app && npm start) &

echo "======================================"
echo "All services are starting..."
echo "Backend API: http://localhost:3000"
echo "Frontend UI: http://localhost:3001"
echo "======================================"
echo "Press Ctrl+C to stop all services."

# Wait for all background processes
wait
