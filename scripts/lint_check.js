const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    for (const f of fs.readdirSync(dir)) {
        if (f === 'node_modules' || f === '.git' || f === 'scratch') continue;
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            results = results.concat(walk(p));
        } else if (p.endsWith('.js')) {
            results.push(p);
        }
    }
    return results;
}

const files = walk('.');
let errors = 0;

for (const file of files) {
    try {
        const code = fs.readFileSync(file, 'utf8');
        new Function(code);
    } catch (err) {
        console.error(`SYNTAX ERROR in ${file}: ${err.message}`);
        errors++;
    }
}

if (errors > 0) {
    console.error(`Lint check failed with ${errors} file error(s).`);
    process.exit(1);
} else {
    console.log(`✓ Lint & Syntax check passed! All ${files.length} JavaScript files parsed cleanly.`);
    process.exit(0);
}
