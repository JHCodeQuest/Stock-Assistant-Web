"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const app_1 = require("./app");
Object.defineProperty(exports, "app", { enumerable: true, get: function () { return app_1.app; } });
const database_1 = require("./config/database");
const PORT = process.env.PORT || 5000;
// Listen first so the API can report database readiness while connections retry.
app_1.app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
(0, database_1.connectWithRetry)();
