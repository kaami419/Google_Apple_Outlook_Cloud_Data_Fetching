// app.js
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const { Strategy: AppleStrategy } = require("passport-apple");
const Sequelize = require("sequelize");
const ejs = require("ejs");
const axios = require("axios");

const app = express();

app.use(express.static("public"));

const sequelize = new Sequelize("apple_contacts", "root", "Password_123", {
  host: "127.0.0.1",
  dialect: "mysql",
});

const User = sequelize.define("User", {
  appleId: Sequelize.STRING,
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

app.use(express.static("public"));
app.use(
  session({
    secret: "hamza_apple_secret",
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.set("view engine", "ejs");

// Passport setup with Apple strategy
passport.use(
  new AppleStrategy(
    {
      clientID: "acf4e3956f8e425c9313f95d3c5ba615",
      teamID: "team-id",
      keyID: "acf4e3956f8e425c9313f95d3c5ba615",
      privateKeyPath: "path-to-my-private-key.p8",
      callbackURL:
        "https://4932-119-155-4-149.ngrok-free.app/auth/apple/callback",
      scope: ["name", "email", "contacts.readonly"],
    },
    async (accessToken, refreshToken, decodedIdToken, profile, done) => {
      try {
        let user = await User.findOne({ where: { appleId: profile.id } });

        if (!user) {
          user = await User.create({
            appleId: profile.id,
            accessToken,
            refreshToken,
          });
        }

        // Use the access token to fetch user's contacts
        const contacts = await fetchUserContacts(accessToken);
        await Contact.bulkCreate(contacts);

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Function to fetch user contacts using Apple People API
async function fetchUserContacts(accessToken) {
  const response = await axios.get(
    "https://api.apple.com/contacts/v1/me/contacts",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const contacts = response.data.contacts.map((contact) => ({
    name: contact.name.fullName,
    email: contact.emailAddresses[0]?.value,
    phoneNumber: contact.phoneNumbers[0]?.value,
  }));

  return contacts;
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findOne({ where: { id: id } })
    .then((user) => done(null, user))
    .catch((error) => done(error, null));
});

app.get("/auth/apple", passport.authenticate("apple"));

app.get(
  "/auth/apple/callback",
  passport.authenticate("apple", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

app.get("/dashboard", async (req, res) => {
  const contacts = await Contact.findAll();
  res.render("dashboard", { contacts });
});

sequelize.sync().then(() => {
  app.listen(3000, () => {
    console.log("Server started on port 3000");
  });
});
