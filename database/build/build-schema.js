#!/usr/bin/env node

/**
 * Build-Script für Datenbank-Schema
 * Kombiniert alle modularen Schema-Dateien zu einer complete-schema.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basis-Verzeichnis
const baseDir = path.join(__dirname, '..');
const schemaDir = path.join(baseDir, 'schema');
const outputFile = path.join(baseDir, 'complete-schema.sql');

// Header für die generierte Datei
const header = `-- =====================================================
-- Assixx Complete Database Schema
-- Generated: ${new Date().toISOString()}
-- =====================================================
-- Diese Datei wurde automatisch generiert.
-- Änderungen bitte in den Modul-Dateien vornehmen!
-- =====================================================

`;

// Funktion zum Lesen und Sortieren von Dateien
function getFiles(dir, pattern = /\.sql$/) {
  const files = [];
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (pattern.test(item)) {
        files.push(fullPath);
      }
    });
  }
  
  walk(dir);
  return files.sort();
}

// Funktion zum Kombinieren der Dateien
function buildCompleteSchema() {
  console.log('🔨 Building complete database schema...');
  
  let content = header;
  
  // Definiere die Reihenfolge der Verzeichnisse
  const directories = [
    '00-core',
    '01-features', 
    '02-modules',
    '03-views'
  ];
  
  directories.forEach(dir => {
    const dirPath = path.join(schemaDir, dir);
    
    if (!fs.existsSync(dirPath)) {
      console.warn(`⚠️  Directory not found: ${dir}`);
      return;
    }
    
    content += `\n-- =====================================================\n`;
    content += `-- ${dir.toUpperCase()}\n`;
    content += `-- =====================================================\n\n`;
    
    const files = getFiles(dirPath);
    
    files.forEach(file => {
      const relativePath = path.relative(schemaDir, file);
      console.log(`  ✅ Adding: ${relativePath}`);
      
      content += `-- -----------------------------------------------------\n`;
      content += `-- Source: ${relativePath}\n`;
      content += `-- -----------------------------------------------------\n\n`;
      
      const fileContent = fs.readFileSync(file, 'utf8');
      content += fileContent;
      content += '\n\n';
    });
  });
  
  // Schreibe die kombinierte Datei
  fs.writeFileSync(outputFile, content);
  
  // Zeige Statistiken
  const stats = fs.statSync(outputFile);
  const sizeKB = (stats.size / 1024).toFixed(2);
  const lineCount = content.split('\n').length;
  
  console.log('\n✨ Build completed successfully!');
  console.log(`📄 Output: ${path.relative(baseDir, outputFile)}`);
  console.log(`📊 Size: ${sizeKB} KB`);
  console.log(`📏 Lines: ${lineCount}`);
}

// Script ausführen
try {
  buildCompleteSchema();
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}