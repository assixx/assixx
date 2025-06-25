# 🔒 Production Security Checklist für Assixx

## JWT Secret Configuration

### ⚠️ KRITISCH: JWT_SECRET

1. **Generiere ein sicheres Secret** (mindestens 32 Zeichen):

   ```bash
   openssl rand -base64 32
   ```

2. **Update die .env Datei**:

   ```env
   # NIEMALS das Beispiel-Secret in Produktion verwenden!
   JWT_SECRET=<dein-generiertes-secret-hier>
   ```

3. **Beispiel für sicheres Secret**:
   ```env
   JWT_SECRET=QTZHLkeMTNXwPF2JdKxrTu+2LRFhkzSFYRNt22+lQdY=
   ```

### Warum ist das wichtig?

- **JWT Tokens** werden verwendet um Benutzer zu authentifizieren
- Mit dem Secret kann jeder gültige Tokens erstellen
- Ein kompromittiertes Secret = Vollzugriff auf alle Accounts

### Best Practices:

1. **Unterschiedliche Secrets** für Dev/Staging/Prod
2. **Rotiere Secrets** regelmäßig (z.B. alle 3-6 Monate)
3. **Speichere Secrets sicher** (z.B. in einem Secret Manager)
4. **Niemals committen** - .env sollte in .gitignore sein
5. **Mindestlänge**: 32+ Zeichen, besser 64

### Weitere Sicherheits-Checks:

- [ ] SESSION_SECRET ebenfalls ändern
- [ ] Datenbank-Passwörter ändern
- [ ] SMTP Credentials sicher konfigurieren
- [ ] HTTPS in Produktion aktiviert
- [ ] Rate Limiting aktiviert
- [ ] CORS richtig konfiguriert
