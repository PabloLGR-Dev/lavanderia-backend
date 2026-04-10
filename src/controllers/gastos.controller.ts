import { Request, Response } from 'express';
import { eq, ilike, and, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

// --- HELPER DE ZONA HORARIA (República Dominicana UTC-4) ---
const getDRDateTime = (dateVal?: string | Date) => {
    const d = dateVal ? new Date(dateVal) : new Date();
    const options: Intl.DateTimeFormatOptions = { 
        timeZone: 'America/Santo_Domingo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false 
    };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(d);
    const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const hour = map.hour === '24' ? '00' : map.hour;
    return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}:${map.second}`;
};

const getDRDateOnly = (dateVal?: string | Date) => {
    return getDRDateTime(dateVal).substring(0, 10);
};

export const getGastosResumen = async (req: Request, res: Response) => {
    try {
        const { categoriaId, fechaDesde, fechaHasta, search, page = 1, pageSize = 20 } = req.query;
        
        const currentPage = Math.max(1, Number(page));
        const limit = Math.max(1, Number(pageSize));
        const offset = (currentPage - 1) * limit;

        const filters = [];

        if (categoriaId) filters.push(eq(schema.gastos.idcategoriagasto, Number(categoriaId)));
        
        // Uso de Zona Horaria Local para los filtros
        if (fechaDesde) {
            filters.push(gte(schema.gastos.fechagasto, getDRDateOnly(fechaDesde as string) + "T00:00:00"));
        }
        if (fechaHasta) {
            filters.push(lte(schema.gastos.fechagasto, getDRDateOnly(fechaHasta as string) + "T23:59:59"));
        }
        
        if (search) {
            const searchStr = `%${search}%`;
            filters.push(ilike(schema.gastos.descripcion, searchStr)!);
        }

        const whereClause = filters.length > 0 ? and(...filters) : undefined;

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

        gastosDb.sort((a, b) => new Date(b.gasto.fechagasto).getTime() - new Date(a.gasto.fechagasto).getTime());

        const totalRecords = gastosDb.length;
        const gastosPaginados = gastosDb.slice(offset, offset + limit);

        const data = gastosPaginados.map(g => ({
            idGasto: g.gasto.idgasto,
            categoria: g.categoriaNombre,
            categoriaColor: g.categoriaColor || "#6B7280",
            monto: Number(g.gasto.monto),
            // Evitamos toISOString() aquí para que el navegador no lo convierta a local de nuevo
            fechaGasto: g.gasto.fechagasto ? g.gasto.fechagasto.replace(" ", "T") : null,
            descripcion: g.gasto.descripcion,
            referencia: g.gasto.referencia,
            comprobanteUrl: g.gasto.comprobanteurl,
            usuario: g.usuarioNombre,
            estado: g.estadoNombre,
            fechaCreacion: g.gasto.fechacreacion ? g.gasto.fechacreacion.replace(" ", "T") : null
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
        
        const hoyStr = getDRDateTime();
        
        // Si mandan "YYYY-MM-DD", le pegamos la hora actual de RD
        let fechaGastoFormat = hoyStr;
        if (dto.fechaGasto) {
            fechaGastoFormat = getDRDateOnly(dto.fechaGasto) + "T" + hoyStr.split("T")[1];
        }

        const nuevoGasto = await db.insert(schema.gastos).values({
            idcategoriagasto: dto.idCategoriaGasto,
            monto: String(dto.monto),
            fechagasto: fechaGastoFormat,
            descripcion: dto.descripcion.trim(),
            referencia: dto.referencia?.trim() || null,
            comprobanteurl: dto.comprobanteUrl?.trim() || null,
            idusuario: userId,
            idestado: dto.idEstado || 1,
            fechacreacion: hoyStr,
            fechaultimaactualizacion: hoyStr
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
        const hoyStr = getDRDateTime();

        let fechaGastoFormat = undefined;
        if (dto.fechaGasto) {
            fechaGastoFormat = getDRDateOnly(dto.fechaGasto) + "T" + hoyStr.split("T")[1];
        }

        await db.update(schema.gastos).set({
            ...(dto.idCategoriaGasto && { idcategoriagasto: dto.idCategoriaGasto }),
            ...(dto.monto && { monto: String(dto.monto) }),
            ...(fechaGastoFormat && { fechagasto: fechaGastoFormat }),
            ...(dto.descripcion && { descripcion: dto.descripcion.trim() }),
            ...(dto.referencia !== undefined && { referencia: dto.referencia?.trim() }),
            ...(dto.comprobanteUrl !== undefined && { comprobanteurl: dto.comprobanteUrl?.trim() }),
            ...(dto.idEstado && { idestado: dto.idEstado }),
            fechaultimaactualizacion: hoyStr
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
        
        let desdeStr = "";
        let hastaStr = "";

        if (fechaDesde && fechaHasta) {
            desdeStr = getDRDateOnly(fechaDesde as string) + "T00:00:00";
            hastaStr = getDRDateOnly(fechaHasta as string) + "T23:59:59";
        } else {
            const hoyDate = getDRDateOnly();
            const year = hoyDate.substring(0, 4);
            const month = hoyDate.substring(5, 7);
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            desdeStr = `${year}-${month}-01T00:00:00`;
            hastaStr = `${year}-${month}-${lastDay}T23:59:59`;
        }

        // 1. Total Ingresos
        const facturas = await db.select({ montoAbonado: schema.facturas.montoabonado })
            .from(schema.facturas)
            .where(and(
                gte(schema.facturas.fechacreacion, desdeStr.replace("T", " ")),
                lte(schema.facturas.fechacreacion, hastaStr.replace("T", " "))
            ));
        
        const totalIngresos = facturas.reduce((sum, f) => sum + Number(f.montoAbonado || 0), 0);

        // 2. Total Gastos
        const gastosDb = await db.select({ monto: schema.gastos.monto })
            .from(schema.gastos)
            .where(and(
                gte(schema.gastos.fechagasto, desdeStr.replace("T", " ")),
                lte(schema.gastos.fechagasto, hastaStr.replace("T", " "))
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