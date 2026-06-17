export default {
  // 1. यह हिस्सा आपका HTML पेज दिखाएगा (टेस्टिंग के लिए)
  async fetch(request, env, ctx) {
    const html = `
      <!DOCTYPE html>
      <html lang="hi">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pocket Empire</title>
          <style>
              body { font-family: sans-serif; background-color: #f4f7f6; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
              .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); text-align: center; }
              h1 { color: #2c3e50; }
              p { color: #27ae60; font-weight: bold; }
          </style>
      </head>
      <body>
          <div class="card">
              <h1>Pocket Empire 🚀</h1>
              <p>GitHub के थ्रू HTML टेस्टिंग सफल रही!</p>
          </div>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  },

  // 2. यह खाली हैंडलर क्लाउडफ्लेयर का एरर रोकेगा (इसे फ़ाइल में रखना ज़रूरी है)
  async queue(batch, env, ctx) {
    console.log("Queue triggered in testing mode.");
  }
};
