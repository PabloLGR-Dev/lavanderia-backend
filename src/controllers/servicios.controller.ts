import { Request, Response } from 'express';
import { eq, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

export const getServicios = async (req: Request, res: Response) => {
    try {
        const { search } = req.query;
        let query = db.select().from(schema.servicios).$dynamic();

        if (search) {
            query = query.where(ilike(schema.servicios.nombre, `%${search}%`));
        }

        const servicios = await query.orderBy(schema.servicios.nombre);

        res.json(servicios.map(s => ({
            idServicio: s.idservicio,
            nombre: s.nombre,
            descripcion: s.descripcion,
            duracionEstimada: s.duracionEstimada,
            idEstado: s.idestado,
            fechaCreacion: s.fechaCreacion,
            fechaUltimaActualizacion: s.fechaultimaactualizacion
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
};

export const getServiciosSimples = async (req: Request, res: Response) => {
    try {
        const servicios = await db.select({
            idServicio: schema.servicios.idservicio,
            nombre: schema.servicios.nombre,
            idEstado: schema.servicios.idestado
        })
        .from(schema.servicios)
        .where(eq(schema.servicios.idestado, 1))
        .orderBy(schema.servicios.nombre);

        res.json(servicios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener servicios simples' });
    }
};

export const getServicioById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const servicio = await db.select()
            .from(schema.servicios)
            .where(eq(schema.servicios.idservicio, Number(id)));

        if (servicio.length === 0) return res.status(404).json({ message: 'Servicio no encontrado' });

        const s = servicio[0];
        res.json({
            idServicio: s.idservicio,
            nombre: s.nombre,
            descripcion: s.descripcion,
            duracionEstimada: s.duracionEstimada,
            idEstado: s.idestado
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el servicio' });
    }
};

export const createServicio = async (req: Request, res: Response) => {
    try {
        const data = req.body;
        if (!data.nombre) return res.status(400).json({ message: 'El nombre es requerido' });

        const nuevoServicio = await db.insert(schema.servicios).values({
            nombre: data.nombre.trim(),
            descripcion: data.descripcion?.trim(),
            duracionEstimada: data.duracionEstimada,
            idestado: data.idEstado || 1,
            fechaCreacion: new Date().toISOString(),
            fechaultimaactualizacion: new Date().toISOString()
        }).returning();

        res.status(201).json({
            idServicio: nuevoServicio[0].idservicio,
            nombre: nuevoServicio[0].nombre
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear servicio' });
    }
};

export const updateServicio = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const servicioActualizado = await db.update(schema.servicios)
            .set({
                ...(data.nombre && { nombre: data.nombre.trim() }),
                ...(data.descripcion !== undefined && { descripcion: data.descripcion?.trim() }),
                ...(data.duracionEstimada !== undefined && { duracionEstimada: data.duracionEstimada }),
                ...(data.idEstado !== undefined && { idestado: data.idEstado }),
                fechaultimaactualizacion: new Date().toISOString()
            })
            .where(eq(schema.servicios.idservicio, Number(id)))
            .returning();

        if (servicioActualizado.length === 0) return res.status(404).json({ message: 'Servicio no encontrado' });

        res.json({ idServicio: servicioActualizado[0].idservicio });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar servicio' });
    }
};

export const deleteServicio = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        await db.update(schema.servicios)
            .set({ 
                idestado: 2,
                fechaultimaactualizacion: new Date().toISOString()
            })
            .where(eq(schema.servicios.idservicio, Number(id)));

        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar servicio' });
    }
};