const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { nanoid } = require('nanoid');

const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ users: [], notes: [], comments: [] }).write();
console.log('✅ Database initialized');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'GitNote API' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// -------------------- USERS --------------------
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const existing = db.get('users').find({ username }).value();
  if (existing) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  db.get('users').push({ username, password }).write();
  res.json({ message: 'User created successfully' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.get('users').find({ username, password }).value();
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: username });
});

function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  const user = db.get('users').find({ username: token }).value();
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

// -------------------- NOTES --------------------
app.get('/api/notes', (req, res) => {
  res.json(db.get('notes').value());
});

app.get('/api/notes/:id', (req, res) => {
  const note = db.get('notes').find({ id: req.params.id }).value();
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

app.post('/api/notes', authenticate, (req, res) => {
  const { title, content, parentId } = req.body;
  const newNote = {
    id: nanoid(),
    title: title || 'Untitled',
    content: content || '',
    author: req.user.username,
    parentId: parentId || null,
    createdAt: new Date().toISOString()
  };
  db.get('notes').push(newNote).write();
  res.status(201).json(newNote);
});

app.put('/api/notes/:id', authenticate, (req, res) => {
  const { title, content } = req.body;
  const note = db.get('notes').find({ id: req.params.id }).value();
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.author !== req.user.username) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.get('notes').find({ id: req.params.id }).assign({ title, content }).write();
  res.json({ success: true });
});

app.delete('/api/notes/:id', authenticate, (req, res) => {
  const note = db.get('notes').find({ id: req.params.id }).value();
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.author !== req.user.username) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.get('notes').remove({ id: req.params.id }).write();
  res.json({ success: true });
});

app.get('/api/notes/:id/forks', (req, res) => {
  res.json(db.get('notes').filter({ parentId: req.params.id }).value());
});

// -------------------- COMMENTS --------------------
app.get('/api/notes/:id/comments', (req, res) => {
  res.json(db.get('comments').filter({ noteId: req.params.id }).value() || []);
});

app.post('/api/notes/:id/comments', authenticate, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text required' });
  
  const newComment = {
    id: nanoid(),
    noteId: req.params.id,
    author: req.user.username,
    text,
    createdAt: new Date().toISOString()
  };
  
  db.get('comments').push(newComment).write();
  res.status(201).json(newComment);
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
