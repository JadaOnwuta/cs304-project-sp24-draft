// start app with 'npm run dev' in a terminal window
// go to http://localhost:port/ to view your deployment!
// every time you change something in server.js and save, your deployment will automatically reload

// to exit, type 'ctrl + c', then press the enter key in a terminal window
// if you're prompted with 'terminate batch job (y/n)?', type 'y', then press the enter key in the same terminal

// standard modules, loaded from node_modules
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const express = require('express');
const morgan = require('morgan');
const serveStatic = require('serve-static');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const flash = require('express-flash');
const multer = require('multer');
const fs = require('node:fs/promises');
// our modules loaded from cwd

//module with data to populate form lists
const constants = require('./listsOfThings.js')

const { Connection } = require('./connection');
const cs304 = require('./cs304');
const { MongoDriverError } = require('mongodb');
const { all } = require('bluebird');

// Create and configure the app

const app = express();

// Morgan reports the final status code of a request's response
app.use(morgan('tiny'));

app.use(cs304.logStartRequest);

// This handles POST data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cs304.logRequestData);  // tell the user about any request data
app.use(flash());


app.use(serveStatic('public'));
app.set('view engine', 'ejs');

const mongoUri = cs304.getMongoUri();

app.use(cookieSession({
    name: 'session',
    keys: ['horsebattery'],

    // Cookie Options
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

//configure multer for file upload
app.use('/uploads', express.static('/students/wworld/uploads'));

// ================================================================
// custom routes here

const DB = process.env.USER;
const WW = "wworld";
const STAFF = 'staff';
const PROFILES = 'profiles';
const CHATS = 'chats';
const FILES = 'files';

bcrypt = require('bcrypt');

/**
 * Helper function to check if someone is truly logged in (session obj)
 * before executing any code that a user needs to be logged in for
 * @param {*} req - Request Object
 * @param {*} res - Response Object
 * @param {*} next - Next function to be executed in the chain
 * @returns a response object describing URL where user will be taken
 */
function requiresLogin(req, res, next) {
    if (!req.session.logged_in) {
      req.flash('error', 'This page requires you to be logged in - please do so.');
      return res.redirect("/login/");
    } else {
        next();
    }
  }

// main page. This shows the use of session cookies
app.get('/', (req, res) => {
    let uid = req.session.uid || 'unknown';
    let visits = req.session.visits || 0;
    visits++;
    req.session.visits = visits;
    console.log('uid', uid);
    return res.render('index.ejs', {uid, visits});
});

//login section start

/**
 * Displays login form so that existing users can acess profile
 */
app.get('/login', (req, res) => {
    return res.render('login.ejs');
});

/**
 * Users login with an existing username and password and
 * are redirected to personalized profile page
 */
app.post("/login", async (req, res) => {
    try {
      const username = req.body.username;

      //make sure user is in the database
      const db = await Connection.open(mongoUri, WW);
      var existingUser = await db.collection(PROFILES).findOne({username: username});

      if (!existingUser) {
        req.flash('error', "Username does not exist - try again.");
        return res.redirect('/login');}

        const password = req.body.password;
        
      //route for people with no passwords
      if(password == "" && existingUser.password){
        req.flash('error', `Please enter your password below!`);
        return res.redirect("/login");
      }

      if(password == "" && !existingUser.password){
        req.flash('error', `It seems like you need a password! Redirecting...`);
        return res.redirect("/password/edit/"+username);
      }
        
        //This line is making logins take forever
        const match = await bcrypt.compare(password, existingUser.password); 
        //console.log('match', match);
        
        if (!match) {
        req.flash('error', "Username or password incorrect - try again.");
        return res.redirect('/login');}

        req.flash('info', 'successfully logged in as ' + username);
        req.session.username = username;
        req.session.logged_in = true;
        //console.log('login as', username);
        return res.redirect("/profile/" + username);

    } catch (error) {
      req.flash('error', `Form submission error: ${error}`);
      return res.redirect('/login');
    }
  });

  
//alternative route for those without passwords and those who need to update password

/**
 * Displays pasword update form so that existing users can 
 * update password
 */
app.get('/password/edit/:username', requiresLogin, (req, res) => {
    return res.render('passwordEdit.ejs', {username:req.params.username});
});

app.post("/password/edit/:username", requiresLogin, async (req, res) => {
    try {

        const username = req.params.username;
        //console.log("SESSION USERNAME:", username);
        const password = req.body.password;

      const db = await Connection.open(mongoUri, WW);
      var existingUser = await db.collection(PROFILES).findOne({username: username});

      if (!existingUser) {
        req.flash('error', "Error with username - try again.");
        return res.redirect('/login');}
        
        //adding SALT to user's new password
        const ROUNDS = 15;
        const hash = await bcrypt.hash(password, ROUNDS);
       
       //set up for update
       const filter = {username: username};
       const updatesToAdd = {password: hash};
       const options = {upsert: false};
        
        //update profile in database
        let update = {$set: updatesToAdd};
        await db.collection(PROFILES).updateOne(filter, update, options);
        
        //redirect to updated profile
        req.flash('info',`Success! Password set as: ${hash}`);
        return res.redirect("/profile/" + username);

    } catch (error) {
      req.flash('error', `Form submission error: ${error}`);
      return res.redirect('/login');
    }
});

// conventional non-Ajax logout, so redirects
app.post('/logout/', requiresLogin, (req, res) => {
    if (req.session.username) {
        req.session.username = null;
        req.session.logged_in = false;
        req.flash('info', 'You are logged out');
        return res.redirect('/login/');
      } else {
        req.flash('error', 'You are not logged in - please do so.');
        return res.redirect('/login/');
      }
});


//login section end

//add and remove friend section start

/**
 * Adds a person to the current users friendlist when a button is clicked
 * on that persons profile page
 */
app.post('/add-friend/:uid', requiresLogin, async (req, res) => {
    friendUid = req.params.uid;
    currUser = req.session.username;
    const db = await Connection.open(mongoUri, WW);
    let result = await db.collection(PROFILES).updateOne({username:currUser},
        {$push:{friends: friendUid}});

    let ffList = await db.collection(PROFILES).findOne({username: friendUid}, 
        {projection: {_id: 0, friends: 1}});
    if (!ffList.friends.includes(currUser)){
        await db.collection(PROFILES).updateOne({username: friendUid}, 
            {$push: {pendingFriends: currUser}});
    }
    await db.collection(PROFILES).updateOne({username: currUser}, {$pull: {pendingFriends: friendUid}});
    if (result.modifiedCount == 1){
        req.flash("info", "Added " + friendUid + " to friends");
    }
    return res.redirect('/profile/'+friendUid);

})

/**
 * Removes a person from the current users friendlist when a button is clicked
 * on that persons profile page
 */
app.post('/rm-friend/:uid', requiresLogin, async (req, res) => {
    friendUid = req.params.uid;
    currUser = req.session.username;
    const db = await Connection.open(mongoUri, WW);
    let result = await db.collection(PROFILES).updateOne({username:currUser},
        {$pull:{friends: friendUid}});
    
    await db.collection(PROFILES).updateOne({username: friendUid}, {$pull: {pendingFriends: currUser}});
    if (result.modifiedCount == 1){
        req.flash("info", "Removed " + friendUid + " from friends");
    }
    return res.redirect('/profile/'+friendUid);

})


//add and remove friend section end

//profile section start
    
/**
 * displays blank user profile form to be filled out
 */
app.get('/profileform', (req, res) => {
    return res.render('profileform.ejs', {majors: constants.majors,
                                        minors: constants.minors,
                                        countries: constants.countries,
                                        states: constants.states});
    });


/**
 * Route to process insertion of profile and redirect to login
 */
app.post('/profileform', async (req, res) => {
    //get data from form
    let name = req.body.name;
    let username = req.body.username;

    //check for duplicate usernames
    const db = await Connection.open(mongoUri, WW);
    var existingUser = await db.collection(PROFILES).findOne({username: username});
    if (existingUser){
        req.flash('error', "User with this username already exists.");
        return res.redirect("/profileform");
    }
    
    let password = req.body.password;
    let pronouns = req.body.pronouns;
    let classyear = req.body.classyear;
    let major = [];
    let major1 = req.body.major;
    major.push(major1);
    let major2 = req.body.major2;
    if (major2 != 'choose major'){
        major.push(major2);
    }
    let minor = req.body.minor;
    if (minor == 'choose minor'){
        minor = "";
    }
    let country = req.body.country;
    if (country == 'Country'){
        country = "";
    }
    let state = req.body.state;
    if (state == 'State (US)'){
        state = "";
    }
    let city = req.body.city;
    let bio = req.body.bio;
    let field = req.body.field;
    let interests = req.body.interests.split(", ");

    //adding SALT to user's password
    const ROUNDS = 15;
    const hash = await bcrypt.hash(password, ROUNDS);
    
    //add profile to database

    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);
    await profiles.insertOne({name: name, username: username, password: hash, 
        pronouns: pronouns, classyear: classyear, major: major, minor: minor,
        country: country, state: state, city: city, bio: bio, field: field,
        interests: interests, friends: []});

    //log in
    req.flash('info', 'Account created! Please login to access the website.');
    return res.redirect("/login");
});

/**
 * Route to open a profile page
 */
app.get("/profile/:username", requiresLogin, async (req, res) => {
    let username = req.params.username;
    let currUser = req.session.username;

    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);
    const profileInfo = await profiles.find({username: username}).toArray();
    console.log("profile info",profileInfo);
    const myInfo = await profiles.find({username: currUser}).toArray();

    if (profileInfo.length == 0){
        req.flash('info',`User not found -- try again!`)
        return res.redirect("/profile/" + currUser);
    }

    return res.render("profile.ejs", {data: profileInfo[0], currUser: currUser, 
        myData: myInfo[0]});
});


/**
 * Route to edit profile page
 */
app.get("/profile/edit/:username", requiresLogin, async (req, res) => {
    let username = req.session.username;

    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);
    const profileInfo = await profiles.find({username: username}).toArray();

    return res.render('editProfile.ejs', {data: profileInfo[0],
                                        majors: constants.majors,
                                        minors: constants.minors,
                                        countries: constants.countries,
                                        states: constants.states});
    });

