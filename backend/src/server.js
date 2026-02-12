const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const playerRoutes = require('./routes/players');

const migrate = require('./config/migrate');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: true, // Temporarily allow all origins to bypass env var issues
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rate limiting
const rateLimit = require('express-rate-limit');

// Trust proxy is required when behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
app.set('trust proxy', 1);

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 requests per `window` (here, per hour)
  message: { error: 'Too many requests from this IP, please try again after an hour' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/players', playerRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Import diagnostics
const runDiagnostics = require('./scripts/dbDiagnostics');

// Start server
const startServer = async () => {
  try {
    console.log('Attempting to start server...');

    // Run connectivity diagnostics first
    await runDiagnostics();

    // Run migrations on startup
    await migrate();
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Failed to run migrations on startup:', error);
    // We continue starting the server so we can at least return 500s with logs
    console.warn('⚠️ Server starting in DEGRADED mode (DB connection failed)');
  }

  app.get('/', (req, res) => {
    res.send('API running');
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

// Global error handlers for debugging
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

startServer();

module.exports = app;
