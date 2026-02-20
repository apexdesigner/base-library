import express from 'express';
import createDebug from 'debug';
import router from './routes/index.js';

const debug = createDebug('BaseLibrary:Server');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use('/api', router);

app.listen(port, async () => {
  debug('Server listening on port %d', port);
});