/**
 * Route to update database with profile edits and display edited profile
 */
app.post("/profile/edit/:username", requiresLogin, async (req, res) => {
    let username = req.session.username;

    //get document from database
    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);
    const profileInfo = await profiles.find({username: username}).toArray();
    let data = profileInfo[0];

    //set up for update
    const filter = {username: username};
    const updatesToAdd = {};
    const options = {upsert: false};

    //get data from form
    let editName = req.body.name;
    let editPronouns = req.body.pronouns;
    let editClassyear = req.body.classyear;
    let editMajor = [];
    let major1 = req.body.major;
    editMajor.push(major1);
    let major2 = req.body.major2;
    if (major2 != 'choose major'){
        editMajor.push(major2);
    }
    let editMinor = req.body.minor;
    if (editMinor == 'choose minor'){
        editMinor = "";
    }
    let editCountry = req.body.country;
    if (editCountry == 'Country'){
        editCountry = "";
    }
    let editState = req.body.state;
    if (editState == 'State (US)'){
        editState = "";
    }
    let editCity = req.body.city;
    let editBio = req.body.bio;
    let editField = req.body.field;
    let editInterests = req.body.interests.split(", ");

    //check form data against document from database
    let originalProfile = [data.name, data.pronouns, data.classyear, data.major, data.minor, 
            data.country, data.state, data.city, data.bio, data.field, data.interests];
    let editedProfile = [editName, editPronouns, editClassyear, editMajor, editMinor,
                editCountry, editState, editCity, editBio, editField, editInterests];
    let profileKeys = ["name", "pronouns", "classyear", "major", "minor", "country",
                        "state", "city", "bio", "field", "interests"];
    let i = 0;
    profileKeys.forEach(elt => {
        if (elt == "major" || elt == "interests"){
            if (originalProfile[i].toString() != editedProfile[i].toString()){
                updatesToAdd[elt] = editedProfile[i];
            }
        } else {
            if (originalProfile[i] != editedProfile[i]){
                updatesToAdd[elt] = editedProfile[i];
            }
        }
        i++;
    });

    //update profile in database
    let update = {$set: updatesToAdd};
    await profiles.updateOne(filter, update, options);

    //redirect to updated profile
    return res.redirect("/profile/" + username);
});

