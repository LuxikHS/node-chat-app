const path = require("path");
const http = require("http");
const express = require("express");

const { generateMessage, generateLocationMessage } = require("./utils/message");
const { isRealString } = require("./utils/validation");
const { Users } = require("./utils/users");

const publicPath = path.join(__dirname, "../public");
const port = process.env.PORT || 3000;

var app = express();
var server = http.createServer(app);
var io = socketIO(server);
var users = new Users();

app.use(express.static(publicPath));

// socket.emit emits an event to a single connection
// io.emit emits an event to every single connection

io.on("connection", (socket) => {
  console.log("New user connected");

  /*

	socket.emit('newMessage', {			
		from: 'linhton@example.com',
		text: 'Hey yo',
		createdAt: 123
	});

*/

  socket.on("join", (params, callback) => {
    if (!isRealString(params.name) || !isRealString(params.room)) {
      return callback("Name and room name are required."); // use return to let below code executed if name or room name invalid
    }

    socket.join(params.room);
    users.removeUser(socket.id); // if user join the room, remove the user from the list to prevent them to join other rooms
    users.addUser(socket.id, params.name, params.room); // add user to the room

    io.to(params.room).emit("updateUserList", users.getUserList(params.room));
    socket.emit(
      "newMessage",
      generateMessage("Admin", "Welcome to the chat app")
    );

    // inform all other users in the room (except the this user) that this user joined the room
    socket.broadcast
      .to(params.room)
      .emit(
        "newMessage",
        generateMessage("Admin", `${params.name} has joined.`)
      );

    callback();
  });

  socket.on("createMessage", (message, callback) => {
    var user = users.getUser(socket.id);

    if (user && isRealString(message.text)) {
      io.to(user.room).emit(
        "newMessage",
        generateMessage(user.name, message.text)
      );
    }

    callback();
    //		callback('This is from the server.');

    /*
		socket.broadcast.emit('newMessage', {
			from: message.from,
			text: message.text,
			createdAt: new Date().getTime()
		});
*/
  });

  socket.on("createLocationMessage", (coords) => {
    var user = users.getUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        "newLocationMessage",
        generateLocationMessage(user.name, coords.latitude, coords.longitude)
      );
    }
  });

  socket.on("disconnect", () => {
    //		console.log('User was disconnected');

    // remove user from the room whenever this user leaves the room (refreshing the page counted as leave the room and come back)
    var user = users.removeUser(socket.id);

    if (user) {
      io.to(user.room).emit("updateUserList", users.getUserList(user.room));
      io.to(user.room).emit(
        "newMessage",
        generateMessage("Admin", `${user.name} has left.`)
      );
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on ${port}`);
});
