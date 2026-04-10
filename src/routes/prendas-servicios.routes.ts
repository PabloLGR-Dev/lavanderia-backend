import { Router } from 'express';
import { getPrendaServicioById, createPrendaServicio, deletePrendaServicio } from '../controllers/prendas-servicios.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(authorize);

router.get('/:id', getPrendaServicioById);
router.post('/', createPrendaServicio);
router.delete('/:id', deletePrendaServicio);

export default router;