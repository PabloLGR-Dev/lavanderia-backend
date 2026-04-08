import { Router } from 'express';
import { login, me } from '../controllers/auth.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// Endpoint público para iniciar sesión
router.post('/login', login);

// Endpoint protegido para obtener datos del usuario actual
router.get('/me', authorize, me);

export default router;