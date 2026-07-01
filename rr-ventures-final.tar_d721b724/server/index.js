const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');
const { authMiddleware } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

let db;

// Initialize database then start server
async function startServer() {
  db = await initializeDatabase();
  
  // Store db in app locals for routes to access
  app.locals.db = db;

  // API Routes
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);

  // Protected auth route
  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const user = req.user;
    let role = user.role;
    if (role === 'member' && user.member_to && new Date(user.member_to) < new Date()) {
      role = 'user';
    }
    res.json({
      id: user.id, email: user.email, phone: user.phone,
      name: user.name, role, wallet_balance: user.wallet_balance,
      member_from: user.member_from, member_to: user.member_to
    });
  });

  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api/admin', require('./routes/admin'));

  // Serve static files from client build
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RR Ventures server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
