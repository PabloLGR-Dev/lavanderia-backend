import { Router } from 'express';
import { 
    getServicios, getServiciosSimples, getServicioById, 
    createServicio, updateServicio, deleteServicio 
} from '../controllers/servicios.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authorize);

// IMPORTANTE: Rutas estáticas ANTES que las dinámicas (/:id)
router.get('/simples', getServiciosSimples);

router.get('/', getServicios);
router.get('/:id', getServicioById);
router.post('/', createServicio);
router.put('/:id', updateServicio);
router.delete('/:id', deleteServicio);

export default router;