/**
 * Route for user to add a link to their LinkedIn profile
 */
app.get("/profile/connectLinkedIn/:currUser", requiresLogin, (req, res) => {
    let currUser = req.session.username;
    return res.render('connectLinkedIn.ejs', {currUser: currUser});
});

/**
 * Route to update profile with link to LinkedIn added
 */
app.post("/profile/connectLinkedIn/:currUser", requiresLogin, async (req, res) => {
    let username = req.params.currUser;

    //get info from form & format
    let LinkedIn = req.body.link;
    if (!(LinkedIn.startsWith("https"))){
        let URLstart = "https://";
        LinkedIn = URLstart.concat(LinkedIn);
    }

    //open database
    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);

    //set up for update
    const filter = {username: username};
    let update = {$set: {LinkedIn: LinkedIn}};
    const options = {upsert: false};
    
    //update
    await profiles.updateOne(filter, update, options);

    //return to profile
    return res.redirect("/profile/" + username);
});

//set up for profile picture uploads

/* input is an (optional) date object. Returns a string like 123456 
for 56 seconds past 12:34. If the argument is omitted, the current
time is used.
*/
function timeString(dateObj) {
    if( !dateObj) {
        dateObj = new Date();
    }
    // convert val to two-digit string
    d2 = (val) => val < 10 ? '0'+val : ''+val;
    let hh = d2(dateObj.getHours())
    let mm = d2(dateObj.getMinutes())
    let ss = d2(dateObj.getSeconds())
    return hh+mm+ss
}

