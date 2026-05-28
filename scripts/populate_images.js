require('dotenv').config();
const db = require('../src/backend/config/db');
const https = require('https');
const { URL } = require('url');

function fetchImage(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, urlStr).toString();
        return resolve(fetchImage(redirectUrl));
      }
      if (res.statusCode !== 200) {
        return reject(new Error('Failed to fetch image: ' + res.statusCode));
      }
      const data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve({
        buffer: Buffer.concat(data),
        mimeType: res.headers['content-type']
      }));
    }).on('error', reject);
  });
}

async function populate() {
  try {
    const pets = await db.query('SELECT id, name, species FROM pets');
    for (const pet of pets.rows) {
      console.log(`Fetching image for ${pet.name} (${pet.species})...`);
      const url = `https://loremflickr.com/400/400/${pet.species}?lock=${pet.id}`;
      const { buffer, mimeType } = await fetchImage(url);
      await db.query('UPDATE pets SET image_data = $1, image_mime_type = $2 WHERE id = $3', [buffer, mimeType, pet.id]);
      console.log(`Updated ${pet.name} successfully.`);
    }
    console.log('All images updated.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
populate();
