const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB-Verbindung
mongoose.connect('mongodb://localhost/chatdb', { useNewUrlParser: true, useUnifiedTopology: true });

// MongoDB-Modelle
const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, unique: true },
  nickname: { type: String, unique: true },
  password: String,
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}));

// Middleware
app.use(express.static('public'));  // für das Frontend (HTML, CSS, JS)
app.use(express.json());

// API-Endpunkte
app.post('/register', async (req, res) => {
  const { email, nickname, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ email, nickname, password: hashedPassword });
  await user.save();
  res.status(201).send('Benutzer registriert');
});

app.post('/login', async (req, res) => {
  const { nickname, password } = req.body;
  const user = await User.findOne({ nickname });
  if (user && await bcrypt.compare(password, user.password)) {
    res.status(200).send('Login erfolgreich');
  } else {
    res.status(401).send('Falscher Benutzername oder Passwort');
  }
});

app.post('/add-friend', async (req, res) => {
  const { userId, friendId } = req.body;
  const user = await User.findById(userId);
  const friend = await User.findById(friendId);
  if (user && friend) {
    user.friends.push(friend);
    await user.save();
    res.status(200).send('Freund hinzugefügt');
  } else {
    res.status(404).send('Benutzer nicht gefunden');
  }
});

// Socket.IO für den Chat
let users = {};
io.on('connection', (socket) => {
  console.log('Ein Benutzer hat sich verbunden: ' + socket.id);

  socket.on('setUser', (userId) => {
    users[socket.id] = userId;
  });

  socket.on('sendMessage', (data) => {
    const { toUserId, message } = data;
    // Nachricht an den Empfänger senden
    for (let id in users) {
      if (users[id] === toUserId) {
        io.to(id).emit('receiveMessage', message);
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    console.log('Ein Benutzer hat die Verbindung getrennt');
  });
});

server.listen(3000, () => {
  console.log('Server läuft auf http://localhost:3000');
});
