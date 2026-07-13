const app = require('./app');

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ GEU Alumni backend running at http://localhost:${PORT}`);
  if (!process.env.SMTP_USER) {
    console.log('   ✉  SMTP not configured — emails will be logged to console.');
  }
});

