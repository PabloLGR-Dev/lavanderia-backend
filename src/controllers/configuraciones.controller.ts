import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

// Helper local para obtener booleanos de forma segura
const getConfigBool = async (clave: string): Promise<boolean> => {
    const config = await db.select().from(schema.configuraciones).where(eq(schema.configuraciones.clave, clave));
    if (config.length === 0) return false;
    return config[0].valor.toLowerCase() === 'true';
};

export const getConfiguracionesGenerales = async (req: Request, res: Response) => {
    try {
        const controlStock = await getConfigBool("CONTROL_STOCK_ACTIVO");
        const controlEntregas = await getConfigBool("CONTROL_ENTREGAS_ACTIVO");

        res.json({
            controlStockActivo: controlStock,
            controlEntregasActivo: controlEntregas
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error obteniendo configuraciones generales' });
    }
};

export const toggleControlStock = async (req: Request, res: Response) => {
    try {
        const valorActual = await getConfigBool("CONTROL_STOCK_ACTIVO");
        const nuevoValor = (!valorActual).toString().toLowerCase();

        await db.update(schema.configuraciones)
            .set({ 
                valor: nuevoValor,
                fechaultimaactualizacion: new Date().toISOString()
            })
            .where(eq(schema.configuraciones.clave, "CONTROL_STOCK_ACTIVO"));

        res.json({
            mensaje: `Control de stock ${nuevoValor === 'true' ? 'activado' : 'desactivado'}`,
            activo: nuevoValor === 'true'
        });
    } catch (error) {
         res.status(500).json({ error: 'Error al cambiar configuración' });
    }
};

export const toggleControlEntregas = async (req: Request, res: Response) => {
    try {
        const valorActual = await getConfigBool("CONTROL_ENTREGAS_ACTIVO");
        const nuevoValor = (!valorActual).toString().toLowerCase();

        await db.update(schema.configuraciones)
            .set({ 
                valor: nuevoValor,
                fechaultimaactualizacion: new Date().toISOString()
            })
            .where(eq(schema.configuraciones.clave, "CONTROL_ENTREGAS_ACTIVO"));

        res.json({
            mensaje: `Control de entregas ${nuevoValor === 'true' ? 'activado' : 'desactivado'}`,
            activo: nuevoValor === 'true'
        });
    } catch (error) {
         res.status(500).json({ error: 'Error al cambiar configuración' });
    }
};