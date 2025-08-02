#!/usr/bin/env node
/* eslint-env node */
/* global __dirname, console */

const fs = require("fs");
const path = require("path");

// OpenAPI spec laden
const openapiPath = path.join(__dirname, "../docs/current-openapi-spec.json");
const openapi = JSON.parse(fs.readFileSync(openapiPath, "utf8"));

// Basis Postman Collection Structure
const postmanCollection = {
  info: {
    name: openapi.info.title,
    description: openapi.info.description,
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: {
    type: "bearer",
    bearer: [
      {
        key: "token",
        value: "{{authToken}}",
        type: "string",
      },
    ],
  },
  variable: [
    {
      key: "baseUrl",
      value: "http://localhost:3000/api",
      type: "string",
    },
    {
      key: "authToken",
      value: "",
      type: "string",
    },
  ],
  item: [],
};

// Ordner für verschiedene API-Bereiche
const folders = {
  auth: { name: "Authentication", item: [] },
  users: { name: "Users", item: [] },
  departments: { name: "Departments", item: [] },
  teams: { name: "Teams", item: [] },
  calendar: { name: "Calendar", item: [] },
  chat: { name: "Chat", item: [] },
  documents: { name: "Documents", item: [] },
  shifts: { name: "Shifts", item: [] },
  blackboard: { name: "Blackboard", item: [] },
  kvp: { name: "KVP", item: [] },
  surveys: { name: "Surveys", item: [] },
};

// Konvertiere OpenAPI paths zu Postman requests
Object.entries(openapi.paths || {}).forEach(([path, methods]) => {
  Object.entries(methods).forEach(([method, operation]) => {
    if (["get", "post", "put", "delete", "patch"].includes(method)) {
      // Bestimme den Folder basierend auf dem Path
      let folderKey = "auth"; // default
      for (const key of Object.keys(folders)) {
        if (path.includes(`/${key}`)) {
          folderKey = key;
          break;
        }
      }

      // Erstelle Postman Request
      const request = {
        name: operation.summary || `${method.toUpperCase()} ${path}`,
        request: {
          method: method.toUpperCase(),
          header: [],
          url: {
            raw: `{{baseUrl}}${path}`,
            host: ["{{baseUrl}}"],
            path: path.split("/").filter((p) => p),
          },
        },
      };

      // Auth Header (wenn nicht public)
      if (path !== "/auth/login" && path !== "/auth/signup") {
        request.request.auth = {
          type: "bearer",
          bearer: [
            {
              key: "token",
              value: "{{authToken}}",
              type: "string",
            },
          ],
        };
      }

      // Request Body für POST/PUT
      if (["post", "put", "patch"].includes(method) && operation.requestBody) {
        const content = operation.requestBody.content;
        if (content && content["application/json"]) {
          const schema = content["application/json"].schema;
          let exampleBody = {};

          // Generiere Beispiel-Body aus Schema
          if (schema && schema.properties) {
            Object.entries(schema.properties).forEach(([key, prop]) => {
              if (prop.example !== undefined) {
                exampleBody[key] = prop.example;
              } else if (prop.type === "string") {
                exampleBody[key] = `sample_${key}`;
              } else if (prop.type === "integer") {
                exampleBody[key] = 1;
              } else if (prop.type === "boolean") {
                exampleBody[key] = false;
              } else if (prop.type === "array") {
                exampleBody[key] = [];
              }
            });
          }

          request.request.body = {
            mode: "raw",
            raw: JSON.stringify(exampleBody, null, 2),
            options: {
              raw: {
                language: "json",
              },
            },
          };

          request.request.header.push({
            key: "Content-Type",
            value: "application/json",
          });
        }
      }

      // Path Parameter
      const pathParams = path.match(/{([^}]+)}/g);
      if (pathParams) {
        request.request.url.variable = pathParams.map((param) => ({
          key: param.slice(1, -1),
          value: "",
        }));
      }

      // Query Parameter
      if (operation.parameters) {
        const queryParams = operation.parameters.filter(
          (p) => p.in === "query",
        );
        if (queryParams.length > 0) {
          request.request.url.query = queryParams.map((param) => ({
            key: param.name,
            value: param.example || "",
            disabled: !param.required,
          }));
        }
      }

      // Füge Request zum entsprechenden Folder hinzu
      folders[folderKey].item.push(request);
    }
  });
});

// Füge Folders zur Collection hinzu
Object.values(folders).forEach((folder) => {
  if (folder.item.length > 0) {
    postmanCollection.item.push(folder);
  }
});

// Login Request als Pre-request Script
const loginFolder = folders.auth;
const loginRequest = loginFolder.item.find((r) => r.name.includes("login"));
if (loginRequest) {
  loginRequest.event = [
    {
      listen: "test",
      script: {
        type: "text/javascript",
        exec: [
          "// Save auth token from login response",
          "if (pm.response.code === 200) {",
          "    const response = pm.response.json();",
          "    if (response.token) {",
          "        pm.collectionVariables.set('authToken', response.token);",
          "        console.log('Auth token saved!');",
          "    }",
          "}",
        ],
      },
    },
  ];
}

// Speichere Collection
const outputPath = path.join(
  __dirname,
  "../docs/assixx-api.postman_collection.json",
);
fs.writeFileSync(outputPath, JSON.stringify(postmanCollection, null, 2));

console.log(`✅ Postman Collection generated: ${outputPath}`);
console.log(`📊 Stats:`);
console.log(
  `   - Total Endpoints: ${Object.values(folders).reduce((sum, f) => sum + f.item.length, 0)}`,
);
console.log(
  `   - API Groups: ${Object.values(folders).filter((f) => f.item.length > 0).length}`,
);
console.log(`\n🚀 Import in Postman:`);
console.log(`   1. Open Postman`);
console.log(`   2. Click 'Import' button`);
console.log(`   3. Select file: ${outputPath}`);
console.log(`   4. Set environment variable 'baseUrl' to your API URL`);
