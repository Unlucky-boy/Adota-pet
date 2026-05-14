require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const petsRoutes = require('./routes/pets');
const adoptionsRoutes = require('./routes/adoptions');
const adoptersRoutes = require('./routes/adopters');
const donationsRoutes = require('./routes/donations');
const volunteersRoutes = require('./routes/volunteers');
const visitsRoutes = require('./routes/visits');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'frontend', 'views'));

// Static files
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24h
  },
}));

// Global variables for views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.adopter = req.session.adopter || null;
  res.locals.success = req.session.success || null;
  res.locals.error = req.session.error || null;
  delete req.session.success;
  delete req.session.error;
  next();
});

// Routes
app.use('/', authRoutes);
app.use('/', petsRoutes);
app.use('/', adoptionsRoutes);
app.use('/', adoptersRoutes);
app.use('/', donationsRoutes);
app.use('/', volunteersRoutes);
app.use('/', visitsRoutes);
app.use('/', settingsRoutes);
app.use('/dashboard', dashboardRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Página não encontrada' });
});

app.listen(PORT, () => {
  console.log(`🐾 Adota Pet rodando em http://localhost:${PORT}`);
});
