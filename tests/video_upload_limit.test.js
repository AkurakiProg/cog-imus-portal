const assert = require('assert');
const upload = require('../middleware/uploadMiddleware');

console.log('--- Testing 100 MB Video Upload Middleware Limits ---');

assert.strictEqual(upload.video.limits.fileSize, 100 * 1024 * 1024, 'Video fileSize limit must be exactly 100 MB');
console.log('✓ Video fileSize limit is configured to exactly 100 MB (104,857,600 bytes)');

// Test fileFilter accepts mp4, webm, mov, ogv
const validFiles = [
    { mimetype: 'video/mp4', originalname: 'worship-service.mp4' },
    { mimetype: 'video/webm', originalname: 'church-drone.webm' },
    { mimetype: 'video/quicktime', originalname: 'hero-cam.mov' },
    { mimetype: 'video/ogg', originalname: 'promo.ogv' }
];

for (const f of validFiles) {
    upload.video.fileFilter(null, f, (err, accepted) => {
        assert.ifError(err);
        assert.strictEqual(accepted, true);
    });
}
console.log('✓ Supported video MIME types & extensions are accepted');

// Test fileFilter rejects invalid file types (e.g. exe, php, pdf, mp3)
const invalidFiles = [
    { mimetype: 'application/x-msdownload', originalname: 'virus.exe' },
    { mimetype: 'application/pdf', originalname: 'document.pdf' },
    { mimetype: 'audio/mpeg', originalname: 'audio.mp3' },
    { mimetype: 'text/html', originalname: 'script.html' }
];

for (const f of invalidFiles) {
    upload.video.fileFilter(null, f, (err, accepted) => {
        assert(err instanceof Error, 'Invalid file should return an error');
        assert.strictEqual(accepted, undefined);
    });
}
console.log('✓ Invalid file formats are properly rejected');
console.log('--- Video Upload Limit Validation Passed Successfully ---');
