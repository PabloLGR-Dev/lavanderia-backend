import { Request, Response } from 'express';
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

// 1. Obtener todos los clientes (Con Paginación, Búsqueda y Filtros)
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
          ilike(schema.clientes.email, searchStr)
        )
      );
    }

    if (estado) {
      // Corrección: idestado en minúscula
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
      // Corrección: fecharegistro en minúscula
      .orderBy(desc(schema.clientes.fecharegistro))
      .limit(limitPerPage)
      .offset(offset);

    res.status(200).json({
      data: clientesList,
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
      // Corrección: idcliente en minúscula
      .where(eq(schema.clientes.idcliente, Number(id)));

    if (cliente.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    res.json(cliente[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el cliente' });
  }
};

// 3. Crear un nuevo cliente
export const createCliente = async (req: Request, res: Response) => {
  try {
    const { nombre, apellido, direccion, telefono, email, idEstado, notas } = req.body;

    const nuevoCliente = await db.insert(schema.clientes)
      .values({
        nombre,
        apellido,
        direccion,
        telefono,
        email,
        notas,
        // Corrección: Mapeamos la variable idEstado al campo idestado
        idestado: idEstado || 1, 
      })
      .returning();

    res.status(201).json(nuevoCliente[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear el cliente' });
  }
};

// 4. Actualizar un cliente existente
export const updateCliente = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Desestructuramos para evitar inyectar campos no válidos y manejar las mayúsculas
    const { nombre, apellido, direccion, telefono, email, idEstado, notas } = req.body;

    const clienteActualizado = await db.update(schema.clientes)
      .set({
        ...(nombre !== undefined && { nombre }),
        ...(apellido !== undefined && { apellido }),
        ...(direccion !== undefined && { direccion }),
        ...(telefono !== undefined && { telefono }),
        ...(email !== undefined && { email }),
        ...(notas !== undefined && { notas }),
        ...(idEstado !== undefined && { idestado: idEstado }), // Mapeo a minúscula
        fechaultimaactualizacion: new Date().toISOString(), // Corrección: fechaultimaactualizacion en minúscula
      })
      // Corrección: idcliente en minúscula
      .where(eq(schema.clientes.idcliente, Number(id)))
      .returning();

    if (clienteActualizado.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado para actualizar' });
    }

    res.json(clienteActualizado[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el cliente' });
  }
};

// 5. Eliminar un cliente
export const deleteCliente = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const clienteEliminado = await db.delete(schema.clientes)
      // Corrección: idcliente en minúscula
      .where(eq(schema.clientes.idcliente, Number(id)))
      .returning();

    if (clienteEliminado.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado para eliminar' });
    }

    res.json({ message: 'Cliente eliminado correctamente', cliente: clienteEliminado[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar el cliente' });
  }
};