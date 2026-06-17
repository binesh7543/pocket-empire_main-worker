export default {
  async fetch(request, env, ctx) {
    // सुंदर और आधुनिक वेलकम मैसेज का HTML स्ट्रक्चर
    const html = `
    <!DOCTYPE html>
    <html lang="hi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pocket Empire — Main Engine Trial</title>
        <style>

        
            body {
                font-family: 'Segoe UI', system-ui, sans-serif;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #f8fafc;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                text-align: center;
            }
            .container {
                background: rgba(30, 41, 59, 0.7);
                padding: 40px 30px;
                border-radius: 16px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                max-width: 450px;
                width: 85%;
            }
            h1 {
                color: #3b82f6;
                font-size: 2.3rem;
                margin: 0 0 15px 0;
                letter-spacing: 0.5px;
            }
            p {
                color: #94a3b8;
                font-size: 1.05rem;
                line-height: 1.6;
                margin: 10px 0;
            }
            .status {
                display: inline-block;
                margin-top: 25px;
                padding: 6px 16px;
                background-color: rgba(34, 197, 94, 0.15);
                color: #4ade80;
                border-radius: 20px;
                font-weight: 600;
                font-size: 0.85rem;
                letter-spacing: 0.5px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Pocket Empire</h1>
            <p><strong>Main Engine (Trial Version)</strong> सफलतापूर्वक काम कर रहा है!</p>
            <p>यह वर्कर आपके गिटहब (GitHub) और क्लाउडफ्लेयर के ऑटोमैटिक कनेक्शन के साथ लाइव हो चुका है।</p>
            <div class="status">● System Active & Connected</div>
        </div>
    </body>
    </html>
    `;

    // ब्राउज़र को HTML फॉर्मेट में रिस्पॉन्स भेजना
    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
      },
    });
  },
};

