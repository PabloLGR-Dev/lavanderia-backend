import { Router } from 'express';
import { 
    getReporteFinancieroCompleto, 
    getResumenFinanciero, 
    getEstadisticasGastos, 
    getEstadisticasFacturas 
} from '../controllers/reportes.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// Todas las rutas de reportes requieren autenticación
router.use(authorize);

router.get('/financiero-completo', getReporteFinancieroCompleto);
router.get('/resumen-financiero', getResumenFinanciero);
router.get('/estadisticas-gastos', getEstadisticasGastos);
router.get('/estadisticas-facturas', getEstadisticasFacturas);

export default router;