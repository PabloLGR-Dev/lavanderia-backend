import { Request, Response } from 'express';
import { eq, or, ilike } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

// Mapeo básico para el frontend
const mapUserToDto = (u: any, roles: any[]) => ({
    idUsuario: u.idusuario,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    username: u.username,
    idEstado: u.idestado,
    fechaCreacion: u.fechacreacion,
    fechaUltimoLogin: u.fechaultimologin,
    roles: roles
});

export const getUsuarios = async (req: Request, res: Response) => {
    try {
        const { search } = req.query;
        let query = db.select().from(schema.usuarios).$dynamic();

        if (search) {
            const searchStr = `%${search}%`;
            query = query.where(
                or(
                    ilike(schema.usuarios.nombre, searchStr),
                    ilike(schema.usuarios.username, searchStr)
                )
            );
        }

        const usuarios = await query;
        
        // Obtener los roles para cada usuario (simulando un Include en EF Core)
        const usuariosConRoles = await Promise.all(usuarios.map(async (u) => {
            const rolesDelUsuario = await db.select({
                idRol: schema.roles.idrol,
                nombre: schema.roles.nombre
            })
            .from(schema.usuariorol)
            .innerJoin(schema.roles, eq(schema.usuariorol.idrol, schema.roles.idrol))
            .where(eq(schema.usuariorol.idusuario, u.idusuario));

            return mapUserToDto(u, rolesDelUsuario);
        }));

        // Ordenar alfabéticamente por nombre
        usuariosConRoles.sort((a, b) => a.nombre.localeCompare(b.nombre));

        res.json(usuariosConRoles);
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

export const getUsuarioById = async (req: Request, res: Response) => {
    // ... Implementación similar a getUsuarios pero con where(eq(idusuario, id))
};

export const createUsuario = async (req: Request, res: Response) => {
    try {
        const { nombre, apellido, email, username, password, confirmPassword, idRol, idEstado } = req.body;

        if (!username || !password) return res.status(400).json({ message: "Username y contraseña son obligatorios" });
        if (password !== confirmPassword) return res.status(400).json({ message: "Las contraseñas no coinciden" });
        if (password.length < 8) return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres" });

        // Validar si username o email existen
        const existeUsername = await db.select().from(schema.usuarios).where(eq(schema.usuarios.username, username));
        if (existeUsername.length > 0) return res.status(400).json({ message: "El nombre de usuario ya está en uso" });
        
        if (email) {
             const existeEmail = await db.select().from(schema.usuarios).where(eq(schema.usuarios.email, email));
             if (existeEmail.length > 0) return res.status(400).json({ message: "El email ya está registrado" });
        }

        const rolId = idRol || 2; // Rol por defecto

        // Usar BCRYPT para la contraseña
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Crear usuario
        const nuevoUsuario = await db.insert(schema.usuarios).values({
            nombre: nombre.trim(),
            apellido: apellido?.trim(),
            email: email?.trim(),
            username: username.trim(),
            passwordhash: passwordHash,
            idestado: idEstado || 1,
            fechacreacion: new Date().toISOString()
        }).returning();

        // Asignar Rol
        await db.insert(schema.usuariorol).values({
            idusuario: nuevoUsuario[0].idusuario,
            idrol: rolId,
            fechaasignacion: new Date().toISOString()
        });

        res.status(201).json(mapUserToDto(nuevoUsuario[0], [{ idRol: rolId, nombre: 'Rol Asignado' }])); // Idealmente buscar el nombre real del rol

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
};

export const updateUsuario = async (req: Request, res: Response) => {
     // ... Implementación del update de usuario (similar a updateCliente, validando correos únicos)
};

export const updateUsuarioRol = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { idRol } = req.body;

        if (!idRol) return res.status(400).json({ message: "El rol es requerido" });

        // Eliminar roles anteriores (En este caso, solo 1 por usuario)
        await db.delete(schema.usuariorol).where(eq(schema.usuariorol.idusuario, Number(id)));

        // Agregar nuevo
        await db.insert(schema.usuariorol).values({
            idusuario: Number(id),
            idrol: idRol,
            fechaasignacion: new Date().toISOString()
        });

        res.json({ message: "Rol actualizado exitosamente" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el rol del usuario' });
    }
};

export const deleteUsuario = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        // En .NET eliminabas físicamente al usuario y sus roles si no tenía facturas.
        // Aquí deberías hacer un chequeo de las facturas primero.
        
        // 1. Eliminar sus roles
        await db.delete(schema.usuariorol).where(eq(schema.usuariorol.idusuario, Number(id)));
        
        // 2. Eliminar usuario
        await db.delete(schema.usuarios).where(eq(schema.usuarios.idusuario, Number(id)));

        res.status(204).send();
    } catch (error) {
        console.error(error);
        // Si hay un constraint error de foreign key (ej. facturas), caerá aquí
        res.status(400).json({ message: 'No se puede eliminar el usuario porque tiene registros asociados' });
    }
};