import { Router } from 'express';
import { 
    getCategoriasResumen, getCategoriasActivas, getCategoriaById, 
    createCategoriaGasto, updateCategoriaGasto, deleteCategoriaGasto, toggleEstado 
} from '../controllers/categorias-gastos.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authorize);

router.get('/resumen', getCategoriasResumen);
router.get('/activas', getCategoriasActivas);
router.get('/:id', getCategoriaById);
router.post('/', createCategoriaGasto);
router.put('/:id', updateCategoriaGasto);
router.delete('/:id', deleteCategoriaGasto);
router.put('/:id/toggle-estado', toggleEstado);

export default router;