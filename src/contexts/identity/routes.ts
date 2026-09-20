import { Router } from 'express';
import { withContext } from '../../shared/requestContext';
import authRoutes from './auth/authRoutes';
import { adminCompaniesRoutes, companiesRoutes } from './companies/companiesRoutes';
import meRoutes from './me/meRoutes';
import usersRoutes from './users/usersRoutes';

const router = Router();

const identity = withContext('identity');

router.use('/auth', identity, authRoutes);
router.use('/me', identity, meRoutes);
router.use('/companies', identity, companiesRoutes);
router.use('/admin/companies', identity, adminCompaniesRoutes);
router.use('/admin/users', identity, usersRoutes);

export default router;
