const app = require("./app");
const http = require("http");
const plaid = require("plaid");
const dotenv = require("dotenv");

dotenv.load();

const port = process.env.PORT || 3000;


// console.log(plaidClient);

const onError = ( error ) => {
    if ( error.syscall !== "listen" ) {
      throw error;
    }
  
    let bind = typeof port === "string"
      ? "Pipe " + port
      : "Port " + port;
  
    switch( error.code ) {
      case "EACCES" :
        console.log( bind + " requires elevated privileges" );
        process.exit( 1 ); 
        break;
      case "EADDRINUSE":
        console.log( bind + " is already in use" );
        process.exit( 1 );
        break;
      default:
        throw error;
    }
  }

const server = http.createServer(app);
server.listen(port);
server.on("listening", function() {
    console.log("Server listening on port : "+ process.env.PORT);
})

server.on("error",onError);

dotenv.load();