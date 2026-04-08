import { Request, Response } from 'express';
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

// --- HELPER PARA MAPEAR AL FORMATO DEL FRONTEND ---
// Esto evita que el frontend se rompa por las minúsculas de PostgreSQL
const mapClienteToDto = (c: any) => ({
  idCliente: c.idcliente,
  nombre: c.nombre,
  apellido: c.apellido,
  direccion: c.direccion,
  telefono: c.telefono,
  email: c.email,
  idEstado: c.idestado,
  fechaRegistro: c.fecharegistro,
  fechaUltimaActualizacion: c.fechaultimaactualizacion,
  notas: c.notas
});

// 1. Obtener todos los clientes (Paginado)
export const getClientes = async (req: Request, res: Response) => {
  try {
    const { search, estado, page = 1, limit = 10 } = req.query;

    const currentPage = Math.max(1, Number(page));
    const limitPerPage = Math.max(1, Number(limit));
    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    if (search) {
      const searchStr = `%${search}%`;
      filterConditions.push(
        or(
          ilike(schema.clientes.nombre, searchStr),
          ilike(schema.clientes.apellido, searchStr),
          ilike(schema.clientes.email, searchStr),
          ilike(schema.clientes.telefono, searchStr) // Agregado como en .NET
        )
      );
    }

    if (estado) {
      filterConditions.push(eq(schema.clientes.idestado, Number(estado)));
    }

    const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.clientes)
      .where(whereClause);

    const totalCount = Number(countResult[0]?.count) || 0;

    const clientesList = await db
      .select()
      .from(schema.clientes)
      .where(whereClause)
      .orderBy(desc(schema.clientes.fecharegistro))
      .limit(limitPerPage)
      .offset(offset);

    // Mapeamos la lista antes de enviarla
    const dataMapped = clientesList.map(mapClienteToDto);

    res.status(200).json({
      data: dataMapped,
      pagination: {
        page: currentPage,
        limit: limitPerPage,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitPerPage),
      }
    });
  } catch (error) {
    console.error(`Get /clientes error: ${error}`);
    res.status(500).json({ error: 'Error al obtener los clientes' });
  }
};

// 2. Obtener un cliente por ID
export const getClienteById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cliente = await db.select()
      .from(schema.clientes)
      .where(eq(schema.clientes.idcliente, Number(id)));

    if (cliente.length === 0) return res.status(404).json({ message: 'Cliente no encontrado' });

    res.json(mapClienteToDto(cliente[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el cliente' });
  }
};

// 3. Crear un nuevo cliente
export const createCliente = async (req: Request, res: Response) => {
  try {
    const { nombre, apellido, direccion, telefono, email, idEstado, notas } = req.body;

    if (!nombre) return res.status(400).json({ message: 'El nombre es obligatorio' });

    const nuevoCliente = await db.insert(schema.clientes)
      .values({
        nombre: nombre.trim(),
        apellido: apellido?.trim(),
        direccion: direccion?.trim(),
        telefono: telefono?.trim(),
        email: email?.trim(),
        notas: notas?.trim(),
        idestado: idEstado || 1, 
      })
      .returning();

    res.status(201).json(mapClienteToDto(nuevoCliente[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el cliente' });
  }
};

// 4. Actualizar un cliente existente
export const updateCliente = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, direccion, telefono, email, idEstado, notas } = req.body;

    const clienteActualizado = await db.update(schema.clientes)
      .set({
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(apellido !== undefined && { apellido: apellido.trim() }),
        ...(direccion !== undefined && { direccion: direccion.trim() }),
        ...(telefono !== undefined && { telefono: telefono.trim() }),
        ...(email !== undefined && { email: email.trim() }),
        ...(notas !== undefined && { notas: notas.trim() }),
        ...(idEstado !== undefined && { idestado: idEstado }), 
        fechaultimaactualizacion: new Date().toISOString(), 
      })
      .where(eq(schema.clientes.idcliente, Number(id)))
      .returning();

    if (clienteActualizado.length === 0) return res.status(404).json({ message: 'Cliente no encontrado' });

    res.json(mapClienteToDto(clienteActualizado[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el cliente' });
  }
};

// 5. Eliminar un cliente (Soft Delete como en .NET)
export const deleteCliente = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Soft delete: cambiar estado a 34 (o 2) e indicamos la fecha de actualización
    const clienteEliminado = await db.update(schema.clientes)
      .set({ 
        idestado: 34, 
        fechaultimaactualizacion: new Date().toISOString() 
      })
      .where(eq(schema.clientes.idcliente, Number(id)))
      .returning();

    if (clienteEliminado.length === 0) return res.status(404).json({ message: 'Cliente no encontrado' });

    // .NET retornaba NoContent (204) para los deletes exitosos
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el cliente' });
  }
};

// 6. Obtener clientes activos (Para dropdowns o selects)
export const getClientesActivos = async (req: Request, res: Response) => {
  try {
    const clientes = await db.select()
      .from(schema.clientes)
      .where(eq(schema.clientes.idestado, 1)); // Estado 1 = Activo

    // Ordenamos por nombre en memoria (opcional, Drizzle también puede hacerlo en BD)
    clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));

    res.json(clientes.map(mapClienteToDto));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener clientes activos' });
  }
};

// 7. Obtener Info específica para la pantalla de Facturación
export const getClienteInfoParaFactura = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cliente = await db.select()
      .from(schema.clientes)
      .where(
        and(
          eq(schema.clientes.idcliente, Number(id)),
          eq(schema.clientes.idestado, 1) // Solo si está activo
        )
      );

    if (cliente.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado o inactivo' });
    }

    const c = cliente[0];
    
    // Retornamos la estructura exacta que espera ClienteInfoDto en tu frontend
    res.json({
      idCliente: c.idcliente,
      nombreCompleto: `${c.nombre} ${c.apellido || ''}`.trim(),
      telefono: c.telefono,
      email: c.email
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la info del cliente' });
  }
};