import { Router } from 'express';
import { 
    getFacturasResumen, getFacturaDetallesCompletos, createFactura, registrarPago, 
    deleteFactura, cambiarEstado, getEntregasResumen, getContadoresEntregas, 
    marcarEntrega, actualizarEstadoEntrega, validarItems, getEstadisticas, getProximasEntrega, getFacturasPendientesPago 
} from '../controllers/facturas.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authorize);

// Rutas estáticas primero
router.get('/resumen', getFacturasResumen);
router.get('/entregas-resumen', getEntregasResumen);
router.get('/contadores-entregas', getContadoresEntregas);

// Rutas dinámicas
router.get('/:id/detalles-completos', getFacturaDetallesCompletos);
router.post('/', createFactura);
router.post('/:id/pagar', registrarPago);
router.delete('/:id', deleteFactura);
router.put('/:id/estado', cambiarEstado);
router.post('/:id/marcar-entrega', marcarEntrega);
router.put('/:id/estado-entrega', actualizarEstadoEntrega);

// Estadísticas y otras rutas
router.get('/estadisticas', getEstadisticas);
router.get('/proximas-entrega', getProximasEntrega);
router.get('/pendientes-pago', getFacturasPendientesPago);
router.post('/validar-items', validarItems);

export default router;