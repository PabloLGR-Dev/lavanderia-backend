import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Importamos nuestras rutas (Recuerda el .js al final)
import clientesRoutes from './routes/clientes.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Permite peticiones desde el frontend
app.use(express.json()); // Permite recibir JSON en el body de las peticiones

// Montamos la ruta de clientes
app.use('/api/clientes', clientesRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ message: '¡El backend de Lavandería Rodriguez está vivo y conectado!' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});