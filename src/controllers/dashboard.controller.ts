import { Request, Response } from 'express';
import { and, gte, lte, desc, sum, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

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

// ==========================================
// 1. OBTENER RESUMEN COMPLETO (GET)
// ==========================================
export const getResumenDashboard = async (req: Request, res: Response) => {
    try {
        const hoy = getDRDateOnly(); // Retorna YYYY-MM-DD local
        const year = hoy.substring(0, 4);
        const month = hoy.substring(5, 7);
        const lastDay = new Date(Number(year), Number(month), 0).getDate();

        const fromIso = `${year}-${month}-01T00:00:00`;
        const toIso = `${year}-${month}-${lastDay}T23:59:59`;

        const resumenFinanciero = await obtenerResumenFinancieroLogica(fromIso, toIso);
        const estadisticasFacturas = await obtenerEstadisticasFacturasLogica(fromIso, toIso);
        const ultimosMovimientos = await obtenerUltimosMovimientosLogica();

        const dashboard = {
            resumenFinanciero,
            estadisticasFacturas,
            ultimosMovimientos,
            fechaConsulta: new Date().toISOString(), // FrontEnd maneja ISO UTC a local
            periodoConsultado: `01/${month}/${year} - ${lastDay}/${month}/${year}`
        };

        res.json(dashboard);
    } catch (error: any) {
        console.error("Error en getResumenDashboard:", error);
        res.status(500).json({ message: "Error al obtener resumen del dashboard", error: error.message });
    }
};

// ==========================================
// 2. RESUMEN FINANCIERO (GET)
// ==========================================
export const getResumenFinanciero = async (req: Request, res: Response) => {
    try {
        const { fechaDesde, fechaHasta } = req.query;
        
        let fromIso = "";
        let toIso = "";

        if (fechaDesde && fechaHasta) {
            fromIso = getDRDateOnly(fechaDesde as string) + "T00:00:00";
            toIso = getDRDateOnly(fechaHasta as string) + "T23:59:59";
        } else {
            const hoy = getDRDateOnly();
            const year = hoy.substring(0, 4);
            const month = hoy.substring(5, 7);
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            fromIso = `${year}-${month}-01T00:00:00`;
            toIso = `${year}-${month}-${lastDay}T23:59:59`;
        }

        const resumen = await obtenerResumenFinancieroLogica(fromIso, toIso);
        res.json(resumen);
    } catch (error: any) {
        console.error("Error en getResumenFinanciero:", error);
        res.status(500).json({ message: "Error al obtener resumen financiero", error: error.message });
    }
};

// ==========================================
// 3. ESTADÍSTICAS DE FACTURAS (GET)
// ==========================================
export const getEstadisticasFacturas = async (req: Request, res: Response) => {
    try {
        const { fechaDesde, fechaHasta } = req.query;
        
        let fromIso = "";
        let toIso = "";

        if (fechaDesde && fechaHasta) {
            fromIso = getDRDateOnly(fechaDesde as string) + "T00:00:00";
            toIso = getDRDateOnly(fechaHasta as string) + "T23:59:59";
        } else {
            const hoy = getDRDateOnly();
            const year = hoy.substring(0, 4);
            const month = hoy.substring(5, 7);
            const lastDay = new Date(Number(year), Number(month), 0).getDate();
            fromIso = `${year}-${month}-01T00:00:00`;
            toIso = `${year}-${month}-${lastDay}T23:59:59`;
        }

        const estadisticas = await obtenerEstadisticasFacturasLogica(fromIso, toIso);
        res.json(estadisticas);
    } catch (error: any) {
        console.error("Error en getEstadisticasFacturas:", error);
        res.status(500).json({ message: "Error al obtener estadísticas de facturas", error: error.message });
    }
};

// ==========================================
// 4. ÚLTIMOS MOVIMIENTOS (GET)
// ==========================================
export const getUltimosMovimientos = async (req: Request, res: Response) => {
    try {
        const movimientos = await obtenerUltimosMovimientosLogica();
        res.json(movimientos);
    } catch (error: any) {
        console.error("Error en getUltimosMovimientos:", error);
        res.status(500).json({ message: "Error al obtener últimos movimientos", error: error.message });
    }
};

// ==========================================
// MÉTODOS PRIVADOS / LOGICA AISLADA
// ==========================================

const obtenerResumenFinancieroLogica = async (fromIso: string, toIso: string) => {
    const ingresosResult = await db.select({ total: sum(schema.facturas.montoabonado) })
        .from(schema.facturas)
        .where(and(
            gte(schema.facturas.fechacreacion, fromIso.replace("T", " ")),
            lte(schema.facturas.fechacreacion, toIso.replace("T", " "))
        ));
    const totalIngresos = Number(ingresosResult[0]?.total) || 0;

    const gastosResult = await db.select({ total: sum(schema.gastos.monto) })
        .from(schema.gastos)
        .where(and(
            gte(schema.gastos.fechagasto, fromIso.replace("T", " ")),
            lte(schema.gastos.fechagasto, toIso.replace("T", " "))
        ));
    const totalGastos = Number(gastosResult[0]?.total) || 0;

    const gananciaNeta = totalIngresos - totalGastos;
    const margenGanancia = totalIngresos > 0 ? (gananciaNeta / totalIngresos * 100) : 0;

    return {
        totalIngresos,
        totalGastos,
        gananciaNeta,
        margenGanancia,
        fechaDesde: fromIso,
        fechaHasta: toIso
    };
};

const obtenerEstadisticasFacturasLogica = async (fromIso: string, toIso: string) => {
    const facturas = await db.select()
        .from(schema.facturas)
        .where(and(
            gte(schema.facturas.fechacreacion, fromIso.replace("T", " ")),
            lte(schema.facturas.fechacreacion, toIso.replace("T", " "))
        ));

    const totalFacturas = facturas.length;
    const facturasPagadas = facturas.filter(f => f.idestado === 5).length; 
    const facturasPendientes = facturas.filter(f => f.idestado === 4).length; 
    const totalAbonado = facturas.reduce((acc, f) => acc + Number(f.montoabonado || 0), 0);
    const totalPendiente = facturas.reduce((acc, f) => acc + Number(f.montopendiente || 0), 0);
    const totalVentas = facturas.reduce((acc, f) => acc + Number(f.total || 0), 0);
    
    const promedioVenta = totalFacturas > 0 ? (totalVentas / totalFacturas) : 0;

    return {
        totalFacturas,
        facturasPagadas,
        facturasPendientes,
        promedioVenta,
        totalAbonado,
        totalPendiente
    };
};

const obtenerUltimosMovimientosLogica = async () => {
    const movimientos: any[] = [];

    const ultimasFacturas = await db.select({
        factura: schema.facturas,
        estadoNombre: schema.estados.nombre
    })
    .from(schema.facturas)
    .leftJoin(schema.estados, eq(schema.facturas.idestado, schema.estados.idestado))
    .orderBy(desc(schema.facturas.fechacreacion))
    .limit(2);

    for (const row of ultimasFacturas) {
        movimientos.push({
            id: row.factura.idfactura,
            tipo: "ingreso",
            descripcion: `${row.factura.numerofactura} - ${row.factura.nombrecliente}`,
            monto: Number(row.factura.montoabonado || 0),
            fecha: row.factura.fechacreacion ? row.factura.fechacreacion.replace(" ", "T") : null,
            categoria: row.estadoNombre
        });
    }

    const ultimosGastos = await db.select({
        gasto: schema.gastos,
        categoriaNombre: schema.categoriasgasto.nombre,
        categoriaColor: schema.categoriasgasto.color
    })
    .from(schema.gastos)
    .leftJoin(schema.categoriasgasto, eq(schema.gastos.idcategoriagasto, schema.categoriasgasto.idcategoriagasto))
    .orderBy(desc(schema.gastos.fechagasto))
    .limit(2);

    for (const row of ultimosGastos) {
        movimientos.push({
            id: row.gasto.idgasto,
            tipo: "gasto",
            descripcion: row.gasto.descripcion || row.categoriaNombre || "Sin descripción",
            monto: Number(row.gasto.monto),
            fecha: row.gasto.fechagasto ? row.gasto.fechagasto.replace(" ", "T") : null,
            categoria: row.categoriaNombre,
            color: row.categoriaColor
        });
    }

    return movimientos
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        .slice(0, 4);
};