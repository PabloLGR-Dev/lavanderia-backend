import { Router } from 'express';
import { getRoles, getRolById } from '../controllers/roles.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authorize); // Protegemos todas las rutas de roles

router.get('/', getRoles);
router.get('/:id', getRolById);

export default router;