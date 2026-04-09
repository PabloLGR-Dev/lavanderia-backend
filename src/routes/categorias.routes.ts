import { Router } from 'express';
import { getCategorias, getCategoriaById, createCategoria, updateCategoria, deleteCategoria } from '../controllers/categorias.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authorize);

router.get('/', getCategorias);
router.get('/:id', getCategoriaById);
router.post('/', createCategoria);
router.put('/:id', updateCategoria);
router.delete('/:id', deleteCategoria);

export default router;