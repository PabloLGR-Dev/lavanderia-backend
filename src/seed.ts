import 'dotenv/config';
import bcrypt from 'bcrypt';
import { db } from './db/index.js';
import * as schema from './db/schema.js';

async function seedAdmin() {
    try {
        console.log('⏳ Creando usuario administrador principal...');

        // 1. Encriptar la contraseña
        const passwordHash = await bcrypt.hash('P@ssw0rd', 10);

        // 2. Insertar el usuario en la tabla
        const nuevoAdmin = await db.insert(schema.usuarios).values({
            nombre: 'Pablo',
            apellido: 'Admin',
            email: 'pablolgr1@gmail.com',
            username: 'admin',
            passwordhash: passwordHash, // Contraseña encriptada
            idestado: 1, // Activo
            fechacreacion: new Date().toISOString()
        }).returning();

        const idUsuario = nuevoAdmin[0].idusuario;

        // 3. Asignar el Rol 1 (Administrador) en la tabla UsuarioRol
        await db.insert(schema.usuariorol).values({
            idusuario: idUsuario,
            idrol: 1, 
            fechaasignacion: new Date().toISOString()
        });

        console.log('✅ ¡Administrador creado con éxito!');
        console.log('-----------------------------------');
        console.log('👤 Usuario: admin');
        console.log('🔑 Contraseña: Admin123!');
        console.log('-----------------------------------');
        
        process.exit(0); // Cerramos el script
    } catch (error) {
        console.error('❌ Error creando el administrador:', error);
        process.exit(1);
    }
}

seedAdmin();