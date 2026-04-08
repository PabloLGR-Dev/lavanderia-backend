import { Router } from 'express';
import { 
    getUsuarios, getUsuarioById, createUsuario, 
    updateUsuario, updateUsuarioRol, deleteUsuario 
} from '../controllers/usuarios.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authorize);

router.get('/', getUsuarios);
router.get('/:id', getUsuarioById);
router.post('/', createUsuario);
router.put('/:id', updateUsuario);
router.put('/:id/rol', updateUsuarioRol);
router.delete('/:id', deleteUsuario);

export default router;