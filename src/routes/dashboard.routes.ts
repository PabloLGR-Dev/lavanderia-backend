import { Router } from 'express';
import { getResumen } from '../controllers/dashboard.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authorize); // Protegemos la ruta

router.get('/resumen', getResumen);

export default router;