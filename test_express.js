const express = require('express');
const app = express();
app.get('/pets/:id', (req, res) => res.send('DETAIL: ' + req.params.id));
app.get('/pets/:id/image', (req, res) => res.send('IMAGE: ' + req.params.id));
app.listen(3001, async () => {
  const fetch = require('http');
  fetch.get('http://localhost:3001/pets/1/image', (resp) => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('end', () => { console.log(data); process.exit(0); });
  });
});
