import { spawn, exec, ChildProcessWithoutNullStreams as inst } from 'child_process';
import express from 'express';
import iconv from 'iconv-lite';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import fs from 'fs';
const app = express();
const server = createServer(app);
const io = new Server(server);

const child_pool: { [key: string]: inst | undefined } = {};

// child.stdin.setDefaultEncoding('utf-8');

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/console.html');
})

io.on('connection', (socket) => {
    console.log(`${new Date().toLocaleTimeString()} :  socket [${socket.id}] connected!`);
    if (child_pool[socket.id] === undefined) {
        child_pool[socket.id] = spawn('cmd');
        console.log(`${new Date().toLocaleTimeString()} : child [${child_pool[socket.id]?.pid}] created`)

        // init settings...
        child_pool[socket.id]?.stdin.setDefaultEncoding('binary');
        child_pool[socket.id]?.stdout.setEncoding('binary');
        child_pool[socket.id]?.stderr.setEncoding('binary');

        // child event handlers...    
        child_pool[socket.id]?.stdout.on('data', (data) => {
            // io.emit('stdout', iconv.decode(data, 'euc-kr'));
            socket.emit('stdout', iconv.decode(data, 'euc-kr'))
        })
        child_pool[socket.id]?.stderr.on('data', (data) => {
            socket.emit('stdout', iconv.decode(data, 'euc-kr'));
        })
    }

    // message handlers...
    socket.on('cmd', (cmd) => {
        if (/^bc:.+/.test(cmd)) {
            if (cmd.substring(3) === 'cls') {
                socket.emit('clear')
                return;
            }
            io.emit('stdout', cmd.substring(3));
            return;
        }
        if (cmd === 'ss') {
            exec(__dirname + "/nircmdc.exe savescreenshot ss.png", (e, stdout, stderr) => {
                fs.readFile(__dirname + '/ss.png', 'base64', (e, data) => {
                    if (e)
                        return;
                    socket.emit('image', data);
                });
            })
            return;
        }
        if (cmd === 'cls') {
            socket.emit('clear');
            return;
        }
        console.log(`${new Date().toLocaleTimeString()} : "${cmd}" sended from socket [${socket.id}]`)
        child_pool[socket.id]?.stdin.write(iconv.encode(cmd, 'euc-kr').toString('binary') + '\n');
    })

    // disconnect routine
    socket.on('disconnect', () => {
        console.log(`${new Date().toLocaleTimeString()} : socket [${socket.id}] disconnected!`);
        child_pool[socket.id]?.kill(9);
        console.log(`${new Date().toLocaleTimeString()} : child [${child_pool[socket.id]?.pid}] killed`)
        child_pool[socket.id] = undefined;
    })
})

server.listen(80, () => console.log('listening on port *:80'));


