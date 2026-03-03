const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('redis');
const DataLoader = require('dataloader');
const { Queue, Worker } = require('bullmq');

const app = express();
const prisma = new PrismaClient();

// 1. CONFIGURACIÓN DE REDIS (Para Docker el host es 'redis')
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redisClient.on('error', (err) => console.error('❌ Redis Error:', err));

// 2. DATALOADER: Evita el problema N+1 al cargar posts de usuarios
// Agrupa múltiples IDs y hace una sola consulta: SELECT * FROM Post WHERE authorId IN (...)
const postLoader = new DataLoader(async (userIds) => {
  console.log(`[DataLoader] Consultando DB para IDs: ${userIds}`);
  const posts = await prisma.post.findMany({
    where: { authorId: { in: userIds } }
  });
  // Es vital mapear los resultados al orden correcto de los IDs de entrada
  return userIds.map(id => posts.filter(p => p.authorId === id));
});

// 3. BULLMQ: Configuración de la cola para tareas pesadas
const reportQueue = new Queue('reports', { connection: { host: 'redis', port: 6379 } });

// Worker: El que realmente procesa la tarea fuera del flujo de la API
const reportWorker = new Worker('reports', async (job) => {
  console.log(`[Worker] Iniciando tarea pesada: ${job.name} (ID: ${job.id})`);
  await new Promise(resolve => setTimeout(resolve, 5000)); // Simula 5 segundos de proceso
  console.log(`[Worker] ✅ Tarea ${job.id} finalizada`);
  return { downloadUrl: `/downloads/report-${job.id}.pdf` };
}, { connection: { host: 'redis', port: 6379 } });


// --- ENDPOINTS ---

// ESTRATEGIA: CACHÉ DE CONSULTAS REPETITIVAS
app.get('/users', async (req, res) => {
  const cacheKey = 'api:users:all';
  
  try {
    const cachedUsers = await redisClient.get(cacheKey);
    if (cachedUsers) {
      console.log('⚡ Sirviendo desde CACHÉ');
      return res.json({ source: 'cache', data: JSON.parse(cachedUsers) });
    }

    console.log('🐢 Consultando BASE DE DATOS');
    const users = await prisma.user.findMany();
    
    // Guardamos en caché por 60 segundos (TTL)
    await redisClient.setEx(cacheKey, 60, JSON.stringify(users));
    
    res.json({ source: 'database', data: users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ESTRATEGIA: PREVENCIÓN N+1 Y LAZY LOADING (Inclusión condicional)
app.get('/users-optimized', async (req, res) => {
  const { includePosts } = req.query; // ?includePosts=true
  
  try {
    const users = await prisma.user.findMany();
    
    // Si el cliente pide posts, usamos DataLoader para que sea eficiente
    const data = await Promise.all(users.map(async (user) => {
      return {
        ...user,
        posts: includePosts === 'true' ? await postLoader.load(user.id) : undefined
      };
    }));

    res.json({ count: users.length, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ESTRATEGIA: JOB QUEUE (Tarea pesada asíncrona)
app.post('/generate-report', async (req, res) => {
  // Encolamos el trabajo y respondemos de inmediato
  const job = await reportQueue.add('pdf-report', { timestamp: new Date() });
  
  res.status(202).json({ 
    message: 'Generación de reporte iniciada', 
    jobId: job.id,
    checkStatus: `/job-status/${job.id}`
  });
});

// Endpoint para verificar el estado de la tarea
app.get('/job-status/:id', async (req, res) => {
  const job = await reportQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Trabajo no encontrado' });

  const state = await job.getState(); // completed, failed, active, waiting
  res.json({ jobId: job.id, status: state, result: job.returnvalue });
});


// INICIO DEL SERVIDOR
const PORT = 3000;
async function main() {
  await redisClient.connect();
  app.listen(PORT, () => {
    console.log(`
    🚀 Servidor corriendo en http://localhost:${PORT}
    📂 GET /users -> Caché de Redis
    📂 GET /users-optimized?includePosts=true -> DataLoader (Anti N+1)
    📂 POST /generate-report -> Cola de trabajos (BullMQ)
    `);
  });
}

main().catch(console.error);