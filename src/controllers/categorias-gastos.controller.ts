import { Request, Response } from 'express';
import { eq, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

export const getCategoriasActivas = async (req: Request, res: Response) => {
    try {
        const categorias = await db.select()
            .from(schema.categoriasgasto)
            .where(eq(schema.categoriasgasto.idestado, 1))
            .orderBy(schema.categoriasgasto.nombre);

        res.json(categorias.map(c => ({
            idCategoriaGasto: c.idcategoriagasto,
            nombre: c.nombre,
            descripcion: c.descripcion,
            color: c.color,
            idEstado: c.idestado,
            montoPredefinido: c.montopredefinido ? Number(c.montopredefinido) : null // NUEVO
        })));
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener categorías activas' });
    }
};

export const getCategoriasResumen = async (req: Request, res: Response) => {
    try {
        const { search, estadoId, page = 1, pageSize = 20 } = req.query;
        
        const currentPage = Math.max(1, Number(page));
        const limit = Math.max(1, Number(pageSize));
        const offset = (currentPage - 1) * limit;

        let query = db.select({
            categoria: schema.categoriasgasto,
            estadoNombre: schema.estados.nombre
        })
        .from(schema.categoriasgasto)
        .innerJoin(schema.estados, eq(schema.categoriasgasto.idestado, schema.estados.idestado))
        .$dynamic();

        if (search) {
            const searchStr = `%${search}%`;
            query = query.where(ilike(schema.categoriasgasto.nombre, searchStr)!);
        }

        if (estadoId) {
            query = query.where(eq(schema.categoriasgasto.idestado, Number(estadoId)));
        }

        const categoriasBase = await query.orderBy(schema.categoriasgasto.nombre);
        
        const totalRecords = categoriasBase.length;
        const categoriasPaginadas = categoriasBase.slice(offset, offset + limit);

        const idsCategorias = categoriasPaginadas.map(c => c.categoria.idcategoriagasto);
        
        let gastosPorCategoria: Record<number, any[]> = {};
        if (idsCategorias.length > 0) {
            const todosLosGastos = await db.select().from(schema.gastos);
            todosLosGastos.forEach(g => {
                if (!gastosPorCategoria[g.idcategoriagasto]) gastosPorCategoria[g.idcategoriagasto] = [];
                gastosPorCategoria[g.idcategoriagasto].push(g);
            });
        }

        const result = categoriasPaginadas.map(c => {
            const gastosCat = gastosPorCategoria[c.categoria.idcategoriagasto] || [];
            return {
                idCategoriaGasto: c.categoria.idcategoriagasto,
                nombre: c.categoria.nombre,
                descripcion: c.categoria.descripcion,
                color: c.categoria.color,
                idEstado: c.categoria.idestado,
                estado: c.estadoNombre,
                fechaCreacion: c.categoria.fechacreacion,
                montoPredefinido: c.categoria.montopredefinido ? Number(c.categoria.montopredefinido) : null, // NUEVO
                totalGastos: gastosCat.length,
                montoTotalGastos: gastosCat.reduce((sum, g) => sum + Number(g.monto), 0)
            };
        });

        res.json({
            data: result,
            pagination: {
                page: currentPage,
                pageSize: limit,
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                hasPreviousPage: currentPage > 1,
                hasNextPage: currentPage < Math.ceil(totalRecords / limit)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener resumen de categorías' });
    }
};

export const getCategoriaById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const categoria = await db.select().from(schema.categoriasgasto).where(eq(schema.categoriasgasto.idcategoriagasto, Number(id)));
        if (categoria.length === 0) return res.status(404).json({ message: 'Categoría no encontrada' });
        
        const c = categoria[0];
        res.json({
            idCategoriaGasto: c.idcategoriagasto,
            nombre: c.nombre,
            descripcion: c.descripcion,
            color: c.color,
            idEstado: c.idestado,
            montoPredefinido: c.montopredefinido ? Number(c.montopredefinido) : null // NUEVO
        });
    } catch (error) {
        res.status(500).json({ error: 'Error interno' });
    }
};

export const createCategoriaGasto = async (req: Request, res: Response) => {
    try {
        const { nombre, descripcion, color, idEstado, montoPredefinido } = req.body;

        const existe = await db.select().from(schema.categoriasgasto).where(ilike(schema.categoriasgasto.nombre, nombre.trim()));
        if (existe.length > 0) return res.status(400).json({ message: "Ya existe una categoría con ese nombre" });

        const nueva = await db.insert(schema.categoriasgasto).values({
            nombre: nombre.trim(),
            descripcion: descripcion?.trim(),
            color: color || '#6B7280',
            idestado: idEstado || 1,
            montopredefinido: montoPredefinido || null, // NUEVO
            fechacreacion: new Date().toISOString()
        }).returning();

        res.status(201).json({ idCategoriaGasto: nueva[0].idcategoriagasto });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear' });
    }
};

export const updateCategoriaGasto = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, color, idEstado, montoPredefinido } = req.body;

        const actualizada = await db.update(schema.categoriasgasto).set({
            ...(nombre && { nombre: nombre.trim() }),
            ...(descripcion !== undefined && { descripcion: descripcion?.trim() }),
            ...(color && { color }),
            ...(idEstado && { idestado: idEstado }),
            ...(montoPredefinido !== undefined && { montopredefinido: montoPredefinido }) // NUEVO
        })
        .where(eq(schema.categoriasgasto.idcategoriagasto, Number(id)))
        .returning();

        res.json({ idCategoriaGasto: actualizada[0].idcategoriagasto });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
};

// ... deleteCategoriaGasto y toggleEstado permanecen exactamente igual
export const deleteCategoriaGasto = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const gastos = await db.select().from(schema.gastos).where(eq(schema.gastos.idcategoriagasto, Number(id)));
        if (gastos.length > 0) {
            return res.status(400).json({ message: "No se puede eliminar la categoría porque tiene gastos asociados" });
        }
        await db.delete(schema.categoriasgasto).where(eq(schema.categoriasgasto.idcategoriagasto, Number(id)));
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
};

export const toggleEstado = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const categoria = await db.select().from(schema.categoriasgasto).where(eq(schema.categoriasgasto.idcategoriagasto, Number(id)));
        if (categoria.length === 0) return res.status(404).json({ message: 'No encontrada' });
        const nuevoEstado = categoria[0].idestado === 1 ? 2 : 1;
        await db.update(schema.categoriasgasto).set({ idestado: nuevoEstado }).where(eq(schema.categoriasgasto.idcategoriagasto, Number(id)));
        res.json({ message: "Estado cambiado" });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};