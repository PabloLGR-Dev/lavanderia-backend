import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq, and, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';

// Extendemos Request para el middleware (ruta /me)
export interface AuthRequest extends Request {
    user?: any;
}

// Configuración de JWT
const JWT_SECRET = process.env.JWT_SECRET || 'super-secreta-clave-de-respaldo-123';
const TOKEN_EXPIRATION_HOURS = 6;

// 1. LOGIN
export const login = async (req: Request, res: Response) => {
    try {
        const { usernameOrEmail, password } = req.body;

        if (!usernameOrEmail || !password) {
            return res.status(400).json({ message: 'Usuario/Email y contraseña son requeridos' });
        }

        // Buscar al usuario por username o email
        const isEmail = usernameOrEmail.includes('@');
        const userQuery = await db.select()
            .from(schema.usuarios)
            .where(
                and(
                    eq(schema.usuarios.idestado, 1), // Solo usuarios activos
                    isEmail 
                        ? eq(schema.usuarios.email, usernameOrEmail)
                        : eq(schema.usuarios.username, usernameOrEmail)
                )
            );

        if (userQuery.length === 0) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const user = userQuery[0];

        // Verificar la contraseña con bcrypt
        const validPassword = await bcrypt.compare(password, user.passwordhash);
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        // Buscar los roles del usuario
        const rolesQuery = await db.select({ 
            idRol: schema.roles.idrol, 
            nombre: schema.roles.nombre 
        })
        .from(schema.usuariorol)
        .innerJoin(schema.roles, eq(schema.usuariorol.idrol, schema.roles.idrol))
        .where(eq(schema.usuariorol.idusuario, user.idusuario));

        const roleNames = rolesQuery.map(r => r.nombre);
        const primerRolId = rolesQuery.length > 0 ? rolesQuery[0].idRol : null;

        // Generar Access Token
        const accessToken = jwt.sign(
            { 
                nameid: user.idusuario.toString(), 
                unique_name: user.username,
                role: roleNames 
            }, 
            JWT_SECRET, 
            { expiresIn: `${TOKEN_EXPIRATION_HOURS}h` }
        );

        // Generar Refresh Token
        const refreshToken = crypto.randomBytes(64).toString('base64');
        const expireDate = new Date();
        expireDate.setDate(expireDate.getDate() + 7); // Expira en 7 días

        // Guardar Refresh Token en DB
        await db.insert(schema.refreshtokens).values({
            idusuario: user.idusuario,
            token: refreshToken,
            expires: expireDate.toISOString(),
            created: new Date().toISOString(),
            createdbyip: req.ip || 'unknown'
        });

        // Actualizar fecha de último login
        await db.update(schema.usuarios)
            .set({ fechaultimologin: new Date().toISOString() })
            .where(eq(schema.usuarios.idusuario, user.idusuario));

        // Retornar exactamente lo que el frontend espera (LoginResponse)
        res.json({
            success: true,
            accessToken,
            refreshToken,
            expires: new Date(Date.now() + TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString(),
            user: {
                idUsuario: user.idusuario,
                nombre: user.nombre,
                apellido: user.apellido,
                email: user.email,
                username: user.username,
                fechaUltimoLogin: user.fechaultimologin,
                fechaCreacion: user.fechacreacion,
                idEstado: user.idestado,
                estaActivo: true
            },
            roles: roleNames,
            idRol: primerRolId,
            message: 'Login exitoso'
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

// 2. ME (Devuelve el usuario actual basado en el token)
export const me = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.nameid) {
            return res.status(401).json({ message: 'No autenticado' });
        }

        const userId = Number(req.user.nameid);

        const userQuery = await db.select()
            .from(schema.usuarios)
            .where(eq(schema.usuarios.idusuario, userId));

        if (userQuery.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const user = userQuery[0];

        res.json({
            idUsuario: user.idusuario,
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            username: user.username,
            fechaUltimoLogin: user.fechaultimologin,
            fechaCreacion: user.fechacreacion,
            idEstado: user.idestado,
            estaActivo: user.idestado === 1
        });
    } catch (error) {
        console.error('Error en /me:', error);
        res.status(500).json({ message: 'Error obteniendo datos del usuario' });
    }
};