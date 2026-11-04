"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.io = void 0;
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = require("./app");
Object.defineProperty(exports, "app", { enumerable: true, get: function () { return app_1.app; } });
const database_1 = require("./config/database");
const httpServer = (0, http_1.createServer)(app_1.app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: app_1.checkOrigin,
        credentials: true
    }
});
exports.io = io;
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('joinInventory', (productId) => {
        socket.join(`inventory-${productId}`);
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
const PORT = process.env.PORT || 5000;
const startServer = () => {
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Upload images to: http://localhost:${PORT}/uploads/images/`);
    });
    (0, database_1.connectWithRetry)();
};
startServer();
//# sourceMappingURL=index.js.map