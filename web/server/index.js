require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/database');

const authRoutes = require('./routes/auth');
const wardrobeRoutes = require('./routes/wardrobe');
const recommendationsRoutes = require('./routes/recommendations');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:3000', 'http://10.0.2.2:3000'],
  credentials: true,
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/user', userRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

initDatabase();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`FitGPT server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