/**
 * Configure milter storage to store files on disk
 */
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, '/students/wworld/uploads')
    },
    filename: function (req, file, cb) {
        let parts = file.originalname.split('.');
        let ext = parts[parts.length-1];
        let hhmmss = timeString();
        cb(null, file.fieldname + '-' + hhmmss + '.' + ext);
    }
})

/**
 * Middleware function.
 * Takes a dictionary of storage
 * specifications and a filesize limit
 */
var upload = multer({ storage: storage,
    // max fileSize in bytes, causes an ugly error
    limits: {fileSize: 3000000}});

/**
 * Route to upload profile picture
 */
app.get('/profile/upload/:username/', requiresLogin, (req, res) => {
    let currUser = req.session.username;
    return res.render('fileUpload.ejs', {currUser: currUser});
});
/**
 * Route to upload profile picture
 */
app.post('/profile/upload/:username/', requiresLogin, upload.single('photo'), async (req, res) => {
    let username = req.session.username;

    console.log('uploaded data', req.body);
    console.log('file', req.file);

    //check that file is png or jpg/jpeg
    if (!(req.file.filename.includes('.png') || req.file.filename.includes('.jpg') 
        || req.file.filename.includes('.jpeg') || req.file.filename.includes('.PNG')
        || req.file.filename.includes('.JPG') || req.file.filename.includes('.JPEG'))){
            req.flash('error', "Please submit file in png or jpg/jpeg format");
            return res.redirect('/profile/upload/:username');
    }

    //change permissions of file to be world-readable
    let val = await fs.chmod('/students/wworld/uploads/'+req.file.filename, 0o664);
    console.log('chmod val', val);

    //insert file data into mongodb
    const db = await Connection.open(mongoUri, WW);
    const results = await db.collection(FILES)
        .insertOne({file: req.file});
    console.log('insertOne result', results);

    //check if person has existing picture, delete if so
    const profiles = db.collection(PROFILES);
    const user = await profiles.find({username: username}).toArray();
    let userPicStatus = user[0].picture;
    if (userPicStatus){
        let filename = userPicStatus.filename;
        await db.collection(FILES).deleteOne({"file.filename": filename});
    }

    //update file upload status in profile
    const filter = {username: username};
    const update = {$set: {picture: 
        {picStatus: 'uploaded', filepath: '/uploads/'+req.file.filename, 
        alt: req.body.alt, filename: req.file.filename}}};
    const options = {upsert: false};
    await profiles.updateOne(filter, update, options);

    //redirect to updated profile
    return res.redirect("/profile/" + username);
});

