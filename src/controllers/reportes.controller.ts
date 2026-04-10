import { Request, Response } from 'express';
import { and, gte, lte, eq, sum } from 'drizzle-orm';
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
// 1. REPORTE FINANCIERO COMPLETO (GET)
// ==========================================
export const getReporteFinancieroCompleto = async (req: Request, res: Response) => {
    try {
        const { fechaDesde, fechaHasta } = req.query;
        
        // Creamos los rangos usando horas locales de RD
        const fromIso = (fechaDesde ? getDRDateOnly(fechaDesde as string) : getDRDateOnly()) + "T00:00:00";
        const toIso = (fechaHasta ? getDRDateOnly(fechaHasta as string) : getDRDateOnly()) + "T23:59:59";

        const resumenFinanciero = await GetResumenFinancieroReporte(fromIso, toIso);
        const estadisticasGastos = await GetEstadisticasGastosReporte(fromIso, toIso);
        const estadisticasFacturas = await GetEstadisticasFacturasReporte(fromIso, toIso);

        const reporte = {
            resumenFinanciero,
            estadisticasGastos,
            estadisticasFacturas,
            fechaGeneracion: new Date().toISOString(), // Esto no importa que sea UTC porque el FrontEnd lo adapta a local
            recomendaciones: [] as any[]
        };

        // Generar recomendaciones
        reporte.recomendaciones = GenerarRecomendaciones(reporte);

        res.json(reporte);
    } catch (error: any) {
        console.error("Error en getReporteFinancieroCompleto:", error);
        res.status(500).json({ message: "Error al generar reporte financiero", error: error.message });
    }
};

export const getResumenFinanciero = async (req: Request, res: Response) => {
    try {
        const { fechaDesde, fechaHasta } = req.query;
        const fromIso = (fechaDesde ? getDRDateOnly(fechaDesde as string) : getDRDateOnly()) + "T00:00:00";
        const toIso = (fechaHasta ? getDRDateOnly(fechaHasta as string) : getDRDateOnly()) + "T23:59:59";

        const resumen = await GetResumenFinancieroReporte(fromIso, toIso);
        res.json(resumen);
    } catch (error: any) {
        console.error("Error en getResumenFinanciero:", error);
        res.status(500).json({ message: "Error al obtener resumen financiero", error: error.message });
    }
};

export const getEstadisticasGastos = async (req: Request, res: Response) => {
    try {
        const { fechaDesde, fechaHasta } = req.query;
        const fromIso = (fechaDesde ? getDRDateOnly(fechaDesde as string) : getDRDateOnly()) + "T00:00:00";
        const toIso = (fechaHasta ? getDRDateOnly(fechaHasta as string) : getDRDateOnly()) + "T23:59:59";

        const estadisticas = await GetEstadisticasGastosReporte(fromIso, toIso);
        res.json(estadisticas);
    } catch (error: any) {
        console.error("Error en getEstadisticasGastos:", error);
        res.status(500).json({ message: "Error al obtener estadísticas de gastos", error: error.message });
    }
};

export const getEstadisticasFacturas = async (req: Request, res: Response) => {
    try {
        const { fechaDesde, fechaHasta } = req.query;
        const fromIso = (fechaDesde ? getDRDateOnly(fechaDesde as string) : getDRDateOnly()) + "T00:00:00";
        const toIso = (fechaHasta ? getDRDateOnly(fechaHasta as string) : getDRDateOnly()) + "T23:59:59";

        const estadisticas = await GetEstadisticasFacturasReporte(fromIso, toIso);
        res.json(estadisticas);
    } catch (error: any) {
        console.error("Error en getEstadisticasFacturas:", error);
        res.status(500).json({ message: "Error al obtener estadísticas de facturas", error: error.message });
    }
};

// ==========================================
// MÉTODOS PRIVADOS / LÓGICA DE REPORTE
// ==========================================

