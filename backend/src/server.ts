import 'dotenv/config'; // Prevents hoisting issues
import { env } from './config/env'; // Validates env vars — crashes early if invalid
import app from './app';
import logger from './utils/logger';

app.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT}`);
});