//profile section end

// homepage section start

/**
 * Helper function to load the three friends that the user last added  
 * @param {object} req 
 * @param {String} uid the uid of the user
 * @param {database} profiles profiles collection of wworld db
 * @returns personObject (the user's information as a dictionary) and 
 * friendsArray (their last three friends that they added)
 */
async function homepageHelper(req, uid, profiles) {
    // find the person who's logged in and all their friends
    const personObject = await profiles.findOne({username: uid});
    const friends = personObject.friends.slice(-3); // get last 3 friends

    // find the friends in the db 
    const friendsArray = await profiles.find({username: {$in: friends}}).toArray();
    
    // if this person doesn't have any friends yet, flash a message
    if (friendsArray.length === 0) {
        req.flash("info", "You don't have any friends yet! Go find some :)");
    }

    return [personObject, friendsArray];
}

/**
 * (GET) Shows the homepage, where the user can see their recently-added 
 * friends and friend recommendations
 */
app.get("/homepage/", requiresLogin, async (req, res) => {
    const db = await Connection.open(mongoUri, WW);
    const profiles = db.collection(PROFILES);

    // require session 
    let uid = req.session.username || 'unknown';

    const [personObject, friendsArray] = await homepageHelper(req, uid, profiles);

    const data = {
        friends: friendsArray,
        newFriends: [],
        uid: uid 
    }

    return res.render("homepage.ejs", {data: data});
});

/**
 * (GET) Takes the menu selection and renders the homepage with the 
 * recommended friends information 
 */
app.get("/do-select/", requiresLogin, async (req, res) => {
    const db = await Connection.open(mongoUri, WW);
    const profiles = db.collection(PROFILES);

    // require session 
    let uid = req.session.username || 'unknown';

    const [personObject, friendsArray] = await homepageHelper(req, uid, profiles);
    
    // find new people by field to recommend as a friend 
    let attribute = req.query.menu; // get selected attribute
    if (attribute === "location") {
        attribute = "state";
    }
    const personAttr = personObject[attribute]; // find the user's attribute (currently, hardcoding field)
    let newFriendsArray = await profiles.find({$and: [
        {[attribute]: {$eq: personAttr}},     // find people with the same attribute
        {friends: {$ne: personObject.username}},     // filter out old friends
        {username: {$ne: personObject.username}}     // filter out the user themselves
    ]}).toArray();

    // console.log("attribute: ", attribute);
    // console.log("personAttr: ", personAttr);
    // console.log(newFriendsArray);

    if (newFriendsArray.length === 0) {
        req.flash("info", "You're unique! Nobody has the same attribute yet. Try sorting by another feature :)");
        newFriendsArray = [];
    } 

    const data = {
        friends: friendsArray,
        newFriends: newFriendsArray
    }

    return res.render("homepage.ejs", {data: data});
});

