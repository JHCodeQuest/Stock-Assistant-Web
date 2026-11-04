import { Router } from 'express';
import { register, login } from '../controllers/auth.controllers';

import { loginLimiter, registrationLimiter } from '../middleware/auth-rate-limit';

import { validateBody, registerBody, loginBody } from '../middleware/validation';

const router = Router();

router.post('/register', registrationLimiter, validateBody(registerBody), register);
router.post('/login', loginLimiter, validateBody(loginBody), login);

export default router;
