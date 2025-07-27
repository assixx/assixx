#!/usr/bin/env node

// Script to fix all user_teams inserts to include tenant_id

/* eslint-env node */
/* global __dirname, console */
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "../backend/src/routes/__tests__/teams-v2.test.ts",
);
let content = fs.readFileSync(filePath, "utf8");

// Fix single inserts
content = content.replace(
  /"INSERT INTO user_teams \(user_id, team_id\) VALUES \(\?, \?\)"/g,
  '"INSERT INTO user_teams (user_id, team_id, tenant_id) VALUES (?, ?, ?)"',
);

// Fix double inserts
content = content.replace(
  /"INSERT INTO user_teams \(user_id, team_id\) VALUES \(\?, \?\), \(\?, \?\)"/g,
  '"INSERT INTO user_teams (user_id, team_id, tenant_id) VALUES (?, ?, ?), (?, ?, ?)"',
);

// Fix the parameters arrays for single inserts
content = content.replace(
  /\[employeeUser\.id, team1Id\],/g,
  "[employeeUser.id, team1Id, tenant1Id],",
);

content = content.replace(
  /\[employeeUser\.id, teamToDeleteId\],/g,
  "[employeeUser.id, teamToDeleteId, tenant1Id],",
);

// Fix the parameters arrays for double inserts
content = content.replace(
  /\[employeeUser\.id, team1Id, adminUser\.id, team1Id\],/g,
  "[employeeUser.id, team1Id, tenant1Id, adminUser.id, team1Id, tenant1Id],",
);

// Write back the modified content
fs.writeFileSync(filePath, content);

console.log("user_teams inserts fixed to include tenant_id");
