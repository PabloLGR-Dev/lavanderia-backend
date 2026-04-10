import { Request, Response } from 'express';
import { eq, ilike, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

export const getGastosResumen = async (req: Request, res: Response) => {
    try {
        const { categoriaId, fechaDesde, fechaHasta, search, page = 1, pageSize = 20 } = req.query;
        
        const currentPage = Math.max(1, Number(page));
        const limit = Math.max(1, Number(pageSize));
        const offset = (currentPage - 1) * limit;

        const filters = [];

        // Filtros de categoría y fechas
        if (categoriaId) filters.push(eq(schema.gastos.idcategoriagasto, Number(categoriaId)));
        
        if (fechaDesde) {
            // Pasamos a string
            filters.push(gte(schema.gastos.fechagasto, new Date(fechaDesde as string).toISOString()));
        }
        if (fechaHasta) {
            const dateHasta = new Date(fechaHasta as string);
            dateHasta.setHours(23, 59, 59, 999);
            // Pasamos a string
            filters.push(lte(schema.gastos.fechagasto, dateHasta.toISOString()));
        }
        
        if (search) {
            const searchStr = `%${search}%`;
            filters.push(ilike(schema.gastos.descripcion, searchStr)!);
        }

        const whereClause = filters.length > 0 ? and(...filters) : undefined;

        // Obtener gastos con Joins
        const gastosDb = await db.select({
            gasto: schema.gastos,
            categoriaNombre: schema.categoriasgasto.nombre,
            categoriaColor: schema.categoriasgasto.color,
            usuarioNombre: schema.usuarios.nombre,
            estadoNombre: schema.estados.nombre
        })
        .from(schema.gastos)
        .innerJoin(schema.categoriasgasto, eq(schema.gastos.idcategoriagasto, schema.categoriasgasto.idcategoriagasto))
        .innerJoin(schema.usuarios, eq(schema.gastos.idusuario, schema.usuarios.idusuario))
        .innerJoin(schema.estados, eq(schema.gastos.idestado, schema.estados.idestado))
        .where(whereClause);

        // Ordenar por fecha descendente
        gastosDb.sort((a, b) => new Date(b.gasto.fechagasto).getTime() - new Date(a.gasto.fechagasto).getTime());

        const totalRecords = gastosDb.length;
        const gastosPaginados = gastosDb.slice(offset, offset + limit);

        const data = gastosPaginados.map(g => ({
            idGasto: g.gasto.idgasto,
            categoria: g.categoriaNombre,
            categoriaColor: g.categoriaColor || "#6B7280",
            monto: Number(g.gasto.monto),
            fechaGasto: new Date(g.gasto.fechagasto).toISOString(),
            descripcion: g.gasto.descripcion,
            referencia: g.gasto.referencia,
            comprobanteUrl: g.gasto.comprobanteurl,
            usuario: g.usuarioNombre,
            estado: g.estadoNombre,
            fechaCreacion: new Date(g.gasto.fechacreacion).toISOString()
        }));

        res.json({
            data,
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
        console.error('Error al obtener resumen de gastos:', error);
        res.status(500).json({ error: 'Error al obtener resumen de gastos' });
    }
};

export const createGasto = async (req: AuthRequest, res: Response) => {
    try {
        const userId = Number(req.user.nameid);
        const dto = req.body;

        const nuevoGasto = await db.insert(schema.gastos).values({
            idcategoriagasto: dto.idCategoriaGasto,
            monto: dto.monto,
            fechagasto: new Date(dto.fechaGasto).toISOString(),
            descripcion: dto.descripcion.trim(),
            referencia: dto.referencia?.trim(),
            comprobanteurl: dto.comprobanteUrl?.trim(),
            idusuario: userId,
            idestado: dto.idEstado || 1,
            fechacreacion: new Date().toISOString(),
            fechaultimaactualizacion: new Date().toISOString()
        }).returning();

        res.status(201).json({ idGasto: nuevoGasto[0].idgasto });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear gasto' });
    }
};

export const updateGasto = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const dto = req.body;

        await db.update(schema.gastos).set({
            ...(dto.idCategoriaGasto && { idcategoriagasto: dto.idCategoriaGasto }),
            ...(dto.monto && { monto: dto.monto }),
            ...(dto.fechaGasto && { fechagasto: new Date(dto.fechaGasto).toISOString() }),
            ...(dto.descripcion && { descripcion: dto.descripcion.trim() }),
            ...(dto.referencia !== undefined && { referencia: dto.referencia?.trim() }),
            ...(dto.comprobanteUrl !== undefined && { comprobanteurl: dto.comprobanteUrl?.trim() }),
            ...(dto.idEstado && { idestado: dto.idEstado }),
            fechaultimaactualizacion: new Date().toISOString()
        })
        .where(eq(schema.gastos.idgasto, Number(id)));

        res.json({ message: "Gasto actualizado" });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar gasto' });
    }
};

export const deleteGasto = async (req: Request, res: Response) => {
    try {
        await db.delete(schema.gastos).where(eq(schema.gastos.idgasto, Number(req.params.id)));
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar gasto' });
    }
};

export const getResumenFinanciero = async (req: Request, res: Response) => {
    try {
        const { fechaDesde, fechaHasta } = req.query;
        
        const hoy = new Date();
        const desdeDate = fechaDesde ? new Date(fechaDesde as string) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const hastaDate = fechaHasta ? new Date(fechaHasta as string) : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

        // Convertimos a strings para que Drizzle sea feliz
        const desdeStr = desdeDate.toISOString();
        const hastaStr = hastaDate.toISOString();

        // 1. Total Ingresos
        const facturas = await db.select({ montoAbonado: schema.facturas.montoabonado })
            .from(schema.facturas)
            .where(and(
                gte(schema.facturas.fechacreacion, desdeStr),
                lte(schema.facturas.fechacreacion, hastaStr)
            ));
        
        const totalIngresos = facturas.reduce((sum, f) => sum + Number(f.montoAbonado || 0), 0);

        // 2. Total Gastos
        const gastosDb = await db.select({ monto: schema.gastos.monto })
            .from(schema.gastos)
            .where(and(
                gte(schema.gastos.fechagasto, desdeStr),
                lte(schema.gastos.fechagasto, hastaStr)
            ));

        const totalGastos = gastosDb.reduce((sum, g) => sum + Number(g.monto), 0);

        const gananciaNeta = totalIngresos - totalGastos;
        const margenGanancia = totalIngresos > 0 ? (gananciaNeta / totalIngresos * 100) : 0;

        res.json({
            totalIngresos,
            totalGastos,
            gananciaNeta,
            margenGanancia,
            fechaDesde: desdeStr,
            fechaHasta: hastaStr
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al calcular el resumen financiero' });
    }
};