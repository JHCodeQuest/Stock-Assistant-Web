import { createServer } from 'http';
import { Server } from 'socket.io';

import { app, checkOrigin } from './app';
import { connectWithRetry } from './config/database';

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: checkOrigin,
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinInventory', (productId: string) => {
    socket.join(`inventory-${productId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// Listen first, then connect: the API always answers (health says what is wrong) while the
// database connection retries in the background.
const startServer = () => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Upload images to: http://localhost:${PORT}/uploads/images/`);
  });
  connectWithRetry();
};

startServer();

export { io, app };
