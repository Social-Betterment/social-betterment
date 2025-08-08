// background.js

const PERSPECTIVE_API_KEY = 'YOUR_PERSPECTIVE_API_KEY'; // Replace with your actual API key

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processText") {
    fetch('https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=' + PERSPECTIVE_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
        comment: { text: request.text },
        context: { entries: request.context },
        languages: ['en'],
        requestedAttributes: { TOXICITY: {} },
        doNotStore: true
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.attributeScores) {
        sendResponse(
          {
            summaryScore: data.attributeScores.TOXICITY.summaryScore.value,
            spanScores: data.attributeScores.TOXICITY.spanScores,
            text: request.text
          }
        );
      } else {
        sendResponse({ error: "Could not analyze text." });
      }
    })
    .catch(error => {
      console.error('Error:', error);
      sendResponse({ error: "Could not analyze text." });
    });
  }
  return true; // Indicates that the response is sent asynchronously
});