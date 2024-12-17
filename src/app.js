require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/database');
const routes = require('./routes');

// Initialize express app
const app = express();

// CORS configuration
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'apikey'],
    exposedHeaders: ['apikey'],
    credentials: true
};

// Raw body buffer for webhooks
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

// Body parser middleware - except for Stripe webhook route
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook/stripe') {
        next();
    } else {
        // Log raw request for debugging
        console.log('Raw request:', {
            headers: req.headers,
            body: req.rawBody,
            parsedBody: req.body
        });
        next();
    }
});

// Other middleware
app.use(helmet()); // Security headers
app.use(morgan('dev')); // Logging
app.use(cors(corsOptions)); // CORS support with custom options

// Routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error details:', {
        error: err.message,
        stack: err.stack,
        headers: req.headers,
        body: req.rawBody
    });
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server function
const startServer = async () => {
    try {
        // Connect to MongoDB first
        await connectDB();

        // Then start the server
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    // Don't exit the process in development
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// Start the server
startServer();

module.exports = app;
