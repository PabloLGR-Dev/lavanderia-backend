import { Router } from 'express';
import { 
    getGastosResumen, createGasto, updateGasto, deleteGasto, getResumenFinanciero 
} from '../controllers/gastos.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authorize);

router.get('/resumen', getGastosResumen);
router.get('/resumen-financiero', getResumenFinanciero);
router.post('/', createGasto);
router.put('/:id', updateGasto);
router.delete('/:id', deleteGasto);

export default router;