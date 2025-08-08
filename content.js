// content.js

let isDialogVisible = false;
let hoverTimeout = null;

// --- Custom Dialog ---

function utf8ByteIndexToUtf16CharIndex(str, utf8ByteIndex) {
    let byteIndex = 0;
    let charIndex = 0;
    for (charIndex = 0; charIndex < str.length; charIndex++) {
        if (byteIndex >= utf8ByteIndex) {
            return charIndex;
        }
        const charCode = str.charCodeAt(charIndex);
        if (charCode < 0x0080) {
            byteIndex += 1;
        } else if (charCode < 0x0800) {
            byteIndex += 2;
        } else if (charCode < 0xD800 || charCode >= 0xE000) {
            byteIndex += 3;
        } else {
            // Surrogate pair
            byteIndex += 4;
            charIndex++; // Skip the second part of the pair
        }
    }
    if (byteIndex === utf8ByteIndex) {
        return str.length;
    }
    return str.length;
}

function highlightText(text, spanScores) {
  if (!spanScores || spanScores.length === 0) {
    return text;
  }

  let highlightedText = "";
  let lastIndex = 0;

  // Sort spans by their beginning index to process them in order
  spanScores.sort((a, b) => a.begin - b.begin);

  spanScores.forEach(span => {
    const begin = utf8ByteIndexToUtf16CharIndex(text, span.begin);
    const end = utf8ByteIndexToUtf16CharIndex(text, span.end);

    console.log(`Highlighting from ${begin} to ${end} with score ${span.score.value}`);
    // Append the text from the last index to the beginning of the current span
    highlightedText += text.substring(lastIndex, begin);

    // Append the highlighted span
    const spanText = text.substring(begin, end);
    const toxicity = span.score.value;
    // Make the background color proportional to the toxicity score
    // Use a red color for high toxicity, yellow for medium, and green for low
    // The color intensity is based on the toxicity score (0 to 1)
    let color;
    if (toxicity >= 0.6) {
      // High toxicity, use red
      color = `rgba(255, 0, 0, 200)`;
    } else if (toxicity >= 0.4) {
      // Medium toxicity, use yellow
      color = `rgba(255, 255, 0, 200)`;
    } else {
      // Low toxicity, use green
      color = `rgba(0, 255, 0, 200)`;
    }
    highlightedText += `<span style="background-color: ${color};">${spanText}</span>`;

    lastIndex = end;
  });

  // Append the remaining text after the last span
  highlightedText += text.substring(lastIndex);

  return highlightedText;
}


