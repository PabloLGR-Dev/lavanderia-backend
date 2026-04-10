import { Router } from 'express';
import { getPagos, getPagoById, createPago, updatePago, deletePago } from '../controllers/pagos.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authorize);

router.get('/', getPagos);
router.get('/:id', getPagoById);
router.post('/', createPago);
router.put('/:id', updatePago);
router.delete('/:id', deletePago);

export default router;