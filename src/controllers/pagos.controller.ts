import { Request, Response } from 'express';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';

export const getPagos = async (req: Request, res: Response) => {
    try {
        const { facturaId, fechaDesde, fechaHasta } = req.query;
        const filters = [];

        if (facturaId) filters.push(eq(schema.pagos.idfactura, Number(facturaId)));
        
        if (fechaDesde) filters.push(gte(schema.pagos.fechapago, new Date(fechaDesde as string).toISOString()));
        
        if (fechaHasta) {
            const dateHasta = new Date(fechaHasta as string);
            dateHasta.setHours(23, 59, 59, 999);
            filters.push(lte(schema.pagos.fechapago, dateHasta.toISOString()));
        }

        const whereClause = filters.length > 0 ? and(...filters) : undefined;

        const pagosDb = await db.select({
            pago: schema.pagos,
            usuarioNombre: schema.usuarios.nombre,
            estadoNombre: schema.estados.nombre
        })
        .from(schema.pagos)
        .innerJoin(schema.usuarios, eq(schema.pagos.idusuario, schema.usuarios.idusuario))
        .innerJoin(schema.estados, eq(schema.pagos.idestado, schema.estados.idestado))
        .where(whereClause)
        .orderBy(desc(schema.pagos.fechapago));

        res.json(pagosDb.map(p => ({
            idPago: p.pago.idpago,
            idFactura: p.pago.idfactura,
            monto: Number(p.pago.monto),
            idEstado: p.pago.idestado,
            fechaPago: p.pago.fechapago ? new Date(p.pago.fechapago).toISOString() : null,
            metodoPago: p.pago.metodopago,
            referencia: p.pago.referencia,
            notas: p.pago.notas,
            usuario: p.usuarioNombre,
            estado: p.estadoNombre
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener pagos' });
    }
};

export const getPagoById = async (req: Request, res: Response) => {
    try {
        const pago = await db.select().from(schema.pagos).where(eq(schema.pagos.idpago, Number(req.params.id)));
        if (pago.length === 0) return res.status(404).json({ message: 'Pago no encontrado' });
        res.json(pago[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error interno' });
    }
};

export const createPago = async (req: AuthRequest, res: Response) => {
    try {
        const userId = Number(req.user.nameid);
        const dto = req.body;

        const factura = await db.select().from(schema.facturas).where(eq(schema.facturas.idfactura, dto.idFactura));
        if (factura.length === 0) return res.status(404).json({ message: "Factura no encontrada" });

        const nuevoPago = await db.insert(schema.pagos).values({
            idfactura: dto.idFactura,
            monto: dto.monto.toString(),
            idestado: dto.idEstado || 5, // 5 = Pagado
            fechapago: new Date().toISOString(),
            fechaultimaActualizacion: new Date().toISOString(), // <--- CORREGIDO (A mayúscula)
            metodopago: dto.metodoPago,
            referencia: dto.referencia,
            idusuario: userId,
            notas: dto.notas
        }).returning();

        res.status(201).json(nuevoPago[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear pago' });
    }
};

export const updatePago = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const dto = req.body;

        const actualizado = await db.update(schema.pagos).set({
            ...(dto.idEstado && { idestado: dto.idEstado }),
            ...(dto.referencia !== undefined && { referencia: dto.referencia?.trim() }),
            ...(dto.notas !== undefined && { notas: dto.notas?.trim() }),
            fechaultimaActualizacion: new Date().toISOString() // <--- CORREGIDO (A mayúscula)
        })
        .where(eq(schema.pagos.idpago, Number(id)))
        .returning();

        res.json(actualizado[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar pago' });
    }
};

export const deletePago = async (req: Request, res: Response) => {
    try {
        await db.delete(schema.pagos).where(eq(schema.pagos.idpago, Number(req.params.id)));
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar pago' });
    }
};