// const express = require("express");
// const passport = require("passport");
// const AppleStrategy = require("passport-apple").Strategy;
// const Sequelize = require("sequelize");
// const mysql = require("mysql2");
// const { ICloud } = require("node-icloud");

// const app = express();

// const sequelize = new Sequelize("google_contacts", "root", "Password_123", {
//   host: "127.0.0.1",
//   dialect: "mysql",
// });

// // Define Contact model
// const Contact = sequelize.define("Contact", {
//   name: Sequelize.STRING,
//   email: Sequelize.STRING,
// });

// // Define User model
// const User = sequelize.define("User", {
//   appleId: Sequelize.STRING,
//   accessToken: Sequelize.STRING,
//   refreshToken: Sequelize.STRING,
// });

// // Configure Passport.js with Apple OAuth 2.0 strategy
// passport.use(
//   new AppleStrategy(
//     {
//       clientID: "your_client_id",
//       clientSecret: "your_client_secret",
//       callbackURL: "http://localhost:3000/auth/apple/callback",
//     },
//     function (accessToken, refreshToken, profile, cb) {
//       User.findOrCreate({ where: { appleId: profile.id } })
//         .then(([user, created]) => cb(null, user))
//         .catch((err) => cb(err));
//     }
//   )
// );

// // Set up authentication routes
// app.get(
//   "/auth/apple",
//   passport.authenticate("apple", { scope: ["name", "email"] })
// );
// app.get("/auth/apple/callback", passport.authenticate("apple"), async (req, res) => {
//   // Extract access token and refresh token from the authenticated user
//   const accessToken = req.user.accessToken;
//   const refreshToken = req.user.refreshToken;

//   // Create a new iCloud API client
//   const iCloudClient = new ICloud({
//     apple_id: "your_apple_id",
//     password: "your_password",
//     client_id: "your_client_id",
//     client_secret: "your_client_secret",
//   });

//   // Authenticate the iCloud API client
//   await iCloudClient.login();

//   const contacts = await iCloudClient.fetchContacts();

//   const contactData = contacts.map((contact) => {
//     return {
//       name: contact.fullName,
//       email: contact.emails[0].value,
//     };
//   });

//   const transaction = await sequelize.transaction();

//   try {
//     await Contact.bulkCreate(contactData, { transaction });

//     await transaction.commit();

//     res.redirect("/dashboard");
//   } catch (err) {
//     await transaction.rollback();

//     console.error(err);
//   }
// });

// app.get("/dashboard", (req, res) => {

//   res.render("dashboard");
// });

// app.listen(3000, () => {
//   console.log("Server started on port 3000");
// });

// ==================================================OUTLOOK===================================================================================//
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const {
  Strategy: MicrosoftGraphStrategy,
} = require("@microsoft/microsoft-graph-client");
const Sequelize = require("sequelize");
const ejs = require("ejs");
const axios = require("axios");

const app = express();

// Database setup
const sequelize = new Sequelize("outlook_contacts", "root", "Password_123", {
  host: "127.0.0.1",
  dialect: "mysql",
});

const User = sequelize.define("User", {
  outlookId: Sequelize.STRING,
  accessToken: Sequelize.STRING,
  refreshToken: Sequelize.STRING,
});

const Contact = sequelize.define("Contact", {
  name: Sequelize.STRING,
  email: Sequelize.STRING,
  phoneNumber: Sequelize.STRING,
});

User.sync({ force: true });
Contact.sync({ force: true });

app.use(express.static("public"));
app.use(
  session({
    secret: "hamza_outlook_secret",
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.set("view engine", "ejs");

// Update clientID and clientSecret with your Entra ID (Azure AD) application details
passport.use(
  new MicrosoftGraphStrategy(
    {
      clientID: "your-entra-id-client-id",
      clientSecret: "your-entra-id-client-secret",
      callbackURL: "https://your-callback-url/auth/outlook/callback",
      scope: ["user.read", "contacts.read"],
    },
    (accessToken, refreshToken, profile, done) => {
      fetchUserContacts(accessToken)
        .then((contacts) => {
          return Contact.bulkCreate(contacts);
        })
        .then(() => {
          return done(null, profile);
        })
        .catch((error) => {
          return done(error, null);
        });
    }
  )
);

async function fetchUserContacts(accessToken) {
  const response = await axios.get(
    "https://graph.microsoft.com/v1.0/me/contacts",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const contacts = response.data.value.map((contact) => ({
    name: contact.displayName,
    email: contact.emailAddresses[0]?.address,
    phoneNumber: contact.phoneNumbers[0]?.number,
  }));

  return contacts;
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => done(null, user))
    .catch((error) => done(error, null));
});

// Update the route for Microsoft Entra ID authentication
app.get("/auth/outlook", passport.authenticate("oauth-bearer"));

// Update the callback route for Microsoft Entra ID authentication
app.get(
  "/auth/outlook/callback",
  passport.authenticate("oauth-bearer", { failureRedirect: "/" }),
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

//  =================================================OUTLOOK===================================================================================//
