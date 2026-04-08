import { relations } from "drizzle-orm/relations";
import { estados, categoriasgasto, clientes, facturas, usuarios, detallefactura, prendaservicio, productos, prendas, servicios, categoriasproducto, gastos, pagos, refreshtokens, roles, usuariorol } from "./schema";

export const categoriasgastoRelations = relations(categoriasgasto, ({one, many}) => ({
	estado: one(estados, {
		fields: [categoriasgasto.idestado],
		references: [estados.idestado]
	}),
	gastos: many(gastos),
}));

export const estadosRelations = relations(estados, ({many}) => ({
	categoriasgastos: many(categoriasgasto),
	clientes: many(clientes),
	facturas_idestadoentrega: many(facturas, {
		relationName: "facturas_idestadoentrega_estados_idestado"
	}),
	facturas_idestado: many(facturas, {
		relationName: "facturas_idestado_estados_idestado"
	}),
	productos: many(productos),
	usuarios: many(usuarios),
	gastos: many(gastos),
	pagos: many(pagos),
	servicios: many(servicios),
	roles: many(roles),
}));

export const clientesRelations = relations(clientes, ({one, many}) => ({
	estado: one(estados, {
		fields: [clientes.idestado],
		references: [estados.idestado]
	}),
	facturas: many(facturas),
}));

export const facturasRelations = relations(facturas, ({one, many}) => ({
	cliente: one(clientes, {
		fields: [facturas.idcliente],
		references: [clientes.idcliente]
	}),
	estado_idestadoentrega: one(estados, {
		fields: [facturas.idestadoentrega],
		references: [estados.idestado],
		relationName: "facturas_idestadoentrega_estados_idestado"
	}),
	estado_idestado: one(estados, {
		fields: [facturas.idestado],
		references: [estados.idestado],
		relationName: "facturas_idestado_estados_idestado"
	}),
	usuario: one(usuarios, {
		fields: [facturas.idusuario],
		references: [usuarios.idusuario]
	}),
	detallefacturas: many(detallefactura),
	pagos: many(pagos),
}));

export const usuariosRelations = relations(usuarios, ({one, many}) => ({
	facturas: many(facturas),
	estado: one(estados, {
		fields: [usuarios.idestado],
		references: [estados.idestado]
	}),
	gastos: many(gastos),
	pagos: many(pagos),
	refreshtokens: many(refreshtokens),
	usuariorols: many(usuariorol),
}));

export const detallefacturaRelations = relations(detallefactura, ({one}) => ({
	factura: one(facturas, {
		fields: [detallefactura.idfactura],
		references: [facturas.idfactura]
	}),
	prendaservicio: one(prendaservicio, {
		fields: [detallefactura.idprendaservicio],
		references: [prendaservicio.idprendaservicio]
	}),
	producto: one(productos, {
		fields: [detallefactura.idproducto],
		references: [productos.idproducto]
	}),
}));

export const prendaservicioRelations = relations(prendaservicio, ({one, many}) => ({
	detallefacturas: many(detallefactura),
	prenda: one(prendas, {
		fields: [prendaservicio.idprenda],
		references: [prendas.idprenda]
	}),
	servicio: one(servicios, {
		fields: [prendaservicio.idservicio],
		references: [servicios.idservicio]
	}),
}));

export const productosRelations = relations(productos, ({one, many}) => ({
	detallefacturas: many(detallefactura),
	categoriasproducto: one(categoriasproducto, {
		fields: [productos.idcategoria],
		references: [categoriasproducto.idcategoria]
	}),
	estado: one(estados, {
		fields: [productos.idestado],
		references: [estados.idestado]
	}),
}));

export const prendasRelations = relations(prendas, ({many}) => ({
	prendaservicios: many(prendaservicio),
}));

export const serviciosRelations = relations(servicios, ({one, many}) => ({
	prendaservicios: many(prendaservicio),
	estado: one(estados, {
		fields: [servicios.idestado],
		references: [estados.idestado]
	}),
}));

export const categoriasproductoRelations = relations(categoriasproducto, ({many}) => ({
	productos: many(productos),
}));

export const gastosRelations = relations(gastos, ({one}) => ({
	categoriasgasto: one(categoriasgasto, {
		fields: [gastos.idcategoriagasto],
		references: [categoriasgasto.idcategoriagasto]
	}),
	estado: one(estados, {
		fields: [gastos.idestado],
		references: [estados.idestado]
	}),
	usuario: one(usuarios, {
		fields: [gastos.idusuario],
		references: [usuarios.idusuario]
	}),
}));

export const pagosRelations = relations(pagos, ({one}) => ({
	estado: one(estados, {
		fields: [pagos.idestado],
		references: [estados.idestado]
	}),
	factura: one(facturas, {
		fields: [pagos.idfactura],
		references: [facturas.idfactura]
	}),
	usuario: one(usuarios, {
		fields: [pagos.idusuario],
		references: [usuarios.idusuario]
	}),
}));

export const refreshtokensRelations = relations(refreshtokens, ({one}) => ({
	usuario: one(usuarios, {
		fields: [refreshtokens.idusuario],
		references: [usuarios.idusuario]
	}),
}));

export const rolesRelations = relations(roles, ({one, many}) => ({
	estado: one(estados, {
		fields: [roles.idestado],
		references: [estados.idestado]
	}),
	usuariorols: many(usuariorol),
}));

export const usuariorolRelations = relations(usuariorol, ({one}) => ({
	role: one(roles, {
		fields: [usuariorol.idrol],
		references: [roles.idrol]
	}),
	usuario: one(usuarios, {
		fields: [usuariorol.idusuario],
		references: [usuarios.idusuario]
	}),
}));