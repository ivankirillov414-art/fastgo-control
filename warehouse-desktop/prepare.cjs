const fs=require('node:fs'),path=require('node:path');fs.copyFileSync(path.join(__dirname,'../desktop/updates.cjs'),path.join(__dirname,'updates.cjs'));
