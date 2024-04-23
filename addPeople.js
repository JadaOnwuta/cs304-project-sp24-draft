
// Setting up DB connection
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const { Connection } = require('./connection');
const cs304 = require('./cs304');
const { localsName } = require('ejs');
const database = require('mime-db');
const mongoUri = cs304.getMongoUri();
const myDBName = "wworld";

/**
 * 
 * @param {database} db 
 * Inserts a new person into the 'profiles' collection 
 * Returns nothing.
 */
async function insertPerson(db, name, un, pronouns, cy, major, minor, country, state, city, bio, field, interests, friends) {
    await db.collection("profiles").insertOne({
        name: name, 
        username: un,
        pronouns: pronouns,
        classyear: cy,
        major: major,
        minor: minor,
        country: country,
        state: state,
        city: city,
        bio: bio,
        field: field,
        interests: interests,
        friends: friends
    })
}

/**
 * 
 * @param {database} db 
 * Inserts a new person into the 'profiles' collection 
 * Returns nothing.
 */
async function updatePersonFriends(db, un, friendList) {
    await db.collection("profiles").updateOne(
        { username: un },
        { $set: { friends: friendList} }
    )
}

async function main() {
    console.log('starting function check...\n');
    // Defining databases
    const personal_db = await Connection.open(mongoUri, myDBName);

    // add 3 fake profiles
    // await insertPerson(
    //     personal_db,
    //     "Ellie Bray", 
    //     'eb110',
    //     'she/they',
    //     '2024',
    //     [ 'Data Science' ],
    //     '',
    //     'United States',
    //     'Washington',
    //     'Spokane',
    //     'Love ya!',
    //     '',
    //     [ 'Chocolate tasting' ],
    //     [ 'en121', 'ac120', 'eb108' ]
    // );

    // await insertPerson(
    //     personal_db,
    //     'Alex Chen',
    //     'ac120',
    //     'they/them',
    //     '2024',
    //     [ 'Environmental Science' ],
    //     '',
    //     'Canada',
    //     'Ontario',
    //     'Toronto',
    //     'Dedicated to protecting the environment and advocating for climate action.',
    //     'Environmental Studies',
    //     [ 'Activism', 'gardening', 'cooking' ],
    //     [ 'eb110', 'en121', 'eb108' ]
    // );

    // await insertPerson(
    //     personal_db,
    //     'Emily Nguyen',
    //     'en121',
    //     'she/her',
    //     '2023',
    //     'Biology',
    //     'Chemistry',
    //     'USA',
    //     'New York',
    //     'New York City',
    //     "Fascinated by the complexities of life and the natural world.",
    //     'Life Sciences',
    //     [ 'Painting', 'hiking' ],
    //     [ 'eb110', 'ac120', 'eb108' ]
    // );

    console.log("Inserted everyone!")

    // add a friends attribute for all people in db who don't have one yet
    // await updatePersonFriends(personal_db, "lk103", []);

    console.log("Updated everyone!")

    await Connection.close();
}

main().catch(console.error);
