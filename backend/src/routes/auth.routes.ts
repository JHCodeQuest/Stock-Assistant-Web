import { Router } from 'express';
import { register, login } from '../controllers/auth.controllers';

import { loginLimiter, registrationLimiter } from '../middleware/auth-rate-limit';

const router = Router();

router.post('/register', registrationLimiter, register);
router.post('/login', loginLimiter, login);

export default router;