// homepage section end

//chat section start

/**
 * Renders a list of all other users that the current user has chatted with. 
 * Clicking on the users name will take you to the page to chat with that user.
 */
app.get('/chats/', requiresLogin, async (req, res) => {

    let uid = req.session.username || 'unknown';
    const db = await Connection.open(mongoUri, WW);

    //get the current users full name
    let currName = await db.collection(PROFILES).findOne(
        {username: uid}, {projection: {name: 1, _id: 0}});
    //get all chats that the user is in
    let chats = await db.collection(CHATS).find({users: {userID: uid, 
        name: currName.name}}).toArray();
    
    //Get an array of all the users usernames
    let chatList = await getChatUsers(chats,uid);
    //Find the profile pictures associated with those users
    let profiles = await db.collection(PROFILES).find(
        {username: {$in: chatList}}, 
        {projection:{_id: 0, picture: 1, username:1}}).toArray()

    //An object that holds just a username and the 
    //corresponding profile picture (if there is one)
    let userDict = {};
    profiles.forEach(elt =>{
        if (elt.picture != undefined){
            userDict[elt.username] = elt.picture;
        }
    })
    

    return res.render("chatList.ejs", {chats: chats, currentUser: uid, pictures: userDict});
});

/**
 * A helper function that gets a simple array of usernames
 * to make looking up profiles easier
 * @param {Array} chats - An array of chat objects 
 * @param {String} curr - the current users uid
 * @returns - an array of usernames of the users the current user has chatted with
 */
async function getChatUsers(chats,curr){
    //console.log(chats);
    chatList = [];
    chats.forEach((elt) =>{
        elt.users.forEach( user=>{
            if (user.userID !== curr){
                chatList.push(user.userID);
            }
        });
    });

    
    return chatList;
}

/**
 * This function creates a new chat object in the chats collection
 *  the first time the user tries to chat with another user.
 * @param {*} uid - the current users id
 * @param {*} friendUid - the id of the person the current user is chatting with
 * @param {*} currUserName - the current users name
 * @param {*} friendUserName - the name of the person the current user is chatting with
 */
async function newChatObj(uid, friendUid, currUserName, friendUserName){
    const db = await Connection.open(mongoUri, WW);
    console.log(uid);
    console.log(friendUid);

    await db.collection(CHATS).insertOne({
        users: [{userID: uid, name: currUserName}, 
            {userID: friendUid, name: friendUserName}],
        messages : []
    })
}

/**
 * renders the current chat messages between the current user
 *  and whichever user's uid is in the url
 * and a text input to write a chat
 */
app.get('/chat/:username', requiresLogin, async (req, res) => {
    const db = await Connection.open(mongoUri, WW);
    let uid = req.session.username || 'unknown';
    let receiver = req.params.username;
    let currUserName = await db.collection(PROFILES).findOne(
        {username: uid}, {projection: {name: 1, _id: 0}});
    let friendUserName = await db.collection(PROFILES).findOne(
        {username: receiver}, {projection: {name: 1, _id: 0}});
    console.log(currUserName.name);

    //just in case someone deletes their profile!
    if (friendUserName == null){
        req.flash('info', `Cannot find ${receiver}!`);
        return res.redirect("/chats/");
    }
    
    //find the document that contains messages between thise two users

    let chats = await db.collection(CHATS).find(
        {$and: [ {users: {$eq: {userID: uid, name: currUserName.name}}}, 
            {users: {$eq: {userID: receiver, name: friendUserName.name}}} ]}
    ).toArray();
    //if there are no chats, create a chat between those two users
    if (chats[0] == undefined){
        await newChatObj(uid, receiver, currUserName.name, friendUserName.name);
        chats = await db.collection(CHATS).find(
            {$and: [ {users: {$eq: {userID: uid, name: currUserName.name}}}, 
                {users: {$eq: {userID: receiver, name: friendUserName.name}}} ]}
                ).toArray();
    };
    console.log(chats[0]);
    console.log("currentUser: " + uid)
    return res.render('chat.ejs', {
        chats: chats[0], 
        currUser: uid, 
        friendUser: receiver,
        currUserName: currUserName.name, 
        friendName: friendUserName.name});
    
});

