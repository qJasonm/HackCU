import dotenv from 'dotenv';
dotenv.config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    console.error('Please set your GEMINI_API_KEY in the .env file first!');
    return;
  }

  // A tiny valid 1x1 white transparent PNG base64 string to act as the dummy image payload
  const dummyBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  const payload = {
    contents: [{
      parts: [
        { text: "Create a picture of a cat eating a nano-banana in a fancy restaurant" },
        {
          inline_data: {
            mime_type: "image/png",
            data: dummyBase64
          }
        }
      ]
    }]
  };

  console.log('Sending request to Gemini API...');
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error ${response.status}:`, errorText);
      return;
    }

    const data = await response.json();
    console.log('\n--- FULL API RESPONSE ---');
    console.log(JSON.stringify(data, null, 2));
    
    // Check what kind of output we got
    const parts = data?.candidates?.[0]?.content?.parts || [];
    parts.forEach((part, index) => {
      if (part.text) {
        console.log(`\nPart [${index}] contains TEXT:`);
        console.log(part.text.substring(0, 100) + '...');
      } else if (part.inline_data || part.inlineData) {
        console.log(`\nPart [${index}] contains an IMAGE (Base64 data)!`);
      } else if (part.executableCode || part.codeExecutionResult) {
         console.log(`\nPart [${index}] contains execution code/result.`);
      } else {
        console.log(`\nPart [${index}] contains something else:`, Object.keys(part));
      }
    });

  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

testGemini();
