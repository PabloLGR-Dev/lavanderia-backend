import { Request, Response } from 'express';
import { eq, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

export const getCategorias = async (req: Request, res: Response) => {
    try {
        const { search } = req.query;
        let query = db.select().from(schema.categoriasproducto).$dynamic();

        if (search) {
            query = query.where(ilike(schema.categoriasproducto.nombre, `%${search}%`));
        }

        const categorias = await query.orderBy(schema.categoriasproducto.nombre);

        // Mapeo a camelCase para el frontend
        res.json(categorias.map(c => ({
            idCategoria: c.idcategoria,
            nombre: c.nombre
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};

export const getCategoriaById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const categoria = await db.select()
            .from(schema.categoriasproducto)
            .where(eq(schema.categoriasproducto.idcategoria, Number(id)));

        if (categoria.length === 0) return res.status(404).json({ message: 'Categoría no encontrada' });

        res.json({
            idCategoria: categoria[0].idcategoria,
            nombre: categoria[0].nombre
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener la categoría' });
    }
};

export const createCategoria = async (req: Request, res: Response) => {
    try {
        const { nombre } = req.body;
        if (!nombre) return res.status(400).json({ message: 'El nombre es requerido' });

        const nuevaCategoria = await db.insert(schema.categoriasproducto)
            .values({ nombre: nombre.trim() })
            .returning();

        res.status(201).json({
            idCategoria: nuevaCategoria[0].idcategoria,
            nombre: nuevaCategoria[0].nombre
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
};

export const updateCategoria = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;

        const categoriaActualizada = await db.update(schema.categoriasproducto)
            .set({ nombre: nombre?.trim() })
            .where(eq(schema.categoriasproducto.idcategoria, Number(id)))
            .returning();

        if (categoriaActualizada.length === 0) return res.status(404).json({ message: 'Categoría no encontrada' });

        res.json({
            idCategoria: categoriaActualizada[0].idcategoria,
            nombre: categoriaActualizada[0].nombre
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar categoría' });
    }
};

export const deleteCategoria = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Validar si tiene productos
        const productosAsociados = await db.select()
            .from(schema.productos)
            .where(eq(schema.productos.idcategoria, Number(id)));

        if (productosAsociados.length > 0) {
            return res.status(400).json({ message: 'No se puede eliminar la categoría porque tiene productos asociados' });
        }

        await db.delete(schema.categoriasproducto).where(eq(schema.categoriasproducto.idcategoria, Number(id)));
        
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
};