/**
 * updates the chat page when a message is sent and adds the message to 
 * the corresponding chat object
 */
app.post('/chat/:username', requiresLogin, async (req, res) => {
    let username = req.params.username;
    let uid = req.session.username || 'unknown';
    const db = await Connection.open(mongoUri, WW);
    
    let currUserName = await db.collection(PROFILES).findOne(
        {username: uid}, {projection: {name: 1, _id: 0}});
    let friendUserName = await db.collection(PROFILES).findOne(
        {username: username}, {projection: {name: 1, _id: 0}});

    //get the current time to use as a timestamp for the message
    let time = new Date(Date.now());
    console.log(time);
    time = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'EST',
      }).format(time);
    
    //time = time.toUTCString();
    let content = req.body.message;
    //and
    await db.collection(CHATS).updateOne(
        {$and: [ {users: {$eq: {userID: uid, name: currUserName.name}}}, 
            {users: {$eq: {userID: username, name: friendUserName.name}}} ]},
        {$push: {messages: {sender: uid, timestamp: time, message: content}}})
    res.redirect("/chat/" + username);
});

//chat section end

//search section start

/**
 * Helper function to sort by alums
 * @param {list} allNames list of all people found with the search paramters
 */
function alumFinder(peopleFound) {
    let alumsOnlyList = [];
    peopleFound.forEach( (person) => {
        if (Number(person.classyear) < 2024) {
            console.log("CLASSYEAR", Number(person.classyear));
            alumsOnlyList.push(person);
        }
    })
    return alumsOnlyList;
}

/**
 * populates page with profils that match the users search criteria
 * TO-DO: search for more than one thing at a time?
 */
