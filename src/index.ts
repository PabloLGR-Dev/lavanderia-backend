import express from 'express';
import clientesRouter from './routes/clientes.js';
import estadosRouter from './routes/estados.js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 8000;

app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}))

app.use('/api/clientes', clientesRouter)
app.use('/api/estados', estadosRouter)

app.get('/', (req, res) => {
  res.send('Hello, welcome to Lavanderia Rodriguez API!')
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});