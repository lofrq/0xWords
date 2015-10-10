var
    /** Node packages */
    express    = require('express'),
    colors     = require('colors'),

    // Create app
    app        = express(),

    // Config
    env        = process.env.NODE_ENV || 'development',
    serverPort = process.env.PORT || 3000,
    staticDir  = __dirname + '/public',

    server,

    /**
     * Graceful server shutdown
     */
    gracefulShutdown = function() {
        console.log('Shutting down gracefully...');

        server.close(function() {
            console.log('Worker %s: closed out remaining connections', process.pid);
            process.exit(0);
        });

        setTimeout(function() {
            console.log('Worker %s: could not close connections in time, forcefully shutting down'.red, process.pid);
            process.exit(1);
        }, 10 * 1000);
    },

    /**
     * Handle 'listening' event
     */
    serverOnListening = function() {},

    /**
     * Handle 'error' event
     *
     * @param   {Object}       error
     */
    serverOnError = function( error ) {
        if ( error.syscall !== 'listen' ) {
            throw error;
        }

        /** Handle specific listen errors with friendly messages */
        switch ( error.code ) {
            case 'EACCES':
                console.log('%s requires elevated privileges'.red, serverPort);
                process.exit(1);
                break;
            case 'EADDRINUSE':
                console.log('%s is already in use'.red, serverPort);
                process.exit(1);
                break;
            default:
                throw error;
        }
    };


process.on('SIGINT', gracefulShutdown);

app.use(express.static(staticDir));

// Start server
server = app.listen(serverPort, serverOnListening).on('error', serverOnError);
