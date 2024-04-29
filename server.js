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

const { Connection } = require('./connection');
const cs304 = require('./cs304');
const { MongoDriverError } = require('mongodb');

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
 * Redirects existing users to profile -- includes session capabilities 
 * for further functionalities
 */
app.post("/login", async (req, res) => {
    try {
      const username = req.body.username;
      console.log("username", username);
      //const password = req.body.password;
      const db = await Connection.open(mongoUri, WW);
      var existingUser = await db.collection(PROFILES).findOne({username: username});
      console.log('user', existingUser);
      if (!existingUser) {
        req.flash('error', "Username does not exist - try again.");
       return res.redirect('/login')
      }
        //   const match = await bcrypt.compare(password, existingUser.hash); 
        //   console.log('match', match);
        //   if (!match) {
        //       req.flash('error', "Username or password incorrect - try again.");
        //       return res.redirect('/login')
        //   }
      req.flash('info', 'successfully logged in as ' + username);
      req.session.username = username;
      req.session.logged_in = true;
      console.log('login as', username);
      return res.redirect("/profile/" + username);
    } catch (error) {
      req.flash('error', `Form submission error: ${error}`);
      return res.redirect('/login')
    }
  });

// conventional non-Ajax logout, so redirects
app.post('/logout/', (req, res) => {
    console.log('in logout');
    req.session.uid = false;
    req.session.logged_in = false;
    res.redirect('/login/');
});

//login section end

/**
 * Adds a person to the current users friendlist when a button is clicked
 * on that persons profile page
 */
app.post('/add-friend/:uid', async (req, res) => {
    friendUid = req.params.uid;
    currUser = req.session.username;
    const db = await Connection.open(mongoUri, WW);
    let result = db.collection(PROFILES).updateOne({username:currUser},{$push:{friends: friendUid}});
    if (result.modifiedCount == 1){
        req.flash("info", "Added " + friendUid + " to friends");
    }
    return res.redirect('/profile/'+friendUid);

})


//profile section start

//constants
const majors = ["Africana Studies", "American Studies", "Anthropology", 
    "Architecture", "Art History", "Astronomy", "Astrophysics", "Biochemistry",
    "Biological Sciences", "Chemical Physics", "Chemistry",
    "Cinema and Media Studies", "Classical Civilization", "Classics", 
    "Cognitive and Linguistic Sciences", "Comparative Literary Studies",
    "Computer Science", "Data Science", "East Asian Languages and Cultures",
    "East Asian Studies", "Economics", "Education Studies", 
    "English and Creative Writing", "Environmental Studies",
    "French & Francophone Studies", "French Cultural Studies", "Geosciences",
    "German Studies", "History", "International Relations - Economics", 
    "International Relations - History", 
    "International Relations - Political Science", "Italian Studies", 
    "Jewish Studies", "Latin American Studies", "Mathematics", 
    "Media Arts and Sciences", "Medieval and Renaissance Studies",
    "Middle Eastern Studies", "Music", "Neuroscience", 
    "Peace and Justice Studies", "Philosophy", "Physics", "Political Science",
    "Psychology", "Religion", "Russian", "Russian Area Studies", "Sociology",
    "South Asia Studies", "Spanish and Portuguese", "Studio Art",
    "Theatre Studies", "Women's and Gender Studies", "Individual", "Undeclared"];
const minors = ["Africana Studies", "Anthropology", 
    "Art History", "Asian American Studies", "Astronomy", "Biochemistry",
    "Biological Sciences", "Chemistry", "Chinese Language and Culture",
    "Cinema and Media Studies", "Comparative Race and Ethnicity",
    "Computer Science", "Economics", "Education Studies", 
    "English and Creative Writing", "Environmental Studies", "Geosciences",
    "German Studies", "Global Portuguese Studies", "Health and Society",
    "History", "Italian Studies", "Japanese Language and Culture",
    "Jewish Studies", "Korean Language and Culture", "Latin American Studies",
    "Latina/o Studies", "Mathematics", "Medieval and Renaissance Studies",
    "Middle Eastern Studies", "Music", "Peace and Justice Studies", 
    "Philosophy", "Physics", "Psychology", "Religion", "Russian", "Sociology",
    "South Asia Studies", "Statistics", "Studio Art", 
    "Teaching and Learning Studies", "Women's and Gender Studies"];
