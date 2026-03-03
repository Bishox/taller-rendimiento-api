API de Alto Rendimiento: Estrategias de Escalabilidad en Node.js
Este proyecto es una API REST diseñada para demostrar cómo optimizar sistemas con alto tráfico. No se trata solo de una aplicación funcional, sino de una arquitectura que implementa patrones de diseño para reducir la latencia, evitar la saturación de la base de datos y gestionar procesos pesados de forma asíncrona.

🛠️ Tecnologías del Proyecto
Backend: Node.js con Express.

ORM: Prisma 6 (con base de datos SQLite).

Caché y Colas: Redis.

Contenedores: Docker y Docker Compose.

Librerías Clave: DataLoader (Batching) y BullMQ (Job Queues).

🏗️ Estrategias de Rendimiento Implementadas
A. Caché de Consultas Repetitivas (Redis)
Implementé el patrón Cache-Aside. Al solicitar datos, el sistema verifica primero en Redis. Si hay un "Hit", se sirve en milisegundos; si hay un "Miss", se consulta la base de datos y se guarda en caché con un tiempo de vida (TTL).

Impacto: Reducción de latencia de ~100ms a <5ms.

Uso: GET /users.

B. Prevención del Problema N+1 (DataLoader)
Para evitar que el servidor realice múltiples consultas pequeñas al cargar relaciones (como los posts de cada usuario), utilicé DataLoader. Esta herramienta agrupa las peticiones en una sola consulta masiva (WHERE IN (...)).

Impacto: Reducción drástica del tráfico de red entre la API y la DB.

Uso: GET /users-optimized?includePosts=true.

C. Gestión de Tareas Pesadas (Job Queue)
Para procesos que tardan mucho (como generar reportes), implementé una Cola de Trabajos con BullMQ. El flujo principal nunca se bloquea; la tarea se delega a un Worker que procesa en segundo plano.

Impacto: El servidor mantiene su disponibilidad (concurrencia) sin importar la carga de trabajo.

Uso: POST /generate-report.

D. Lazy-Loading (Carga Inteligente)
Optimizamos el Payload (tamaño de la respuesta) permitiendo que el cliente decida qué datos necesita mediante parámetros de consulta.

Impacto: Ahorro de ancho de banda y memoria RAM.

🚦 Guía de Inicio Rápido
1. Requisitos
Docker y Docker Compose instalados.

Node.js v18+ (opcional para desarrollo local).

2. Instalación y Despliegue
Clona el proyecto y ejecuta:

Bash
# Instalar dependencias locales
```
 install
```
# Sincronizar la base de datos (Prisma 6)
```
npx prisma migrate dev --name init
```
# Generar datos de prueba
```
node seed.js
```
# Levantar infraestructura (API + Redis)
```
docker-compose up --build
```
Método,Endpoint,Descripción,Estrategia
GET,/users,Lista de usuarios,Caché Redis
GET,/users-optimized,Lista optimizada,DataLoader & Lazy-Loading
POST,/generate-report,Crear reporte (5s),Job Queue (BullMQ)
GET,/job-status/:id,Ver estado de tarea,Polling de estado