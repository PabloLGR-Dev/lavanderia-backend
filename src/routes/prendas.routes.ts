import { Router } from 'express';
import { getPrendas, getPrendaById, createPrenda, updatePrenda, deletePrenda } from '../controllers/prendas.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authorize);

router.get('/', getPrendas);
router.get('/:id', getPrendaById);
router.post('/', createPrenda);
router.put('/:id', updatePrenda);
router.delete('/:id', deletePrenda);

export default router;