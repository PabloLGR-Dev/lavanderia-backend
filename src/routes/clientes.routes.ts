import { Router } from 'express';
import { 
  getClientes, 
  getClienteById, 
  createCliente, 
  updateCliente, 
  deleteCliente 
} from '../controllers/clientes.controller.js';

const router = Router();

// Definimos los endpoints para /api/clientes
router.get('/', getClientes);           // GET /api/clientes
router.get('/:id', getClienteById);     // GET /api/clientes/1
router.post('/', createCliente);        // POST /api/clientes
router.put('/:id', updateCliente);      // PUT /api/clientes/1
router.delete('/:id', deleteCliente);   // DELETE /api/clientes/1

export default router;