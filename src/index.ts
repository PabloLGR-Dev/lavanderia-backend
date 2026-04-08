import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import clientesRoutes from './routes/clientes.routes.js';
import rolesRoutes from './routes/roles.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import configuracionesRoutes from './routes/configuraciones.routes.js';
import authRoutes from './routes/auth.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración estricta de CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3001', // Solo permite peticiones de esta URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Headers permitidos (necesitas Authorization para el Bearer token)
  credentials: true // Importante si en el futuro usas cookies
};

app.use(cors(corsOptions));
app.use(express.json());

// Rutas
app.use('/api/clientes', clientesRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/users', usuariosRoutes); // Ojo: tu frontend lo llama 'users', no 'usuarios'
app.use('/api/configuraciones', configuracionesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/health', (req, res) => {
  res.json({ message: '¡El backend de Lavandería Rodriguez está vivo y conectado!' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Aceptando peticiones solo desde: ${process.env.FRONTEND_URL}`);
});