const bcrypt = require('bcrypt');

const password = 'root'; // Das gewünschte Passwort für den root-Benutzer
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error('Fehler beim Hashen des Passworts:', err);
    } else {
        console.log('Gehashtes Passwort:', hash);
    }
});