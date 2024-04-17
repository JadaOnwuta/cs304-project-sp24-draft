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

// ================================================================
// custom routes here

const DB = process.env.USER;
const WMDB = 'wmdb';
const STAFF = 'staff';

// main page. This shows the use of session cookies
app.get('/', (req, res) => {
    let uid = req.session.uid || 'unknown';
    let visits = req.session.visits || 0;
    visits++;
    req.session.visits = visits;
    console.log('uid', uid);
    return res.render('index.ejs', {uid, visits});
});

// shows how logins might work by setting a value in the session
// This is a conventional, non-Ajax, login, so it redirects to main page 
app.post('/set-uid/', (req, res) => {
    console.log('in set-uid');
    req.session.uid = req.body.uid;
    req.session.logged_in = true;
    res.redirect('/');
});

// shows how logins might work via Ajax
app.post('/set-uid-ajax/', (req, res) => {
    console.log(Object.keys(req.body));
    console.log(req.body);
    let uid = req.body.uid;
    if(!uid) {
        res.send({error: 'no uid'}, 400);
        return;
    }
    req.session.uid = req.body.uid;
    req.session.logged_in = true;
    console.log('logged in via ajax as ', req.body.uid);
    res.send({error: false});
});

// conventional non-Ajax logout, so redirects
app.post('/logout/', (req, res) => {
    console.log('in logout');
    req.session.uid = false;
    req.session.logged_in = false;
    res.redirect('/');
});

// two kinds of forms (GET and POST), both of which are pre-filled with data
// from previous request, including a SELECT menu. Everything but radio buttons

app.get('/form/', (req, res) => {
    console.log('get form');
    return res.render('form.ejs', {action: '/form/', data: req.query });
});

app.post('/form/', (req, res) => {
    console.log('post form');
    return res.render('form.ejs', {action: '/form/', data: req.body });
});

//profile section start

//constants
const WW = "wworld";
const PROFILES = "profiles";
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
        "Theatre Studies", "Women's and Gender Studies", "Undeclared"];
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
    let interests = req.body.interests;
    
    //add profile to database

    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);
    await profiles.insertOne({name: name, username: username,
        pronouns: pronouns, classyear: classyear, major: major, minor: minor, 
        country: country, state: state, city: city, bio: bio, field: field, interests: interests});
    return res.redirect("/profile/" + username);
});

/**
 * Route to open a profile page
 */
app.get("/profile/:username", async (req, res) => {
    let username = req.params.username;

    const dbopen = await Connection.open(mongoUri, WW);
    const profiles = dbopen.collection(PROFILES);
    const profileInfo = await profiles.find({username: username}).toArray();

    return res.render("profile.ejs", {data: profileInfo[0]});
});

//profile section end

app.get('/staffList/', async (req, res) => {
    const db = await Connection.open(mongoUri, WMDB);
    let all = await db.collection(STAFF).find({}).sort({name: 1}).toArray();
    console.log('len', all.length, 'first', all[0]);
    return res.render('list.ejs', {listDescription: 'all staff', list: all});
});

// ================================================================
// postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`open http://localhost:${serverPort}`);
});
