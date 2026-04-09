import { Request, Response } from 'express';
import { eq, or, ilike, and, lte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

// Helper para leer configuración (Como lo tenías en .NET con IConfiguracionService)
const getConfigBool = async (clave: string): Promise<boolean> => {
    const config = await db.select().from(schema.configuraciones).where(eq(schema.configuraciones.clave, clave));
    if (config.length === 0) return false;
    return config[0].valor.toLowerCase() === 'true';
};

// 1. OBTENER PRODUCTOS PAGINADOS (Para la tabla principal)
export const getProductosPaginados = async (req: Request, res: Response) => {
    try {
        const { search, idCategoria, page = 1, pageSize = 20 } = req.query;
        
        const currentPage = Math.max(1, Number(page));
        const limit = Math.max(1, Number(pageSize));
        const offset = (currentPage - 1) * limit;

        const filters = [eq(schema.productos.idestado, 1)]; // Solo activos

        if (idCategoria) {
            filters.push(eq(schema.productos.idcategoria, Number(idCategoria)));
        }

        if (search) {
            const searchStr = `%${search}%`;
            filters.push(
                or(
                    ilike(schema.productos.nombre, searchStr),
                    ilike(schema.productos.codigobarras, searchStr),
                    ilike(schema.productos.descripcion, searchStr)
                )! // <-- Agregamos el "!" aquí
            );
        }

        const whereClause = and(...filters);

        // Contar el total
        const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(schema.productos)
            .where(whereClause);
        const total = Number(countResult[0]?.count) || 0;

        // Obtener productos con Join a su categoría
        const productosQuery = await db.select({
            producto: schema.productos,
            categoriaNombre: schema.categoriasproducto.nombre
        })
        .from(schema.productos)
        .leftJoin(schema.categoriasproducto, eq(schema.productos.idcategoria, schema.categoriasproducto.idcategoria))
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(schema.productos.nombre);

        // Mapear al formato del frontend
        const items = productosQuery.map(row => ({
            idProducto: row.producto.idproducto,
            nombre: row.producto.nombre,
            descripcion: row.producto.descripcion,
            codigoBarras: row.producto.codigobarras,
            precioVenta: Number(row.producto.precioventa),
            costo: row.producto.costo ? Number(row.producto.costo) : null,
            stockActual: row.producto.stockactual,
            stockMinimo: row.producto.stockminimo,
            idCategoria: row.producto.idcategoria,
            idEstado: row.producto.idestado,
            fechaCreacion: row.producto.fechacreacion,
            idCategoriaNavigation: row.producto.idcategoria ? {
                idCategoria: row.producto.idcategoria,
                nombre: row.categoriaNombre
            } : null
        }));

        res.json({
            items,
            total,
            page: currentPage,
            pageSize: limit,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener productos paginados' });
    }
};

// 2. BÚSQUEDA UNIFICADA (Para el punto de venta / facturación)
export const busquedaUnificada = async (req: Request, res: Response) => {
    try {
        const search = (req.query.search as string) || '';
        const limite = Number(req.query.limite) || 20;
        
        const controlStockActivo = await getConfigBool("CONTROL_STOCK_ACTIVO");
        const searchStr = `%${search}%`;

        // A. Buscar Servicios (Prendas + Servicios)
        const serviciosQuery = await db.select({
            idPrendaServicio: schema.prendaservicio.idprendaservicio,
            prendaNombre: schema.prendas.nombre,
            servicioNombre: schema.servicios.nombre,
            precioUnitario: schema.prendaservicio.preciounitario
        })
        .from(schema.prendaservicio)
        .innerJoin(schema.prendas, eq(schema.prendaservicio.idprenda, schema.prendas.idprenda))
        .innerJoin(schema.servicios, eq(schema.prendaservicio.idservicio, schema.servicios.idservicio))
        .where(
            search ? or(
                ilike(schema.prendas.nombre, searchStr),
                ilike(schema.servicios.nombre, searchStr)
            ) : undefined
        )
        .limit(limite);

        const serviciosMapeados = serviciosQuery.map(s => ({
            tipo: "servicio",
            id: s.idPrendaServicio,
            idPrendaServicio: s.idPrendaServicio,
            idProducto: null,
            nombre: `${s.prendaNombre} - ${s.servicioNombre}`,
            prendaNombre: s.prendaNombre,
            servicioNombre: s.servicioNombre,
            precioUnitario: Number(s.precioUnitario),
            stockDisponible: null,
            categoria: null,
            codigoBarras: null,
            tieneStock: true // Servicios siempre tienen stock
        }));

        // B. Buscar Productos
        const prodFilters = [eq(schema.productos.idestado, 1)];
        if (controlStockActivo) {
            prodFilters.push(sql`${schema.productos.stockactual} > 0`);
        }
        if (search) {
            prodFilters.push(
                or(
                    ilike(schema.productos.nombre, searchStr),
                    ilike(schema.productos.codigobarras, searchStr)
                )! // <-- Agregamos el "!" aquí también
            );
        }

        const productosQuery = await db.select({
            producto: schema.productos,
            categoriaNombre: schema.categoriasproducto.nombre
        })
        .from(schema.productos)
        .leftJoin(schema.categoriasproducto, eq(schema.productos.idcategoria, schema.categoriasproducto.idcategoria))
        .where(and(...prodFilters))
        .limit(limite);

        const productosMapeados = productosQuery.map(row => ({
            tipo: "producto",
            id: row.producto.idproducto,
            idPrendaServicio: null,
            idProducto: row.producto.idproducto,
            nombre: row.producto.nombre,
            prendaNombre: null,
            servicioNombre: null,
            precioUnitario: Number(row.producto.precioventa),
            stockDisponible: row.producto.stockactual,
            categoria: row.categoriaNombre || "Sin categoría",
            codigoBarras: row.producto.codigobarras || "",
            tieneStock: !controlStockActivo || row.producto.stockactual > 0
        }));

        res.json({
            servicios: serviciosMapeados,
            productos: productosMapeados,
            controlStockActivo
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en búsqueda unificada' });
    }
};

// 3. CRUD BÁSICO DE PRODUCTOS
export const getProductos = async (req: Request, res: Response) => {
    // Retorna todos sin paginar
    const productos = await db.select().from(schema.productos).where(eq(schema.productos.idestado, 1));
    res.json(productos);
};

export const getProductoById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const producto = await db.select().from(schema.productos).where(eq(schema.productos.idproducto, Number(id)));
    if (producto.length === 0) return res.status(404).json({ message: 'Producto no encontrado' });
    
    const p = producto[0];
    res.json({
        idProducto: p.idproducto,
        nombre: p.nombre,
        descripcion: p.descripcion,
        codigoBarras: p.codigobarras,
        precioVenta: Number(p.precioventa),
        costo: p.costo ? Number(p.costo) : null,
        stockActual: p.stockactual,
        stockMinimo: p.stockminimo,
        idCategoria: p.idcategoria,
        idEstado: p.idestado
    });
};

export const createProducto = async (req: Request, res: Response) => {
    try {
        const data = req.body;
        const nuevo = await db.insert(schema.productos).values({
            nombre: data.nombre.trim(),
            descripcion: data.descripcion?.trim(),
            codigobarras: data.codigoBarras?.trim(),
            precioventa: data.precioVenta,
            costo: data.costo,
            stockactual: data.stockActual || 0,
            stockminimo: data.stockMinimo || 0,
            idcategoria: data.idCategoria,
            idestado: data.idEstado || 1,
            fechacreacion: new Date().toISOString()
        }).returning();

        res.status(201).json(nuevo[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear producto' });
    }
};

export const updateProducto = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body;

        const actualizado = await db.update(schema.productos).set({
            ...(data.nombre && { nombre: data.nombre.trim() }),
            ...(data.descripcion !== undefined && { descripcion: data.descripcion?.trim() }),
            ...(data.codigoBarras !== undefined && { codigobarras: data.codigoBarras?.trim() }),
            ...(data.precioVenta !== undefined && { precioventa: data.precioVenta }),
            ...(data.costo !== undefined && { costo: data.costo }),
            ...(data.stockActual !== undefined && { stockactual: data.stockActual }),
            ...(data.stockMinimo !== undefined && { stockminimo: data.stockMinimo }),
            ...(data.idCategoria !== undefined && { idcategoria: data.idCategoria }),
            ...(data.idEstado !== undefined && { idestado: data.idEstado }),
        })
        .where(eq(schema.productos.idproducto, Number(id)))
        .returning();

        if (actualizado.length === 0) return res.status(404).json({ message: 'Producto no encontrado' });
        res.json(actualizado[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar producto' });
    }
};

export const deleteProducto = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Soft delete (Estado 34)
        await db.update(schema.productos)
            .set({ idestado: 34 })
            .where(eq(schema.productos.idproducto, Number(id)));
            
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar producto' });
    }
};

// 4. ALERTAS
export const getProductosBajoStock = async (req: Request, res: Response) => {
    try {
        const productos = await db.select()
            .from(schema.productos)
            .where(
                and(
                    eq(schema.productos.idestado, 1),
                    sql`${schema.productos.stockactual} <= ${schema.productos.stockminimo}`
                )
            );
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos bajo stock' });
    }
};