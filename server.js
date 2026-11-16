const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// CHANGE THESE PASSWORDS FOR PRIVACY
const STUDENT_PASS = "class123";
const TEACHER_KEY = "admin999";

app.use(express.static('public'));

let teacherSocketId = null;

io.on('connection', (socket) => {
    // 1. Private Login Check
    socket.on('join-room', ({ name, password, role }) => {
        if (role === 'teacher' && password === TEACHER_KEY) {
            teacherSocketId = socket.id;
            socket.join('classroom');
            socket.emit('auth-success', { role: 'teacher' });
            io.to('classroom').emit('chat-msg', { sender: 'System', text: `${name} (Teacher) joined.` });
        } else if (role === 'student' && password === STUDENT_PASS) {
            socket.join('classroom');
            socket.emit('auth-success', { role: 'student' });
            io.to('classroom').emit('chat-msg', { sender: 'System', text: `${name} joined the class.` });
            
            // Notify teacher so they can stream video/audio to this new student
            if (teacherSocketId) {
                io.to(teacherSocketId).emit('student-joined', socket.id);
            }
        } else {
            socket.emit('auth-fail', 'Wrong password!');
        }
    });

    // 2. Live Chat
    socket.on('send-chat', (data) => {
        io.to('classroom').emit('chat-msg', data);
    });

    // 3. Real-Time Whiteboard Sync
    socket.on('draw', (data) => {
        socket.to('classroom').emit('draw', data);
    });
    socket.on('clear-board', () => {
        io.to('classroom').emit('clear-board');
    });

    // 4. WebRTC Live Audio/Video Signaling (Teacher -> Students)
    socket.on('offer', (id, message) => {
        io.to(id).emit('offer', socket.id, message);
    });
    socket.on('answer', (id, message) => {
        io.to(id).emit('answer', socket.id, message);
    });
    socket.on('candidate', (id, message) => {
        io.to(id).emit('candidate', socket.id, message);
    });

    socket.on('disconnect', () => {
        if (socket.id === teacherSocketId) {
            teacherSocketId = null;
            io.to('classroom').emit('chat-msg', { sender: 'System', text: 'Teacher disconnected.' });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Private Class running on http://localhost:${PORT}`);
});
