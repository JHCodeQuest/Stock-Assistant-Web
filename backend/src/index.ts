import { app } from './app';
import { connectWithRetry } from './config/database';

const PORT = process.env.PORT || 5000;

// Listen first so the API can report database readiness while connections retry.
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
connectWithRetry();

export { app };
