const http = require('http')
const path = require('path')
const express = require('express')
const Filter = require('bad-words')
const socketio = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const { generateMessage } = require('./utils/messages')
const {
    addUser,
    removeUser,
    getUser,
    getUsersInRoom
} = require('./utils/users')

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options })

        if (error) {
            callback(error)
            return
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('Admin', 'Welcome'))
        socket.broadcast
            .to(user.room)
            .emit(
                'message',
                generateMessage('Admin', `${user.username} has joined!`)
            ) // notify others about new user

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)

        if (!user) {
            callback('Invalid User.')
        }

        const filter = new Filter()

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed!')
        }
        io.to(user.room).emit(
            'message',
            generateMessage(user.username, message)
        )
        callback('Delivered!')
    })

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id)

        if (!user) {
            callback('Invalid User.')
        }

        let { latitude, longitude } = coords
        io.to(user.room).emit(
            'locationMessage',
            generateMessage(
                user.username,
                `https://google.com/maps/@${latitude},${longitude}`
            )
        )

        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit(
                'message',
                generateMessage('Admin', `${user.username} has left!`)
            )

            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}`)
})
