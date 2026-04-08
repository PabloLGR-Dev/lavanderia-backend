import { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

export const getRoles = async (req: Request, res: Response) => {
    try {
        const roles = await db.select().from(schema.roles);
        
        // Mapear para el frontend
        const mappedRoles = roles.map(r => ({
            idRol: r.idrol,
            nombre: r.nombre,
            descripcion: r.descripcion,
            idEstado: r.idestado,
            fechaCreacion: r.fechacreacion
        }));
        
        res.json(mappedRoles);
    } catch (error) {
        console.error('Error obteniendo roles:', error);
        res.status(500).json({ error: 'Error al obtener los roles' });
    }
};

export const getRolById = async (req: Request, res: Response) => {
     try {
        const { id } = req.params;
        const roles = await db.select().from(schema.roles).where(eq(schema.roles.idrol, Number(id)));
        
        if (roles.length === 0) return res.status(404).json({ message: 'Rol no encontrado' });

        const r = roles[0];
        res.json({
            idRol: r.idrol,
            nombre: r.nombre,
            descripcion: r.descripcion,
            idEstado: r.idestado,
            fechaCreacion: r.fechacreacion
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el rol' });
    }
};