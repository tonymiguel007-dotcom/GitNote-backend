const express = require('express');
const cors = require('cors');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { nanoid } = require('nanoid');

const adapter = new FileSync('db.json');
const db = low(adapter);
// Initialize empty database with comments array
db.defaults({ users: [], notes: [], comments: [] }).write();

const app = express();
app.use(cors());
app.use(express.json());

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
  // For simplicity, we use the username as a token.
  res.json({ token: username });
});

// Middleware to protect routes
function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  const user = db.get('users').find({ username: token }).value();
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

// -------------------- NOTES --------------------
// Get all notes (public)
app.get('/api/notes', (req, res) => {
  const notes = db.get('notes').value();
  res.json(notes);
});

// Get a single note
app.get('/api/notes/:id', (req, res) => {
  const note = db.get('notes').find({ id: req.params.id }).value();
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(note);
});

// Create a note (authenticated)
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

// Update a note (authenticated, only author)
app.put('/api/notes/:id', authenticate, (req, res) => {
  const { title, content } = req.body;
  const note = db.get('notes').find({ id: req.params.id }).value();
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.author !== req.user.username) {
    return res.status(403).json({ error: 'You can only edit your own notes' });
  }
  db.get('notes')
    .find({ id: req.params.id })
    .assign({ title, content, updatedAt: new Date().toISOString() })
    .write();
  res.json({ success: true });
});

// Delete a note (authenticated, only author)
app.delete('/api/notes/:id', authenticate, (req, res) => {
  const note = db.get('notes').find({ id: req.params.id }).value();
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.author !== req.user.username) {
    return res.status(403).json({ error: 'You can only delete your own notes' });
  }
  db.get('notes').remove({ id: req.params.id }).write();
  res.json({ success: true });
});

// Get all forks of a note
app.get('/api/notes/:id/forks', (req, res) => {
  const forks = db.get('notes').filter({ parentId: req.params.id }).value();
  res.json(forks);
});

// -------------------- COMMENTS --------------------
// Get comments for a note
app.get('/api/notes/:id/comments', (req, res) => {
  const comments = db.get('comments').filter({ noteId: req.params.id }).value() || [];
  res.json(comments);
});

// Add a comment to a note
app.post('/api/notes/:id/comments', authenticate, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text required' });
  
  const newComment = {
    id: nanoid(),
    noteId: req.params.id,
    author: req.user.username,
    text: text,
    createdAt: new Date().toISOString()
  };
  
  db.get('comments').push(newComment).write();
  res.status(201).json(newComment);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
