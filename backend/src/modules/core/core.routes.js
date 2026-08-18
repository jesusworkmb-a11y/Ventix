const express = require('express');

// MOD-001 Core -- Fase 1: auth, empresas, sucursales, usuarios, roles, permisos, folios, auditoria
// No agregar endpoints de otros módulos aquí (regla de límites de módulo, §3.1).
const authRoutes = require('./auth/auth.routes');
const empresaRoutes = require('./empresa/empresa.routes');
const sucursalesRoutes = require('./sucursales/sucursales.routes');
const usuariosRoutes = require('./usuarios/usuarios.routes');
const rolesRoutes = require('./roles/roles.routes');
const permisosRoutes = require('./permisos/permisos.routes');
const auditoriaRoutes = require('./auditoria/auditoria.routes');
const superadminRoutes = require('./superadmin/superadmin.routes');

const router = express.Router();

router.use('/', authRoutes); // /registro, /login, /me
router.use('/empresa', empresaRoutes);
router.use('/sucursales', sucursalesRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/roles', rolesRoutes);
router.use('/permisos', permisosRoutes);
router.use('/auditoria', auditoriaRoutes);
router.use('/superadmin', superadminRoutes);

module.exports = router;
