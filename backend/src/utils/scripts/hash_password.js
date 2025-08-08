const bcrypt = require("bcrypt");

const password = "root"; // Das gewünschte Passwort für den root-Benutzer
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error("Fehler beim Hashen des Passworts:", err);
  } else {
    console.info("Gehashtes Passwort:", hash);
  }
});
