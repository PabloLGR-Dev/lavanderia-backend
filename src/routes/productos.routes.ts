import { Router } from 'express';
import { 
    getProductos, getProductoById, createProducto, updateProducto, deleteProducto,
    getProductosPaginados, busquedaUnificada, getProductosBajoStock
} from '../controllers/productos.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authorize);

// Rutas específicas primero para que no choquen con /:id
router.get('/paginados', getProductosPaginados);
router.get('/busqueda-unificada', busquedaUnificada);
router.get('/bajo-stock', getProductosBajoStock);

// CRUD estándar
router.get('/', getProductos);
router.get('/:id', getProductoById);
router.post('/', createProducto);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);

export default router;