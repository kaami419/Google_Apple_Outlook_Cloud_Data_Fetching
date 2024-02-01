const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const Sequelize = require("sequelize");
const { google } = require("googleapis");
const ejs = require("ejs");
const session = require("express-session");

const app = express();

app.use(express.static("public"));

const sequelize = new Sequelize("google_contacts", "root", "Password_123", {
  host: "127.0.0.1",
  dialect: "mysql",
});

const User = sequelize.define("User", {
  googleId: Sequelize.STRING,
  accessToken: Sequelize.STRING,
  refreshToken: Sequelize.STRING,
});

const Contact = sequelize.define("Contact", {
  name: Sequelize.STRING,
  email: Sequelize.STRING,
  phoneNumber: Sequelize.STRING,
});

User.sync({});
Contact.sync({});

app.use(
  session({
    secret: "hamza_google_secret",
    resave: true,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Configure Passport.js with Google OAuth 2.0 strategy
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "925561091215-v44ofdl3chnje2km8iq853j5ghulknmf.apps.googleusercontent.com",
      clientSecret: "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",
      callbackURL:
        "https://4932-119-155-4-149.ngrok-free.app/auth/google/callback",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ where: { googleId: profile.id } })
        .then(([created, isNewRecord]) => {
          created.accessToken = accessToken;
          created.refreshToken = refreshToken;
          return created.save();
        })
        .then((user) => cb(null, user))
        .catch((err) => cb(err));
    }
  )
);

passport.serializeUser((user, done) => {
  // console.log("user id is", user);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const findUser = User.findOne({ where: { id: id } }).then((user) => {
    done(null, user);
  });
  // console.log("found user is", findUser);
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["https://www.googleapis.com/auth/contacts.readonly", "profile"],
  })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  async (req, res) => {
    const accessToken = req.user.accessToken;

    // Use the Google People API client library to retrieve the user's contacts
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const peopleClient = google.people({
      version: "v1",
      auth: oauth2Client,
    });

    try {
      const response = await peopleClient.people.connections.list({
        resourceName: "people/me",
        pageSize: 100,
        personFields: "names,emailAddresses,phoneNumbers",
      });

      const contacts = response.data.connections.map((connection) => ({
        name:
          connection.names &&
          connection.names[0] &&
          connection.names[0].displayName,
        email:
          connection.emailAddresses &&
          connection.emailAddresses[0] &&
          connection.emailAddresses[0].value,
        phoneNumber:
          connection.phoneNumbers &&
          connection.phoneNumbers[0] &&
          connection.phoneNumbers[0].value,
      }));

      console.log("response is", response.data.connections);

      await Contact.bulkCreate(contacts);
      console.log("Success");

      res.redirect("/dashboard");
    } catch (error) {
      console.error("Error fetching contacts:", error);
      console.log("error", "Error fetching contacts. Please try again.");
      res.redirect("/");
    }
  }
);

app.get("/dashboard", async (req, res) => {
  const contacts = await Contact.findAll();
  res.render("dashboard", { contacts });
});

app.set("view engine", "ejs");

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
