import express from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment variables from .env file
dotenv.config();

async function startServer() {
  const app = express();
  
  // Create Vite server in middleware mode
  // This allows Express to handle the Vite development server
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      allowedHosts: true // Allow all hosts, or specify ["stratasense.soon.it"]
    },
    appType: 'spa', 
  });
  
  // Use vite's connect instance as middleware
  app.use(vite.middlewares);
  
  // You can add your custom API routes here
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'Server is running successfully!',
      message: 'Data from .env has been loaded into process.env'
    });
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 Server started at http://localhost:${port}`);
    console.log(`🌍 Vite middleware is handling frontend routing`);
  });
}

startServer();
