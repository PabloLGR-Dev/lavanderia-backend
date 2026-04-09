import { Request, Response } from 'express';
import { eq, or, ilike, and, ne } from 'drizzle-orm';
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
        
        // Obtener los roles para cada usuario
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

// -------------------------------------------------------------------
// IMPLEMENTACIÓN: getUsuarioById
// -------------------------------------------------------------------
export const getUsuarioById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const usuarios = await db.select()
            .from(schema.usuarios)
            .where(eq(schema.usuarios.idusuario, Number(id)));

        if (usuarios.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const usuario = usuarios[0];

        // Buscar sus roles
        const rolesDelUsuario = await db.select({
            idRol: schema.roles.idrol,
            nombre: schema.roles.nombre
        })
        .from(schema.usuariorol)
        .innerJoin(schema.roles, eq(schema.usuariorol.idrol, schema.roles.idrol))
        .where(eq(schema.usuariorol.idusuario, usuario.idusuario));

        res.json(mapUserToDto(usuario, rolesDelUsuario));
    } catch (error) {
        console.error('Error obteniendo el usuario:', error);
        res.status(500).json({ error: 'Error al obtener el usuario' });
    }
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

        res.status(201).json(mapUserToDto(nuevoUsuario[0], [{ idRol: rolId, nombre: 'Rol Asignado' }]));

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear el usuario' });
    }
};

// -------------------------------------------------------------------
// IMPLEMENTACIÓN: updateUsuario
// -------------------------------------------------------------------
export const updateUsuario = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, email, idEstado } = req.body;
        const userId = Number(id);

        // Validar que el usuario exista
        const existeUsuario = await db.select().from(schema.usuarios).where(eq(schema.usuarios.idusuario, userId));
        if (existeUsuario.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Si se envió un email, validamos que no lo esté usando OTRA persona
        if (email) {
            const emailTrimmed = email.trim();
            const existeEmail = await db.select()
                .from(schema.usuarios)
                .where(
                    and(
                        eq(schema.usuarios.email, emailTrimmed),
                        ne(schema.usuarios.idusuario, userId) // ne = Not Equal (Distinto del ID actual)
                    )
                );

            if (existeEmail.length > 0) {
                return res.status(400).json({ message: "El email ya está registrado por otro usuario" });
            }
        }

        // Actualizamos los campos enviados
        const usuarioActualizado = await db.update(schema.usuarios)
            .set({
                ...(nombre !== undefined && { nombre: nombre.trim() }),
                ...(apellido !== undefined && { apellido: apellido.trim() }),
                ...(email !== undefined && { email: email.trim() }),
                ...(idEstado !== undefined && { idestado: idEstado })
            })
            .where(eq(schema.usuarios.idusuario, userId))
            .returning();

        // Retornamos el usuario actualizado (Para mantener el DTO, le volvemos a buscar sus roles)
        const rolesDelUsuario = await db.select({
            idRol: schema.roles.idrol,
            nombre: schema.roles.nombre
        })
        .from(schema.usuariorol)
        .innerJoin(schema.roles, eq(schema.usuariorol.idrol, schema.roles.idrol))
        .where(eq(schema.usuariorol.idusuario, userId));

        res.json(mapUserToDto(usuarioActualizado[0], rolesDelUsuario));

    } catch (error) {
        console.error('Error al actualizar el usuario:', error);
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
};

export const updateUsuarioRol = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { idRol } = req.body;

        if (!idRol) return res.status(400).json({ message: "El rol es requerido" });

        // Eliminar roles anteriores
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