const GetResumenFinancieroReporte = async (fromIso: string, toIso: string) => {
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

const GetEstadisticasGastosReporte = async (fromIso: string, toIso: string) => {
    const gastos = await db.select({
        gasto: schema.gastos,
        categoriaNombre: schema.categoriasgasto.nombre,
        categoriaColor: schema.categoriasgasto.color
    })
    .from(schema.gastos)
    .innerJoin(schema.categoriasgasto, eq(schema.gastos.idcategoriagasto, schema.categoriasgasto.idcategoriagasto))
    .where(and(
        gte(schema.gastos.fechagasto, fromIso.replace("T", " ")),
        lte(schema.gastos.fechagasto, toIso.replace("T", " "))
    ));

    if (gastos.length === 0) {
        return {
            totalGastos: 0,
            promedioGasto: 0,
            totalRegistros: 0,
            gastosPorCategoria: [],
            gastosPorMes: []
        };
    }

    const totalGastos = gastos.reduce((acc, g) => acc + Number(g.gasto.monto), 0);
    const promedioGasto = totalGastos / gastos.length;

    // Agrupar por Categoría
    const catMap = new Map<string, { color: string, total: number, cantidad: number }>();
    gastos.forEach(g => {
        const cat = g.categoriaNombre;
        const color = g.categoriaColor || '#6B7280';
        const monto = Number(g.gasto.monto);
        
        if (!catMap.has(cat)) {
            catMap.set(cat, { color, total: 0, cantidad: 0 });
        }
        const data = catMap.get(cat)!;
        data.total += monto;
        data.cantidad += 1;
    });

    const gastosPorCategoria = Array.from(catMap.entries()).map(([categoria, data]) => ({
        categoria,
        color: data.color,
        total: data.total,
        cantidad: data.cantidad,
        porcentaje: totalGastos > 0 ? (data.total / totalGastos * 100) : 0
    })).sort((a, b) => b.total - a.total);

    // Agrupar por Mes
    const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const mesMap = new Map<string, { año: number, mes: number, mesNombre: string, total: number, cantidad: number }>();

    gastos.forEach(g => {
        // La fecha de DB viene con formato "YYYY-MM-DD HH:mm:ss"
        const d = new Date(g.gasto.fechagasto.replace(" ", "T")); 
        const año = d.getFullYear();
        const mes = d.getMonth() + 1; // 1-12
        const key = `${año}-${mes}`;
        const monto = Number(g.gasto.monto);

        if (!mesMap.has(key)) {
            mesMap.set(key, { 
                año, 
                mes, 
                mesNombre: mesesNombres[mes - 1], 
                total: 0, 
                cantidad: 0 
            });
        }
        const data = mesMap.get(key)!;
        data.total += monto;
        data.cantidad += 1;
    });

    const gastosPorMes = Array.from(mesMap.values())
        .sort((a, b) => (a.año - b.año) || (a.mes - b.mes));

    return {
        totalGastos,
        promedioGasto,
        totalRegistros: gastos.length,
        gastosPorCategoria,
        gastosPorMes
    };
};

const GetEstadisticasFacturasReporte = async (fromIso: string, toIso: string) => {
    const facturas = await db.select()
        .from(schema.facturas)
        .where(and(
            gte(schema.facturas.fechacreacion, fromIso.replace("T", " ")),
            lte(schema.facturas.fechacreacion, toIso.replace("T", " "))
        ));

    if (facturas.length === 0) {
        return {
            totalFacturas: 0,
            totalVentas: 0,
            totalAbonado: 0,
            totalPendiente: 0,
            facturasPagadas: 0,
            facturasPendientes: 0,
            promedioVenta: 0
        };
    }

    const totalFacturas = facturas.length;
    const totalVentas = facturas.reduce((acc, f) => acc + Number(f.total), 0);
    const totalAbonado = facturas.reduce((acc, f) => acc + Number(f.montoabonado || 0), 0);
    const totalPendiente = facturas.reduce((acc, f) => acc + Number(f.montopendiente || 0), 0);
    const facturasPagadas = facturas.filter(f => f.idestado === 5).length;
    const facturasPendientes = facturas.filter(f => f.idestado === 4).length;
    const promedioVenta = totalVentas / totalFacturas;

    return {
        totalFacturas,
        totalVentas,
        totalAbonado,
        totalPendiente,
        facturasPagadas,
        facturasPendientes,
        promedioVenta
    };
};

const GenerarRecomendaciones = (reporte: any) => {
    const recomendaciones = [];
    const rf = reporte.resumenFinanciero;
    const eg = reporte.estadisticasGastos;
    const ef = reporte.estadisticasFacturas;

    if (rf.gananciaNeta < 0) {
        recomendaciones.push({
            tipo: "warning",
            mensaje: "⚠️ El negocio está operando en pérdidas. Considera reducir gastos o aumentar ingresos.",
            icono: "⚠️"
        });
    }

    if (rf.margenGanancia < 20 && rf.gananciaNeta > 0) {
        recomendaciones.push({
            tipo: "warning",
            mensaje: `📉 Margen de ganancia bajo (${rf.margenGanancia.toFixed(1)}%). Revisa la estructura de costos.`,
            icono: "📉"
        });
    } else if (rf.margenGanancia >= 20 && rf.margenGanancia < 40) {
        recomendaciones.push({
            tipo: "success",
            mensaje: `✅ Margen saludable (${rf.margenGanancia.toFixed(1)}%). El negocio está funcionando bien.`,
            icono: "✅"
        });
    } else if (rf.margenGanancia >= 40) {
        recomendaciones.push({
            tipo: "success",
            mensaje: `🎯 Excelente margen (${rf.margenGanancia.toFixed(1)}%). ¡Buen trabajo!`,
            icono: "🎯"
        });
    }

    if (eg.gastosPorCategoria && eg.gastosPorCategoria.length > 0) {
        const mayorGasto = eg.gastosPorCategoria[0];
        recomendaciones.push({
            tipo: "info",
            mensaje: `📊 Mayor gasto: ${mayorGasto.categoria} (RD$ ${mayorGasto.total.toFixed(2)}). Representa el ${mayorGasto.porcentaje.toFixed(1)}% del total.`,
            icono: "📊"
        });
    }

    if (ef.totalPendiente > (ef.totalAbonado * 0.3)) {
        recomendaciones.push({
            tipo: "warning",
            mensaje: "💸 Hay un monto significativo pendiente de cobro. Considera hacer seguimiento a clientes.",
            icono: "💸"
        });
    }

    return recomendaciones;
};