const countries = ["Afghanistan", "Albania", "Algeria", "Andorra",
    "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia",
    "Austria", "Azerbaijan", "The Bahamas", "Bahrain", "Bangladesh",
    "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei",
    "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
    "Cameroon", "Canada", "Central African Republic", "Chad", "Chile",
    "China", "Colombia", "Comoros", "Congo, Democratic Republic of the",
    "Congo, Republic of the", "Costa Rica", "Côte d’Ivoire", "Croatia",
    "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica",
    "Dominican Republic", "East Timor (Timor-Leste)", "Ecuador", "Egypt",
    "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini",
    "Ethiopia", "Fiji", "Finland", "France", "Gabon", "The Gambia",
    "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala",
    "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary",
    "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
    "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya",
    "Kiribati", "Korea, North", "Korea, South", "Kosovo", "Kuwait",
    "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia",
    "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar",
    "Malawi", "Malaysia", "Maldives", "Mali", "Malta", 
    "Marshall Islands", "Mauritania", "Mauritius", "Mexico",
    "Micronesia, Federated States of", "Moldova", "Monaco", "Mongolia",
    "Montenegro", "Morocco", "Mozambique", "Myanmar (Burma)",
    "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand",
    "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway",
    "Oman", "Pakistan", "Palau", "Palestine", "Panama", 
    "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
    "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
    "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino",
    "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia",
    "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia",
    "Solomon Islands", "Somalia", "South Africa", "Spain", "Sri Lanka",
    "Sudan", "Sudan, South", "Suriname", "Sweden", "Switzerland",
    "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo",
    "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
    "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", 
    "United Kingdom", "United States", "Uruguay", "Uzbekistan",
    "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", 
    "Zambia", "Zimbabwe"];
const states = ["Alabama", "Alaska", "Arizona", "Arkansas", 
    "California", "Colorado", "Connecticut", "D.C.", "Delaware", 
    "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", 
    "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", 
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", 
    "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", 
    "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
    "Rhode Island", "South Carolina", "South Dakota", "Tennessee",
    "Texas", "Utah", "Vermont", "Virginia", "Washington", 
    "West Virginia", "Wisconsin", "Wyoming"];
    
/**
 * displays blank user profile form to be filled out
 */
app.get('/profileform', (req, res) => {
    return res.render('profileform.ejs', {majors: majors,
                                        minors: minors,
                                        countries: countries,
                                        states: states});
    });


/**
 * Route to process insertion of profile and redirect to new profile page
 */
app.post('/profileform', async (req, res) => {
    //get data from form
    let name = req.body.name;
    let username = req.body.username;
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
    
    //add profile to database

    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);
    await profiles.insertOne({name: name, username: username,
        pronouns: pronouns, classyear: classyear, major: major, minor: minor, 
        country: country, state: state, city: city, bio: bio, field: field, 
        interests: interests, friends: []});
    return res.redirect("/profile/" + username);
});

/**
 * Route to open a profile page
 */
app.get("/profile/:username", async (req, res) => {
    let username = req.params.username;
    let currUser = req.session.username;

    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);
    const profileInfo = await profiles.find({username: username}).toArray();
    const myInfo = await profiles.find({username: currUser}).toArray();
    
    return res.render("profile.ejs", {data: profileInfo[0], currUser: currUser, 
        myData: myInfo[0]});
});

/**
 * Route to edit profile page
 */
app.get("/profile/edit/:username", async (req, res) => {
    let username = req.session.username;

    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);
    const profileInfo = await profiles.find({username: username}).toArray();

    return res.render('editProfile.ejs', {data: profileInfo[0],
                                        majors: majors,
                                        minors: minors,
                                        countries: countries,
                                        states: states});
    });

/**
 * Route to update database with profile edits and display edited profile
 */
