import 'dotenv/config'; // <-- Vital para que lea el .env a tiempo
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: any;
}

export const authorize = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No autorizado. Token faltante.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Nos aseguramos de usar la misma clave que en el AuthController
        const JWT_SECRET = process.env.JWT_SECRET || 'super-secreta-clave-de-respaldo-123';
        
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next(); 
    } catch (error) {
        console.error("Error validando token:", error);
        return res.status(401).json({ message: 'Token inválido o expirado' });
    }
};