app.get('/search/', requiresLogin, async (req, res) => {
    let term = req.query.term;
    let kind = req.query.kind;
    let alumStatus = req.query.alum;
    let currentUser = req.session.username;

    //opening connection to database
    const db = await Connection.open(mongoUri, WW);
    const profiles = db.collection(PROFILES);

    //search routes: username/name, interests, region
    if (kind == "userName"){

        let regName = new RegExp(term, 'i');

        //look in database for BOTH Wellesley usernames and regular names
        //change this to $or format
        let allNames = await profiles.find({$or: [{username: {$regex: regName}}, 
            {name: {$regex: regName}}]}).toArray();

        //if they want to find alums, find people with classyears > 2024
        if (alumStatus === "alums") {
            allNames = alumFinder(allNames);
        }

        //three routes: find no one, find one person, find multiple people
        if (allNames.length == 0){
            req.flash('info',`Sorry, no one with the user name: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allNames, currUser:currentUser});
        }
        else{
            return res.render("searchPage.ejs",{data:allNames, currUser:currentUser});
        }
    }
    //lets check class years here -- might make it a click thing later on?
    else if (kind == "classYear"){

        let regYear = new RegExp(term, 'i');
        //search for profiles with that specific interest!
        let allYears = await profiles.find({classyear: {$regex: regYear}}).toArray();

        if (alumStatus === "alums") {
            allYears = alumFinder(allYears);
        }

        if (allYears.length == 0){
            req.flash('info',`Sorry, no one with the class year: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allYears, currUser:currentUser});
        }
        else{
            return res.render("searchPage.ejs",{data:allYears, currUser:currentUser});
        }
    }else if (kind == "majorOrMinor"){

        let regMajor = new RegExp(term, 'i');
        
        //search for profiles with that specific interest!
        let allMajors = await profiles.find({$or: [{major: {$regex: regMajor}}, 
            {minor: {$regex: regMajor}}]}).toArray();

        //console.log(allInterests);

        if (alumStatus === "alums") {
            allMajors = alumFinder(allMajors);
        }

        if (allMajors.length == 0){
            req.flash('info',`Sorry, no one with the major: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allMajors, currUser:currentUser});
        }
        else{
            return res.render("searchPage.ejs",{data:allMajors, currUser:currentUser});
        }
    }else if (kind == "interest"){

        let regInterest = new RegExp(term, 'i');
        
        //search for profiles with that specific interest!
        let allInterests = await profiles.find(
            {interests: {$regex: regInterest}}).toArray();

        //console.log(allInterests);

        if (alumStatus === "alums") {
            allInterests = alumFinder(allInterests);
        }

        if (allInterests.length == 0){
            req.flash('info',`Sorry, no one with the interest: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allInterests, currUser:currentUser});
        }
        else{
            return res.render("searchPage.ejs",{data:allInterests, currUser:currentUser});
        }
    }else if (kind == "field"){

        let regField = new RegExp(term, 'i');
        
        //search for profiles with that specific interest!
        let allFields = await profiles.find({field: {$regex: regField}}).toArray();

        //console.log(allInterests);

        if (alumStatus === "alums") {
            allFields = alumFinder(allFields);
        }

        if (allFields.length == 0){
            req.flash('info',`Sorry, no one with the field: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allFields, currUser:currentUser});
        }
        else{
            return res.render("searchPage.ejs",{data:allFields, currUser:currentUser});
        }
    }else{
        
        let regRegion = new RegExp(term, 'i');
        
        //search for regions in city, state, and country -- makes life easier
        let allRegion = await profiles.find({$or: [{country: regRegion}, 
            {state: regRegion},{city: regRegion}]}).toArray();
        
        if (alumStatus === "alums") {
            allRegion = alumFinder(allRegion);
        }

        if (allRegion.length == 0){
            req.flash('info',`Sorry, no one lives in: ${term}!`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allRegion, currUser:currentUser});
        }
        else{
            return res.render("searchPage.ejs",{data:allRegion, currUser:currentUser});
        }
    }
});
//search section end

//delete section start
/**
 * Displays delete page so user can confirm they want to delete account
 */
app.get('/delete/', requiresLogin, (req, res) => {
    let user = req.session.username;
    return res.render('deletePage.ejs', {username: user});
});

/**
 * Users can delete an account with an
 * existing username and are redirected to the login page
 */
app.post("/delete/:username", requiresLogin, async (req, res) => {
    try {
      const user = req.params.username;

      //make sure user is in the database before you delete them?
      const db = await Connection.open(mongoUri, WW);
      var existingUser = await db.collection(PROFILES).findOne({username: user});
      console.log(existingUser);

      if (!existingUser) {
        req.flash('error', "Username does not exist - cannot delete.");
        return res.redirect('/delete/');}

        console.log("IM ABOUT TO DELETE!!!");
        var result = await db.collection(PROFILES).deleteOne({username: user});
        console.log(`deleted: ${result.deleteCount} documents`);
        return res.redirect("/");

    } catch (error) {
      req.flash('error', `Form submission error: ${error}`);
      return res.redirect('/login');
    }
  });
//delete section end

// ================================================================
// postlude

app.use((err, req, res, next) => {
    console.log('error', err);
    let username = req.session.username;
    if(err.code === 'LIMIT_FILE_SIZE') {
        console.log('file too big')
        req.flash('error', 'File too big: please upload a file under 3 MB')
        res.redirect('/profile/upload/:username')
    } else {
        console.error(err.stack)
        res.status(500).send('Something broke!')
    }
})

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`open http://localhost:${serverPort}`);
});
