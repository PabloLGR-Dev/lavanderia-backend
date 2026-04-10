import { Request, Response } from 'express';
import { eq, ilike, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

// GET: OPTIMIZADO (Agrupando en memoria)
export const getPrendas = async (req: Request, res: Response) => {
    try {
        const { search } = req.query;
        let query = db.select().from(schema.prendas).$dynamic();

        if (search) {
            query = query.where(ilike(schema.prendas.nombre, `%${search}%`));
        }

        // 1. Obtener prendas base
        const prendasBase = await query.orderBy(schema.prendas.nombre);
        
        if (prendasBase.length === 0) {
            return res.json([]);
        }

        const idsPrendas = prendasBase.map(p => p.idprenda);

        // 2. Obtener todos los servicios de esas prendas
        const serviciosDb = await db.select({
            idPrenda: schema.prendaservicio.idprenda,
            idPrendaServicio: schema.prendaservicio.idprendaservicio,
            idServicio: schema.prendaservicio.idservicio,
            precioUnitario: schema.prendaservicio.preciounitario,
            nombreServicio: schema.servicios.nombre
        })
        .from(schema.prendaservicio)
        .innerJoin(schema.servicios, eq(schema.prendaservicio.idservicio, schema.servicios.idservicio))
        .where(inArray(schema.prendaservicio.idprenda, idsPrendas));

        // 3. Agrupar servicios por IdPrenda
        const serviciosPorPrenda: Record<number, any[]> = {};
        serviciosDb.forEach(s => {
            if (!serviciosPorPrenda[s.idPrenda]) {
                serviciosPorPrenda[s.idPrenda] = [];
            }
            serviciosPorPrenda[s.idPrenda].push({
                idPrendaServicio: s.idPrendaServicio,
                idServicio: s.idServicio,
                nombreServicio: s.nombreServicio,
                precioUnitario: Number(s.precioUnitario)
            });
        });

        // 4. Mapear al DTO final
        const result = prendasBase.map(p => ({
            idPrenda: p.idprenda,
            nombre: p.nombre,
            descripcion: p.descripcion,
            cantidadServicios: serviciosPorPrenda[p.idprenda]?.length || 0,
            servicios: serviciosPorPrenda[p.idprenda] || []
        }));

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener prendas' });
    }
};

export const getPrendaById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const idNum = Number(id);

        const prendas = await db.select().from(schema.prendas).where(eq(schema.prendas.idprenda, idNum));
        if (prendas.length === 0) return res.status(404).json({ message: 'Prenda no encontrada' });

        const serviciosDb = await db.select({
            idPrendaServicio: schema.prendaservicio.idprendaservicio,
            idServicio: schema.prendaservicio.idservicio,
            precioUnitario: schema.prendaservicio.preciounitario,
            nombreServicio: schema.servicios.nombre
        })
        .from(schema.prendaservicio)
        .innerJoin(schema.servicios, eq(schema.prendaservicio.idservicio, schema.servicios.idservicio))
        .where(eq(schema.prendaservicio.idprenda, idNum));

        const result = {
            idPrenda: prendas[0].idprenda,
            nombre: prendas[0].nombre,
            descripcion: prendas[0].descripcion,
            cantidadServicios: serviciosDb.length,
            servicios: serviciosDb.map(s => ({
                ...s,
                precioUnitario: Number(s.precioUnitario)
            }))
        };

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener la prenda' });
    }
};

export const createPrenda = async (req: Request, res: Response) => {
    try {
        const { nombre, descripcion } = req.body;
        const nuevaPrenda = await db.insert(schema.prendas)
            .values({ nombre: nombre.trim(), descripcion: descripcion?.trim() })
            .returning();

        res.status(201).json({ idPrenda: nuevaPrenda[0].idprenda, nombre: nuevaPrenda[0].nombre });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear prenda' });
    }
};

export const updatePrenda = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion } = req.body;

        const actualizada = await db.update(schema.prendas)
            .set({
                ...(nombre && { nombre: nombre.trim() }),
                ...(descripcion !== undefined && { descripcion: descripcion?.trim() })
            })
            .where(eq(schema.prendas.idprenda, Number(id)))
            .returning();

        if (actualizada.length === 0) return res.status(404).json({ message: 'Prenda no encontrada' });
        res.json({ idPrenda: actualizada[0].idprenda });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar prenda' });
    }
};

export const deletePrenda = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        // Verificar si tiene servicios
        const servicios = await db.select().from(schema.prendaservicio).where(eq(schema.prendaservicio.idprenda, Number(id)));
        if (servicios.length > 0) {
            return res.status(400).json({ message: "No se puede eliminar la prenda porque tiene servicios asociados" });
        }

        await db.delete(schema.prendas).where(eq(schema.prendas.idprenda, Number(id)));
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar prenda' });
    }
};