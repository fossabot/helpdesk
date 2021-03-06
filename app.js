var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var logger = require('morgan');
// todo var winston = require('./config/winston');
var io = require("socket.io")();
var format = require('date-fns/format');
const cors = require('cors');

var mongoose = require('mongoose');
var passport = require('passport');
// var LocalStrategy = require('passport-local').Strategy;
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

const { checkAuthentication, loadCommon } = require('./middleware');


const apiRouter = require('./routes/api');
var accountRouter = require('./routes/account');
var indexRouter = require('./routes/index');
var searchRouter = require('./routes/search');
var chatRouter = require('./routes/chat');
var propertyRouter = require('./routes/property');
var notificationRouter = require('./routes/notification');
var messagingRouter = require('./routes/messaging/general');
var ticketsRouter = require('./routes/ticket');

var usersRouter = require('./routes/users');

var app = express();
app.io = io;

app.locals.dateFnsFormat = format;
app.enable('trust proxy');

// mongoose
mongoose.connect(`mongodb://${process.env.DB_HOST}/${process.env.DB_NAME}`, {
    useCreateIndex: true,
    useNewUrlParser: true
});

/* todo upgrade to this
let dev_db_url = 'mongodb://someuser:abcd1234@ds123619.mlab.com:23619/productstutorial';
const mongoDB = process.env.MONGODB_URI || dev_db_url;
mongoose.connect(mongoDB);
mongoose.Promise = global.Promise;
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
*/

// end mongoose


let sessionStore = new MongoStore({mongooseConnection: mongoose.connection, autoReconnect: true});

var cookie = {
    httpOnly: true,
    maxAge: (1000 * 60 * 60 * 24) * 365 // 1 year
};

var sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    cookie: cookie,
    store: sessionStore,
    saveUninitialized: false,
    resave: false
});

io.use(function (socket, next) {
    // Wrap the express middleware
    sessionMiddleware(socket.request, {}, next);
});

// socket.io events
var socket = require('./socket')(app.io);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
// todo app.use(logger('dev', { stream: winston.stream }));

app.use(express.json());

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(cookieParser());

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));

app.use('/chat', chatRouter);

const ticketController = require('./controllers/api/ticket');
app.use('/api/v1/mail/receive',ticketController.receive);

app.use('/api',checkAuthentication, function(req,res,next){
    //TODO add a local to differentiate API calls
    next()
}, apiRouter);

app.use('/tos', function (req, res) {

    res.render('tos');
});
app.use('/privacy', function (req, res) {

    res.render('privacy');
});

var whitelist = ['http://example1.com', 'http://example2.com','http://localhost:63342'];
var corsOptionsDelegate = function (req, callback) {
    var corsOptions = {};
    if (whitelist.indexOf(req.header('Origin')) !== -1) {
        corsOptions['origin']= true;  // reflect (enable) the requested origin in the CORS response
    } else {
        corsOptions['origin'] = false; // disable CORS for this request
    }

    callback(null, corsOptions) // callback expects two parameters: error and options
};

app.get('/livechat/:pId/embed',cors(corsOptionsDelegate), function (req, res, next) {
    //res.header("Access-Control-Allow-Origin", "*");

    res.render('embed', { req : req });

});
app.use('/', accountRouter);


app.use('/', checkAuthentication, loadCommon, indexRouter);
app.use('/search', checkAuthentication,loadCommon, searchRouter);
app.use('/n', checkAuthentication, loadCommon, notificationRouter);
app.use('/p', checkAuthentication,loadCommon, propertyRouter);
app.use('/m', checkAuthentication,loadCommon, messagingRouter);
app.use('/t', checkAuthentication, loadCommon, ticketsRouter);
app.use('/s', checkAuthentication, loadCommon, function (req, res, next) {

    res.render('account/settings');

});
app.get('/profile', checkAuthentication,loadCommon, function (req, res) {

    res.render('account/profile');
});


// app.use('/dashboard', usersRouter);

// passport config
var Account = require('./models/account');

passport.use(Account.createStrategy());
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());


// catch 404 and forward to error handler
app.use(function (req, res, next) {
    // next(createError(404));

    // render the error page
    res.status(404);
    res.render('404');

});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};


    // add this line to include winston logging
    // todo winston.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);


    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
