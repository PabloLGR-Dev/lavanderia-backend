import { Router } from 'express';
import { 
  getClientes, 
  getClienteById, 
  createCliente, 
  updateCliente, 
  deleteCliente,
  getClientesActivos,
  getClienteInfoParaFactura
} from '../controllers/clientes.controller.js';

const router = Router();

// IMPORTANTE: Las rutas estáticas (/activos) deben ir ANTES que las dinámicas (/:id)
// de lo contrario Express pensará que "activos" es un ID.
router.get('/activos', getClientesActivos);
router.get('/:id/info-factura', getClienteInfoParaFactura);

router.get('/', getClientes);           
router.get('/:id', getClienteById);     
router.post('/', createCliente);        
router.put('/:id', updateCliente);      
router.delete('/:id', deleteCliente);   

export default router;