app.post("/profile/edit/:username", async (req, res) => {
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
app.get('/profile/upload/:username/', (req, res) => {
    let currUser = req.session.username;
    return res.render('fileUpload.ejs', {currUser: currUser});
});
/**
 * Route to upload profile picture
 */
app.post('/profile/upload/:username/', upload.single('photo'), async (req, res) => {
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

// homepage section 

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
app.get("/homepage/", async (req, res) => {
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
app.get("/do-select/", async (req, res) => {
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
app.get('/chats/', async (req, res) => {
    let uid = req.session.username || 'unknown';
    const db = await Connection.open(mongoUri, WW);
    let currName = await db.collection(PROFILES).findOne(
        {username: uid}, {projection: {name: 1, _id: 0}});
    
    //get all chats that the user is in
    let chats = await db.collection(CHATS).find({users: {userID: uid, 
        name: currName.name}}).toArray();
    console.log(chats);
    return res.render("chatList.ejs", {chats: chats, currentUser: uid});
});

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
app.get('/chat/:username', async (req, res) => {
    const db = await Connection.open(mongoUri, WW);
    let uid = req.session.username || 'unknown';
    let receiver = req.params.username;
    let currUserName = await db.collection(PROFILES).findOne(
        {username: uid}, {projection: {name: 1, _id: 0}});
    let friendUserName = await db.collection(PROFILES).findOne(
        {username: receiver}, {projection: {name: 1, _id: 0}});
    console.log(currUserName.name);
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
app.post('/chat/:username', async (req, res) => {
    let username = req.params.username;
    let uid = req.session.username || 'unknown';
    const db = await Connection.open(mongoUri, WW);
    
    let currUserName = await db.collection(PROFILES).findOne(
        {username: uid}, {projection: {name: 1, _id: 0}});
    let friendUserName = await db.collection(PROFILES).findOne(
        {username: username}, {projection: {name: 1, _id: 0}});
    //get the current time to use as a timestamp for the message
    let time = new Date(Date.now());
    time = time.toUTCString();
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
 * populates page with profils that match the users search criteria
 * TO-DO: search for more than one thing at a time?
 */
app.get('/search/', async (req, res) => {
    let term = req.query.term;
    let kind = req.query.kind;

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

        //three routes: find no one, find one person, find multiple people
        if (allNames.length == 0){
            req.flash('info',`Sorry, no one with the user name: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allNames});
        }
        else{
            return res.render("searchPage.ejs",{data:allNames});
        }
    }
    //lets check class years here -- might make it a click thing later on?
    else if (kind == "classYear"){

        let regYear = new RegExp(term, 'i');
        //search for profiles with that specific interest!
        let allYears = await profiles.find({classyear: {$regex: regYear}}).toArray();

        if (allYears.length == 0){
            req.flash('info',`Sorry, no one with the class year: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allYears});
        }
        else{
            return res.render("searchPage.ejs",{data:allYears});
        }
    }else if (kind == "majorOrMinor"){

        let regMajor = new RegExp(term, 'i');
        
        //search for profiles with that specific interest!
        let allMajors = await profiles.find({$or: [{major: {$regex: regMajor}}, 
            {minor: {$regex: regMajor}}]}).toArray();

        //console.log(allInterests);

        if (allMajors.length == 0){
            req.flash('info',`Sorry, no one with the major: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allMajors});
        }
        else{
            return res.render("searchPage.ejs",{data:allMajors});
        }
    }else if (kind == "interest"){

        let regInterest = new RegExp(term, 'i');
        
        //search for profiles with that specific interest!
        let allInterests = await profiles.find(
            {interests: {$regex: regInterest}}).toArray();

        //console.log(allInterests);

        if (allInterests.length == 0){
            req.flash('info',`Sorry, no one with the interest: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allInterests});
        }
        else{
            return res.render("searchPage.ejs",{data:allInterests});
        }
    }else if (kind == "field"){

        let regField = new RegExp(term, 'i');
        
        //search for profiles with that specific interest!
        let allFields = await profiles.find({field: {$regex: regField}}).toArray();

        //console.log(allInterests);

        if (allFields.length == 0){
            req.flash('info',`Sorry, no one with the field: ${term} was found`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allFields});
        }
        else{
            return res.render("searchPage.ejs",{data:allFields});
        }
    }else{
        
        let regRegion = new RegExp(term, 'i');
        
        //search for regions in city, state, and country -- makes life easier
        let allRegion = await profiles.find({$or: [{country: regRegion}, 
            {state: regRegion},{city: regRegion}]}).toArray();
        
        if (allRegion.length == 0){
            req.flash('info',`Sorry, no one lives in: ${term}!`);
            //would it be better to redirect or re-render here?
            return res.render("searchPage.ejs",{data:allRegion});
        }
        else{
            return res.render("searchPage.ejs",{data:allRegion});
        }
    }
});
//search section end

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
