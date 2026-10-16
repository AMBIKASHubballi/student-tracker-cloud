import express from 'express';

export function createApp(db) {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10kb' }));
  app.use(express.static('public'));

  // Homepage route
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Student Tracker Cloud</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background: #f4f7fb;
              margin: 0;
              padding: 40px 20px;
              color: #1f2937;
              text-align: center;
            }
            .container {
              max-width: 650px;
              margin: 60px auto;
              background: white;
              padding: 40px 25px;
              border-radius: 16px;
              box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
            }
            h1 {
              color: #2563eb;
            }
            p {
              line-height: 1.6;
            }
            .status {
              display: inline-block;
              padding: 10px 16px;
              background: #dcfce7;
              color: #166534;
              border-radius: 20px;
              font-weight: bold;
            }
            a {
              display: inline-block;
              margin: 10px;
              padding: 12px 20px;
              background: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 8px;
            }
            a:hover {
              background: #1d4ed8;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Student Tracker Cloud</h1>
            <p>Your Student Project Tracker server is running.</p>
            <div class="status">Server is online</div>
            <p>Use the links below to check your API.</p>
            <a href="/api/health">Check Server Health</a>
            <a href="/api/projects">View Projects</a>
          </div>
        </body>
      </html>
    `);
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  // Get all projects
  app.get('/api/projects', async (req, res, next) => {
    try {
      const projects = await db.list();
      res.json(projects);
    } catch (error) {
      next(error);
    }
  });

  // Validate project ID
  function readId(req, res) {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      res.status(400).json({
        error: 'Invalid project id.'
      });
      return null;
    }

    return id;
  }

  // Validate project data
  function readProject(req, res) {
    const name =
      typeof req.body?.name === 'string'
        ? req.body.name.trim()
        : '';

    const status = req.body?.status;

    if (
      name.length < 1 ||
      name.length > 80 ||
      !['Planned', 'In Progress', 'Completed'].includes(status)
    ) {
      res.status(400).json({
        error: 'Use a name of 1-80 characters and a valid status.'
      });

      return null;
    }

    return { name, status };
  }

  // Create a project
  app.post('/api/projects', async (req, res, next) => {
    try {
      const project = readProject(req, res);

      if (!project) return;

      const createdProject = await db.create(project);

      res.status(201).json(createdProject);
    } catch (error) {
      next(error);
    }
  });

  // Update a project
  app.put('/api/projects/:id', async (req, res, next) => {
    try {
      const id = readId(req, res);

      if (id === null) return;

      const project = readProject(req, res);

      if (!project) return;

      const updatedProject = await db.update(id, project);

      if (!updatedProject) {
        return res.status(404).json({
          error: 'Project not found.'
        });
      }

      res.json(updatedProject);
    } catch (error) {
      next(error);
    }
  });

  // Delete a project
  app.delete('/api/projects/:id', async (req, res, next) => {
    try {
      const id = readId(req, res);

      if (id === null) return;

      const deleted = await db.remove(id);

      if (!deleted) {
        return res.status(404).json({
          error: 'Project not found.'
        });
      }

      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  });

  // Handle unknown API routes
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'API route not found.'
    });
  });

  // Handle malformed JSON
  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: 'Invalid JSON.'
      });
    }

    if (error.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'Request too large.'
      });
    }

    console.error(
      'Request failed:',
      error.code || error.name || 'Unknown error'
    );

    res.status(500).json({
      error: 'Server error. Check the server terminal.'
    });
  });

  return app;
}