function showConfirmationDialog(score, text, spanScores, form, button) {
  if (isDialogVisible) return;
  isDialogVisible = true;

  const existingDialog = document.getElementById('gemini-dialog-overlay');
  if (existingDialog) existingDialog.remove();

  const cssLink = document.createElement('link');
  cssLink.href = chrome.runtime.getURL('dialog.css');
  cssLink.rel = 'stylesheet';
  cssLink.type = 'text/css';
  document.head.appendChild(cssLink);

  const overlay = document.createElement('div');
  overlay.id = 'gemini-dialog-overlay';

  const dialog = document.createElement('div');
  dialog.id = 'gemini-dialog';
  const highlightedText = highlightText(text, spanScores);
  dialog.innerHTML = `
    <h3>Review Your Comment</h3>
    <p class="toxicity-score">Toxicity Score: ${Math.round(score * 100)}%</p>
    <blockquote style="white-space: pre-wrap;">${highlightedText}</blockquote>
    <p>Are you sure you want to post this?</p>
    <div id="gemini-dialog-buttons">
      <button id="gemini-dialog-no">Cancel</button>
      <button id="gemini-dialog-yes">Post Anyway</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const yesButton = document.getElementById('gemini-dialog-yes');
  const toxicityPercentage = score * 100;

  let yesButtonColor, yesButtonHoverColor;

  if (toxicityPercentage > 60) {
    yesButtonColor = '#dc3545'; // red
    yesButtonHoverColor = '#c82333';
    yesButton.style.color = 'white';
  } else if (toxicityPercentage >= 40) {
    yesButtonColor = '#ffc107'; // yellow
    yesButtonHoverColor = '#e0a800';
    yesButton.style.color = 'black';
  } else {
    yesButtonColor = '#28a745'; // green
    yesButtonHoverColor = '#218838';
    yesButton.style.color = 'white';
  }

  yesButton.style.backgroundColor = yesButtonColor;

  yesButton.addEventListener('mouseenter', () => {
    yesButton.style.backgroundColor = yesButtonHoverColor;
  });
  yesButton.addEventListener('mouseleave', () => {
    yesButton.style.backgroundColor = yesButtonColor;
  });

  const cleanup = () => {
    overlay.remove();
    cssLink.remove();
    isDialogVisible = false;
  };

  yesButton.addEventListener('click', () => {
    cleanup();
    if (form) {
      form.dataset.geminiSubmit = 'true';
      form.submit();
    } else if (button) {
      button.dataset.geminiSubmit = 'true';
      button.click();
    }
  });

  document.getElementById('gemini-dialog-no').addEventListener('click', cleanup);
}

// --- Mock Perspective API Support ---

// Toggle this to true to use mock data instead of real API calls
const USE_PERSPECTIVE_MOCK = false;

// Example mock texts and scores
const MOCK_RESPONSES = [
  {
    text: "You are awesome and I hope you have a great day! You're doing a fantastic job. Keep it up!",
    summaryScore: 0.01,
    spanScores: []
  },
  {
    text: "I don't agree with you, but that's okay. We can have different opinions. That's what makes discussions interesting.",
    summaryScore: 0.10,
    spanScores: []
  },
  {
    text: "I don't agree with you, but that's okay. We can have different opinions. But don't talk back to me.",
    summaryScore: 0.45,
    spanScores: [{ begin: 60, end: 70, score: { value: 0.45 }}]
  },
  {
    text: "That was a stupid thing to say. I can't believe you would even think that. What were you thinking?",
    summaryScore: 0.65,
    spanScores: [
      { begin: 13, end: 33, score: { value: 0.65 } }
    ]
  },
  {
    text: "You're an idiot and nobody likes you. You should just go away. You're a waste of space.",
    summaryScore: 0.92,
    spanScores: [
      { begin: 10, end: 15, score: { value: 0.85 } },
      { begin: 20, end: 36, score: { value: 0.92 } }
    ]
  },
  {
    text: "Go away, nobody wants you here.",
    summaryScore: 0.80,
    spanScores: [
      { begin: 8, end: 33, score: { value: 0.80 } }
    ]
  }
];

// Utility to get a random mock response
function getRandomMockResponse(inputText) {
  // Pick a random mock, but replace the text with the user's input
  const mock = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
  // Optionally, you could match the mock to the inputText for more realism
  return {
    summaryScore: mock.summaryScore,
    spanScores: mock.spanScores,
    text: mock.text,
  };
}

// --- Core Logic ---

function processAction(form, button, isHover) {
  if (isDialogVisible) return;

  const textScope = form || document.body;
  let text = '';

  const textInputs = Array.from(textScope.querySelectorAll('textarea, [contenteditable="true"], input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]):not([type="radio"]):not([type="checkbox"])'))
    .filter(el => el.offsetParent !== null && (el.value || el.innerText).trim().length > 0);

  if (textInputs.length === 0) return;

  const textInput = textInputs.reduce((prev, current) => (prev.offsetTop > current.offsetTop) ? prev : current);
  text = textInput.value || textInput.innerText;

  if (text.length > 0) {
    if (USE_PERSPECTIVE_MOCK) {
      // Use mock data
      //setTimeout(() => {
        const mockResponse = getRandomMockResponse(trimmedText);
        showConfirmationDialog(
          mockResponse.summaryScore,
          mockResponse.text,
          mockResponse.spanScores,
          form,
          button
        );
      //}, 300); // Simulate network delay
    } else {
      // Real API call
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const context = sentences.map(sentence => ({ text: sentence, type: "PLAIN_TEXT" }));

      chrome.runtime.sendMessage({ action: "processText", text: text, context: context }, (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          return;
        }
        if (response && response.summaryScore) {
          // Check again that the hover is still active before showing the dialog
          if (isHover && !hoverTimeout) return;
          console.log("Perspective API response:", response);
          showConfirmationDialog(response.summaryScore, text, response.spanScores, form, button);
        } else if (response && response.error) {
          showConfirmationDialog(0, response.error, [], form, button);
          console.error("Perspective API error:", response.error);
        }
      });
    }
  }
}


// --- Icon & Event Listeners ---

const icon = document.createElement('img');
icon.src = chrome.runtime.getURL('social_betterment_logo.svg');
icon.style.position = 'absolute';
icon.style.zIndex = '9999';
icon.style.display = 'none';
icon.style.width = '180px';
icon.style.height = '24px';
document.body.appendChild(icon);

function showIcon(element) {
  const rect = element.getBoundingClientRect();
  icon.style.display = 'block';
  icon.style.top = `${window.scrollY + rect.top}px`;
  icon.style.left = `${window.scrollX + rect.right + 5}px`;
}

function hideIcon() {
  icon.style.display = 'none';
  clearTimeout(hoverTimeout);
  hoverTimeout = null;
}

function addListenersToButton(button) {
  // Use 'mouseenter' instead of 'mouseover'
  button.addEventListener('mouseover', () => {
    if (button.dataset.geminiSubmit) return;
    showIcon(button);
    hoverTimeout = setTimeout(() => {
        const form = button.closest('form');
        processAction(form, button, true);
    }, 500);
  });

  // Use 'mouseleave' instead of 'mouseout'
  button.addEventListener('mouseout', hideIcon);
}

function setupListeners(rootNode) {
  rootNode.querySelectorAll('input[type="submit"], button[type="submit"]').forEach(button => {
    if (!button.dataset.geminiListener) {
      addListenersToButton(button);
      button.dataset.geminiListener = 'true';
    }
  });
}

document.addEventListener('submit', function(event) {
  const form = event.target;
  if (form.dataset.geminiSubmit) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  const submitter = event.submitter || form.querySelector('input[type="submit"], button[type="submit"]');
  processAction(form, submitter, false);
}, true);

// --- MutationObserver ---

const observer = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          setupListeners(node);
        }
      });
    }
  }
});

setupListeners(document.body);
observer.observe(document.body, { childList: true, subtree: true });

